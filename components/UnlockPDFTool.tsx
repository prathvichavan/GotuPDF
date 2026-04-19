"use client";

import { useEffect, useRef, useState } from "react";
import DragDropUpload from "./DragDropUpload";
import { buildDownloadName, splitFileName } from "@/lib/fileName";
import { Eye, EyeOff } from "lucide-react";

type Status = "idle" | "uploading" | "unlocking" | "success" | "error";

const MAX_FILE_SIZE_MB = Number(process.env.NEXT_PUBLIC_UNLOCK_PDF_MAX_MB || 50);

function parseFileNameFromDisposition(disposition: string | null) {
 if (!disposition) return null;
 const match = disposition.match(/filename="?([^"]+)"?/i);
 return match?.[1] || null;
}

export default function UnlockPDFTool() {
 const [file, setFile] = useState<File | null>(null);
 const [password, setPassword] = useState("");
 const [showPassword, setShowPassword] = useState(false);
 const [status, setStatus] = useState<Status>("idle");
 const [progress, setProgress] = useState(0);
 const [errorMessage, setErrorMessage] = useState<string | null>(null);
 const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
 const [downloadName, setDownloadName] = useState<string>("unlocked.pdf");
 const [downloadBaseName, setDownloadBaseName] = useState<string>("unlocked");
 const [downloadExtension, setDownloadExtension] = useState<string>(".pdf");
 const xhrRef = useRef<XMLHttpRequest | null>(null);

 const isBusy = status === "uploading" || status === "unlocking";

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
 setPassword("");
 setStatus("idle");
 setProgress(0);
 setErrorMessage(null);
 setDownloadUrl(null);
 setDownloadName("unlocked.pdf");
 setDownloadBaseName("unlocked");
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
 setDownloadUrl(null);
 setDownloadName("unlocked.pdf");
 setDownloadBaseName("unlocked");
 setDownloadExtension(".pdf");
 };

 const handleUnlock = () => {
 if (!file || isBusy) return;
 if (!password.trim()) {
 setErrorMessage("Please enter the PDF password.");
 return;
 }

 setStatus("uploading");
 setProgress(0);
 setErrorMessage(null);

 const xhr = new XMLHttpRequest();
 xhrRef.current = xhr;
 let uploadComplete = false;

 xhr.open("POST", "/api/unlock-pdf", true);
 xhr.responseType = "blob";

 xhr.upload.onprogress = (event) => {
 if (!event.lengthComputable) return;
 const percent = Math.round((event.loaded / event.total) * 60);
 setProgress(Math.min(percent, 60));
 };

 xhr.upload.onload = () => {
 uploadComplete = true;
 setStatus("unlocking");
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
 `${file.name.replace(/\.[^/.]+$/, "")}_unlocked.pdf`;

 setDownloadUrl(url);
 setDownloadName(fileName);
 const parts = splitFileName(fileName);
 setDownloadBaseName(parts.base || "unlocked");
 setDownloadExtension(parts.ext || ".pdf");
 setProgress(100);
 setStatus("success");
 } else {
 const blob = xhr.response;
 blob?.text?.().then((text: string) => {
 try {
 const data = JSON.parse(text);
 setErrorMessage(data.error || "Unlock failed.");
 } catch {
 setErrorMessage(text || "Unlock failed.");
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
 formData.append("password", password);
 xhr.send(formData);
 };

 const handleCancel = () => {
 xhrRef.current?.abort();
 };

 return (
 <div className="min-h-screen bg-gradient-to-br p-8">
 <div className="max-w-4xl mx-auto">
 <div className="text-center mb-12">
 <h1 className="text-5xl font-bold bg-gradient-to-r from-indigo-600 to-sky-600 bg-clip-text text-transparent mb-4">
 🔓 Unlock PDF
 </h1>
 <p className="text-gray-500 dark:text-slate-400 text-lg">
 Remove password protection from PDFs you own and have permission to unlock.
 </p>
 </div>

 {!file && (
 <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/30 p-8 mb-8">
 <DragDropUpload
 onFileSelect={handleFileSelect}
 accept=".pdf"
 multiple={false}
 maxSize={MAX_FILE_SIZE_MB}
 disabled={isBusy}
 icon="🔐"
 title="Click to select a password-protected PDF"
 subtitle="or drag and drop here"
 borderColor="border-indigo-300"
 hoverColor="border-indigo-500 bg-indigo-500/10"
 />
 </div>
 )}

 {!file && (
 <div className="mt-8 bg-indigo-500/10 rounded-2xl p-8 border-2 border-indigo-500/20">
 <h3 className="text-xl font-bold text-indigo-200 mb-4">
 📖 How to use:
 </h3>
 <ol className="space-y-2 text-indigo-300">
 <li>1. Upload a password-protected PDF</li>
 <li>2. Enter the correct password</li>
 <li>3. Click "Unlock PDF"</li>
 <li>4. Download the unlocked file</li>
 </ol>
 </div>
 )}

 {file && (
 <>
 <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/30 p-6 mb-8">
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

 <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/30 p-8 mb-8">
 <h2 className="text-2xl font-bold text-gray-700 dark:text-slate-200 mb-6">Password</h2>
 <label className="block text-sm font-medium text-gray-600 dark:text-slate-300 mb-2">
 PDF Password
 </label>
 <div className="relative">
 <input
 type={showPassword ? "text" : "password"}
 value={password}
 onChange={(e) => setPassword(e.target.value)}
 placeholder="Enter the PDF password"
 disabled={isBusy}
 className="w-full px-4 py-3 pr-12 border-2 border-white/15 rounded-lg focus:border-indigo-500 focus:outline-none bg-gray-100 dark:bg-white/5 text-gray-900 dark:text-white"
 />
 <button
 type="button"
 onClick={() => setShowPassword((prev) => !prev)}
 disabled={isBusy}
 aria-label={showPassword ? "Hide password" : "Show password"}
 className="absolute inset-y-0 right-3 flex items-center text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 disabled:opacity-50"
 >
 {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
 </button>
 </div>
 <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
 We never store your password or files.
 </p>
 </div>

 {errorMessage && (
 <div className="bg-red-500/10 border-2 border-red-500/20 rounded-2xl p-6 mb-8" role="alert">
 <h4 className="text-red-300 font-semibold mb-2">⚠️ Error</h4>
 <p className="text-red-400">{errorMessage}</p>
 </div>
 )}

 {isBusy && (
 <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/30 p-8 mb-8">
 <div className="mb-4 text-center">
 <div className="text-xl font-semibold text-gray-600 dark:text-slate-300 mb-2">
 {status === "uploading" ? "Uploading PDF..." : "Unlocking PDF..."}
 </div>
 <div className="text-4xl font-bold text-indigo-600">
 {Math.round(progress)}%
 </div>
 </div>
 <div className="w-full bg-white/5/15 rounded-full h-4 overflow-hidden">
 <div
 className="bg-gradient-to-r from-indigo-500 to-sky-500 h-full transition-all duration-300 rounded-full"
 style={{ width: `${progress}%` }}
 />
 </div>
 <button
 onClick={handleCancel}
 className="mt-6 w-full py-3 rounded-xl bg-white/5/10 text-gray-600 dark:text-slate-300 font-semibold hover:bg-white/5/15 transition-colors"
 >
 Cancel
 </button>
 </div>
 )}

 {file && !isBusy && status !== "success" && (
 <button
 onClick={handleUnlock}
 className="w-full bg-gradient-to-r from-indigo-600 to-sky-600 text-white text-xl font-bold py-6 rounded-2xl hover:from-indigo-700 hover:to-sky-700 transition-all shadow-xl shadow-black/30 hover:shadow-2xl transform hover:scale-105"
 >
 🔓 Unlock PDF
 </button>
 )}

 {status === "success" && downloadUrl && (
 <div className="text-center py-8 bg-emerald-500/10 rounded-2xl border-2 border-emerald-200 mb-8" role="status">
 <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
 <svg className="w-10 h-10 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
 <path
 fillRule="evenodd"
 d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
 clipRule="evenodd"
 />
 </svg>
 </div>
 <h3 className="text-2xl font-bold text-emerald-900 mb-2">Unlocked Successfully!</h3>
 <p className="text-emerald-700 mb-6">Your unlocked PDF is ready to download.</p>
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
 <span className="px-3 py-2 bg-white/5/10 rounded-lg text-sm text-gray-500 dark:text-slate-400">
 {downloadExtension}
 </span>
 )}
 </div>
 </div>
 <div className="flex flex-col sm:flex-row gap-4 justify-center">
 <a
 href={downloadUrl}
 download={buildDownloadName(downloadBaseName, downloadExtension, downloadName)}
 className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-sky-600 !text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-sky-700 transition-all shadow-lg shadow-black/20 hover:shadow-xl shadow-black/30 ring-1 ring-indigo-500/20"
 >
 Download PDF
 </a>
 <button
 onClick={reset}
 className="px-8 py-4 bg-white/5/10 text-gray-600 dark:text-slate-300 rounded-xl font-semibold hover:bg-white/5/15 transition-all"
 >
 Unlock Another File
 </button>
 </div>
 </div>
 )}
 </>
 )}

 <div className="mt-12 bg-indigo-500/10 rounded-2xl p-8 border-2 border-indigo-500/20">
 <h3 className="text-xl font-bold text-indigo-200 mb-4">
 🔐 Security Information:
 </h3>
 <ul className="space-y-2 text-indigo-300">
 <li>• Only unlock PDFs you own or have explicit permission to access</li>
 <li>• Passwords are used only to decrypt and are never stored</li>
 <li>• Files are processed securely and deleted after unlocking</li>
 </ul>
 </div>
 </div>
 </div>
 );
}