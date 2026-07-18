"use client";

import { useEffect, useRef, useState } from "react";
import DragDropUpload from "./DragDropUpload";
import { RotateCcw, RotateCw } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import { buildDownloadName, splitFileName } from "@/lib/fileName";

type Status = "idle" | "uploading" | "rotating" | "success" | "error";

const MAX_FILE_SIZE_MB = 50;
const MAX_PREVIEW_PAGES = 24;

if (typeof window !== "undefined") {
 pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}

function parseFileNameFromDisposition(disposition: string | null) {
 if (!disposition) return null;
 const match = disposition.match(/filename="?([^"]+)"?/i);
 return match?.[1] || null;
}

export default function RotatePDFTool() {
 const [file, setFile] = useState<File | null>(null);
 const [rotationAngle, setRotationAngle] = useState<number>(90);
 const [rangeMode, setRangeMode] = useState<"all" | "custom">("all");
 const [pageRange, setPageRange] = useState("");
 const [totalPages, setTotalPages] = useState(0);
 const [pagePreviews, setPagePreviews] = useState<{ pageNumber: number; dataUrl: string }[]>([]);
 const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
 const [isPreviewing, setIsPreviewing] = useState(false);
 const [previewProgress, setPreviewProgress] = useState(0);
 const [previewError, setPreviewError] = useState<string | null>(null);
 const [previewLimitReached, setPreviewLimitReached] = useState(false);
 const [status, setStatus] = useState<Status>("idle");
 const [progress, setProgress] = useState(0);
 const [errorMessage, setErrorMessage] = useState<string | null>(null);
 const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
 const [downloadName, setDownloadName] = useState<string>("rotated.pdf");
 const [downloadBaseName, setDownloadBaseName] = useState<string>("rotated");
 const [downloadExtension, setDownloadExtension] = useState<string>(".pdf");
 const xhrRef = useRef<XMLHttpRequest | null>(null);

 const isBusy = status === "uploading" || status === "rotating";

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
 setRotationAngle(90);
 setRangeMode("all");
 setPageRange("");
 setTotalPages(0);
 setPagePreviews([]);
 setSelectedPages(new Set());
 setIsPreviewing(false);
 setPreviewProgress(0);
 setPreviewError(null);
 setPreviewLimitReached(false);
 setStatus("idle");
 setProgress(0);
 setErrorMessage(null);
 setDownloadUrl(null);
 setDownloadName("rotated.pdf");
 setDownloadBaseName("rotated");
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
 setPageRange("");
 setRangeMode("all");
 setSelectedPages(new Set());
 setPreviewError(null);
 setPagePreviews([]);
 setPreviewLimitReached(false);
 setTotalPages(0);

 loadPreviews(selectedFile);
 };

 const loadPreviews = async (selectedFile: File) => {
 setIsPreviewing(true);
 setPreviewProgress(0);
 setPreviewError(null);

 try {
 const arrayBuffer = await selectedFile.arrayBuffer();
 const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
 const pdf = await loadingTask.promise;
 const total = pdf.numPages;
 setTotalPages(total);

 const renderCount = Math.min(total, MAX_PREVIEW_PAGES);
 setPreviewLimitReached(total > MAX_PREVIEW_PAGES);

 const previews: { pageNumber: number; dataUrl: string }[] = [];

 for (let pageNum = 1; pageNum <= renderCount; pageNum++) {
 const page = await pdf.getPage(pageNum);
 const viewport = page.getViewport({ scale: 0.4 });
 const canvas = document.createElement("canvas");
 const context = canvas.getContext("2d");
 if (!context) throw new Error("Unable to render PDF preview.");

 canvas.width = viewport.width;
 canvas.height = viewport.height;

 await page.render({ canvasContext: context, viewport }).promise;

 const dataUrl = canvas.toDataURL("image/png");
 previews.push({ pageNumber: pageNum, dataUrl });
 setPreviewProgress(Math.round((pageNum / renderCount) * 100));
 }

 setPagePreviews(previews);
 } catch (error) {
 setPreviewError(
 error instanceof Error ? error.message : "Failed to render PDF previews."
 );
 } finally {
 setIsPreviewing(false);
 }
 };

 const togglePageSelection = (pageNumber: number) => {
 setSelectedPages((prev) => {
 const next = new Set(prev);
 if (next.has(pageNumber)) {
 next.delete(pageNumber);
 } else {
 next.add(pageNumber);
 }
 return next;
 });
 };

 const applySelectedPages = () => {
 if (selectedPages.size === 0) {
 setErrorMessage("Select at least one page in the visual picker.");
 return;
 }
 const range = buildPageRange(Array.from(selectedPages));
 setRangeMode("custom");
 setPageRange(range);
 setErrorMessage(null);
 };

 const selectAllPreviews = () => {
 const next = new Set<number>();
 pagePreviews.forEach((preview) => next.add(preview.pageNumber));
 setSelectedPages(next);
 };

 const clearSelectedPages = () => {
 setSelectedPages(new Set());
 };

 const handleRotate = () => {
 if (!file || isBusy) return;

 if (rangeMode === "custom" && !pageRange.trim()) {
 setErrorMessage("Please enter a valid page range (e.g., 1-3, 5).");
 return;
 }

 setStatus("uploading");
 setProgress(0);
 setErrorMessage(null);

 const xhr = new XMLHttpRequest();
 xhrRef.current = xhr;
 let uploadComplete = false;

 xhr.open("POST", "/api/rotate-pdf", true);
 xhr.responseType = "blob";

 xhr.upload.onprogress = (event) => {
 if (!event.lengthComputable) return;
 const percent = Math.round((event.loaded / event.total) * 60);
 setProgress(Math.min(percent, 60));
 };

 xhr.upload.onload = () => {
 uploadComplete = true;
 setStatus("rotating");
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
 `${file.name.replace(/\.[^/.]+$/, "")}_rotated.pdf`;

 setDownloadUrl(url);
 setDownloadName(fileName);
 const parts = splitFileName(fileName);
 setDownloadBaseName(parts.base || "rotated");
 setDownloadExtension(parts.ext || ".pdf");
 setProgress(100);
 setStatus("success");
 } else {
 const blob = xhr.response;
 blob?.text?.().then((text: string) => {
 try {
 const data = JSON.parse(text);
 setErrorMessage(data.error || "Rotation failed.");
 } catch {
 setErrorMessage(text || "Rotation failed.");
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

 const formData = new FormData();
 formData.append("file0", file);
 formData.append("rotationAngle", rotationAngle.toString());
 formData.append("pageRange", rangeMode === "custom" ? pageRange.trim() : "all");
 xhr.send(formData);
 };

 const handleCancel = () => {
 xhrRef.current?.abort();
 };

 return (
 <div className="min-h-screen bg-gradient-to-br p-8">
 <div className="max-w-4xl mx-auto">
 <div className="text-center mb-12">
 <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">Rotate PDF</h1>
 <p className="text-gray-500 dark:text-slate-400 text-lg">
 Rotate pages in your PDF document with precise control.
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
 icon="📄"
 title="Click to select a PDF file"
 subtitle="or drag and drop here"
 borderColor="border-blue-300"
 hoverColor="border-blue-500 bg-indigo-500/100/10"
 />
 </div>
 )}

 {!file && (
 <div className="mt-8 bg-indigo-500/100/10 rounded-2xl p-8 border-2 border-indigo-500/20">
 <h3 className="text-xl font-bold text-indigo-200 mb-4">📖 How to use:</h3>
 <ol className="space-y-2 text-indigo-300">
 <li>1. Upload your PDF file</li>
 <li>2. Choose rotation direction and pages</li>
 <li>3. Click "Rotate PDF"</li>
 <li>4. Download the rotated file</li>
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
 {(file.size / 1024 / 1024).toFixed(2)} MB • Max {MAX_FILE_SIZE_MB}MB
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
 <h2 className="text-2xl font-bold text-gray-700 dark:text-slate-200 mb-6">Rotation Direction</h2>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 {[
 { value: 90, label: "Rotate Right 90°", icon: <RotateCw className="w-5 h-5" /> },
 { value: 180, label: "Rotate 180°", icon: <RotateCw className="w-5 h-5" /> },
 { value: -90, label: "Rotate Left 90°", icon: <RotateCcw className="w-5 h-5" /> },
 ].map((option) => (
 <button
 key={option.value}
 type="button"
 onClick={() => setRotationAngle(option.value)}
 disabled={isBusy}
 className={`flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-4 text-sm font-semibold transition-all ${
 rotationAngle === option.value
 ? "border-blue-600 bg-indigo-500/100/10 text-indigo-400"
 : "border-gray-200 dark:border-white/10 text-gray-600 dark:text-slate-300 hover:border-blue-300 hover:bg-indigo-500/100/10"
 }`}
 >
 {option.icon}
 {option.label}
 </button>
 ))}
 </div>
 </div>

 <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 p-8 mb-8">
 <h2 className="text-2xl font-bold text-gray-700 dark:text-slate-200 mb-6">Pages to Rotate</h2>
 <div className="flex flex-col gap-4">
 <label className="flex items-center gap-3">
 <input
 type="radio"
 name="page-range"
 checked={rangeMode === "all"}
 onChange={() => setRangeMode("all")}
 disabled={isBusy}
 className="w-4 h-4 text-indigo-400"
 />
 <span className="text-gray-600 dark:text-slate-300 font-medium">All pages</span>
 </label>
 <label className="flex items-start gap-3">
 <input
 type="radio"
 name="page-range"
 checked={rangeMode === "custom"}
 onChange={() => setRangeMode("custom")}
 disabled={isBusy}
 className="w-4 h-4 text-indigo-400 mt-1"
 />
 <div className="w-full">
 <span className="text-gray-600 dark:text-slate-300 font-medium">Custom range</span>
 <input
 type="text"
 value={pageRange}
 onChange={(e) => setPageRange(e.target.value)}
 placeholder="e.g., 1-3, 5, 8-10"
 disabled={isBusy || rangeMode !== "custom"}
 className="mt-2 w-full px-4 py-3 border-2 border-gray-300 dark:border-white/15 rounded-lg focus:border-indigo-500 focus:outline-none bg-gray-100 dark:bg-white/5 text-gray-900 dark:text-white"
 />
 <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
 Use commas for separate pages and hyphens for ranges.
 </p>
 </div>
 </label>
 </div>
 </div>

 <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 p-8 mb-8">
 <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
 <div>
 <h2 className="text-2xl font-bold text-gray-700 dark:text-slate-200">Visual Page Picker</h2>
 <p className="text-sm text-gray-400 dark:text-slate-500">
 Click pages to select them. Use the selection to populate the custom range.
 </p>
 </div>
 <div className="text-sm text-gray-400 dark:text-slate-500">
 {totalPages > 0 ? `${totalPages} pages detected` : "Loading pages..."}
 </div>
 </div>

 {previewError && (
 <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
 {previewError}
 </div>
 )}

 {isPreviewing && (
 <div className="mb-6">
 <div className="text-sm text-gray-500 dark:text-slate-400 mb-2">Rendering previews...</div>
 <div className="w-full bg-gray-200 dark:bg-white/5/15 rounded-full h-3 overflow-hidden">
 <div
 className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full transition-all duration-300 rounded-full"
 style={{ width: `${previewProgress}%` }}
 />
 </div>
 </div>
 )}

 {pagePreviews.length > 0 && (
 <>
 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
 {pagePreviews.map((preview) => {
 const isSelected = selectedPages.has(preview.pageNumber);
 return (
 <button
 key={preview.pageNumber}
 type="button"
 onClick={() => togglePageSelection(preview.pageNumber)}
 className={`rounded-xl border-2 p-3 text-left transition-all ${
 isSelected
 ? "border-blue-600 bg-indigo-500/100/10 shadow-md shadow-black/5 dark:shadow-black/20"
 : "border-gray-200 dark:border-white/10 hover:border-blue-300"
 }`}
 >
 <div className="relative">
 <img
 src={preview.dataUrl}
 alt={`Page ${preview.pageNumber}`}
 className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-white/5"
 />
 <span className="absolute top-2 left-2 rounded-full bg-gray-100 dark:bg-white/5/90 px-2 py-0.5 text-xs font-semibold text-gray-600 dark:text-slate-300 shadow">
 {preview.pageNumber}
 </span>
 </div>
 <div className="mt-3 flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
 <span>{isSelected ? "Selected" : "Click to select"}</span>
 <span className={isSelected ? "text-indigo-400" : "text-gray-400 dark:text-slate-500"}>
 {isSelected ? "✓" : "○"}
 </span>
 </div>
 </button>
 );
 })}
 </div>

 {previewLimitReached && (
 <p className="mt-4 text-xs text-gray-400 dark:text-slate-500">
 Showing the first {MAX_PREVIEW_PAGES} pages. Use the custom range input for pages beyond this.
 </p>
 )}

 <div className="mt-6 flex flex-wrap gap-3">
 <button
 type="button"
 onClick={selectAllPreviews}
 className="px-4 py-2 rounded-lg border border-gray-200 dark:border-white/10 text-gray-600 dark:text-slate-300 hover:border-blue-300 hover:text-indigo-400 transition"
 >
 Select all shown
 </button>
 <button
 type="button"
 onClick={clearSelectedPages}
 className="px-4 py-2 rounded-lg border border-gray-200 dark:border-white/10 text-gray-600 dark:text-slate-300 hover:border-blue-300 hover:text-indigo-400 transition"
 >
 Clear selection
 </button>
 <button
 type="button"
 onClick={applySelectedPages}
 className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition"
 >
 Use selected pages
 </button>
 <div className="text-sm text-gray-400 dark:text-slate-500 flex items-center">
 {selectedPages.size} page{selectedPages.size === 1 ? "" : "s"} selected
 </div>
 </div>
 </>
 )}
 </div>

 {errorMessage && (
 <div className="bg-red-500/10 border-2 border-red-500/20 rounded-2xl p-6 mb-8" role="alert">
 <h4 className="text-red-300 font-semibold mb-2">⚠️ Error</h4>
 <p className="text-red-400">{errorMessage}</p>
 </div>
 )}

 {isBusy && (
 <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 p-8 mb-8">
 <div className="mb-4 text-center">
 <div className="text-xl font-semibold text-gray-600 dark:text-slate-300 mb-2">
 {status === "uploading" ? "Uploading PDF..." : "Rotating PDF..."}
 </div>
 <div className="text-4xl font-bold text-indigo-400">
 {Math.round(progress)}%
 </div>
 </div>
 <div className="w-full bg-gray-200 dark:bg-white/5/15 rounded-full h-4 overflow-hidden">
 <div
 className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full transition-all duration-300 rounded-full"
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
 onClick={handleRotate}
 className="w-full bg-gradient-to-r from-indigo-500 to-indigo-600 text-white text-xl font-bold py-6 rounded-2xl hover:from-indigo-600 hover:to-indigo-700 transition-all shadow-xl shadow-black/10 dark:shadow-black/30 hover:shadow-2xl transform hover:scale-105"
 >
 🔄 Rotate PDF
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
 <h3 className="text-2xl font-bold text-green-900 mb-2">Success!</h3>
 <p className="text-emerald-400 mb-6">Your rotated PDF is ready to download.</p>
 <div className="max-w-md mx-auto mb-6 text-left">
 <label className="block text-sm font-semibold text-gray-600 dark:text-slate-300 mb-2">File name</label>
 <div className="flex items-center gap-2">
 <input
 type="text"
 value={downloadBaseName}
 onChange={(event) => setDownloadBaseName(event.target.value)}
 className="flex-1 px-4 py-3 border border-gray-200 dark:border-white/10 rounded-lg focus:border-indigo-500 focus:outline-none text-gray-600 dark:text-slate-300"
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
 className="px-8 py-4 bg-gradient-to-r from-indigo-500 to-indigo-600 !text-white rounded-xl font-semibold hover:from-indigo-600 hover:to-indigo-700 transition-all shadow-lg shadow-black/5 dark:shadow-black/20 hover:shadow-xl shadow-black/10 dark:shadow-black/30"
 >
 Download PDF
 </a>
 <button
 onClick={reset}
 className="px-8 py-4 bg-gray-100 dark:bg-white/5/10 text-gray-600 dark:text-slate-300 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-white/5/15 transition-all"
 >
 Rotate Another File
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

function buildPageRange(pages: number[]) {
 if (pages.length === 0) return "";
 const sorted = [...new Set(pages)].sort((a, b) => a - b);
 const ranges: string[] = [];
 let start = sorted[0];
 let end = sorted[0];

 for (let i = 1; i < sorted.length; i++) {
 const current = sorted[i];
 if (current === end + 1) {
 end = current;
 } else {
 ranges.push(start === end ? `${start}` : `${start}-${end}`);
 start = current;
 end = current;
 }
 }

 ranges.push(start === end ? `${start}` : `${start}-${end}`);
 return ranges.join(", ");
}