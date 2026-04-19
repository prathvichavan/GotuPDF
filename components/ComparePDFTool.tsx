"use client";

import { useState, useCallback } from "react";
import DragDropUpload from "./DragDropUpload";

interface DiffLine {
    type: "same" | "added" | "removed";
    text: string;
    lineNumber?: number;
}

interface CompareResult {
    file1: { name: string; lineCount: number };
    file2: { name: string; lineCount: number };
    identical: boolean;
    additions: number;
    deletions: number;
    unchanged: number;
    diff: DiffLine[];
}

export default function ComparePDFTool() {
    const [file1, setFile1] = useState<File | null>(null);
    const [file2, setFile2] = useState<File | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [result, setResult] = useState<CompareResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showDiff, setShowDiff] = useState(true);

    const handleFile1Select = useCallback((selectedFiles: File[]) => {
        setFile1(selectedFiles[0] || null);
        setResult(null);
        setError(null);
    }, []);

    const handleFile2Select = useCallback((selectedFiles: File[]) => {
        setFile2(selectedFiles[0] || null);
        setResult(null);
        setError(null);
    }, []);

    const handleCompare = async () => {
        if (!file1 || !file2) return;
        setIsProcessing(true);
        setProgress(10);
        setError(null);
        try {
            const formData = new FormData();
            formData.append("file0", file1);
            formData.append("file1", file2);
            setProgress(30);
            const res = await fetch("/api/compare-pdf", { method: "POST", body: formData });
            setProgress(70);
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Comparison failed");
            }
            const data = await res.json();
            setResult(data);
            setProgress(100);
        } catch (e: any) {
            setError(e.message || "An error occurred");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReset = () => {
        setFile1(null);
        setFile2(null);
        setResult(null);
        setError(null);
        setProgress(0);
    };

    return (
        <div className="min-h-screen p-4 md:p-8">
            <div className="max-w-5xl mx-auto">
                <div className="text-center mb-12">
                    <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">Compare PDF</h1>
                    <p className="text-gray-500 dark:text-slate-400 text-lg">
                        Compare two PDF documents and see the differences
                    </p>
                </div>

                {error && (
                    <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-500 font-medium">{error}</div>
                )}

                {!result && (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                            <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 p-6">
                                <h2 className="text-lg font-bold text-gray-700 dark:text-slate-200 mb-4">📄 First PDF</h2>
                                {file1 ? (
                                    <div className="flex items-center justify-between bg-white dark:bg-white/5 rounded-xl p-4 border border-gray-200 dark:border-white/10">
                                        <div>
                                            <div className="font-semibold text-gray-700 dark:text-slate-200 text-sm">{file1.name}</div>
                                            <div className="text-xs text-gray-400 dark:text-slate-500">{(file1.size / 1024 / 1024).toFixed(2)} MB</div>
                                        </div>
                                        <button onClick={() => { setFile1(null); setResult(null); }} className="text-red-400 hover:text-red-600 text-sm">Remove</button>
                                    </div>
                                ) : (
                                    <DragDropUpload onFileSelect={handleFile1Select} accept=".pdf" multiple={false} maxSize={50}
                                        icon="📄" title="Drop first PDF" subtitle="or click to browse"
                                        borderColor="border-blue-300" hoverColor="border-blue-500 bg-blue-500/10" />
                                )}
                            </div>

                            <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 p-6">
                                <h2 className="text-lg font-bold text-gray-700 dark:text-slate-200 mb-4">📄 Second PDF</h2>
                                {file2 ? (
                                    <div className="flex items-center justify-between bg-white dark:bg-white/5 rounded-xl p-4 border border-gray-200 dark:border-white/10">
                                        <div>
                                            <div className="font-semibold text-gray-700 dark:text-slate-200 text-sm">{file2.name}</div>
                                            <div className="text-xs text-gray-400 dark:text-slate-500">{(file2.size / 1024 / 1024).toFixed(2)} MB</div>
                                        </div>
                                        <button onClick={() => { setFile2(null); setResult(null); }} className="text-red-400 hover:text-red-600 text-sm">Remove</button>
                                    </div>
                                ) : (
                                    <DragDropUpload onFileSelect={handleFile2Select} accept=".pdf" multiple={false} maxSize={50}
                                        icon="📄" title="Drop second PDF" subtitle="or click to browse"
                                        borderColor="border-purple-300" hoverColor="border-purple-500 bg-purple-500/10" />
                                )}
                            </div>
                        </div>

                        {isProcessing && (
                            <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 p-8 mb-8">
                                <div className="text-center mb-4"><div className="text-xl font-semibold text-gray-600 dark:text-slate-300">Comparing PDFs...</div></div>
                                <div className="w-full bg-gray-200 dark:bg-white/15 rounded-full h-4 overflow-hidden">
                                    <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-full transition-all duration-300 rounded-full" style={{ width: `${progress}%` }} />
                                </div>
                            </div>
                        )}

                        {!isProcessing && file1 && file2 && (
                            <button onClick={handleCompare}
                                className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xl font-bold py-6 rounded-2xl hover:from-blue-600 hover:to-purple-600 transition-all shadow-xl shadow-black/10 dark:shadow-black/30 hover:shadow-2xl transform hover:scale-105">
                                🔍 Compare PDFs
                            </button>
                        )}
                    </>
                )}

                {result && (
                    <div className="space-y-6">
                        {/* Summary */}
                        <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 p-6">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Comparison Result</h3>

                            {result.identical ? (
                                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-6 text-center">
                                    <span className="text-4xl mb-2 block">✅</span>
                                    <p className="text-emerald-600 dark:text-emerald-400 font-bold text-lg">Documents are identical!</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
                                        <div className="text-3xl font-bold text-green-500">{result.additions}</div>
                                        <div className="text-sm text-gray-500 dark:text-slate-400">Additions</div>
                                    </div>
                                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
                                        <div className="text-3xl font-bold text-red-500">{result.deletions}</div>
                                        <div className="text-sm text-gray-500 dark:text-slate-400">Deletions</div>
                                    </div>
                                    <div className="bg-gray-500/10 border border-gray-500/20 dark:border-white/10 rounded-xl p-4 text-center">
                                        <div className="text-3xl font-bold text-gray-500">{result.unchanged}</div>
                                        <div className="text-sm text-gray-500 dark:text-slate-400">Unchanged</div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Diff Output */}
                        {!result.identical && (
                            <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold text-gray-700 dark:text-slate-200">Diff View</h3>
                                    <button onClick={() => setShowDiff(!showDiff)}
                                        className="px-4 py-2 bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-gray-300 dark:hover:bg-white/15 transition">
                                        {showDiff ? "Hide" : "Show"} Details
                                    </button>
                                </div>
                                {showDiff && (
                                    <div className="max-h-96 overflow-auto bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-white/10 font-mono text-xs">
                                        {result.diff.map((line, i) => (
                                            <div key={i} className={`px-4 py-1 border-b border-gray-100 dark:border-white/5 ${
                                                line.type === "added" ? "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400" :
                                                line.type === "removed" ? "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400" :
                                                "text-gray-600 dark:text-slate-400"
                                            }`}>
                                                <span className="inline-block w-6 text-gray-400 dark:text-slate-600">
                                                    {line.type === "added" ? "+" : line.type === "removed" ? "-" : " "}
                                                </span>
                                                {line.text || "\u00A0"}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <button onClick={handleReset}
                            className="w-full py-4 bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-slate-300 rounded-2xl font-semibold hover:bg-gray-300 dark:hover:bg-white/15 transition-all">
                            Compare Different PDFs
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
