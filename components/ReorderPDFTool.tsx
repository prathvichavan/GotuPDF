"use client";

import { useEffect, useRef, useState } from "react";
import DragDropUpload from "./DragDropUpload";
import * as pdfjsLib from "pdfjs-dist";
import { buildDownloadName, splitFileName } from "@/lib/fileName";

type Status = "idle" | "uploading" | "reordering" | "success" | "error";

const MAX_FILE_SIZE_MB = 50;

if (typeof window !== "undefined") {
 pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}

interface PagePreview {
 pageNumber: number;
 dataUrl: string;
}

function parseFileNameFromDisposition(disposition: string | null) {
 if (!disposition) return null;
 const match = disposition.match(/filename="?([^"]+)"?/i);
 return match?.[1] || null;
}

export default function ReorderPDFTool() {
 const [file, setFile] = useState<File | null>(null);
 const [totalPages, setTotalPages] = useState(0);
 const [pages, setPages] = useState<PagePreview[]>([]);
 const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
 const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
 const [status, setStatus] = useState<Status>("idle");
 const [progress, setProgress] = useState(0);
 const [previewProgress, setPreviewProgress] = useState(0);
 const [isPreviewing, setIsPreviewing] = useState(false);
 const [errorMessage, setErrorMessage] = useState<string | null>(null);
 const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
 const [downloadName, setDownloadName] = useState<string>("reordered.pdf");
 const [downloadBaseName, setDownloadBaseName] = useState<string>("reordered");
 const [downloadExtension, setDownloadExtension] = useState<string>(".pdf");
 const xhrRef = useRef<XMLHttpRequest | null>(null);

 const isBusy = status === "uploading" || status === "reordering" || isPreviewing;

 useEffect(() => {
 return () => {
 if (downloadUrl) {
 URL.revokeObjectURL(downloadUrl);
 }
 xhrRef.current?.abort();
 };
 }, [downloadUrl]);

 const reset = () => {
 if (downloadUrl) {
 URL.revokeObjectURL(downloadUrl);
 }
 setFile(null);
 setTotalPages(0);
 setPages([]);
 setDraggingIndex(null);
 setDragOverIndex(null);
 setStatus("idle");
 setProgress(0);
 setPreviewProgress(0);
 setIsPreviewing(false);
 setErrorMessage(null);
 setDownloadUrl(null);
 setDownloadName("reordered.pdf");
 setDownloadBaseName("reordered");
 setDownloadExtension(".pdf");
 };

 const validateFile = (selectedFile: File) => {
 if (!selectedFile.name.toLowerCase().endsWith(".pdf")) {
 return "Please upload a PDF file.";
 }
 if (selectedFile.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
 return `File too large. Max size is ${MAX_FILE_SIZE_MB}MB.`;
 }
 return null;
 };

 const handleFileSelect = (selectedFiles: File[]) => {
 const selectedFile = selectedFiles[0];
 if (!selectedFile) return;

 const validationError = validateFile(selectedFile);
 if (validationError) {
 setErrorMessage(validationError);
 setFile(null);
 return;
 }

 if (downloadUrl) {
 URL.revokeObjectURL(downloadUrl);
 }
 setFile(selectedFile);
 setErrorMessage(null);
 setStatus("idle");
 setProgress(0);
 setPages([]);
 setTotalPages(0);
 setPreviewProgress(0);
 setDownloadUrl(null);
 setDownloadName("reordered.pdf");
 setDownloadBaseName("reordered");
 setDownloadExtension(".pdf");

 loadPreviews(selectedFile);
 };

 const loadPreviews = async (selectedFile: File) => {
 setIsPreviewing(true);
 setPreviewProgress(0);
 setErrorMessage(null);

 try {
 const arrayBuffer = await selectedFile.arrayBuffer();
 const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
 const pdf = await loadingTask.promise;
 const total = pdf.numPages;
 setTotalPages(total);

 const previews: PagePreview[] = [];
 for (let pageNum = 1; pageNum <= total; pageNum++) {
 const page = await pdf.getPage(pageNum);
 const viewport = page.getViewport({ scale: 0.35 });
 const canvas = document.createElement("canvas");
 const context = canvas.getContext("2d");
 if (!context) throw new Error("Unable to render PDF preview.");

 canvas.width = viewport.width;
 canvas.height = viewport.height;

 await page.render({ canvasContext: context, viewport }).promise;
 const dataUrl = canvas.toDataURL("image/png");
 previews.push({ pageNumber: pageNum, dataUrl });
 setPreviewProgress(Math.round((pageNum / total) * 100));
 }

 setPages(previews);
 } catch (error) {
 setErrorMessage(
 error instanceof Error ? error.message : "Failed to render PDF previews."
 );
 } finally {
 setIsPreviewing(false);
 }
 };

 const movePage = (fromIndex: number, toIndex: number) => {
 setPages((prev) => {
 if (toIndex < 0 || toIndex >= prev.length || fromIndex === toIndex) return prev;
 const next = [...prev];
 const [moved] = next.splice(fromIndex, 1);
 next.splice(toIndex, 0, moved);
 return next;
 });
 };

 const handleDragStart = (index: number) => {
 setDraggingIndex(index);
 setDragOverIndex(index);
 };

 const handleDragOver = (event: React.DragEvent<HTMLButtonElement>, index: number) => {
 event.preventDefault();
 if (dragOverIndex !== index) {
 setDragOverIndex(index);
 }
 };

 const handleDrop = (event: React.DragEvent<HTMLButtonElement>, index: number) => {
 event.preventDefault();
 if (draggingIndex === null) return;
 movePage(draggingIndex, index);
 setDraggingIndex(null);
 setDragOverIndex(null);
 };

 const handleDragEnd = () => {
 setDraggingIndex(null);
 setDragOverIndex(null);
 };

 const resetOrder = () => {
 setPages((prev) => [...prev].sort((a, b) => a.pageNumber - b.pageNumber));
 };

 const reverseOrder = () => {
 setPages((prev) => [...prev].reverse());
 };

 const handleReorder = () => {
 if (!file || isBusy) return;
 if (pages.length === 0) {
 setErrorMessage("Please load a PDF file to reorder.");
 return;
 }

 setStatus("uploading");
 setProgress(0);
 setErrorMessage(null);

 const xhr = new XMLHttpRequest();
 xhrRef.current = xhr;
 let uploadComplete = false;

 xhr.open("POST", "/api/reorder-pdf", true);
 xhr.responseType = "blob";

 xhr.upload.onprogress = (event) => {
 if (!event.lengthComputable) return;
 const percent = Math.round((event.loaded / event.total) * 60);
 setProgress(Math.min(percent, 60));
 };

 xhr.upload.onload = () => {
 uploadComplete = true;
 setStatus("reordering");
 setProgress((prev) => Math.max(prev, 70));
 };

 xhr.onprogress = (event) => {
 if (!uploadComplete || !event.lengthComputable) return;
 const percent = 70 + Math.round((event.loaded / event.total) * 25);
 setProgress(Math.min(percent, 95));
 };

 xhr.onload = () => {
 if (xhr.status >= 200 && xhr.status < 300) {
 const blob = xhr.response;
 const url = URL.createObjectURL(blob);
 const disposition = xhr.getResponseHeader("Content-Disposition");
 const fileName =
 parseFileNameFromDisposition(disposition) ||
 `${file.name.replace(/\.[^/.]+$/, "")}_reordered.pdf`;

 setDownloadUrl(url);
 setDownloadName(fileName);
 const parts = splitFileName(fileName);
 setDownloadBaseName(parts.base || "reordered");
 setDownloadExtension(parts.ext || ".pdf");
 setProgress(100);
 setStatus("success");
 } else {
 const blob = xhr.response;
 blob?.text?.().then((text: string) => {
 try {
 const data = JSON.parse(text);
 setErrorMessage(data.error || "Reorder failed.");
 } catch {
 setErrorMessage(text || "Reorder failed.");
 }
 });
 setStatus("error");
 setProgress(0);
 }
 };

 xhr.onerror = () => {
 setErrorMessage("Network error. Please try again.");
 setStatus("error");
 setProgress(0);
 };

 xhr.onabort = () => {
 setErrorMessage("Upload cancelled.");
 setStatus("error");
 setProgress(0);
 };

 const newOrder = pages.map((page) => page.pageNumber).join(",");
 const formData = new FormData();
 formData.append("file0", file);
 formData.append("newOrder", newOrder);
 xhr.send(formData);
 };

 const handleCancel = () => {
 xhrRef.current?.abort();
 };

 return (
 <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-8">
 <div className="max-w-5xl mx-auto">
 <div className="text-center mb-12">
 <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">Reorder PDF Pages</h1>
 <p className="text-gray-500 dark:text-slate-400 text-lg">
 Drag and drop pages to arrange your PDF exactly the way you want.
 </p>
 </div>

 {!file && (
 <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 p-8 mb-8">
 <DragDropUpload
 onFileSelect={handleFileSelect}
 accept=".pdf"
 multiple={false}
 maxSize={MAX_FILE_SIZE_MB}
 disabled={isBusy}
 icon="🗂️"
 title="Click to select a PDF file"
 subtitle="or drag and drop here"
 borderColor="border-emerald-300"
 hoverColor="border-emerald-500 bg-emerald-500/10"
 />
 </div>
 )}

 {!file && (
 <div className="mt-8 bg-emerald-500/10 rounded-2xl p-8 border-2 border-emerald-200">
 <h3 className="text-xl font-bold text-emerald-900 mb-4">📖 How to use:</h3>
 <ol className="space-y-2 text-emerald-800">
 <li>1. Upload your PDF file</li>
 <li>2. Drag pages to reorder them</li>
 <li>3. Click "Apply Order"</li>
 <li>4. Download the reordered PDF</li>
 </ol>
 </div>
 )}

 {file && (
 <>
 <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 p-6 mb-8">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-4">
 <div className="text-4xl">📄</div>
 <div>
 <div className="font-semibold text-gray-700 dark:text-slate-200">{file.name}</div>
 <div className="text-sm text-gray-400 dark:text-slate-500">
 {totalPages} pages • {(file.size / 1024 / 1024).toFixed(2)} MB
 </div>
 </div>
 </div>
 <button
 onClick={reset}
 disabled={isBusy}
 className="px-4 py-2 bg-red-500/100 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
 >
 Remove
 </button>
 </div>
 </div>

 <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 p-8 mb-8">
 <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
 <div>
 <h2 className="text-2xl font-bold text-gray-700 dark:text-slate-200">Page Order</h2>
 <p className="text-sm text-gray-400 dark:text-slate-500">
 Drag pages to rearrange. The number badge shows the new position.
 </p>
 </div>
 <div className="flex flex-wrap gap-3">
 <button
 type="button"
 onClick={resetOrder}
 className="px-4 py-2 rounded-lg border border-gray-200 dark:border-white/10 text-gray-600 dark:text-slate-300 hover:border-emerald-300 hover:text-emerald-700 transition"
 disabled={isBusy}
 >
 Reset order
 </button>
 <button
 type="button"
 onClick={reverseOrder}
 className="px-4 py-2 rounded-lg border border-gray-200 dark:border-white/10 text-gray-600 dark:text-slate-300 hover:border-emerald-300 hover:text-emerald-700 transition"
 disabled={isBusy}
 >
 Reverse order
 </button>
 </div>
 </div>

 {errorMessage && (
 <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400" role="alert">
 {errorMessage}
 </div>
 )}

 {isPreviewing && (
 <div className="mb-6">
 <div className="text-sm text-gray-500 dark:text-slate-400 mb-2">Rendering previews...</div>
 <div className="w-full bg-gray-200 dark:bg-white/5/15 rounded-full h-3 overflow-hidden">
 <div
 className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full transition-all duration-300 rounded-full"
 style={{ width: `${previewProgress}%` }}
 />
 </div>
 </div>
 )}

 {pages.length > 0 && (
 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
 {pages.map((page, index) => {
 const isDragging = draggingIndex === index;
 const isOver = dragOverIndex === index;
 return (
 <button
 key={`${page.pageNumber}-${index}`}
 type="button"
 draggable
 onDragStart={() => handleDragStart(index)}
 onDragOver={(event) => handleDragOver(event, index)}
 onDrop={(event) => handleDrop(event, index)}
 onDragEnd={handleDragEnd}
 className={`rounded-xl border-2 p-3 text-left transition-all ${
 isOver ? "border-emerald-400 bg-emerald-500/10" : "border-gray-200 dark:border-white/10"
 } ${isDragging ? "opacity-60" : ""}`}
 >
 <div className="relative">
 <img
 src={page.dataUrl}
 alt={`Page ${page.pageNumber}`}
 className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-white/5"
 />
 <span className="absolute top-2 left-2 rounded-full bg-gray-100 dark:bg-white/5/90 px-2 py-0.5 text-xs font-semibold text-gray-600 dark:text-slate-300 shadow">
 #{index + 1}
 </span>
 <span className="absolute top-2 right-2 rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white shadow">
 Page {page.pageNumber}
 </span>
 </div>
 <div className="mt-3 text-xs text-gray-500 dark:text-slate-400">
 Drag to reorder
 </div>
 </button>
 );
 })}
 </div>
 )}
 </div>

 {isBusy && (
 <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 p-8 mb-8">
 <div className="mb-4 text-center">
 <div className="text-xl font-semibold text-gray-600 dark:text-slate-300 mb-2">
 {status === "uploading" ? "Uploading PDF..." : "Reordering pages..."}
 </div>
 <div className="text-4xl font-bold text-emerald-600">
 {Math.round(progress)}%
 </div>
 </div>
 <div className="w-full bg-gray-200 dark:bg-white/5/15 rounded-full h-4 overflow-hidden">
 <div
 className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full transition-all duration-300 rounded-full"
 style={{ width: `${progress}%` }}
 />
 </div>
 <button
 onClick={handleCancel}
 className="mt-6 w-full py-3 rounded-xl bg-gray-100 dark:bg-white/5/10 text-gray-600 dark:text-slate-300 font-semibold hover:bg-gray-200 dark:hover:bg-white/5/15 transition-colors"
 >
 Cancel
 </button>
 </div>
 )}

 {file && !isBusy && status !== "success" && (
 <button
 onClick={handleReorder}
 className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xl font-bold py-6 rounded-2xl hover:from-emerald-700 hover:to-teal-700 transition-all shadow-xl shadow-black/10 dark:shadow-black/30 hover:shadow-2xl transform hover:scale-105"
 >
 🧩 Apply Order
 </button>
 )}

 {status === "success" && downloadUrl && (
 <div className="text-center py-8 bg-emerald-500/100/10 rounded-2xl border-2 border-emerald-500/20 mb-8" role="status">
 <div className="w-20 h-20 bg-emerald-500/100/15 rounded-full flex items-center justify-center mx-auto mb-6">
 <svg className="w-10 h-10 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
 <path
 fillRule="evenodd"
 d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
 clipRule="evenodd"
 />
 </svg>
 </div>
 <h3 className="text-2xl font-bold text-green-900 mb-2">Reorder Complete!</h3>
 <p className="text-emerald-400 mb-6">Your reordered PDF is ready to download.</p>
 <div className="max-w-md mx-auto mb-6 text-left">
 <label className="block text-sm font-semibold text-gray-600 dark:text-slate-300 mb-2">File name</label>
 <div className="flex items-center gap-2">
 <input
 type="text"
 value={downloadBaseName}
 onChange={(event) => setDownloadBaseName(event.target.value)}
 className="flex-1 px-4 py-3 border border-gray-200 dark:border-white/10 rounded-lg focus:border-emerald-500 focus:outline-none text-gray-600 dark:text-slate-300"
 placeholder="Enter file name"
 />
 {downloadExtension && (
 <span className="px-3 py-2 bg-gray-100 dark:bg-white/5/10 rounded-lg text-sm text-gray-500 dark:text-slate-400">
 {downloadExtension}
 </span>
 )}
 </div>
 </div>
 <div className="flex flex-col sm:flex-row gap-4 justify-center">
 <a
 href={downloadUrl}
 download={buildDownloadName(downloadBaseName, downloadExtension, downloadName)}
 className="px-8 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 !text-white rounded-xl font-semibold hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg shadow-black/5 dark:shadow-black/20 hover:shadow-xl shadow-black/10 dark:shadow-black/30"
 >
 Download PDF
 </a>
 <button
 onClick={reset}
 className="px-8 py-4 bg-gray-100 dark:bg-white/5/10 text-gray-600 dark:text-slate-300 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-white/5/15 transition-all"
 >
 Reorder Another File
 </button>
 </div>
 </div>
 )}
 </>
 )}
 </div>
 </div>
 );
}