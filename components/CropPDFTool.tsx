"use client";

import { useState, useCallback } from "react";
import DragDropUpload from "./DragDropUpload";
import { splitFileName, buildDownloadName } from "@/lib/fileName";

export default function CropPDFTool() {
    const [file, setFile] = useState<File | null>(null);
    const [top, setTop] = useState(0);
    const [bottom, setBottom] = useState(0);
    const [left, setLeft] = useState(0);
    const [right, setRight] = useState(0);
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
        setDownloadBaseName(parts.base ? parts.base + "-cropped" : "cropped");
    }, []);

    const handleProcess = async () => {
        if (!file) return;
        if (top === 0 && bottom === 0 && left === 0 && right === 0) {
            setError("Please set at least one crop margin");
            return;
        }
        setIsProcessing(true);
        setProgress(10);
        setError(null);
        try {
            const formData = new FormData();
            formData.append("file0", file);
            formData.append("top", String(top));
            formData.append("bottom", String(bottom));
            formData.append("left", String(left));
            formData.append("right", String(right));
            setProgress(30);
            const res = await fetch("/api/crop-pdf", { method: "POST", body: formData });
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
        setTop(0); setBottom(0); setLeft(0); setRight(0);
    };

    const presets = [
        { label: "Small (10pt)", values: { top: 10, bottom: 10, left: 10, right: 10 } },
        { label: "Medium (30pt)", values: { top: 30, bottom: 30, left: 30, right: 30 } },
        { label: "Large (60pt)", values: { top: 60, bottom: 60, left: 60, right: 60 } },
        { label: "Extra Large (100pt)", values: { top: 100, bottom: 100, left: 100, right: 100 } },
    ];

    return (
        <div className="min-h-screen p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-12">
                    <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">Crop PDF</h1>
                    <p className="text-gray-500 dark:text-slate-400 text-lg">
                        Trim margins from all pages of your PDF
                    </p>
                </div>

                {error && (
                    <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-500 font-medium">{error}</div>
                )}

                {!file && (
                    <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 p-8 mb-8">
                        <DragDropUpload onFileSelect={handleFileSelect} accept=".pdf" multiple={false} maxSize={50}
                            icon="✂️" title="Drop your PDF here" subtitle="or click to browse"
                            borderColor="border-orange-300" hoverColor="border-orange-500 bg-orange-500/10" />
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

                            <h2 className="text-lg font-bold text-gray-700 dark:text-slate-200 mb-4">Crop Margins (in points, 72pt = 1 inch)</h2>

                            <div className="flex flex-wrap gap-2 mb-6">
                                {presets.map((p) => (
                                    <button key={p.label} onClick={() => { setTop(p.values.top); setBottom(p.values.bottom); setLeft(p.values.left); setRight(p.values.right); }}
                                        className="px-4 py-2 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-lg hover:bg-orange-500/20 transition-colors text-sm font-medium border border-orange-300 dark:border-orange-500/30">
                                        {p.label}
                                    </button>
                                ))}
                            </div>

                            {/* Visual crop editor */}
                            <div className="relative w-64 h-80 mx-auto mb-6">
                                {/* Outer page */}
                                <div className="absolute inset-0 bg-gray-200 dark:bg-white/10 border-2 border-dashed border-gray-400 dark:border-white/30 rounded">
                                    {/* Inner crop area */}
                                    <div className="absolute bg-white dark:bg-slate-800 border-2 border-orange-500 rounded"
                                        style={{ top: `${(top / 842) * 100}%`, bottom: `${(bottom / 842) * 100}%`, left: `${(left / 595) * 100}%`, right: `${(right / 595) * 100}%` }}>
                                        <div className="flex items-center justify-center h-full text-xs text-gray-400 dark:text-slate-500">Content Area</div>
                                    </div>
                                    {/* Labels */}
                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 text-xs text-orange-500 font-bold">{top}pt</div>
                                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-xs text-orange-500 font-bold">{bottom}pt</div>
                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 text-xs text-orange-500 font-bold">{left}pt</div>
                                    <div className="absolute right-0 top-1/2 -translate-y-1/2 text-xs text-orange-500 font-bold">{right}pt</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {([["Top", top, setTop], ["Bottom", bottom, setBottom], ["Left", left, setLeft], ["Right", right, setRight]] as [string, number, (v: number) => void][]).map(([label, val, setter]) => (
                                    <div key={label}>
                                        <label className="block text-sm font-semibold text-gray-600 dark:text-slate-300 mb-2">{label}: {val}pt</label>
                                        <input type="range" min="0" max="200" value={val} onChange={(e) => setter(Number(e.target.value))}
                                            className="w-full accent-orange-500" />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {isProcessing && (
                            <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 p-8 mb-8">
                                <div className="text-center mb-4"><div className="text-xl font-semibold text-gray-600 dark:text-slate-300">Cropping PDF...</div></div>
                                <div className="w-full bg-gray-200 dark:bg-white/15 rounded-full h-4 overflow-hidden">
                                    <div className="bg-gradient-to-r from-orange-500 to-amber-500 h-full transition-all duration-300 rounded-full" style={{ width: `${progress}%` }} />
                                </div>
                            </div>
                        )}

                        {!isProcessing && (
                            <button onClick={handleProcess}
                                className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xl font-bold py-6 rounded-2xl hover:from-orange-600 hover:to-amber-600 transition-all shadow-xl shadow-black/10 dark:shadow-black/30 hover:shadow-2xl transform hover:scale-105">
                                ✂️ Crop PDF
                            </button>
                        )}
                    </>
                )}

                {downloadUrl && (
                    <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 p-8 text-center">
                        <div className="w-20 h-20 bg-emerald-500/15 rounded-full flex items-center justify-center mx-auto mb-6"><span className="text-4xl">✅</span></div>
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">PDF Cropped!</h3>
                        <p className="text-gray-500 dark:text-slate-400 mb-6">Your cropped PDF is ready to download.</p>
                        <div className="max-w-md mx-auto mb-6 text-left">
                            <label className="block text-sm font-semibold text-gray-600 dark:text-slate-300 mb-2">File name</label>
                            <div className="flex items-center gap-2">
                                <input type="text" value={downloadBaseName} onChange={(e) => setDownloadBaseName(e.target.value)}
                                    className="flex-1 px-4 py-3 border border-gray-200 dark:border-white/10 rounded-lg focus:border-orange-500 focus:outline-none bg-white dark:bg-white/5 text-gray-600 dark:text-slate-300" />
                                <span className="px-3 py-2 bg-gray-100 dark:bg-white/10 rounded-lg text-sm text-gray-500 dark:text-slate-400">.pdf</span>
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <button onClick={handleDownload} className="px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg">📥 Download PDF</button>
                            <button onClick={handleReset} className="px-8 py-4 bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-slate-300 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-white/15 transition-all">Crop Another PDF</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
