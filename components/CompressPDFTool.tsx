"use client";

import { useEffect, useState } from "react";
import DragDropUpload from "./DragDropUpload";
import { buildDownloadName, splitFileName } from "@/lib/fileName";

type CompressionLevel = "low" | "medium" | "high";

export default function CompressPDFTool() {
 const [file, setFile] = useState<File | null>(null);
 const [compressionLevel, setCompressionLevel] = useState<CompressionLevel>("medium");
 const [isProcessing, setIsProcessing] = useState(false);
 const [progress, setProgress] = useState(0);
 const [originalSize, setOriginalSize] = useState(0);
 const [compressedSize, setCompressedSize] = useState(0);
 const [compressionRatio, setCompressionRatio] = useState(0);
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
 const selectedFile = selectedFiles[0];
 if (!selectedFile) return;

 if (downloadUrl) {
 URL.revokeObjectURL(downloadUrl);
 }
 setFile(selectedFile);
 setOriginalSize(selectedFile.size);
 setCompressedSize(0);
 setCompressionRatio(0);
 setDownloadUrl(null);
 setDownloadName("");
 setDownloadBaseName("");
 setDownloadExtension("");
 };

 const compressPDF = async () => {
 if (!file) return;

 setIsProcessing(true);
 setProgress(0);

 try {
 setProgress(20);

 // Create form data
 const formData = new FormData();
 formData.append('file0', file);
 formData.append('compressionLevel', compressionLevel);

 setProgress(40);

 // Call API
 const response = await fetch('/api/compress-pdf', {
 method: 'POST',
 body: formData,
 });

 setProgress(60);

 if (!response.ok) {
 const error = await response.json();
 throw new Error(error.error || 'Compression failed');
 }

 // Get compressed PDF
 const blob = await response.blob();
 const compressed = blob.size;
 const ratio = ((originalSize - compressed) / originalSize * 100);
 setCompressedSize(compressed);
 setCompressionRatio(ratio);

 setProgress(80);

 const url = URL.createObjectURL(blob);
 const defaultName = `compressed_${file.name}`;
 const parts = splitFileName(defaultName);
 setDownloadUrl(url);
 setDownloadName(defaultName);
 setDownloadBaseName(parts.base || "compressed");
 setDownloadExtension(parts.ext || ".pdf");

 setProgress(100);

 // Show success message
 setTimeout(() => {
 setProgress(0);
 }, 2000);

 } catch (error) {
 console.error("Error compressing PDF:", error);
 alert("Failed to compress PDF. Please try again.");
 setProgress(0);
 } finally {
 setIsProcessing(false);
 }
 };

 const handleDownload = () => {
 if (!downloadUrl) return;
 const finalName = buildDownloadName(downloadBaseName, downloadExtension, downloadName || "compressed.pdf");
 const link = document.createElement("a");
 link.href = downloadUrl;
 link.download = finalName;
 document.body.appendChild(link);
 link.click();
 document.body.removeChild(link);
 };

 const formatFileSize = (bytes: number) => {
 if (bytes === 0) return '0 Bytes';
 const k = 1024;
 const sizes = ['Bytes', 'KB', 'MB', 'GB'];
 const i = Math.floor(Math.log(bytes) / Math.log(k));
 return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
 };

 return (
 <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50 p-8">
 <div className="max-w-4xl mx-auto">
 {/* Header */}
 <div className="text-center mb-12">
 <h1 className="text-5xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent mb-4">
 🗜️ Compress PDF Online Free - GotuPDF
 </h1>
 <p className="text-gray-500 dark:text-slate-400 text-lg">
 Reduce PDF file size while maintaining quality with quick, secure PDF tools online.
 </p>
 </div>

 {/* Upload Area */}
 {!file && (
 <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/30 p-8 mb-8">
 <DragDropUpload
 onFileSelect={handleFileSelect}
 accept=".pdf"
 multiple={false}
 maxSize={50}
 icon="📄"
 title="Click to select a PDF file"
 subtitle="or drag and drop here"
 borderColor="border-orange-300"
 hoverColor="border-orange-500 bg-orange-500/100/10"
 />
 </div>
 )}

 {!file && (
 <div className="mt-8 bg-red-500/10 rounded-2xl p-8 border-2 border-red-500/20">
 <h3 className="text-xl font-bold text-red-300 mb-4">
 📖 How to use:
 </h3>
 <ol className="space-y-2 text-red-300">
 <li>1. Upload a PDF file</li>
 <li>2. Choose compression level (Low, Medium, or High)</li>
 <li>3. Click "Compress PDF"</li>
 <li>4. Wait for processing to complete</li>
 <li>5. Choose a filename and download your PDF</li>
 </ol>
 </div>
 )}

 {/* File Info & Compression Options */}
 {file && (
 <>
 {/* File Info */}
 <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/30 p-6 mb-8">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-4">
 <div className="text-4xl">📄</div>
 <div>
 <div className="font-semibold text-gray-700 dark:text-slate-200">{file.name}</div>
 <div className="text-sm text-gray-400 dark:text-slate-500">
 Original size: {formatFileSize(originalSize)}
 </div>
 </div>
 </div>
 <button
 onClick={() => {
 if (downloadUrl) {
 URL.revokeObjectURL(downloadUrl);
 }
 setFile(null);
 setOriginalSize(0);
 setCompressedSize(0);
 setCompressionRatio(0);
 setDownloadUrl(null);
 setDownloadName("");
 setDownloadBaseName("");
 setDownloadExtension("");
 }}
 disabled={isProcessing}
 className="px-4 py-2 bg-red-500/100 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
 >
 Remove
 </button>
 </div>
 </div>

 {/* Compression Level Selector */}
 <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/30 p-8 mb-8">
 <h2 className="text-2xl font-bold text-gray-700 dark:text-slate-200 mb-6">Compression Level</h2>
 <div className="grid grid-cols-3 gap-4">
 <button
 onClick={() => setCompressionLevel("low")}
 disabled={isProcessing}
 className={`p-6 rounded-xl border-2 transition-all ${compressionLevel === "low"
 ? "border-orange-500 bg-orange-500/100/10"
 : "border-gray-200 dark:border-white/10 hover:border-orange-300"
 } ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
 >
 <div className="text-3xl mb-2">🟢</div>
 <div className="font-semibold">Low</div>
 <div className="text-sm text-gray-400 dark:text-slate-500">Best quality</div>
 <div className="text-xs text-gray-400 dark:text-slate-500 mt-2">~10-20% smaller</div>
 </button>
 <button
 onClick={() => setCompressionLevel("medium")}
 disabled={isProcessing}
 className={`p-6 rounded-xl border-2 transition-all ${compressionLevel === "medium"
 ? "border-orange-500 bg-orange-500/100/10"
 : "border-gray-200 dark:border-white/10 hover:border-orange-300"
 } ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
 >
 <div className="text-3xl mb-2">🟡</div>
 <div className="font-semibold">Medium</div>
 <div className="text-sm text-gray-400 dark:text-slate-500">Balanced</div>
 <div className="text-xs text-gray-400 dark:text-slate-500 mt-2">~30-40% smaller</div>
 </button>
 <button
 onClick={() => setCompressionLevel("high")}
 disabled={isProcessing}
 className={`p-6 rounded-xl border-2 transition-all ${compressionLevel === "high"
 ? "border-orange-500 bg-orange-500/100/10"
 : "border-gray-200 dark:border-white/10 hover:border-orange-300"
 } ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
 >
 <div className="text-3xl mb-2">🔴</div>
 <div className="font-semibold">High</div>
 <div className="text-sm text-gray-400 dark:text-slate-500">Maximum compression</div>
 <div className="text-xs text-gray-400 dark:text-slate-500 mt-2">~50-60% smaller</div>
 </button>
 </div>
 </div>

 {/* Results */}
 {compressedSize > 0 && !isProcessing && (
 <div className="bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 rounded-2xl shadow-xl shadow-black/30 p-8 mb-8 border-2 border-emerald-500/20">
 <h2 className="text-2xl font-bold text-emerald-300 mb-6 text-center">
 ✅ Compression Complete!
 </h2>
 <div className="grid grid-cols-3 gap-6">
 <div className="text-center">
 <div className="text-sm text-gray-500 dark:text-slate-400 mb-2">Original Size</div>
 <div className="text-2xl font-bold text-gray-700 dark:text-slate-200">
 {formatFileSize(originalSize)}
 </div>
 </div>
 <div className="text-center">
 <div className="text-sm text-gray-500 dark:text-slate-400 mb-2">Compressed Size</div>
 <div className="text-2xl font-bold text-emerald-400">
 {formatFileSize(compressedSize)}
 </div>
 </div>
 <div className="text-center">
 <div className="text-sm text-gray-500 dark:text-slate-400 mb-2">Saved</div>
 <div className="text-2xl font-bold text-orange-600">
 {compressionRatio.toFixed(1)}%
 </div>
 </div>
 </div>
 <div className="mt-6 text-center">
 <div className="inline-block bg-gray-100 dark:bg-white/5 px-6 py-3 rounded-lg shadow">
 <span className="text-gray-500 dark:text-slate-400">You saved </span>
 <span className="font-bold text-emerald-400">
 {formatFileSize(originalSize - compressedSize)}
 </span>
 </div>
 </div>
 </div>
 )}

 {downloadUrl && !isProcessing && (
 <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/30 p-8 mb-8 border border-emerald-500/15">
 <h3 className="text-xl font-bold text-gray-700 dark:text-slate-200 mb-4 text-center">
 Ready to Download
 </h3>
 <div className="max-w-md mx-auto">
 <label className="block text-sm font-semibold text-gray-600 dark:text-slate-300 mb-2">File name</label>
 <div className="flex items-center gap-2">
 <input
 type="text"
 value={downloadBaseName}
 onChange={(event) => setDownloadBaseName(event.target.value)}
 className="flex-1 px-4 py-3 border border-gray-200 dark:border-white/10 rounded-lg focus:border-orange-500 focus:outline-none text-gray-600 dark:text-slate-300"
 placeholder="Enter file name"
 />
 {downloadExtension && (
 <span className="px-3 py-2 bg-white/5/10 rounded-lg text-sm text-gray-500 dark:text-slate-400">
 {downloadExtension}
 </span>
 )}
 </div>
 <button
 onClick={handleDownload}
 className="mt-4 w-full bg-gradient-to-r from-orange-600 to-red-600 text-white text-lg font-bold py-4 rounded-xl hover:from-orange-700 hover:to-red-700 transition-all shadow-lg shadow-black/20"
 >
 Download Compressed PDF
 </button>
 </div>
 </div>
 )}

 {/* Progress */}
 {isProcessing && (
 <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/30 p-8 mb-8">
 <div className="mb-4 text-center">
 <div className="text-xl font-semibold text-gray-600 dark:text-slate-300 mb-2">
 Compressing PDF...
 </div>
 <div className="text-4xl font-bold text-orange-600">
 {progress}%
 </div>
 </div>
 <div className="w-full bg-white/5/15 rounded-full h-4 overflow-hidden">
 <div
 className="bg-gradient-to-r from-orange-500 to-red-500 h-full transition-all duration-300 rounded-full"
 style={{ width: `${progress}%` }}
 />
 </div>
 </div>
 )}

 {/* Compress Button */}
 {!isProcessing && !downloadUrl && (
 <button
 onClick={compressPDF}
 className="w-full bg-gradient-to-r from-orange-600 to-red-600 text-white text-xl font-bold py-6 rounded-2xl hover:from-orange-700 hover:to-red-700 transition-all shadow-xl shadow-black/30 hover:shadow-2xl transform hover:scale-105"
 >
 🗜️ Compress PDF
 </button>
 )}
 </>
 )}

 {/* Info Box */}
 <div className="mt-12 bg-orange-500/100/10 rounded-2xl p-8 border-2 border-orange-200">
 <h3 className="text-xl font-bold text-orange-900 mb-4">
 💡 Compression Tips:
 </h3>
 <ul className="space-y-2 text-orange-800">
 <li>• <strong>Low:</strong> Minimal compression, best for documents with important images</li>
 <li>• <strong>Medium:</strong> Balanced compression, good for most use cases</li>
 <li>• <strong>High:</strong> Maximum compression, best for text-heavy documents</li>
 <li>• Compression removes metadata and optimizes file structure</li>
 <li>• Original file is never modified - you get a new compressed copy</li>
 </ul>
 </div>

 {/* SEO Content Section */}
 <div className="mt-12 bg-gray-100 dark:bg-white/5 rounded-2xl p-8 border-2 border-gray-200 dark:border-white/10">
 <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
 Compress PDF Online for Free
 </h2>
 <div className="prose max-w-none text-gray-600 dark:text-slate-300 space-y-4">
 <p>
 Compress PDF is an online tool that reduces the file size of PDF documents while maintaining
 good quality. Large PDF files can be difficult to share through email or upload to websites.
 This tool helps you make your files smaller and easier to manage.
 </p>

 <h3 className="text-xl font-semibold text-gray-900 dark:text-white mt-6 mb-3">
 How to use Compress PDF:
 </h3>
 <ul className="list-disc pl-6 space-y-2">
 <li>Upload your PDF file using the upload button</li>
 <li>The tool automatically compresses the file</li>
 <li>Download the optimized PDF instantly</li>
 </ul>

 <p className="mt-4">
 This tool is useful for students submitting assignments, professionals sharing reports, and
 anyone who wants faster PDF uploads. You can also
 <a href="/merge-pdf" className="text-indigo-400 hover:underline"> merge PDF files online</a>
 or <a href="/split-pdf" className="text-indigo-400 hover:underline">split PDF documents</a>
 with our free PDF tools.
 </p>
 </div>
 </div>
 </div>
 </div>
 );
}