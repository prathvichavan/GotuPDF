"use client";

import { useState, useCallback } from "react";
import DragDropUpload from "./DragDropUpload";
import { splitFileName, buildDownloadName } from "@/lib/fileName";

type Position = "bottom-center" | "bottom-left" | "bottom-right" | "top-center" | "top-left" | "top-right";

const POSITIONS: { value: Position; label: string }[] = [
    { value: "bottom-center", label: "Bottom Center" },
    { value: "bottom-left", label: "Bottom Left" },
    { value: "bottom-right", label: "Bottom Right" },
    { value: "top-center", label: "Top Center" },
    { value: "top-left", label: "Top Left" },
    { value: "top-right", label: "Top Right" },
];

const FORMATS = [
    { value: "{n}", label: "1, 2, 3..." },
    { value: "Page {n}", label: "Page 1, Page 2..." },
    { value: "{n} of {total}", label: "1 of 10, 2 of 10..." },
    { value: "Page {n} of {total}", label: "Page 1 of 10..." },
    { value: "- {n} -", label: "- 1 -, - 2 -..." },
];

export default function AddPageNumbersTool() {
    const [file, setFile] = useState<File | null>(null);
    const [position, setPosition] = useState<Position>("bottom-center");
    const [format, setFormat] = useState("{n}");
    const [fontSize, setFontSize] = useState(12);
    const [startNumber, setStartNumber] = useState(1);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
    const [downloadBaseName, setDownloadBaseName] = useState("");
    const [error, setError] = useState<string | null>(null);

    const handleFileSelect = useCallback((selectedFiles: File[]) => {
        const f = selectedFiles[0];
        if (!f) return;
        setError(null);
        setFile(f);
        setDownloadUrl(null);
        const parts = splitFileName(f.name);
        setDownloadBaseName(parts.base ? parts.base + "-numbered" : "numbered");
    }, []);

    const handleProcess = async () => {
        if (!file) return;
        setIsProcessing(true);
        setProgress(10);
        setError(null);
        try {
            const formData = new FormData();
            formData.append("file0", file);
            formData.append("position", position);
            formData.append("format", format);
            formData.append("fontSize", String(fontSize));
            formData.append("startNumber", String(startNumber));
            setProgress(30);
            const res = await fetch("/api/add-page-numbers", { method: "POST", body: formData });
            setProgress(70);
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Processing failed");
            }
            const blob = await res.blob();
            setDownloadUrl(URL.createObjectURL(blob));
            setProgress(100);
        } catch (e: any) {
            setError(e.message || "An error occurred");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDownload = () => {
        if (!downloadUrl) return;
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = buildDownloadName(downloadBaseName, ".pdf", "output.pdf");
        a.click();
    };

    const handleReset = () => {
        if (downloadUrl) URL.revokeObjectURL(downloadUrl);
        setFile(null);
        setDownloadUrl(null);
        setError(null);
        setProgress(0);
    };

    return (
        <div className="min-h-screen p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-12">
                    <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">Add Page Numbers</h1>
                    <p className="text-gray-500 dark:text-slate-400 text-lg">
                        Add customizable page numbers to your PDF
                    </p>
                </div>

                {error && (
                    <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-500 font-medium">{error}</div>
                )}

                {!file && (
                    <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 p-8 mb-8">
                        <DragDropUpload onFileSelect={handleFileSelect} accept=".pdf" multiple={false} maxSize={50}
                            icon="🔢" title="Drop your PDF here" subtitle="or click to browse"
                            borderColor="border-indigo-300" hoverColor="border-indigo-500 bg-indigo-500/10" />
                    </div>
                )}

                {file && !downloadUrl && (
                    <>
                        <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 p-6 mb-8">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="text-4xl">📄</div>
                                    <div>
                                        <div className="font-semibold text-gray-700 dark:text-slate-200">{file.name}</div>
                                        <div className="text-sm text-gray-400 dark:text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                                    </div>
                                </div>
                                <button onClick={handleReset} className="text-gray-400 dark:text-slate-500 hover:text-red-400 transition-colors p-2">✕</button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-600 dark:text-slate-300 mb-2">Position</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {POSITIONS.map((p) => (
                                            <button key={p.value} onClick={() => setPosition(p.value)}
                                                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all border-2 ${
                                                    position === p.value
                                                        ? "border-indigo-500 bg-indigo-500 text-white"
                                                        : "border-gray-200 dark:border-white/10 text-gray-600 dark:text-slate-300 hover:border-indigo-400"
                                                }`}>
                                                {p.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-600 dark:text-slate-300 mb-2">Format</label>
                                    <div className="space-y-2">
                                        {FORMATS.map((f) => (
                                            <button key={f.value} onClick={() => setFormat(f.value)}
                                                className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-all border-2 ${
                                                    format === f.value
                                                        ? "border-indigo-500 bg-indigo-500/10 text-indigo-500 dark:text-indigo-300"
                                                        : "border-gray-200 dark:border-white/10 text-gray-600 dark:text-slate-300 hover:border-indigo-400"
                                                }`}>
                                                {f.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-600 dark:text-slate-300 mb-2">Font Size: {fontSize}pt</label>
                                    <input type="range" min="8" max="24" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))}
                                        className="w-full accent-indigo-500" />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-600 dark:text-slate-300 mb-2">Start Number</label>
                                    <input type="number" min="1" value={startNumber} onChange={(e) => setStartNumber(Number(e.target.value))}
                                        className="w-full px-4 py-3 border border-gray-200 dark:border-white/10 rounded-lg focus:border-indigo-500 focus:outline-none bg-white dark:bg-white/5 text-gray-600 dark:text-slate-300" />
                                </div>
                            </div>

                            {/* Preview */}
                            <div className="mt-6 p-4 bg-white dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10">
                                <div className="text-xs text-gray-400 dark:text-slate-500 mb-2">Preview</div>
                                <div className="relative w-32 h-44 mx-auto bg-white dark:bg-slate-800 border border-gray-300 dark:border-white/20 rounded shadow-sm">
                                    <div className={`absolute text-[10px] font-medium text-gray-700 dark:text-slate-300 ${
                                        position.startsWith("top") ? "top-1" : "bottom-1"
                                    } ${position.includes("left") ? "left-2" : position.includes("right") ? "right-2" : "left-1/2 -translate-x-1/2"}`}>
                                        {format.replace("{n}", String(startNumber)).replace("{total}", "10")}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {isProcessing && (
                            <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 p-8 mb-8">
                                <div className="text-center mb-4">
                                    <div className="text-xl font-semibold text-gray-600 dark:text-slate-300">Adding page numbers...</div>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-white/15 rounded-full h-4 overflow-hidden">
                                    <div className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full transition-all duration-300 rounded-full"
                                        style={{ width: `${progress}%` }} />
                                </div>
                            </div>
                        )}

                        {!isProcessing && (
                            <button onClick={handleProcess}
                                className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xl font-bold py-6 rounded-2xl hover:from-indigo-600 hover:to-purple-600 transition-all shadow-xl shadow-black/10 dark:shadow-black/30 hover:shadow-2xl transform hover:scale-105">
                                🔢 Add Page Numbers
                            </button>
                        )}
                    </>
                )}

                {downloadUrl && (
                    <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 p-8 text-center">
                        <div className="w-20 h-20 bg-emerald-500/15 rounded-full flex items-center justify-center mx-auto mb-6"><span className="text-4xl">✅</span></div>
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Page Numbers Added!</h3>
                        <p className="text-gray-500 dark:text-slate-400 mb-6">Your numbered PDF is ready to download.</p>
                        <div className="max-w-md mx-auto mb-6 text-left">
                            <label className="block text-sm font-semibold text-gray-600 dark:text-slate-300 mb-2">File name</label>
                            <div className="flex items-center gap-2">
                                <input type="text" value={downloadBaseName} onChange={(e) => setDownloadBaseName(e.target.value)}
                                    className="flex-1 px-4 py-3 border border-gray-200 dark:border-white/10 rounded-lg focus:border-indigo-500 focus:outline-none bg-white dark:bg-white/5 text-gray-600 dark:text-slate-300" />
                                <span className="px-3 py-2 bg-gray-100 dark:bg-white/10 rounded-lg text-sm text-gray-500 dark:text-slate-400">.pdf</span>
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <button onClick={handleDownload} className="px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg">📥 Download PDF</button>
                            <button onClick={handleReset} className="px-8 py-4 bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-slate-300 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-white/15 transition-all">Number Another PDF</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
