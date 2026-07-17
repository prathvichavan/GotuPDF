"use client";

import { useState } from "react";
import { buildDownloadName, splitFileName } from "@/lib/fileName";
import { marked } from "marked";
import Prism from "prismjs";
import "prismjs/components/prism-python";
import AnsiToHtml from "ansi-to-html";

const ansiConverter = new AnsiToHtml({ escapeXML: true });

const escapeHtml = (value: string) =>
 value
 .replace(/&/g, "&amp;")
 .replace(/</g, "&lt;")
 .replace(/>/g, "&gt;")
 .replace(/"/g, "&quot;")
 .replace(/'/g, "&#39;");

const normalizeText = (value?: string | string[]) =>
 Array.isArray(value) ? value.join("") : value ?? "";

const highlightCode = (code: string, language: string) => {
 const lang = language && Prism.languages[language] ? language : "python";
 const grammar = Prism.languages[lang] || Prism.languages.python;
 return Prism.highlight(code, grammar, lang);
};

const markdownRenderer = new marked.Renderer();
markdownRenderer.code = ({ text, lang, escaped }: { text: string; lang?: string; escaped?: boolean }) => {
  const code = text;
 const language = (lang || "").split(/\s+/)[0] || "python";
 const highlighted = highlightCode(code, language);
 return `<pre class="jp-code jp-markdown-code"><code class="language-${language}">${highlighted}</code></pre>`;
};

marked.use({
 renderer: markdownRenderer,
 gfm: true,
 breaks: false,
} as any);

const buildNotebookStyles = () => `
@page { size: A4; margin: 16mm 14mm; }
* { box-sizing: border-box; }
body {
 margin: 0;
 background: #ffffff;
 color: #111827;
 font-family: "Helvetica Neue", Arial, sans-serif;
 font-size: 11pt;
}
.nb-root { width: 180mm; margin: 0 auto; padding: 0; }
.nb-header { border-bottom: 1px solid #d0d0d0; margin-bottom: 12px; padding-bottom: 8px; }
.nb-title { font-size: 16pt; font-weight: 600; letter-spacing: -0.01em; }
.nb-meta { font-size: 9pt; color: #6b7280; margin-top: 4px; }
.jp-cell {
 display: grid;
 grid-template-columns: 68px 1fr;
 column-gap: 10px;
 margin: 10px 0;
 page-break-inside: avoid;
}
.jp-cell-label {
 font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
 font-size: 9pt;
 color: #1f4b99;
 text-align: right;
 padding-top: 3px;
}
.jp-cell-output-label { color: #a11a1a; }
.jp-cell-input {
 background: #f7f7f7;
 border: 1px solid #e0e0e0;
 border-radius: 4px;
 padding: 6px 8px;
}
.jp-cell-output {
 grid-column: 2 / -1;
}
.jp-output {
 background: #f7f7f7;
 border: 1px solid #e0e0e0;
 border-radius: 4px;
 padding: 6px 8px;
 margin-top: 6px;
 font-size: 9.5pt;
 line-height: 1.4;
 white-space: pre-wrap;
 word-break: break-word;
}
.jp-output-stream { background: #f7f7f7; }
.jp-output-error { background: #fff2f2; border-color: #f2b8b8; color: #7f1d1d; }
.jp-output-image {
 max-width: 100%;
 height: auto;
 display: block;
 border: 1px solid #e0e0e0;
 border-radius: 4px;
 background: #ffffff;
 padding: 4px;
}
.jp-output table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
.jp-output th, .jp-output td { border: 1px solid #dcdcdc; padding: 4px 6px; text-align: left; }
.jp-markdown {
 display: block;
 margin-left: 68px;
 font-size: 10.5pt;
 line-height: 1.6;
 color: #111827;
}
.jp-markdown h1 { font-size: 15pt; margin: 14px 0 8px; }
.jp-markdown h2 { font-size: 13pt; margin: 12px 0 6px; }
.jp-markdown h3 { font-size: 11pt; margin: 10px 0 5px; }
.jp-markdown p { margin: 5px 0; }
.jp-markdown ul, .jp-markdown ol { padding-left: 18px; margin: 6px 0; }
.jp-markdown code {
 background: #f2f2f2;
 border-radius: 3px;
 padding: 0 3px;
 font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
 font-size: 9.5pt;
}
.jp-markdown blockquote { border-left: 3px solid #dcdcdc; margin: 8px 0; padding: 4px 8px; color: #4b5563; }
.jp-markdown table { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin: 8px 0; }
.jp-markdown th, .jp-markdown td { border: 1px solid #dcdcdc; padding: 4px 6px; text-align: left; }
.jp-code {
 margin: 0;
 font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
 font-size: 9.5pt;
 line-height: 1.45;
 white-space: pre-wrap;
 word-break: break-word;
}
.token.comment { color: #6b7280; font-style: italic; }
.token.keyword { color: #1d4ed8; font-weight: 600; }
.token.string { color: #b91c1c; }
.token.number { color: #0f766e; }
.token.function { color: #0ea5e9; }
.token.operator { color: #374151; }
.token.boolean, .token.constant { color: #a16207; }
.token.class-name { color: #7c2d12; }
.page-break { page-break-after: always; }
`;

const renderOutputData = (data: Record<string, any>) => {
 if (!data) return "";
 if (data["image/png"]) {
 return `<img class="jp-output-image" src="data:image/png;base64,${data["image/png"]}" alt="Output image" />`;
 }
 if (data["image/jpeg"]) {
 return `<img class="jp-output-image" src="data:image/jpeg;base64,${data["image/jpeg"]}" alt="Output image" />`;
 }
 if (data["image/svg+xml"]) {
 const svgText = normalizeText(data["image/svg+xml"]);
 const encoded = encodeURIComponent(svgText);
 return `<img class="jp-output-image" src="data:image/svg+xml,${encoded}" alt="Output image" />`;
 }
 if (data["text/html"]) {
 return `<div class="jp-output">${normalizeText(data["text/html"])}</div>`;
 }
 if (data["text/plain"]) {
 return `<pre class="jp-output jp-output-stream">${escapeHtml(normalizeText(data["text/plain"]))}</pre>`;
 }
 if (data["text/markdown"]) {
 const html = marked.parse(normalizeText(data["text/markdown"])) as string;
 return `<div class="jp-output">${html}</div>`;
 }
 if (data["application/json"]) {
 const jsonText = JSON.stringify(data["application/json"], null, 2);
 return `<pre class="jp-output jp-output-stream">${escapeHtml(jsonText)}</pre>`;
 }
 return "";
};

const renderOutputs = (outputs: any[]) => {
 if (!outputs || outputs.length === 0) return "";
 const blocks = outputs.map((output) => {
 if (output.output_type === "stream") {
 const text = normalizeText(output.text);
 return `<pre class="jp-output jp-output-stream">${escapeHtml(text)}</pre>`;
 }
 if (output.output_type === "error") {
 const traceback = normalizeText(output.traceback);
 const html = ansiConverter.toHtml(traceback);
 return `<pre class="jp-output jp-output-error">${html}</pre>`;
 }
 if (output.output_type === "execute_result" || output.output_type === "display_data") {
 return renderOutputData(output.data);
 }
 return "";
 });
 const content = blocks.filter(Boolean).join("");
 if (!content) return "";
 return content;
};

const buildNotebookHtml = (notebook: any, fileName: string) => {
 const cells = notebook?.cells || [];
 const title = fileName.replace(/\.(ipynb|py)$/i, "");
 const createdAt = new Date().toLocaleString("en-US", {
 year: "numeric",
 month: "long",
 day: "numeric",
 });

 const renderedCells = cells
 .map((cell: any, index: number) => {
 const source = normalizeText(cell.source);
 if (!source.trim()) return "";

 if (cell.cell_type === "markdown") {
 const html = marked.parse(source) as string;
 return `<section class="jp-cell jp-markdown">${html}</section>`;
 }

 if (cell.cell_type === "code") {
 const execution = cell.execution_count ?? "";
 const codeHtml = highlightCode(source, "python");
 const outputsHtml = renderOutputs(cell.outputs || []);
 return `
 <section class="jp-cell">
 <div class="jp-cell-label">In [${execution}]:</div>
 <div class="jp-cell-input">
 <pre class="jp-code"><code class="language-python">${codeHtml}</code></pre>
 </div>
 ${outputsHtml ? `<div class="jp-cell-label jp-cell-output-label">Out [${execution}]:</div>` : ""}
 ${outputsHtml ? `<div class="jp-cell-output">${outputsHtml}</div>` : ""}
 </section>`;
 }

 return "";
 })
 .filter(Boolean)
 .join("");

 return `
 <div class="nb-root">
 <header class="nb-header">
 <div class="nb-title">${escapeHtml(title)}</div>
 <div class="nb-meta">Generated on ${escapeHtml(createdAt)}</div>
 </header>
 ${renderedCells}
 </div>
 `;
};

const buildPythonHtml = (source: string, fileName: string) => {
 const title = fileName.replace(/\.(ipynb|py)$/i, "");
 const createdAt = new Date().toLocaleString("en-US", {
 year: "numeric",
 month: "long",
 day: "numeric",
 });
 const highlighted = highlightCode(source, "python");
 return `
 <div class="nb-root">
 <header class="nb-header">
 <div class="nb-title">${escapeHtml(title)}</div>
 <div class="nb-meta">Generated on ${escapeHtml(createdAt)}</div>
 </header>
 <section class="jp-cell">
 <div class="jp-cell-label">In [ ]:</div>
 <div class="jp-cell-input">
 <pre class="jp-code"><code class="language-python">${highlighted}</code></pre>
 </div>
 </section>
 </div>
 `;
};

const buildHtmlDocument = (bodyHtml: string) => `
<!doctype html>
<html lang="en">
 <head>
 <meta charset="utf-8" />
 <meta name="viewport" content="width=device-width, initial-scale=1" />
 <style>${buildNotebookStyles()}</style>
 </head>
 <body>
 ${bodyHtml}
 </body>
</html>
`;
export default function PythonJupyterToPDFTool() {
 const [file, setFile] = useState<File | null>(null);
 const [isProcessing, setIsProcessing] = useState(false);
 const [progress, setProgress] = useState(0);
 const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
 const [downloadBaseName, setDownloadBaseName] = useState<string>("");
 const [downloadExtension, setDownloadExtension] = useState<string>("");
 const [error, setError] = useState<string | null>(null);

 const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
 const selectedFile = e.target.files?.[0];
 if (!selectedFile) return;

 // Validate file type
 const validExtensions = ['.py', '.ipynb'];
 const fileExtension = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();

 if (!validExtensions.includes(fileExtension)) {
 setError('Please upload a Python (.py) or Jupyter Notebook (.ipynb) file');
 return;
 }

 // Validate file size (max 50MB)
 const maxSize = 50 * 1024 * 1024; // 50MB
 if (selectedFile.size > maxSize) {
 setError('File size must be less than 50MB');
 return;
 }

 setFile(selectedFile);
 setError(null);
 setDownloadUrl(null);
 setDownloadBaseName("");
 setDownloadExtension("");
 };

 const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
 e.preventDefault();
 const droppedFile = e.dataTransfer.files[0];
 if (droppedFile) {
 const fakeEvent = {
 target: { files: [droppedFile] }
 } as any;
 handleFileSelect(fakeEvent);
 }
 };

 const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
 e.preventDefault();
 };

 const renderHtmlToPdf = async (html: string, baseName: string) => {
 const html2pdfModule: any = await import("html2pdf.js");
 const html2pdf = html2pdfModule.default || html2pdfModule;
 const iframe = document.createElement("iframe");
 iframe.style.position = "fixed";
 iframe.style.left = "-10000px";
 iframe.style.top = "0";
 iframe.style.width = "210mm";
 iframe.style.height = "297mm";
 iframe.style.border = "0";
 iframe.style.background = "#ffffff";
 iframe.setAttribute("aria-hidden", "true");
 document.body.appendChild(iframe);

 let iframeDoc: Document | null = null;
 try {
 iframeDoc = iframe.contentDocument || iframe.contentWindow?.document || null;
 if (!iframeDoc) {
 throw new Error("Failed to initialize PDF renderer.");
 }

 iframeDoc.open();
 iframeDoc.write(html);
 iframeDoc.close();

 const waitForImages = async () => {
 const images = Array.from(iframeDoc?.querySelectorAll("img") || []);
 if (images.length === 0) return;
 await Promise.all(
 images.map(
 (img) =>
 new Promise<void>((resolve) => {
 const image = img as HTMLImageElement;
 if (image.complete) return resolve();
 image.onload = () => resolve();
 image.onerror = () => resolve();
 })
 )
 );
 };

 try {
 const fonts = (iframeDoc as any).fonts;
 if (fonts && "ready" in fonts) {
 await fonts.ready;
 }
 } catch {
 // ignore font loading errors
 }

 await waitForImages();
 await new Promise<void>((resolve) => {
 requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
 });

 const target = iframeDoc.body;
 const bounds = target.getBoundingClientRect();
 const width = Math.max(target.scrollWidth, bounds.width, 794);
 const height = Math.max(target.scrollHeight, bounds.height, 1123);

 const pdfBlob = await html2pdf()
 .set({
 margin: [12, 10, 12, 10],
 filename: `${baseName}.pdf`,
 image: { type: "jpeg", quality: 0.98 },
 html2canvas: {
 scale: 2,
 useCORS: true,
 backgroundColor: "#ffffff",
 letterRendering: true,
 windowWidth: Math.ceil(width),
 windowHeight: Math.ceil(height),
 scrollY: 0,
 scrollX: 0,
 },
 jsPDF: {
 unit: "mm",
 format: "a4",
 orientation: "portrait",
 compress: true,
 },
 pagebreak: { mode: ["css", "legacy"] },
 })
 .from(target)
 .outputPdf("blob");

 if (pdfBlob.size < 1500) {
 throw new Error("Generated PDF is empty. Please try again.");
 }

 return pdfBlob;
 } finally {
 document.body.removeChild(iframe);
 }
 };

 const convertToPDF = async () => {
 if (!file) return;

 setIsProcessing(true);
 setProgress(0);
 setError(null);

 try {
 setProgress(10);
 const formData = new FormData();
 formData.append("file", file);

 setProgress(35);
 const response = await fetch("/api/convert-jupyter-to-pdf", {
 method: "POST",
 body: formData,
 });

 if (!response.ok) {
 const contentType = response.headers.get("content-type") || "";
 if (contentType.includes("application/json")) {
 const errorPayload = await response.json();
 throw new Error(errorPayload?.error || "Conversion failed.");
 }
 throw new Error("Conversion failed.");
 }

 setProgress(70);
 const pdfBlob = await response.blob();
 if (pdfBlob.size < 1500) {
 throw new Error("Generated PDF is empty. Please try again.");
 }

 if (downloadUrl) {
 URL.revokeObjectURL(downloadUrl);
 }
 const url = URL.createObjectURL(pdfBlob);
 setDownloadUrl(url);
 const defaultName = file ? file.name.replace(/\.(py|ipynb)$/, '.pdf') : 'converted.pdf';
 const parts = splitFileName(defaultName);
 setDownloadBaseName(parts.base || 'converted');
 setDownloadExtension(parts.ext || '.pdf');
 setProgress(100);
 } catch (err) {
 console.error("Conversion error:", err);
 setError(err instanceof Error ? err.message : "Failed to convert file. Please try again.");
 } finally {
 setIsProcessing(false);
 }
 };

 const handleDownload = () => {
 if (!downloadUrl) return;
 const a = document.createElement('a');
 a.href = downloadUrl;
 a.download = buildDownloadName(
 downloadBaseName,
 downloadExtension,
 file ? file.name.replace(/\.(py|ipynb)$/, '.pdf') : 'converted.pdf'
 );
 document.body.appendChild(a);
 a.click();
 document.body.removeChild(a);
 };

 const handleReset = () => {
 setFile(null);
 if (downloadUrl) {
 URL.revokeObjectURL(downloadUrl);
 }
 setDownloadUrl(null);
 setDownloadBaseName("");
 setDownloadExtension("");
 setProgress(0);
 setError(null);
 setIsProcessing(false);
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
 <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 p-8 border-2 border-purple-100">
 {!file && !downloadUrl && (
 <div
 className="border-4 border-dashed border-purple-300 rounded-xl p-12 text-center hover:border-purple-500 transition-all cursor-pointer bg-purple-500/100/100/10"
 onDrop={handleDrop}
 onDragOver={handleDragOver}
 onClick={() => document.getElementById('file-input')?.click()}
 >
 <div className="mb-6">
 <svg
 className="mx-auto h-16 w-16 text-purple-400"
 stroke="currentColor"
 fill="none"
 viewBox="0 0 48 48"
 aria-hidden="true"
 >
 <path
 d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
 strokeWidth={2}
 strokeLinecap="round"
 strokeLinejoin="round"
 />
 </svg>
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
 <div className="bg-red-500/10 border-2 border-red-500/20 rounded-xl p-4 mb-6">
 <div className="flex items-center gap-3">
 <svg className="w-6 h-6 text-red-400" fill="currentColor" viewBox="0 0 20 20">
 <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
 </svg>
 <span className="text-red-400 font-medium">{error}</span>
 </div>
 </div>
 )}

 {file && !downloadUrl && (
 <>
 <div className="bg-gradient-to-r rounded-xl p-6 mb-6 border-2 border-purple-500/20">
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-4">
 <div className="w-12 h-12 bg-purple-500/100/100 rounded-lg flex items-center justify-center">
 <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
 <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
 </svg>
 </div>
 <div>
 <div className="font-semibold text-gray-900 dark:text-white">{file.name}</div>
 <div className="text-sm text-gray-400 dark:text-slate-500">{formatFileSize(file.size)}</div>
 </div>
 </div>
 <button
 onClick={handleReset}
 className="p-2 hover:bg-purple-100 rounded-lg transition-colors"
 title="Remove file"
 >
 <svg className="w-5 h-5 text-gray-400 dark:text-slate-500" fill="currentColor" viewBox="0 0 20 20">
 <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
 </svg>
 </button>
 </div>

 {isProcessing && (
 <div className="mt-4">
 <div className="flex items-center justify-between mb-2">
 <span className="text-sm font-medium text-gray-600 dark:text-slate-300">Converting to PDF...</span>
 <span className="text-sm font-bold text-purple-600">{progress}%</span>
 </div>
 <div className="w-full bg-gray-200 dark:bg-white/5/15 rounded-full h-3 overflow-hidden">
 <div
 className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full transition-all duration-300 rounded-full"
 style={{ width: `${progress}%` }}
 />
 </div>
 </div>
 )}
 </div>

 {!isProcessing && (
 <button
 onClick={convertToPDF}
 className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xl font-bold py-6 rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg shadow-black/5 dark:shadow-black/20 hover:shadow-xl shadow-black/10 dark:shadow-black/30 transform hover:scale-105"
 >
 🚀 Convert to PDF
 </button>
 )}
 </>
 )}

 {downloadUrl && (
 <div className="text-center py-8">
 <div className="w-20 h-20 bg-emerald-500/100/15 rounded-full flex items-center justify-center mx-auto mb-6">
 <svg className="w-10 h-10 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
 <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
 </svg>
 </div>
 <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Conversion Complete!</h3>
 <p className="text-gray-500 dark:text-slate-400 mb-6">Your PDF is ready to download</p>
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
 <span className="px-3 py-2 bg-gray-100 dark:bg-white/5/10 rounded-lg text-sm text-gray-500 dark:text-slate-400">
 {downloadExtension}
 </span>
 )}
 </div>
 </div>
 <div className="flex flex-col sm:flex-row gap-4 justify-center">
 <button
 onClick={handleDownload}
 className="px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold hover:from-green-700 hover:to-emerald-700 transition-all duration-300 shadow-lg shadow-black/5 dark:shadow-black/20 hover:shadow-xl shadow-black/10 dark:shadow-black/30"
 >
 📥 Download PDF
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
 <div className="mt-8 bg-indigo-500/100/10 rounded-xl p-6 border-2 border-indigo-500/20">
 <h3 className="text-lg font-bold text-indigo-200 mb-3 flex items-center gap-2">
 <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
 <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
 </svg>
 How It Works
 </h3>
 <ul className="space-y-2 text-indigo-300 text-sm">
 <li>✓ Upload your Python (.py) or Jupyter Notebook (.ipynb) file</li>
 <li>✓ Our tool processes and formats your code with syntax highlighting</li>
 <li>✓ For Jupyter notebooks, all outputs and visualizations are preserved</li>
 <li>✓ Download your professionally formatted PDF</li>
 <li>✓ Files are automatically deleted after processing for your privacy</li>
 </ul>
 </div>
 </div>

 {/* Features Grid */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
 <div className="text-center p-6 bg-gray-100 dark:bg-white/5 rounded-xl shadow-lg shadow-black/5 dark:shadow-black/20 border border-gray-200 dark:border-white/5">
 <div className="text-4xl mb-3">🔒</div>
 <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Secure</h4>
 <p className="text-sm text-gray-500 dark:text-slate-400">
 Files encrypted and auto-deleted after conversion
 </p>
 </div>
 <div className="text-center p-6 bg-gray-100 dark:bg-white/5 rounded-xl shadow-lg shadow-black/5 dark:shadow-black/20 border border-gray-200 dark:border-white/5">
 <div className="text-4xl mb-3">⚡</div>
 <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Fast</h4>
 <p className="text-sm text-gray-500 dark:text-slate-400">
 Convert files in seconds with optimized processing
 </p>
 </div>
 <div className="text-center p-6 bg-gray-100 dark:bg-white/5 rounded-xl shadow-lg shadow-black/5 dark:shadow-black/20 border border-gray-200 dark:border-white/5">
 <div className="text-4xl mb-3">🆓</div>
 <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Free</h4>
 <p className="text-sm text-gray-500 dark:text-slate-400">
 No registration or payment required
 </p>
 </div>
 </div>
 </div>
 );
}