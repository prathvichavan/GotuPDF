"use client";

import { useState, useCallback } from "react";
import DragDropUpload from "./DragDropUpload";
import { splitFileName, buildDownloadName } from "@/lib/fileName";

export default function ExtractPagesTool() {
    const [file, setFile] = useState<File | null>(null);
    const [totalPages, setTotalPages] = useState(0);
    const [selectedPages, setSelectedPages] = useState<number[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
    const [downloadBaseName, setDownloadBaseName] = useState("");
    const [error, setError] = useState<string | null>(null);

    const handleFileSelect = useCallback(async (selectedFiles: File[]) => {
        const f = selectedFiles[0];
        if (!f) return;
        setError(null);
        setFile(f);
        setDownloadUrl(null);
        setSelectedPages([]);
        const parts = splitFileName(f.name);
        setDownloadBaseName(parts.base ? parts.base + "-extracted" : "extracted");

        try {
            const { PDFDocument } = await import("pdf-lib");
            const ab = await f.arrayBuffer();
            const pdf = await PDFDocument.load(ab, { ignoreEncryption: true });
            setTotalPages(pdf.getPageCount());
        } catch {
            setError("Failed to load PDF. It may be corrupted.");
        }
    }, []);

    const togglePage = (pageNum: number) => {
        setSelectedPages((prev) =>
            prev.includes(pageNum) ? prev.filter((p) => p !== pageNum) : [...prev, pageNum].sort((a, b) => a - b)
        );
    };

    const selectAll = () => setSelectedPages(Array.from({ length: totalPages }, (_, i) => i + 1));
    const deselectAll = () => setSelectedPages([]);

    const handleProcess = async () => {
        if (!file || selectedPages.length === 0) return;
        setIsProcessing(true);
        setProgress(10);
        setError(null);
        try {
            const formData = new FormData();
            formData.append("file0", file);
            formData.append("pages", selectedPages.join(","));
            setProgress(30);
            const res = await fetch("/api/extract-pages", { method: "POST", body: formData });
            setProgress(70);
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Processing failed");
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            setDownloadUrl(url);
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
        setTotalPages(0);
        setSelectedPages([]);
        setDownloadUrl(null);
        setError(null);
        setProgress(0);
    };

    return (
        <div className="min-h-screen p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-12">
                    <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">Extract Pages</h1>
                    <p className="text-gray-500 dark:text-slate-400 text-lg">
                        Select and extract specific pages into a new PDF
                    </p>
                </div>

                {error && (
                    <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-500 font-medium">
                        {error}
                    </div>
                )}

                {!file && (
                    <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 p-8 mb-8">
                        <DragDropUpload
                            onFileSelect={handleFileSelect}
                            accept=".pdf"
                            multiple={false}
                            maxSize={50}
                            icon="📑"
                            title="Drop your PDF here"
                            subtitle="or click to browse"
                            borderColor="border-blue-300"
                            hoverColor="border-blue-500 bg-blue-500/10"
                        />
                    </div>
                )}

                {file && !downloadUrl && totalPages > 0 && (
                    <>
                        <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 p-6 mb-8">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-4">
                                    <div className="text-4xl">📄</div>
                                    <div>
                                        <div className="font-semibold text-gray-700 dark:text-slate-200">{file.name}</div>
                                        <div className="text-sm text-gray-400 dark:text-slate-500">
                                            {totalPages} pages • {(file.size / 1024 / 1024).toFixed(2)} MB
                                        </div>
                                    </div>
                                </div>
                                <button onClick={handleReset} className="text-gray-400 dark:text-slate-500 hover:text-red-400 transition-colors p-2">✕</button>
                            </div>

                            <h2 className="text-xl font-bold text-gray-700 dark:text-slate-200 mb-4">
                                Select Pages to Extract ({selectedPages.length} selected)
                            </h2>

                            <div className="flex gap-2 mb-4">
                                <button onClick={selectAll} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium">
                                    Select All
                                </button>
                                <button onClick={deselectAll} className="px-4 py-2 bg-gray-300 dark:bg-white/10 text-gray-700 dark:text-white rounded-lg hover:bg-gray-400 dark:hover:bg-white/15 transition-colors text-sm font-medium">
                                    Deselect All
                                </button>
                            </div>

                            <div className="grid grid-cols-10 gap-2 mb-6">
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                                    <button
                                        key={pageNum}
                                        onClick={() => togglePage(pageNum)}
                                        className={`aspect-square rounded-lg border-2 font-semibold transition-all focus:outline-none text-sm ${
                                            selectedPages.includes(pageNum)
                                                ? "border-blue-500 bg-blue-500 text-white shadow-sm"
                                                : "border-gray-300 dark:border-white/15 bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-white hover:border-blue-400 hover:bg-blue-500/10"
                                        }`}
                                    >
                                        {pageNum}
                                    </button>
                                ))}
                            </div>

                            {selectedPages.length > 0 && (
                                <div className="text-center text-gray-500 dark:text-slate-400 mb-4">
                                    {selectedPages.length} page{selectedPages.length > 1 ? "s" : ""} will be extracted
                                </div>
                            )}
                        </div>

                        {isProcessing && (
                            <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 p-8 mb-8">
                                <div className="text-center mb-4">
                                    <div className="text-xl font-semibold text-gray-600 dark:text-slate-300">Extracting pages...</div>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-white/15 rounded-full h-4 overflow-hidden">
                                    <div
                                        className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full transition-all duration-300 rounded-full"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {!isProcessing && selectedPages.length > 0 && (
                            <button
                                onClick={handleProcess}
                                className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xl font-bold py-6 rounded-2xl hover:from-blue-600 hover:to-indigo-600 transition-all shadow-xl shadow-black/10 dark:shadow-black/30 hover:shadow-2xl transform hover:scale-105"
                            >
                                📑 Extract {selectedPages.length} Page{selectedPages.length > 1 ? "s" : ""}
                            </button>
                        )}
                    </>
                )}

                {downloadUrl && (
                    <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 p-8 text-center">
                        <div className="w-20 h-20 bg-emerald-500/15 rounded-full flex items-center justify-center mx-auto mb-6">
                            <span className="text-4xl">✅</span>
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Pages Extracted!</h3>
                        <p className="text-gray-500 dark:text-slate-400 mb-6">
                            Extracted {selectedPages.length} page{selectedPages.length > 1 ? "s" : ""}. Your PDF is ready.
                        </p>
                        <div className="max-w-md mx-auto mb-6 text-left">
                            <label className="block text-sm font-semibold text-gray-600 dark:text-slate-300 mb-2">File name</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={downloadBaseName}
                                    onChange={(e) => setDownloadBaseName(e.target.value)}
                                    className="flex-1 px-4 py-3 border border-gray-200 dark:border-white/10 rounded-lg focus:border-blue-500 focus:outline-none bg-white dark:bg-white/5 text-gray-600 dark:text-slate-300"
                                />
                                <span className="px-3 py-2 bg-gray-100 dark:bg-white/10 rounded-lg text-sm text-gray-500 dark:text-slate-400">.pdf</span>
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <button onClick={handleDownload} className="px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg">
                                📥 Download PDF
                            </button>
                            <button onClick={handleReset} className="px-8 py-4 bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-slate-300 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-white/15 transition-all">
                                Extract More Pages
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
