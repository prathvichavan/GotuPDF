"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import DragDropUpload from "./DragDropUpload";
import { buildDownloadName, splitFileName } from "@/lib/fileName";

export default function ProtectPDFTool() {
 const [file, setFile] = useState<File | null>(null);
 const [userPassword, setUserPassword] = useState("");
 const [ownerPassword, setOwnerPassword] = useState("");
 const [showUserPassword, setShowUserPassword] = useState(false);
 const [showOwnerPassword, setShowOwnerPassword] = useState(false);
 const [permissions, setPermissions] = useState({
 print: true,
 copy: true,
 modify: false,
 annotate: false,
 });
 const [isProcessing, setIsProcessing] = useState(false);
 const [progress, setProgress] = useState(0);
 const [errorMessage, setErrorMessage] = useState<string | null>(null);
 const [permissionToast, setPermissionToast] = useState<string | null>(null);
 const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
 const [downloadName, setDownloadName] = useState("");
 const [downloadBaseName, setDownloadBaseName] = useState("");
 const [downloadExtension, setDownloadExtension] = useState("");

 const handleFileSelect = (selectedFiles: File[]) => {
 const selectedFile = selectedFiles[0];
 if (!selectedFile) return;
 if (downloadUrl) {
 URL.revokeObjectURL(downloadUrl);
 }
 setFile(selectedFile);
 setDownloadUrl(null);
 setDownloadName("");
 setDownloadBaseName("");
 setDownloadExtension("");
 };

 const protectPDF = async () => {
 if (!file) return;

 if (!userPassword) {
 alert("User password is required to open the PDF");
 return;
 }

 setIsProcessing(true);
 setProgress(0);
 setErrorMessage(null);

 try {
 setProgress(20);

 // Create form data
 const formData = new FormData();
 formData.append('file0', file);
 formData.append('userPassword', userPassword);
 formData.append('ownerPassword', ownerPassword);

 const permissionStr = Object.entries(permissions)
 .filter(([_, value]) => value)
 .map(([key, _]) => key)
 .join(',');
 formData.append('permissions', permissionStr);

 setProgress(40);

 // Call API
 const response = await fetch('/api/protect-pdf', {
 method: 'POST',
 body: formData,
 });

 setProgress(60);

 if (!response.ok) {
 let message = "Protection failed";
 try {
 const error = await response.json();
 message = error.error || message;
 } catch {
 // ignore parse errors
 }
 setErrorMessage(message);
 setProgress(0);
 setIsProcessing(false);
 return;
 }

 const blob = await response.blob();
 const url = URL.createObjectURL(blob);
 const defaultName = `protected_${file.name}`;
 const parts = splitFileName(defaultName);
 setDownloadUrl(url);
 setDownloadName(defaultName);
 setDownloadBaseName(parts.base || "protected");
 setDownloadExtension(parts.ext || ".pdf");

 setProgress(100);

 const hasRestrictions =
 !permissions.print || !permissions.copy || !permissions.modify || !permissions.annotate;
 if (hasRestrictions) {
 setPermissionToast( "Permissions are restricted. Some PDF viewers (especially browser previews) may ignore these limits. Verify in Adobe Acrobat or another full PDF reader."
 );
 setTimeout(() => setPermissionToast(null), 6000);
 }

 setTimeout(() => {
 setProgress(0);
 }, 800);

 } catch (error) {
 const message = error instanceof Error ? error.message : "Unknown error";
 setErrorMessage(`Failed to protect PDF: ${message}`);
 setProgress(0);
 } finally {
 setIsProcessing(false);
 }
 };

 const handleDownload = () => {
 if (!downloadUrl) return;
 const finalName = buildDownloadName(downloadBaseName, downloadExtension, downloadName || "protected.pdf");
 const link = document.createElement("a");
 link.href = downloadUrl;
 link.download = finalName;
 document.body.appendChild(link);
 link.click();
 document.body.removeChild(link);
 };

 const resetTool = () => {
 if (downloadUrl) {
 URL.revokeObjectURL(downloadUrl);
 }
 setFile(null);
 setUserPassword("");
 setOwnerPassword("");
 setPermissions({
 print: true,
 copy: true,
 modify: false,
 annotate: false,
 });
 setProgress(0);
 setDownloadUrl(null);
 setDownloadName("");
 setDownloadBaseName("");
 setDownloadExtension("");
 };

 return (
 <div className="min-h-screen bg-gradient-to-br p-8">
 {permissionToast && (
 <div
 className="message-toast fixed top-6 right-6 z-50 max-w-sm rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-lg shadow-black/20"
 role="status"
 aria-live="polite"
 >
 <div className="flex items-start gap-3">
 <div className="text-amber-600">⚠️</div>
 <div className="text-sm text-amber-900">
 {permissionToast}
 </div>
 <button
 type="button"
 onClick={() => setPermissionToast(null)}
 className="ml-auto text-amber-700 hover:text-amber-900"
 aria-label="Dismiss warning"
 >
 ✕
 </button>
 </div>
 </div>
 )}
 <div className="max-w-4xl mx-auto">
 {/* Header */}
 <div className="text-center mb-12">
 <h1 className="text-5xl font-bold bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent mb-4">
 🔒 Protect PDF
 </h1>
 <p className="text-gray-500 dark:text-slate-400 text-lg">
 Add password protection to your PDF documents
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
 borderColor="border-red-300"
 hoverColor="border-red-500 bg-red-500/10"
 />
 </div>
 )}

 {!file && (
 <div className="mt-8 bg-pink-50 rounded-2xl p-8 border-2 border-pink-200">
 <h3 className="text-xl font-bold text-pink-900 mb-4">
 📖 How to use:
 </h3>
 <ol className="space-y-2 text-pink-800">
 <li>1. Upload a PDF file</li>
 <li>2. Set a user password (required to open the PDF)</li>
 <li>3. Optionally set an owner password for editing permissions</li>
 <li>4. Choose which permissions to allow</li>
 <li>5. Click "Protect PDF", then choose a filename and download</li>
 </ol>
 </div>
 )}

 {/* File Info & Protection Options */}
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
 {(file.size / 1024 / 1024).toFixed(2)} MB
 </div>
 </div>
 </div>
 <button
 onClick={resetTool}
 disabled={isProcessing}
 className="px-4 py-2 bg-red-500/100 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
 >
 Remove
 </button>
 </div>
 </div>

 {/* Password Settings */}
 <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/30 p-8 mb-8">
 <h2 className="text-2xl font-bold text-gray-700 dark:text-slate-200 mb-6">Password Settings</h2>

 <div className="space-y-6">
 {/* User Password */}
 <div>
 <label className="block text-sm font-medium text-gray-600 dark:text-slate-300 mb-2">
 User Password (Required to open the PDF)
 </label>
 <div className="relative">
 <input
 type={showUserPassword ? "text" : "password"}
 value={userPassword}
 onChange={(e) => setUserPassword(e.target.value)}
 placeholder="Enter password"
 disabled={isProcessing}
 className="w-full px-4 py-3 pr-12 border-2 border-white/15 rounded-lg focus:border-red-500 focus:outline-none bg-gray-100 dark:bg-white/5 text-gray-900 dark:text-white"
 />
 <button
 type="button"
 onClick={() => setShowUserPassword((prev) => !prev)}
 disabled={isProcessing}
 aria-label={showUserPassword ? "Hide user password" : "Show user password"}
 className="absolute inset-y-0 right-3 flex items-center text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 disabled:opacity-50"
 >
 {showUserPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
 </button>
 </div>
 <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
 Users will need this password to view the PDF
 </p>
 </div>

 {/* Owner Password */}
 <div>
 <label className="block text-sm font-medium text-gray-600 dark:text-slate-300 mb-2">
 Owner Password (Optional - for editing permissions)
 </label>
 <div className="relative">
 <input
 type={showOwnerPassword ? "text" : "password"}
 value={ownerPassword}
 onChange={(e) => setOwnerPassword(e.target.value)}
 placeholder="Enter owner password"
 disabled={isProcessing}
 className="w-full px-4 py-3 pr-12 border-2 border-white/15 rounded-lg focus:border-red-500 focus:outline-none bg-gray-100 dark:bg-white/5 text-gray-900 dark:text-white"
 />
 <button
 type="button"
 onClick={() => setShowOwnerPassword((prev) => !prev)}
 disabled={isProcessing}
 aria-label={showOwnerPassword ? "Hide owner password" : "Show owner password"}
 className="absolute inset-y-0 right-3 flex items-center text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 disabled:opacity-50"
 >
 {showOwnerPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
 </button>
 </div>
 <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
 Owner password allows changing permissions
 </p>
 </div>
 </div>
 </div>

 {/* Permissions */}
 <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/30 p-8 mb-8">
 <h2 className="text-2xl font-bold text-gray-700 dark:text-slate-200 mb-6">Permissions</h2>

 <div className="grid grid-cols-2 gap-4">
 <label className="flex items-center gap-3 p-4 border-2 border-gray-200 dark:border-white/10 rounded-lg hover:border-red-300 cursor-pointer transition-all">
 <input
 type="checkbox"
 checked={permissions.print}
 onChange={(e) => setPermissions({ ...permissions, print: e.target.checked })}
 disabled={isProcessing}
 className="w-5 h-5 text-red-400 rounded focus:ring-red-500"
 />
 <div>
 <div className="font-semibold text-gray-700 dark:text-slate-200">Allow Printing</div>
 <div className="text-xs text-gray-400 dark:text-slate-500">Users can print the document</div>
 </div>
 </label>

 <label className="flex items-center gap-3 p-4 border-2 border-gray-200 dark:border-white/10 rounded-lg hover:border-red-300 cursor-pointer transition-all">
 <input
 type="checkbox"
 checked={permissions.copy}
 onChange={(e) => setPermissions({ ...permissions, copy: e.target.checked })}
 disabled={isProcessing}
 className="w-5 h-5 text-red-400 rounded focus:ring-red-500"
 />
 <div>
 <div className="font-semibold text-gray-700 dark:text-slate-200">Allow Copying</div>
 <div className="text-xs text-gray-400 dark:text-slate-500">Users can copy text/content</div>
 </div>
 </label>

 <label className="flex items-center gap-3 p-4 border-2 border-gray-200 dark:border-white/10 rounded-lg hover:border-red-300 cursor-pointer transition-all">
 <input
 type="checkbox"
 checked={permissions.modify}
 onChange={(e) => setPermissions({ ...permissions, modify: e.target.checked })}
 disabled={isProcessing}
 className="w-5 h-5 text-red-400 rounded focus:ring-red-500"
 />
 <div>
 <div className="font-semibold text-gray-700 dark:text-slate-200">Allow Modification</div>
 <div className="text-xs text-gray-400 dark:text-slate-500">Users can edit the document</div>
 </div>
 </label>

 <label className="flex items-center gap-3 p-4 border-2 border-gray-200 dark:border-white/10 rounded-lg hover:border-red-300 cursor-pointer transition-all">
 <input
 type="checkbox"
 checked={permissions.annotate}
 onChange={(e) => setPermissions({ ...permissions, annotate: e.target.checked })}
 disabled={isProcessing}
 className="w-5 h-5 text-red-400 rounded focus:ring-red-500"
 />
 <div>
 <div className="font-semibold text-gray-700 dark:text-slate-200">Allow Annotations</div>
 <div className="text-xs text-gray-400 dark:text-slate-500">Users can add comments/notes</div>
 </div>
 </label>
 </div>
 <p className="text-xs text-gray-400 dark:text-slate-500 mt-4">
 Note: Permissions are enforced by PDF readers. Some browser previews may ignore these
 restrictions—use a full PDF reader (e.g., Adobe Acrobat) to verify them.
 </p>
 </div>

 {/* Error */}
 {errorMessage && (
 <div className="bg-red-500/10 border-2 border-red-500/20 rounded-2xl p-6 mb-8" role="alert">
 <h4 className="text-red-300 font-semibold mb-2">⚠️ Error</h4>
 <p className="text-red-400">{errorMessage}</p>
 </div>
 )}

 {/* Progress */}
 {isProcessing && (
 <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/30 p-8 mb-8">
 <div className="mb-4 text-center">
 <div className="text-xl font-semibold text-gray-600 dark:text-slate-300 mb-2">
 Protecting PDF...
 </div>
 <div className="text-4xl font-bold text-red-400">
 {progress}%
 </div>
 </div>
 <div className="w-full bg-white/5/15 rounded-full h-4 overflow-hidden">
 <div
 className="bg-gradient-to-r from-red-500 to-pink-500 h-full transition-all duration-300 rounded-full"
 style={{ width: `${progress}%` }}
 />
 </div>
 </div>
 )}

 {downloadUrl && !isProcessing && (
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
 <h3 className="text-2xl font-bold text-green-900 mb-2">Protection Complete!</h3>
 <p className="text-emerald-400 mb-6">Your protected PDF is ready to download.</p>
 <div className="max-w-md mx-auto mb-6 text-left">
 <label className="block text-sm font-semibold text-gray-600 dark:text-slate-300 mb-2">File name</label>
 <div className="flex items-center gap-2">
 <input
 type="text"
 value={downloadBaseName}
 onChange={(event) => setDownloadBaseName(event.target.value)}
 className="flex-1 px-4 py-3 border border-gray-200 dark:border-white/10 rounded-lg focus:border-red-500 focus:outline-none text-gray-600 dark:text-slate-300"
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
 className="px-8 py-4 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-xl font-semibold hover:from-red-700 hover:to-pink-700 transition-all shadow-lg shadow-black/20 hover:shadow-xl shadow-black/30"
 >
 Download PDF
 </button>
 <button
 onClick={resetTool}
 className="px-8 py-4 bg-white/5/10 text-gray-600 dark:text-slate-300 rounded-xl font-semibold hover:bg-white/5/15 transition-all"
 >
 Protect Another File
 </button>
 </div>
 </div>
 )}

 {/* Protect Button */}
 {!isProcessing && !downloadUrl && (
 <button
 onClick={protectPDF}
 className="w-full bg-gradient-to-r from-red-600 to-pink-600 text-white text-xl font-bold py-6 rounded-2xl hover:from-red-700 hover:to-pink-700 transition-all shadow-xl shadow-black/30 hover:shadow-2xl transform hover:scale-105"
 >
 🔒 Protect PDF
 </button>
 )}
 </>
 )}

 {/* Info Box */}
 <div className="mt-12 bg-red-500/10 rounded-2xl p-8 border-2 border-red-500/20">
 <h3 className="text-xl font-bold text-red-300 mb-4">
 🔐 Security Information:
 </h3>
 <ul className="space-y-2 text-red-300">
 <li>• <strong>User Password:</strong> Required to open and view the PDF</li>
 <li>• <strong>Owner Password:</strong> Required to change permissions and security settings</li>
 <li>• <strong>Permissions:</strong> Control what users can do with the PDF</li>
 <li>• All processing is done securely - your files are never stored</li>
 <li>• Keep your passwords safe - they cannot be recovered if lost</li>
 </ul>
 </div>
 </div>
 </div>
 );
}