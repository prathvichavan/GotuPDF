"use client";

import { useState } from "react";
import { Upload, FileCode, Download, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { buildDownloadName, splitFileName } from "@/lib/fileName";

export default function JupyterToPDFConverter() {
 const [file, setFile] = useState<File | null>(null);
 const [isProcessing, setIsProcessing] = useState(false);
 const [progress, setProgress] = useState(0);
 const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
 const [downloadBaseName, setDownloadBaseName] = useState<string>("");
 const [downloadExtension, setDownloadExtension] = useState<string>("");
 const [error, setError] = useState<string | null>(null);
 const [isDragging, setIsDragging] = useState(false);

 const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
 const selectedFile = e.target.files?.[0];
 if (!selectedFile) return;

 validateAndSetFile(selectedFile);
 };

 const validateAndSetFile = (selectedFile: File) => {
 // Validate file type
 const validExtensions = ['.py', '.ipynb'];
 const fileExtension = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();

 if (!validExtensions.includes(fileExtension)) {
 setError('Please upload a Python (.py) or Jupyter Notebook (.ipynb) file');
 return;
 }

 // Validate file size (max 50MB)
 const maxSize = 50 * 1024 * 1024;
 if (selectedFile.size > maxSize) {
 setError('File size must be less than 50MB');
 return;
 }

 if (downloadUrl) {
 URL.revokeObjectURL(downloadUrl);
 }
 setFile(selectedFile);
 setError(null);
 setDownloadUrl(null);
 setDownloadBaseName("");
 setDownloadExtension("");
 setProgress(0);
 };

 const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
 e.preventDefault();
 setIsDragging(false);

 const droppedFile = e.dataTransfer.files[0];
 if (droppedFile) {
 validateAndSetFile(droppedFile);
 }
 };

 const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
 e.preventDefault();
 setIsDragging(true);
 };

 const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
 e.preventDefault();
 setIsDragging(false);
 };

 const convertToPDF = async () => {
 if (!file) return;

 setIsProcessing(true);
 setProgress(10);
 setError(null);

 try {
 // Create form data
 const formData = new FormData();
 formData.append('file', file);

 setProgress(20);

 // Call API to convert to HTML
 const response = await fetch('/api/convert-jupyter-to-pdf', {
 method: 'POST',
 body: formData,
 });

 setProgress(50);

 if (!response.ok) {
 const errorData = await response.json();
 throw new Error(errorData.error || 'Conversion failed');
 }

 const { html } = await response.json();
 setProgress(70);

 // Convert HTML to PDF using browser's print functionality
 const pdfBlob = await htmlToPDF(html);
 setProgress(90);

 // Create download URL
 const url = URL.createObjectURL(pdfBlob);
 setDownloadUrl(url);
 const defaultName = file?.name.replace(/\.(ipynb|py)$/, '.pdf') || 'document.pdf';
 const parts = splitFileName(defaultName);
 setDownloadBaseName(parts.base || 'document');
 setDownloadExtension(parts.ext || '.pdf');
 setProgress(100);

 } catch (err) {
 console.error('Conversion error:', err);
 setError(err instanceof Error ? err.message : 'Failed to convert file. Please try again.');
 } finally {
 setIsProcessing(false);
 }
 };

 const htmlToPDF = async (html: string): Promise<Blob> => {
 return new Promise((resolve, reject) => {
 try {
 // Create an iframe to render the HTML
 const iframe = document.createElement('iframe');
 iframe.style.position = 'absolute';
 iframe.style.width = '210mm'; // A4 width
 iframe.style.height = '297mm'; // A4 height
 iframe.style.left = '-9999px';
 document.body.appendChild(iframe);

 const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
 if (!iframeDoc) {
 throw new Error('Failed to access iframe document');
 }

 iframeDoc.open();
 iframeDoc.write(html);
 iframeDoc.close();

 // Wait for content to load
 setTimeout(async () => {
 try {
 // Use modern browser API to generate PDF
 const canvas = document.createElement('canvas');
 const ctx = canvas.getContext('2d');

 if (!ctx) {
 throw new Error('Canvas context not available');
 }

 // For now, we'll use a simpler approach: convert to blob directly
 // In production, you'd use a library like jsPDF or html2pdf
 const blob = new Blob([html], { type: 'text/html' });

 // Clean up
 document.body.removeChild(iframe);

 // For actual PDF generation, we need to use the print dialog
 // or a proper HTML to PDF library
 // This is a placeholder - see note below
 const pdfBlob = await convertHTMLToPDFBlob(html);
 resolve(pdfBlob);

 } catch (err) {
 document.body.removeChild(iframe);
 reject(err);
 }
 }, 1000);

 } catch (err) {
 reject(err);
 }
 });
 };

 // Helper function to convert HTML to PDF
 // Note: For production, use html2pdf.js, jsPDF with html2canvas, or server-side Puppeteer
 const convertHTMLToPDFBlob = async (html: string): Promise<Blob> => {
 // Import html2pdf dynamically
 const html2pdf = (await import('html2pdf.js')).default;

 const opt = {
 margin: 0,
 filename: file?.name.replace(/\.(ipynb|py)$/, '.pdf') || 'document.pdf',
 image: { type: 'jpeg' as const, quality: 0.98 },
 html2canvas: {
 scale: 2,
 useCORS: true,
 letterRendering: true,
 },
 jsPDF: {
 unit: 'mm' as const,
 format: 'a4' as const,
 orientation: 'portrait' as const,
 compress: true,
 },
 pagebreak: { mode: ['avoid-all', 'css', 'legacy'] as const }
 };

 const pdfBlob = await html2pdf().set({...opt, image: {...opt.image, type: 'png' as const}}).from(html).outputPdf('blob');
 return pdfBlob;
 };

 const handleDownload = () => {
 if (!downloadUrl || !file) return;

 const a = document.createElement('a');
 a.href = downloadUrl;
 a.download = buildDownloadName(downloadBaseName, downloadExtension, file.name.replace(/\.(py|ipynb)$/, '.pdf'));
 document.body.appendChild(a);
 a.click();
 document.body.removeChild(a);
 };

 const handleReset = () => {
 setFile(null);
 setDownloadUrl(null);
 setDownloadBaseName("");
 setDownloadExtension("");
 setProgress(0);
 setError(null);
 setIsProcessing(false);
 if (downloadUrl) {
 URL.revokeObjectURL(downloadUrl);
 }
 };

 const formatFileSize = (bytes: number): string => {
 if (bytes === 0) return '0 Bytes';
 const k = 1024;
 const sizes = ['Bytes', 'KB', 'MB'];
 const i = Math.floor(Math.log(bytes) / Math.log(k));
 return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
 };

 return (
 <div className="max-w-4xl mx-auto">
 <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 p-8 border border-gray-200 dark:border-white/10">
 {!file && !downloadUrl && (
 <div
 className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer ${isDragging
 ? 'border-blue-500 bg-indigo-500/100/10'
 : 'border-gray-300 dark:border-white/15 bg-gray-100 dark:bg-white/5 hover:border-blue-400 hover:bg-indigo-500/100/10/50'
 }`}
 onDrop={handleDrop}
 onDragOver={handleDragOver}
 onDragLeave={handleDragLeave}
 onClick={() => document.getElementById('file-input')?.click()}
 >
 <div className="mb-6">
 <Upload className="mx-auto h-16 w-16 text-blue-500" />
 </div>
 <div className="text-xl font-semibold text-gray-600 dark:text-slate-300 mb-2">
 Drop your file here or click to browse
 </div>
 <p className="text-gray-400 dark:text-slate-500 mb-4">
 Supports: .py (Python) and .ipynb (Jupyter Notebook)
 </p>
 <p className="text-sm text-gray-400 dark:text-slate-500">
 Maximum file size: 50MB
 </p>
 <input
 id="file-input"
 type="file"
 accept=".py,.ipynb"
 onChange={handleFileSelect}
 className="hidden"
 />
 </div>
 )}

 {error && (
 <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
 <div className="flex items-center gap-3">
 <XCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
 <span className="text-red-400 font-medium">{error}</span>
 </div>
 </div>
 )}

 {file && !downloadUrl && (
 <>
 <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 mb-6 border border-indigo-500/20">
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-4">
 <div className="w-12 h-12 bg-indigo-500/100/100 rounded-lg flex items-center justify-center">
 <FileCode className="w-6 h-6 text-white" />
 </div>
 <div>
 <div className="font-semibold text-gray-900 dark:text-white">{file.name}</div>
 <div className="text-sm text-gray-400 dark:text-slate-500">{formatFileSize(file.size)}</div>
 </div>
 </div>
 <button
 onClick={handleReset}
 className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
 title="Remove file"
 disabled={isProcessing}
 >
 <XCircle className="w-5 h-5 text-gray-400 dark:text-slate-500" />
 </button>
 </div>

 {isProcessing && (
 <div className="mt-4">
 <div className="flex items-center justify-between mb-2">
 <span className="text-sm font-medium text-gray-600 dark:text-slate-300 flex items-center gap-2">
 <Loader2 className="w-4 h-4 animate-spin" />
 Converting to PDF...
 </span>
 <span className="text-sm font-bold text-indigo-400">{progress}%</span>
 </div>
 <div className="w-full bg-gray-200 dark:bg-white/5/15 rounded-full h-3 overflow-hidden">
 <div
 className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full transition-all duration-300 rounded-full"
 style={{ width: `${progress}%` }}
 />
 </div>
 </div>
 )}
 </div>

 {!isProcessing && (
 <button
 onClick={convertToPDF}
 className="w-full bg-gradient-to-r from-indigo-500 to-indigo-600 text-white text-lg font-bold py-4 rounded-xl hover:from-indigo-600 hover:to-indigo-700 transition-all shadow-lg shadow-black/5 dark:shadow-black/20 hover:shadow-xl shadow-black/10 dark:shadow-black/30 transform hover:scale-[1.02] flex items-center justify-center gap-2"
 >
 <FileCode className="w-5 h-5" />
 Convert to Professional PDF
 </button>
 )}
 </>
 )}

 {downloadUrl && (
 <div className="text-center py-8">
 <div className="w-20 h-20 bg-emerald-500/100/15 rounded-full flex items-center justify-center mx-auto mb-6">
 <CheckCircle2 className="w-10 h-10 text-emerald-400" />
 </div>
 <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Conversion Complete!</h3>
 <p className="text-gray-500 dark:text-slate-400 mb-6">Your professional PDF is ready to download</p>
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
 <button
 onClick={handleDownload}
 className="px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold hover:from-green-700 hover:to-emerald-700 transition-all duration-300 shadow-lg shadow-black/5 dark:shadow-black/20 hover:shadow-xl shadow-black/10 dark:shadow-black/30 flex items-center justify-center gap-2"
 >
 <Download className="w-5 h-5" />
 Download PDF
 </button>
 <button
 onClick={handleReset}
 className="px-8 py-4 bg-gray-100 dark:bg-white/5/10 text-gray-600 dark:text-slate-300 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-white/5/15 transition-all duration-300"
 >
 Convert Another File
 </button>
 </div>
 </div>
 )}

 {/* Info Box */}
 <div className="mt-8 bg-indigo-500/100/10 rounded-xl p-6 border border-indigo-500/20">
 <h3 className="text-lg font-bold text-indigo-200 mb-3 flex items-center gap-2">
 <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
 <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
 </svg>
 Professional Quality Output
 </h3>
 <ul className="space-y-2 text-indigo-300 text-sm">
 <li>✓ Preserves all markdown formatting and headings</li>
 <li>✓ Syntax-highlighted code blocks</li>
 <li>✓ Embedded images and visualizations</li>
 <li>✓ Clean, print-ready A4 format</li>
 <li>✓ Professional typography and spacing</li>
 <li>✓ Files processed securely and deleted immediately</li>
 </ul>
 </div>
 </div>
 </div>
 );
}