"use client";

import { useState, useCallback } from "react";
import DragDropUpload from "./DragDropUpload";
import { splitFileName, buildDownloadName } from "@/lib/fileName";

const LANGUAGES = [
    { value: "eng", label: "English" },
    { value: "spa", label: "Spanish" },
    { value: "fra", label: "French" },
    { value: "deu", label: "German" },
    { value: "ita", label: "Italian" },
    { value: "por", label: "Portuguese" },
    { value: "hin", label: "Hindi" },
    { value: "jpn", label: "Japanese" },
    { value: "kor", label: "Korean" },
    { value: "chi_sim", label: "Chinese (Simplified)" },
    { value: "ara", label: "Arabic" },
    { value: "rus", label: "Russian" },
];

export default function OCRPDFTool() {
    const [file, setFile] = useState<File | null>(null);
    const [language, setLanguage] = useState("eng");
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [resultText, setResultText] = useState<string | null>(null);
    const [downloadBaseName, setDownloadBaseName] = useState("");
    const [error, setError] = useState<string | null>(null);

    const handleFileSelect = useCallback((selectedFiles: File[]) => {
        const f = selectedFiles[0];
        if (!f) return;
        setError(null);
        setFile(f);
        setResultText(null);
        const parts = splitFileName(f.name);
        setDownloadBaseName(parts.base ? parts.base + "-ocr" : "ocr-result");
    }, []);

    const handleProcess = async () => {
        if (!file) return;
        setIsProcessing(true);
        setProgress(10);
        setError(null);
        try {
            const formData = new FormData();
            formData.append("file0", file);
            formData.append("language", language);
            setProgress(30);
            const res = await fetch("/api/ocr-pdf", { method: "POST", body: formData });
            setProgress(70);
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Processing failed");
            }
            const text = await res.text();
            setResultText(text);
            setProgress(100);
        } catch (e: any) {
            setError(e.message || "An error occurred");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDownload = () => {
        if (!resultText) return;
        const blob = new Blob([resultText], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = buildDownloadName(downloadBaseName, ".txt", "output.txt");
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleCopy = () => {
        if (resultText) navigator.clipboard.writeText(resultText);
    };

    const handleReset = () => {
        setFile(null);
        setResultText(null);
        setError(null);
        setProgress(0);
    };

    return (
        <div className="min-h-screen p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-12">
                    <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">OCR PDF</h1>
                    <p className="text-gray-500 dark:text-slate-400 text-lg">
                        Extract text from scanned PDFs using optical character recognition
                    </p>
                </div>

                {error && (
                    <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-500 font-medium">{error}</div>
                )}

                {!file && (
                    <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 p-8 mb-8">
                        <DragDropUpload onFileSelect={handleFileSelect} accept=".pdf" multiple={false} maxSize={50}
                            icon="🔍" title="Drop your PDF here" subtitle="or click to browse"
                            borderColor="border-emerald-300" hoverColor="border-emerald-500 bg-emerald-500/10" />
                    </div>
                )}

                {file && !resultText && (
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

                            <div>
                                <label className="block text-sm font-semibold text-gray-600 dark:text-slate-300 mb-2">Language</label>
                                <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                                    {LANGUAGES.map((lang) => (
                                        <button key={lang.value} onClick={() => setLanguage(lang.value)}
                                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border-2 ${
                                                language === lang.value
                                                    ? "border-emerald-500 bg-emerald-500 text-white"
                                                    : "border-gray-200 dark:border-white/10 text-gray-600 dark:text-slate-300 hover:border-emerald-400"
                                            }`}>
                                            {lang.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {isProcessing && (
                            <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 p-8 mb-8">
                                <div className="text-center mb-4"><div className="text-xl font-semibold text-gray-600 dark:text-slate-300">Extracting text (OCR)...</div></div>
                                <div className="w-full bg-gray-200 dark:bg-white/15 rounded-full h-4 overflow-hidden">
                                    <div className="bg-gradient-to-r from-emerald-500 to-green-500 h-full transition-all duration-300 rounded-full" style={{ width: `${progress}%` }} />
                                </div>
                                <p className="text-sm text-gray-400 dark:text-slate-500 mt-3 text-center">This may take a few minutes for large documents...</p>
                            </div>
                        )}

                        {!isProcessing && (
                            <button onClick={handleProcess}
                                className="w-full bg-gradient-to-r from-emerald-500 to-green-500 text-white text-xl font-bold py-6 rounded-2xl hover:from-emerald-600 hover:to-green-600 transition-all shadow-xl shadow-black/10 dark:shadow-black/30 hover:shadow-2xl transform hover:scale-105">
                                🔍 Extract Text (OCR)
                            </button>
                        )}
                    </>
                )}

                {resultText && (
                    <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Extracted Text</h3>
                            <div className="flex gap-2">
                                <button onClick={handleCopy}
                                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium">
                                    📋 Copy
                                </button>
                                <button onClick={handleDownload}
                                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium">
                                    📥 Download .txt
                                </button>
                            </div>
                        </div>
                        <div className="max-w-md mx-auto mb-4 text-left">
                            <label className="block text-sm font-semibold text-gray-600 dark:text-slate-300 mb-2">File name</label>
                            <div className="flex items-center gap-2">
                                <input type="text" value={downloadBaseName} onChange={(e) => setDownloadBaseName(e.target.value)}
                                    className="flex-1 px-4 py-2 border border-gray-200 dark:border-white/10 rounded-lg focus:border-emerald-500 focus:outline-none bg-white dark:bg-white/5 text-gray-600 dark:text-slate-300 text-sm" />
                                <span className="px-3 py-2 bg-gray-100 dark:bg-white/10 rounded-lg text-sm text-gray-500 dark:text-slate-400">.txt</span>
                            </div>
                        </div>
                        <pre className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/10 rounded-xl p-4 text-sm text-gray-700 dark:text-slate-300 max-h-96 overflow-auto whitespace-pre-wrap font-mono">
                            {resultText}
                        </pre>
                        <button onClick={handleReset} className="mt-4 px-6 py-3 bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-slate-300 rounded-xl font-semibold hover:bg-gray-300 dark:hover:bg-white/15 transition-all">
                            OCR Another PDF
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
