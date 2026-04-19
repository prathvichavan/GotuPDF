"use client";

import { useState } from "react";
import { PDFDocument } from "pdf-lib";
import DragDropUpload from "./DragDropUpload";
import { sanitizeFileNamePart, splitFileName } from "@/lib/fileName";

type SplitMode = "pages" | "range" | "every";

export default function SplitPDFTool() {
 const [file, setFile] = useState<File | null>(null);
 const [totalPages, setTotalPages] = useState(0);
 const [splitMode, setSplitMode] = useState<SplitMode>("pages");
 const [selectedPages, setSelectedPages] = useState<number[]>([]);
 const [rangeStart, setRangeStart] = useState("1");
 const [rangeEnd, setRangeEnd] = useState("1");
 const [everyN, setEveryN] = useState("1");
 const [isProcessing, setIsProcessing] = useState(false);
 const [progress, setProgress] = useState(0);
 const [outputBaseName, setOutputBaseName] = useState("");

 const maxPages = Math.max(totalPages, 1);
 const parsePageValue = (value: string, fallback: number) => {
 const parsed = Number.parseInt(value, 10);
 return Number.isFinite(parsed) ? parsed : fallback;
 };
 const clampPageValue = (value: number) => Math.min(Math.max(value, 1), maxPages);
 const rangeStartValue = clampPageValue(parsePageValue(rangeStart, 1));
 const rangeEndValue = clampPageValue(parsePageValue(rangeEnd, maxPages));
 const everyNValue = clampPageValue(parsePageValue(everyN, 1));

 const handleFileSelect = async (selectedFiles: File[]) => {
 const selectedFile = selectedFiles[0];
 if (!selectedFile) return;

 setFile(selectedFile);
 const parts = splitFileName(selectedFile.name);
 setOutputBaseName(parts.base || "split");

 // Load PDF to get page count
 try {
 const arrayBuffer = await selectedFile.arrayBuffer();
 const pdf = await PDFDocument.load(arrayBuffer);
 const pageCount = pdf.getPageCount();
 setTotalPages(pageCount);
 setRangeStart("1");
 setRangeEnd(String(pageCount));
 setEveryN("1");
 } catch (error) {
 console.error("Error loading PDF:", error);
 alert("Failed to load PDF. Please try again.");
 }
 };

 const togglePage = (pageNum: number) => {
 if (selectedPages.includes(pageNum)) {
 setSelectedPages(selectedPages.filter(p => p !== pageNum));
 } else {
 setSelectedPages([...selectedPages, pageNum].sort((a, b) => a - b));
 }
 };

 const selectAll = () => {
 setSelectedPages(Array.from({ length: totalPages }, (_, i) => i + 1));
 };

 const deselectAll = () => {
 setSelectedPages([]);
 };

 const splitPDF = async () => {
 if (!file) return;
 const safeBaseName = sanitizeFileNamePart(outputBaseName || "split");

 let pagesToExtract: number[][] = [];

 // Determine pages based on mode
 if (splitMode === "pages") {
 if (selectedPages.length === 0) {
 alert("Please select at least one page");
 return;
 }
 // Each selected page becomes its own PDF
 pagesToExtract = selectedPages.map(p => [p]);
 } else if (splitMode === "range") {
 if (rangeStartValue < 1 || rangeEndValue > totalPages || rangeStartValue > rangeEndValue) {
 alert("Invalid page range");
 return;
 }
 // Extract range as single PDF
 pagesToExtract = [Array.from({ length: rangeEndValue - rangeStartValue + 1 }, (_, i) => rangeStartValue + i)];
 } else if (splitMode === "every") {
 if (everyNValue < 1 || everyNValue > totalPages) {
 alert("Invalid split interval");
 return;
 }
 // Split every N pages
 for (let i = 1; i <= totalPages; i += everyNValue) {
 const end = Math.min(i + everyNValue - 1, totalPages);
 pagesToExtract.push(Array.from({ length: end - i + 1 }, (_, j) => i + j));
 }
 }

 setIsProcessing(true);
 setProgress(0);

 try {
 const arrayBuffer = await file.arrayBuffer();
 const originalPdf = await PDFDocument.load(arrayBuffer);

 for (let i = 0; i < pagesToExtract.length; i++) {
 const pages = pagesToExtract[i];
 const newPdf = await PDFDocument.create();

 // Copy selected pages
 const copiedPages = await newPdf.copyPages(
 originalPdf,
 pages.map(p => p - 1) // Convert to 0-indexed
 );
 copiedPages.forEach(page => newPdf.addPage(page));

 // Save and download with high quality
 const pdfBytes = await newPdf.save({
 useObjectStreams: false,
 addDefaultPage: false,
 });
 const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
 const url = URL.createObjectURL(blob);

 const link = document.createElement("a");
 link.href = url;
 if (splitMode === "pages") {
 link.download = `${safeBaseName}_page_${pages[0]}.pdf`;
 } else if (splitMode === "range") {
 link.download = `${safeBaseName}_pages_${rangeStartValue}-${rangeEndValue}.pdf`;
 } else {
 link.download = `${safeBaseName}_part_${i + 1}.pdf`;
 }
 link.click();
 URL.revokeObjectURL(url);

 // Update progress
 setProgress(Math.round(((i + 1) / pagesToExtract.length) * 100));

 // Small delay between downloads
 await new Promise(resolve => setTimeout(resolve, 100));
 }

 alert(`Successfully created ${pagesToExtract.length} PDF file(s)!`);
 } catch (error) {
 console.error("Error splitting PDF:", error);
 alert("Failed to split PDF. Please try again.");
 } finally {
 setIsProcessing(false);
 setProgress(0);
 }
 };

 return (
 <div className="min-h-screen bg-gradient-to-br p-8">
 <div className="max-w-5xl mx-auto">
 {/* Header */}
 <div className="text-center mb-12">
 <h1 className="text-5xl font-bold bg-gradient-to-r from-green-600 to-teal-600 bg-clip-text text-transparent mb-4">
 ✂️ Split PDF Files Easily with GotuPDF
 </h1>
 <p className="text-gray-500 dark:text-slate-400 text-lg">
 Split PDF documents into pages or ranges using fast, free PDF tools.
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
 borderColor="border-green-300"
 hoverColor="border-green-500 bg-emerald-500/100/10"
 />
 </div>
 )}

 {!file && (
 <div className="mt-8 bg-teal-50 rounded-2xl p-8 border-2 border-teal-200">
 <h3 className="text-xl font-bold text-teal-900 mb-4">
 📖 How to use:
 </h3>
 <ol className="space-y-2 text-teal-800">
 <li>1. Upload a PDF file</li>
 <li>2. Choose split mode (Pages, Range, or Interval)</li>
 <li>3. Configure your selection</li>
 <li>4. Click "Split PDF" to extract</li>
 <li>5. Files will download using your chosen name</li>
 </ol>
 </div>
 )}

 {/* File Info & Split Options */}
 {file && totalPages > 0 && (
 <>
 {/* File Info */}
 <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/30 p-6 mb-8">
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
 onClick={() => {
 setFile(null);
 setTotalPages(0);
 setSelectedPages([]);
 setRangeStart("1");
 setRangeEnd("1");
 setEveryN("1");
 setOutputBaseName("");
 }}
 className="px-4 py-2 bg-red-500/100 text-white rounded-lg hover:bg-red-600 transition-colors"
 >
 Remove
 </button>
 </div>
 </div>

 <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/30 p-8 mb-8">
 <h2 className="text-2xl font-bold text-gray-700 dark:text-slate-200 mb-4">Output File Name</h2>
 <label className="block text-sm font-medium text-gray-600 dark:text-slate-300 mb-2">
 Base name for split files
 </label>
 <div className="flex items-center gap-2">
 <input
 type="text"
 value={outputBaseName}
 onChange={(event) => setOutputBaseName(event.target.value)}
 className="flex-1 px-4 py-3 border-2 border-gray-300 dark:border-white/15 rounded-lg focus:border-green-500 focus:outline-none bg-gray-100 dark:bg-white/5 text-gray-900 dark:text-white"
 placeholder="e.g., contract"
 />
 <span className="px-3 py-2 bg-white/5/10 rounded-lg text-sm text-gray-500 dark:text-slate-400">.pdf</span>
 </div>
 <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">
 Files will be named like {outputBaseName || "split"}_page_1.pdf
 </p>
 </div>

 {/* Split Mode Selector */}
 <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/30 p-8 mb-8">
 <h2 className="text-2xl font-bold text-gray-700 dark:text-slate-200 mb-6">Split Mode</h2>
 <div className="grid grid-cols-3 gap-4">
 <button
 onClick={() => setSplitMode("pages")}
 className={`p-6 rounded-xl border-2 transition-all ${splitMode === "pages"
 ? "border-green-500 bg-emerald-500/100/10"
 : "border-gray-200 dark:border-white/10 hover:border-green-300"
 }`}
 >
 <div className="text-3xl mb-2">📑</div>
 <div className="font-semibold text-gray-700 dark:text-slate-200">Select Pages</div>
 <div className="text-sm text-gray-500 dark:text-slate-400">Choose specific pages</div>
 </button>
 <button
 onClick={() => setSplitMode("range")}
 className={`p-6 rounded-xl border-2 transition-all ${splitMode === "range"
 ? "border-green-500 bg-emerald-500/100/10"
 : "border-gray-200 dark:border-white/10 hover:border-green-300"
 }`}
 >
 <div className="text-3xl mb-2">📊</div>
 <div className="font-semibold text-gray-700 dark:text-slate-200">Page Range</div>
 <div className="text-sm text-gray-500 dark:text-slate-400">Extract a range</div>
 </button>
 <button
 onClick={() => setSplitMode("every")}
 className={`p-6 rounded-xl border-2 transition-all ${splitMode === "every"
 ? "border-green-500 bg-emerald-500/100/10"
 : "border-gray-200 dark:border-white/10 hover:border-green-300"
 }`}
 >
 <div className="text-3xl mb-2">🔢</div>
 <div className="font-semibold text-gray-700 dark:text-slate-200">Every N Pages</div>
 <div className="text-sm text-gray-500 dark:text-slate-400">Split at intervals</div>
 </button>
 </div>
 </div>

 {/* Mode-specific Controls */}
 {splitMode === "pages" && (
 <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/30 p-8 mb-8">
 <div className="flex items-center justify-between mb-6">
 <h2 className="text-2xl font-bold text-gray-700 dark:text-slate-200">
 Select Pages ({selectedPages.length} selected)
 </h2>
 <div className="flex gap-2">
 <button
 onClick={selectAll}
 className="px-4 py-2 bg-emerald-500/100/100 text-white rounded-lg hover:bg-emerald-600 transition-colors"
 >
 Select All
 </button>
 <button
 onClick={deselectAll}
 className="px-4 py-2 bg-gray-300 dark:bg-white/50 text-gray-700 dark:text-white rounded-lg hover:bg-gray-400 dark:hover:bg-white/15 transition-colors"
 >
 Deselect All
 </button>
 </div>
 </div>
 <div className="grid grid-cols-10 gap-2">
 {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
 <button
 key={pageNum}
 onClick={() => togglePage(pageNum)}
 className={`aspect-square rounded-lg border-2 font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-green-400/40 ${selectedPages.includes(pageNum)
 ? "border-green-500 bg-emerald-500/100/100 text-white shadow-sm"
 : "border-gray-300 dark:border-white/15 bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-white hover:border-green-400 hover:bg-emerald-500/100/10 hover:text-white"
 }`}
 >
 {pageNum}
 </button>
 ))}
 </div>
 </div>
 )}

 {splitMode === "range" && (
 <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/30 p-8 mb-8">
 <h2 className="text-2xl font-bold text-gray-700 dark:text-slate-200 mb-6">Page Range</h2>
 <div className="flex items-center gap-4">
 <div className="flex-1">
 <label className="block text-sm font-medium text-gray-600 dark:text-slate-300 mb-2">
 Start Page
 </label>
 <input
 type="number"
 min="1"
 max={totalPages}
 value={rangeStart}
 onChange={(e) => setRangeStart(e.target.value)}
 onBlur={() => setRangeStart(String(rangeStartValue))}
 inputMode="numeric"
 pattern="[0-9]*"
 className="no-spinner w-full px-4 py-3 border-2 border-gray-300 dark:border-white/15 rounded-lg focus:border-green-500 focus:outline-none bg-gray-100 dark:bg-white/5 text-gray-900 dark:text-white font-semibold text-lg"
 />
 </div>
 <div className="text-2xl text-gray-400 dark:text-slate-500 mt-8">→</div>
 <div className="flex-1">
 <label className="block text-sm font-medium text-gray-600 dark:text-slate-300 mb-2">
 End Page
 </label>
 <input
 type="number"
 min="1"
 max={totalPages}
 value={rangeEnd}
 onChange={(e) => setRangeEnd(e.target.value)}
 onBlur={() => setRangeEnd(String(rangeEndValue))}
 inputMode="numeric"
 pattern="[0-9]*"
 className="no-spinner w-full px-4 py-3 border-2 border-gray-300 dark:border-white/15 rounded-lg focus:border-green-500 focus:outline-none bg-gray-100 dark:bg-white/5 text-gray-900 dark:text-white font-semibold text-lg"
 />
 </div>
 </div>
 <div className="mt-4 text-center text-gray-500 dark:text-slate-400">
 Will extract pages {rangeStartValue} to {rangeEndValue} ({Math.max(rangeEndValue - rangeStartValue + 1, 0)} pages)
 </div>
 </div>
 )}

 {splitMode === "every" && (
 <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/30 p-8 mb-8">
 <h2 className="text-2xl font-bold text-gray-700 dark:text-slate-200 mb-6">Split Interval</h2>
 <div className="max-w-md mx-auto">
 <label className="block text-sm font-medium text-gray-600 dark:text-slate-300 mb-2">
 Split every N pages
 </label>
 <input
 type="number"
 min="1"
 max={totalPages}
 value={everyN}
 onChange={(e) => setEveryN(e.target.value)}
 onBlur={() => setEveryN(String(everyNValue))}
 inputMode="numeric"
 pattern="[0-9]*"
 className="no-spinner w-full px-4 py-3 border-2 border-gray-300 dark:border-white/15 rounded-lg focus:border-green-500 focus:outline-none text-center text-2xl font-bold bg-gray-100 dark:bg-white/5 text-gray-900 dark:text-white"
 />
 <div className="mt-4 text-center text-gray-500 dark:text-slate-400">
 Will create {Math.ceil(totalPages / everyNValue)} PDF file(s)
 </div>
 </div>
 </div>
 )}

 {/* Progress */}
 {isProcessing && (
 <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/30 p-8 mb-8">
 <div className="mb-4 text-center">
 <div className="text-xl font-semibold text-gray-600 dark:text-slate-300 mb-2">
 Splitting PDF...
 </div>
 <div className="text-4xl font-bold text-emerald-400">
 {progress}%
 </div>
 </div>
 <div className="w-full bg-white/5/15 rounded-full h-4 overflow-hidden">
 <div
 className="bg-gradient-to-r from-green-500 to-teal-500 h-full transition-all duration-300 rounded-full"
 style={{ width: `${progress}%` }}
 />
 </div>
 </div>
 )}

 {/* Split Button */}
 {!isProcessing && (
 <button
 onClick={splitPDF}
 className="w-full bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 text-white text-xl font-bold py-6 rounded-2xl border border-emerald-300/40 shadow-2xl shadow-emerald-500/30 hover:from-emerald-600 hover:via-green-600 hover:to-teal-600 hover:shadow-emerald-500/50 transition-all duration-300 transform hover:scale-[1.02] focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400/40"
 >
 ✂️ Split PDF
 </button>
 )}
 </>
 )}

 {/* SEO Content Section */}
 <div className="mt-12 bg-gray-100 dark:bg-white/5 rounded-2xl p-8 border-2 border-gray-200 dark:border-white/10">
 <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
 Split PDF Pages Online
 </h2>
 <div className="prose max-w-none text-gray-600 dark:text-slate-300 space-y-4">
 <p>
 Split PDF helps you extract specific pages from a PDF document or divide a large PDF into
 smaller files. This tool is useful when you need only selected pages instead of the entire document.
 </p>

 <h3 className="text-xl font-semibold text-gray-900 dark:text-white mt-6 mb-3">
 How to use Split PDF:
 </h3>
 <ul className="list-disc pl-6 space-y-2">
 <li>Upload your PDF file</li>
 <li>Select the pages you want to extract</li>
 <li>Download the new PDF file</li>
 </ul>

 <p className="mt-4">
 This tool saves time and keeps your documents organized. For related tasks, you can
 <a href="/merge-pdf" className="text-indigo-400 hover:underline"> merge PDF files online</a>
 <br/> or <a href="/compress-pdf" className="text-indigo-400 hover:underline">compress PDF documents</a>.
 </p>
 </div>
 </div>
 </div>
 </div>
 );
}