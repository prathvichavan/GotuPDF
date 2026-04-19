"use client";

import { useEffect, useState, type DragEvent } from "react";
import { PDFDocument } from "pdf-lib";
import DragDropUpload from "./DragDropUpload";
import { buildDownloadName, splitFileName } from "@/lib/fileName";

export default function MergePDFTool() {
 const [files, setFiles] = useState<File[]>([]);
 const [isProcessing, setIsProcessing] = useState(false);
 const [progress, setProgress] = useState(0);
 const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
 const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
 const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
 const [downloadName, setDownloadName] = useState("");
 const [downloadBaseName, setDownloadBaseName] = useState("");
 const [downloadExtension, setDownloadExtension] = useState("");

 useEffect(() => {
 return () => {
 if (downloadUrl) {
 URL.revokeObjectURL(downloadUrl);
 }
 };
 }, [downloadUrl]);

 const handleFileSelect = (selectedFiles: File[]) => {
 setFiles((prevFiles) => [...prevFiles, ...selectedFiles]);
 if (downloadUrl) {
 URL.revokeObjectURL(downloadUrl);
 }
 setDownloadUrl(null);
 setDownloadName("");
 setDownloadBaseName("");
 setDownloadExtension("");
 };

 const removeFile = (index: number) => {
 setFiles(files.filter((_, i) => i !== index));
 if (downloadUrl) {
 URL.revokeObjectURL(downloadUrl);
 setDownloadUrl(null);
 setDownloadName("");
 setDownloadBaseName("");
 setDownloadExtension("");
 }
 };

 const moveFile = (fromIndex: number, toIndex: number) => {
 if (toIndex < 0 || toIndex >= files.length || fromIndex === toIndex) return;
 const nextFiles = [...files];
 const [moved] = nextFiles.splice(fromIndex, 1);
 nextFiles.splice(toIndex, 0, moved);
 setFiles(nextFiles);
 if (downloadUrl) {
 URL.revokeObjectURL(downloadUrl);
 setDownloadUrl(null);
 setDownloadName("");
 setDownloadBaseName("");
 setDownloadExtension("");
 }
 };

 const handleDragStart = (index: number) => {
 setDraggingIndex(index);
 setDragOverIndex(index);
 };

 const handleDragOver = (event: DragEvent<HTMLDivElement>, index: number) => {
 event.preventDefault();
 if (dragOverIndex !== index) {
 setDragOverIndex(index);
 }
 };

 const handleDrop = (event: DragEvent<HTMLDivElement>, index: number) => {
 event.preventDefault();
 if (draggingIndex === null) return;
 moveFile(draggingIndex, index);
 setDraggingIndex(null);
 setDragOverIndex(null);
 };

 const handleDragEnd = () => {
 setDraggingIndex(null);
 setDragOverIndex(null);
 };

 const mergePDFs = async () => {
 if (files.length < 2) {
 alert("Please select at least 2 PDF files to merge");
 return;
 }

 setIsProcessing(true);
 setProgress(0);

 try {
 // Create a new PDF document
 const mergedPdf = await PDFDocument.create();

 // Process each file
 for (let i = 0; i < files.length; i++) {
 const file = files[i];
 const arrayBuffer = await file.arrayBuffer();
 const pdf = await PDFDocument.load(arrayBuffer);

 // Copy all pages from this PDF
 const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
 copiedPages.forEach((page) => {
 mergedPdf.addPage(page);
 });

 // Update progress
 setProgress(Math.round(((i + 1) / files.length) * 100));
 }

 // Save the merged PDF with high quality settings
 const pdfBytes = await mergedPdf.save({
 useObjectStreams: false, // Disable compression for better quality
 addDefaultPage: false,
 objectsPerTick: 50,
 updateFieldAppearances: true,
 });
 const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
 const url = URL.createObjectURL(blob);
 const defaultName = `merged_${Date.now()}.pdf`;
 const parts = splitFileName(defaultName);
 setDownloadUrl(url);
 setDownloadName(defaultName);
 setDownloadBaseName(parts.base || "merged");
 setDownloadExtension(parts.ext || ".pdf");
 setProgress(100);
 } catch (error) {
 console.error("Error merging PDFs:", error);
 alert("Failed to merge PDFs. Please try again.");
 } finally {
 setIsProcessing(false);
 }
 };

 const handleDownload = () => {
 if (!downloadUrl) return;
 const finalName = buildDownloadName(downloadBaseName, downloadExtension, downloadName || "merged.pdf");
 const link = document.createElement("a");
 link.href = downloadUrl;
 link.download = finalName;
 document.body.appendChild(link);
 link.click();
 document.body.removeChild(link);
 };

 const handleReset = () => {
 if (downloadUrl) {
 URL.revokeObjectURL(downloadUrl);
 }
 setFiles([]);
 setProgress(0);
 setDownloadUrl(null);
 setDownloadName("");
 setDownloadBaseName("");
 setDownloadExtension("");
 };

 return (
 <div className="min-h-screen bg-gradient-to-br p-8">
 <div className="max-w-4xl mx-auto">
 {/* Header */}
 <div className="text-center mb-12">
 <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-4">
 📄 Merge PDFs
 </h1>
 <p className="text-gray-500 dark:text-slate-400 text-lg">
 Combine multiple PDF files into one document
 </p>
 </div>

 {/* Upload Area */}
 <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/30 p-8 mb-8">
 <DragDropUpload
 onFileSelect={handleFileSelect}
 accept=".pdf"
 multiple={true}
 maxSize={50}
 disabled={isProcessing}
 icon="📁"
 title="Click to select PDF files"
 subtitle="or drag and drop files here"
 borderColor="border-purple-300"
 hoverColor="border-purple-500 bg-purple-500/100/10"
 />
 </div>

 {/* Instructions */}
 <div className="mt-8 bg-indigo-500/100/10 rounded-2xl p-8 border-2 border-indigo-500/20">
 <h3 className="text-xl font-bold text-indigo-200 mb-4">
 📖 How to use:
 </h3>
 <ol className="space-y-2 text-indigo-300">
 <li>1. Click to select or drag PDF files</li>
 <li>2. Drag files to reorder</li>
 <li>3. Click "Merge PDFs" to combine them</li>
 <li>4. Choose a filename and download the merged PDF</li>
 </ol>
 </div>

 {/* File List */}
 {files.length > 0 && (
 <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/30 p-8 mb-8">
 <div className="flex items-center justify-between mb-6">
 <h2 className="text-2xl font-bold text-gray-700 dark:text-slate-200">
 Selected Files ({files.length})
 </h2>
 {files.length > 1 && (
 <span className="text-xs text-gray-400 dark:text-slate-500">Drag to reorder</span>
 )}
 </div>
 <div className="space-y-3">
 {files.map((file, index) => (
 <div
 key={index}
 className={`flex flex-wrap items-center gap-4 p-4 rounded-lg border transition-colors ${files.length > 1 ? "cursor-move" : ""} ${dragOverIndex === index ? "border-purple-300 bg-purple-500/100/10" : "border-purple-500/20 bg-gradient-to-r "} ${draggingIndex === index ? "opacity-60" : ""}`}
 draggable={files.length > 1 && !isProcessing}
 onDragStart={() => handleDragStart(index)}
 onDragOver={(event) => handleDragOver(event, index)}
 onDrop={(event) => handleDrop(event, index)}
 onDragEnd={handleDragEnd}
 >
 <div className="text-3xl">📄</div>
 <div className="flex-1 min-w-[200px]">
 <div className="font-semibold text-gray-700 dark:text-slate-200">
 {index + 1}. {file.name}
 </div>
 <div className="text-sm text-gray-400 dark:text-slate-500">
 {(file.size / 1024 / 1024).toFixed(2)} MB
 </div>
 </div>
 <div className="flex gap-2">
 <button
 onClick={() => removeFile(index)}
 disabled={isProcessing}
 className="px-3 py-2 bg-red-500/100 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
 >
 ✕
 </button>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Progress Bar */}
 {isProcessing && (
 <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/30 p-8 mb-8">
 <div className="mb-4 text-center">
 <div className="text-xl font-semibold text-gray-600 dark:text-slate-300 mb-2">
 Merging PDFs...
 </div>
 <div className="text-4xl font-bold text-purple-600">
 {progress}%
 </div>
 </div>
 <div className="w-full bg-white/5/15 rounded-full h-4 overflow-hidden">
 <div
 className="bg-gradient-to-r from-purple-500 to-blue-500 h-full transition-all duration-300 rounded-full"
 style={{ width: `${progress}%` }}
 />
 </div>
 </div>
 )}

 {downloadUrl && !isProcessing && (
 <div className="text-center py-8 bg-emerald-500/100/10 rounded-2xl border-2 border-emerald-500/20 mb-8" role="status">
 <div className="w-20 h-20 bg-emerald-500/100/15 rounded-full flex items-center justify-center mx-auto mb-6">
 <svg className="w-10 h-10 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
 <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
 </svg>
 </div>
 <h3 className="text-2xl font-bold text-green-900 mb-2">Merge Complete!</h3>
 <p className="text-emerald-400 mb-6">Your merged PDF is ready to download.</p>
 <div className="max-w-md mx-auto mb-6 text-left">
 <label className="block text-sm font-semibold text-gray-600 dark:text-slate-300 mb-2">File name</label>
 <div className="flex items-center gap-2">
 <input
 type="text"
 value={downloadBaseName}
 onChange={(event) => setDownloadBaseName(event.target.value)}
 className="flex-1 px-4 py-3 border border-gray-200 dark:border-white/10 rounded-lg focus:border-purple-500 focus:outline-none text-gray-600 dark:text-slate-300"
 placeholder="Enter file name"
 />
 {downloadExtension && (
 <span className="px-3 py-2 bg-white/5/10 rounded-lg text-sm text-gray-500 dark:text-slate-400">
 {downloadExtension}
 </span>
 )}
 </div>
 </div>
 <div className="flex flex-col sm:flex-row gap-4 justify-center">
 <button
 onClick={handleDownload}
 className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-purple-600 transition-all shadow-lg shadow-black/20 hover:shadow-xl shadow-black/30"
 >
 Download PDF
 </button>
 <button
 onClick={handleReset}
 className="px-8 py-4 bg-gray-100 dark:bg-white/5/10 text-gray-600 dark:text-slate-300 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-white/5/15 transition-all"
 >
 Merge Another File
 </button>
 </div>
 </div>
 )}

 {/* Merge Button */}
 {files.length >= 2 && !isProcessing && !downloadUrl && (
 <button
 onClick={mergePDFs}
 className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xl font-bold py-6 rounded-2xl hover:from-purple-700 hover:to-purple-600 transition-all shadow-xl shadow-black/30 hover:shadow-2xl transform hover:scale-105"
 >
 🔗 Merge {files.length} PDFs
 </button>
 )}
 </div>
 </div>
 );
}