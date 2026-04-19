"use client";

import { useMemo, useState } from "react";
import { splitFileName } from "@/lib/fileName";

type AcceptType = string | Record<string, string[]> | undefined;

interface CloudImportProps {
 onFilesSelected: (files: File[]) => void;
 accept?: AcceptType;
 maxSizeBytes?: number;
 multiple?: boolean;
 disabled?: boolean;
 className?: string;
}

type Provider = "google" | "onedrive";

const providerLabels: Record<Provider, string> = {
 google: "Google Drive",
 onedrive: "OneDrive",
};

const MIME_EXTENSION_MAP: Record<string, string[]> = { "application/pdf": [".pdf"], "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"], "application/msword": [".doc"], "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"], "application/vnd.ms-powerpoint": [".ppt"], "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"], "application/vnd.ms-excel": [".xls"], "image/jpeg": [".jpg", ".jpeg"], "image/jpg": [".jpg"], "image/png": [".png"],
};

function parseAccept(accept?: AcceptType) {
 const extensions = new Set<string>();
 const mimes = new Set<string>();

 if (!accept) {
 return { extensions: [], mimes: [] };
 }

 if (typeof accept === "string") {
 accept
 .split(",")
 .map((entry) => entry.trim().toLowerCase())
 .filter(Boolean)
 .forEach((entry) => {
 if (entry.includes("/")) {
 mimes.add(entry);
 MIME_EXTENSION_MAP[entry]?.forEach((ext) => extensions.add(ext));
 } else {
 extensions.add(entry.startsWith(".") ? entry : `.${entry}`);
 }
 });
 return { extensions: Array.from(extensions), mimes: Array.from(mimes) };
 }

 Object.entries(accept).forEach(([key, values]) => {
 if (key.includes("/")) {
 const normalized = key.toLowerCase();
 mimes.add(normalized);
 MIME_EXTENSION_MAP[normalized]?.forEach((ext) => extensions.add(ext));
 } else if (key.startsWith(".")) {
 extensions.add(key.toLowerCase());
 }
 values.forEach((value) => {
 const normalized = value.toLowerCase();
 if (normalized.includes("/")) {
 mimes.add(normalized);
 MIME_EXTENSION_MAP[normalized]?.forEach((ext) => extensions.add(ext));
 } else if (normalized.startsWith(".")) {
 extensions.add(normalized);
 }
 });
 });

 return { extensions: Array.from(extensions), mimes: Array.from(mimes) };
}

function parseFilenameFromDisposition(disposition: string | null) {
 if (!disposition) return null;
 const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
 if (utfMatch?.[1]) {
 try {
 return decodeURIComponent(utfMatch[1]);
 } catch {
 return utfMatch[1];
 }
 }
 const match = disposition.match(/filename="?([^"]+)"?/i);
 return match?.[1] || null;
}

function ensureExtension(name: string, fallbackExtension: string) {
 const parts = splitFileName(name);
 if (parts.ext) return name;
 const ext = fallbackExtension.startsWith(".") ? fallbackExtension : `.${fallbackExtension}`;
 return `${parts.base || "cloud-file"}${ext}`;
}

export default function CloudImport({
 onFilesSelected,
 accept,
 maxSizeBytes,
 multiple = false,
 disabled = false,
 className,
}: CloudImportProps) {
 const [activeProvider, setActiveProvider] = useState<Provider | null>(null);
 const [link, setLink] = useState("");
 const [error, setError] = useState("");
 const [isLoading, setIsLoading] = useState(false);
 const [lastProvider, setLastProvider] = useState<Provider | null>(null);

 const acceptInfo = useMemo(() => parseAccept(accept), [accept]);

 const validateFile = (file: File) => {
 if (maxSizeBytes && file.size > maxSizeBytes) {
 return `File is too large. Maximum size is ${(maxSizeBytes / 1024 / 1024).toFixed(0)}MB.`;
 }
 if (acceptInfo.mimes.length > 0 && file.type) {
 if (acceptInfo.mimes.includes(file.type.toLowerCase())) {
 return null;
 }
 }
 if (acceptInfo.extensions.length > 0) {
 const lowerName = file.name.toLowerCase();
 if (acceptInfo.extensions.some((ext) => lowerName.endsWith(ext))) {
 return null;
 }
 }
 if (acceptInfo.mimes.length > 0 || acceptInfo.extensions.length > 0) {
 return "File type not supported for this tool.";
 }
 return null;
 };

 const handleImport = async () => {
 if (!link.trim()) {
 setError("Please paste a valid share link.");
 return;
 }
 setIsLoading(true);
 setError("");

 try {
 const response = await fetch("/api/cloud-import", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ url: link.trim() }),
 });

 if (!response.ok) {
 let message = "Failed to import file.";
 try {
 const data = await response.json();
 message = data.error || message;
 } catch {
 const text = await response.text();
 if (text) message = text;
 }
 throw new Error(message);
 }

 const contentDisposition = response.headers.get("Content-Disposition");
 const contentType = response.headers.get("Content-Type") || "application/octet-stream";
 const headerFileName = parseFilenameFromDisposition(contentDisposition);
 const responseFileName = response.headers.get("X-File-Name");
 const fallbackName = headerFileName || responseFileName || "cloud-file";

 const blob = await response.blob();
 let finalName = fallbackName;
 if (!splitFileName(finalName).ext && contentType) {
 const extension = contentType.includes("pdf")
 ? ".pdf"
 : contentType.includes("word")
 ? ".docx"
 : contentType.includes("presentation")
 ? ".pptx"
 : contentType.includes("spreadsheet")
 ? ".xlsx"
 : contentType.includes("png")
 ? ".png"
 : contentType.includes("jpeg") || contentType.includes("jpg")
 ? ".jpg"
 : "";
 if (extension) {
 finalName = ensureExtension(finalName, extension);
 }
 }

 const file = new File([blob], finalName, { type: contentType });
 const validationError = validateFile(file);
 if (validationError) {
 throw new Error(validationError);
 }

 onFilesSelected(multiple ? [file] : [file]);
 setLastProvider(activeProvider);
 setActiveProvider(null);
 setLink("");
 } catch (err) {
 const message = err instanceof Error ? err.message : "Failed to import file.";
 setError(message);
 } finally {
 setIsLoading(false);
 }
 };

 const activeLabel = activeProvider ? providerLabels[activeProvider] : "";

 return (
 <div className={className}>
 <div className="mt-4 text-center text-xs text-gray-400 dark:text-slate-500">or import from</div>
 <div className="mt-3 flex flex-col sm:flex-row gap-3 justify-center">
 {(["google", "onedrive"] as Provider[]).map((provider) => (
 <button
 key={provider}
 type="button"
 disabled={disabled || isLoading}
 onClick={() => {
 setActiveProvider(provider);
 setError("");
 }}
 className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-white/10 text-sm font-medium text-gray-600 dark:text-slate-300 hover:border-blue-300 hover:text-indigo-400 transition disabled:opacity-50 disabled:cursor-not-allowed bg-gray-100 dark:bg-white/5"
 >
 {provider === "google" ? (
 <svg className="w-4 h-4" viewBox="0 0 48 48" aria-hidden="true">
 <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.2 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.2-.4-3.5z" />
 <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.2 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
 <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.3l-6.3-5.2C29.4 34.7 26.9 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.6 5.1C9.3 39.7 16.2 44 24 44z" />
 <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3-3.4 5.4-6.3 6.5l.1.1 6.3 5.2C34.9 40.4 44 36 44 24c0-1.3-.1-2.2-.4-3.5z" />
 </svg>
 ) : (
 <svg className="w-4 h-4" viewBox="0 0 48 48" aria-hidden="true">
 <path fill="#1976D2" d="M29.8 15.2 18.6 4H4v16h14.6z" />
 <path fill="#2196F3" d="M18.6 20 4 36h14.6l11.2-11.2z" />
 <path fill="#1565C0" d="M44 20H18.6v16H44z" />
 <path fill="#0D47A1" d="M29.8 15.2 18.6 20h24V4H18.6z" />
 </svg>
 )}
 {providerLabels[provider]}
 </button>
 ))}
 </div>

 {activeProvider && (
 <div className="mt-4 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-white/5 p-4">
 <div className="flex items-center justify-between gap-3 mb-3">
 <div className="text-sm font-semibold text-gray-700 dark:text-slate-200">
 Import from {activeLabel}
 </div>
 {lastProvider && lastProvider !== activeProvider && (
 <span className="text-xs text-gray-400 dark:text-slate-500">
 Last used: {providerLabels[lastProvider]}
 </span>
 )}
 </div>
 <label className="block text-xs text-gray-500 dark:text-slate-400 mb-2">
 Paste a public share link
 </label>
 <div className="flex flex-col sm:flex-row gap-3">
 <input
 type="url"
 value={link}
 onChange={(event) => setLink(event.target.value)}
 placeholder={`https://${activeProvider === "google" ? "drive.google.com" : "1drv.ms"}/...`}
 className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-white/15 focus:border-indigo-500 focus:outline-none bg-gray-100 dark:bg-white/5 text-sm"
 disabled={isLoading}
 />
 <button
 type="button"
 onClick={handleImport}
 disabled={isLoading}
 className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
 >
 {isLoading ? "Importing..." : "Import"}
 </button>
 </div>
 <div className="mt-2 text-xs text-gray-400 dark:text-slate-500">
 Files must be shared with "Anyone with the link". We will fetch the file securely and process it locally.
 </div>
 {error && (
 <div className="mt-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
 {error}
 </div>
 )}
 <div className="mt-3 flex justify-end">
 <button
 type="button"
 onClick={() => {
 setActiveProvider(null);
 setLink("");
 setError("");
 }}
 className="text-xs text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300"
 >
 Cancel
 </button>
 </div>
 </div>
 )}
 </div>
 );
}