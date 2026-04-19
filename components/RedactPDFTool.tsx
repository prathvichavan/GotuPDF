"use client";

import { useState, useCallback, useRef } from "react";
import DragDropUpload from "./DragDropUpload";
import { splitFileName, buildDownloadName } from "@/lib/fileName";

interface RedactArea {
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
}

export default function RedactPDFTool() {
    const [file, setFile] = useState<File | null>(null);
    const [totalPages, setTotalPages] = useState(0);
    const [areas, setAreas] = useState<RedactArea[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
    const [downloadBaseName, setDownloadBaseName] = useState("");
    const [error, setError] = useState<string | null>(null);

    // Quick-add form
    const [areaX, setAreaX] = useState(50);
    const [areaY, setAreaY] = useState(50);
    const [areaW, setAreaW] = useState(200);
    const [areaH, setAreaH] = useState(20);

    const handleFileSelect = useCallback(async (selectedFiles: File[]) => {
        const f = selectedFiles[0];
        if (!f) return;
        setError(null);
        setFile(f);
        setDownloadUrl(null);
        setAreas([]);
        const parts = splitFileName(f.name);
        setDownloadBaseName(parts.base ? parts.base + "-redacted" : "redacted");
        try {
            const { PDFDocument } = await import("pdf-lib");
            const ab = await f.arrayBuffer();
            const pdf = await PDFDocument.load(ab, { ignoreEncryption: true });
            setTotalPages(pdf.getPageCount());
        } catch {
            setError("Failed to load PDF.");
        }
    }, []);

    const addArea = () => {
        setAreas((prev) => [...prev, { page: currentPage, x: areaX, y: areaY, width: areaW, height: areaH }]);
    };

    const removeArea = (index: number) => {
        setAreas((prev) => prev.filter((_, i) => i !== index));
    };

    const handleProcess = async () => {
        if (!file || areas.length === 0) return;
        setIsProcessing(true);
        setProgress(10);
        setError(null);
        try {
            const formData = new FormData();
            formData.append("file0", file);
            formData.append("areas", JSON.stringify(areas));
            setProgress(30);
            const res = await fetch("/api/redact-pdf", { method: "POST", body: formData });
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
        setAreas([]);
    };

    return (
        <div className="min-h-screen p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-12">
                    <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">Redact PDF</h1>
                    <p className="text-gray-500 dark:text-slate-400 text-lg">
                        Permanently black out sensitive areas in your PDF
                    </p>
                </div>

                {error && (
                    <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-500 font-medium">{error}</div>
                )}

                {!file && (
                    <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 p-8 mb-8">
                        <DragDropUpload onFileSelect={handleFileSelect} accept=".pdf" multiple={false} maxSize={50}
                            icon="🔒" title="Drop your PDF here" subtitle="or click to browse"
                            borderColor="border-rose-300" hoverColor="border-rose-500 bg-rose-500/10" />
                    </div>
                )}

                {file && !downloadUrl && totalPages > 0 && (
                    <>
                        <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 p-6 mb-8">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="text-4xl">📄</div>
                                    <div>
                                        <div className="font-semibold text-gray-700 dark:text-slate-200">{file.name}</div>
                                        <div className="text-sm text-gray-400 dark:text-slate-500">{totalPages} pages</div>
                                    </div>
                                </div>
                                <button onClick={handleReset} className="text-gray-400 dark:text-slate-500 hover:text-red-400 transition-colors p-2">✕</button>
                            </div>

                            <h2 className="text-lg font-bold text-gray-700 dark:text-slate-200 mb-4">
                                Add Redaction Areas ({areas.length} area{areas.length !== 1 ? "s" : ""})
                            </h2>

                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1">Page</label>
                                    <input type="number" min={1} max={totalPages} value={currentPage} onChange={(e) => setCurrentPage(Number(e.target.value))}
                                        className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-gray-600 dark:text-slate-300 text-sm focus:outline-none focus:border-rose-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1">X</label>
                                    <input type="number" min={0} value={areaX} onChange={(e) => setAreaX(Number(e.target.value))}
                                        className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-gray-600 dark:text-slate-300 text-sm focus:outline-none focus:border-rose-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1">Y</label>
                                    <input type="number" min={0} value={areaY} onChange={(e) => setAreaY(Number(e.target.value))}
                                        className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-gray-600 dark:text-slate-300 text-sm focus:outline-none focus:border-rose-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1">Width</label>
                                    <input type="number" min={10} value={areaW} onChange={(e) => setAreaW(Number(e.target.value))}
                                        className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-gray-600 dark:text-slate-300 text-sm focus:outline-none focus:border-rose-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1">Height</label>
                                    <input type="number" min={10} value={areaH} onChange={(e) => setAreaH(Number(e.target.value))}
                                        className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-gray-600 dark:text-slate-300 text-sm focus:outline-none focus:border-rose-500" />
                                </div>
                            </div>

                            <button onClick={addArea}
                                className="px-6 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors text-sm font-medium mb-6">
                                + Add Redaction Area
                            </button>

                            {areas.length > 0 && (
                                <div className="space-y-2 mb-4">
                                    {areas.map((area, i) => (
                                        <div key={i} className="flex items-center justify-between bg-white dark:bg-white/5 px-4 py-2 rounded-lg border border-gray-200 dark:border-white/10">
                                            <span className="text-sm text-gray-600 dark:text-slate-300">
                                                Page {area.page}: ({area.x}, {area.y}) {area.width}×{area.height}
                                            </span>
                                            <button onClick={() => removeArea(i)} className="text-red-400 hover:text-red-600 text-sm font-medium">Remove</button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-amber-600 dark:text-amber-400 text-sm">
                                ⚠️ Redaction is permanent. The original content under black boxes cannot be recovered.
                            </div>
                        </div>

                        {isProcessing && (
                            <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 p-8 mb-8">
                                <div className="text-center mb-4"><div className="text-xl font-semibold text-gray-600 dark:text-slate-300">Redacting PDF...</div></div>
                                <div className="w-full bg-gray-200 dark:bg-white/15 rounded-full h-4 overflow-hidden">
                                    <div className="bg-gradient-to-r from-rose-500 to-red-500 h-full transition-all duration-300 rounded-full" style={{ width: `${progress}%` }} />
                                </div>
                            </div>
                        )}

                        {!isProcessing && areas.length > 0 && (
                            <button onClick={handleProcess}
                                className="w-full bg-gradient-to-r from-rose-500 to-red-500 text-white text-xl font-bold py-6 rounded-2xl hover:from-rose-600 hover:to-red-600 transition-all shadow-xl shadow-black/10 dark:shadow-black/30 hover:shadow-2xl transform hover:scale-105">
                                🔒 Redact {areas.length} Area{areas.length > 1 ? "s" : ""}
                            </button>
                        )}
                    </>
                )}

                {downloadUrl && (
                    <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 p-8 text-center">
                        <div className="w-20 h-20 bg-emerald-500/15 rounded-full flex items-center justify-center mx-auto mb-6"><span className="text-4xl">✅</span></div>
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">PDF Redacted!</h3>
                        <p className="text-gray-500 dark:text-slate-400 mb-6">Sensitive content has been permanently removed.</p>
                        <div className="max-w-md mx-auto mb-6 text-left">
                            <label className="block text-sm font-semibold text-gray-600 dark:text-slate-300 mb-2">File name</label>
                            <div className="flex items-center gap-2">
                                <input type="text" value={downloadBaseName} onChange={(e) => setDownloadBaseName(e.target.value)}
                                    className="flex-1 px-4 py-3 border border-gray-200 dark:border-white/10 rounded-lg focus:border-rose-500 focus:outline-none bg-white dark:bg-white/5 text-gray-600 dark:text-slate-300" />
                                <span className="px-3 py-2 bg-gray-100 dark:bg-white/10 rounded-lg text-sm text-gray-500 dark:text-slate-400">.pdf</span>
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <button onClick={handleDownload} className="px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg">📥 Download PDF</button>
                            <button onClick={handleReset} className="px-8 py-4 bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-slate-300 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-white/15 transition-all">Redact Another PDF</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
