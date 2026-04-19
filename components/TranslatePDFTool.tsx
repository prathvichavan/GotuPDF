"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import * as pdfjsLib from "pdfjs-dist";
import DragDropUpload from "./DragDropUpload";
import { splitFileName, buildDownloadName } from "@/lib/fileName";

/* ------------------------------------------------------------------ */
/*  pdf.js worker (CDN, same version as the installed package)        */
/* ------------------------------------------------------------------ */
if (typeof window !== "undefined") {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

/* ------------------------------------------------------------------ */
/*  Language list                                                     */
/* ------------------------------------------------------------------ */
const TARGET_LANGUAGES = [
    { value: "en", label: "🇬🇧 English" },
    { value: "mr", label: "🇮🇳 Marathi" },
    { value: "hi", label: "🇮🇳 Hindi" },
    { value: "es", label: "🇪🇸 Spanish" },
    { value: "fr", label: "🇫🇷 French" },
    { value: "de", label: "🇩🇪 German" },
    { value: "it", label: "🇮🇹 Italian" },
    { value: "pt", label: "🇵🇹 Portuguese" },
    { value: "nl", label: "🇳🇱 Dutch" },
    { value: "ru", label: "🇷🇺 Russian" },
    { value: "ja", label: "🇯🇵 Japanese" },
    { value: "ko", label: "🇰🇷 Korean" },
    { value: "zh-CN", label: "🇨🇳 Chinese" },
    { value: "ar", label: "🇸🇦 Arabic" },
];

const SOURCE_LANGUAGES = [
    { value: "en", label: "🇬🇧 English" },
    { value: "mr", label: "🇮🇳 Marathi" },
    { value: "hi", label: "🇮🇳 Hindi" },
    { value: "es", label: "🇪🇸 Spanish" },
    { value: "fr", label: "🇫🇷 French" },
    { value: "de", label: "🇩🇪 German" },
    { value: "auto", label: "🔍 Auto-detect" },
];

const langName = (code: string) =>
    [...TARGET_LANGUAGES, ...SOURCE_LANGUAGES].find((l) => l.value === code)?.label.split(" ").slice(1).join(" ") || code;

/* ------------------------------------------------------------------ */
/*  Phase type for progress                                           */
/* ------------------------------------------------------------------ */
type Phase = "idle" | "extracting" | "translating" | "rebuilding" | "rendering" | "done";
const PHASE_LABELS: Record<Phase, string> = {
    idle: "",
    extracting: "Extracting text from PDF…",
    translating: "Translating content…",
    rebuilding: "Rebuilding PDF layout…",
    rendering: "Rendering preview…",
    done: "Complete!",
};
const PHASE_PCT: Record<Phase, number> = {
    idle: 0, extracting: 15, translating: 50, rebuilding: 75, rendering: 90, done: 100,
};

/* ------------------------------------------------------------------ */
/*  Render a single PDF page to a data-URL image                      */
/* ------------------------------------------------------------------ */
async function renderPageToImage(
    arrayBuffer: ArrayBuffer,
    pageNum: number,
    scale: number,
): Promise<string> {
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
    const page = await doc.getPage(pageNum);
    const vp = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = vp.width;
    canvas.height = vp.height;
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    const url = canvas.toDataURL("image/png");
    doc.destroy();
    return url;
}

/* ================================================================== */
/*  Component                                                         */
/* ================================================================== */
export default function TranslatePDFTool() {
    /* state -------------------------------------------------------- */
    const [file, setFile] = useState<File | null>(null);
    const [sourceLang, setSourceLang] = useState("en");
    const [targetLang, setTargetLang] = useState("mr");
    const [phase, setPhase] = useState<Phase>("idle");
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);

    // Result blobs / buffers
    const [translatedBlob, setTranslatedBlob] = useState<Blob | null>(null);
    const [translatedBuf, setTranslatedBuf] = useState<ArrayBuffer | null>(null);
    const [originalBuf, setOriginalBuf] = useState<ArrayBuffer | null>(null);
    const [totalPages, setTotalPages] = useState(0);

    // Preview state
    const [currentPage, setCurrentPage] = useState(1);
    const [zoom, setZoom] = useState(1.2);
    const [origImg, setOrigImg] = useState<string | null>(null);
    const [transImg, setTransImg] = useState<string | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);

    const [downloadBaseName, setDownloadBaseName] = useState("");

    /* refs --------------------------------------------------------- */
    const abortRef = useRef(false);

    /* file select -------------------------------------------------- */
    const handleFileSelect = useCallback((files: File[]) => {
        const f = files[0];
        if (!f) return;
        setError(null);
        setFile(f);
        setTranslatedBlob(null);
        setTranslatedBuf(null);
        setOriginalBuf(null);
        setPhase("idle");
        setProgress(0);
        setTotalPages(0);
        setCurrentPage(1);
        const parts = splitFileName(f.name);
        const tl = langName(targetLang);
        setDownloadBaseName(parts.base ? `${parts.base}-${tl}` : `translated-${tl}`);
    }, [targetLang]);

    /* render preview for a given page ------------------------------ */
    const renderPreview = useCallback(async (
        origBuf: ArrayBuffer,
        transBuf: ArrayBuffer,
        pageNum: number,
        scale: number,
    ) => {
        setPreviewLoading(true);
        try {
            const [o, t] = await Promise.all([
                renderPageToImage(origBuf, pageNum, scale),
                renderPageToImage(transBuf, pageNum, scale),
            ]);
            setOrigImg(o);
            setTransImg(t);
        } catch (e: any) {
            console.error("Preview render error", e);
        } finally {
            setPreviewLoading(false);
        }
    }, []);

    /* re-render when page or zoom changes -------------------------- */
    useEffect(() => {
        if (originalBuf && translatedBuf && totalPages > 0) {
            renderPreview(originalBuf, translatedBuf, currentPage, zoom);
        }
    }, [currentPage, zoom, originalBuf, translatedBuf, totalPages, renderPreview]);

    /* process ------------------------------------------------------ */
    const handleProcess = async () => {
        if (!file) return;
        abortRef.current = false;
        setError(null);
        setPhase("extracting");
        setProgress(PHASE_PCT.extracting);

        try {
            // Keep original buffer for preview
            const origAB = await file.arrayBuffer();
            setOriginalBuf(origAB);

            // Count pages
            const origDoc = await pdfjsLib.getDocument({ data: new Uint8Array(origAB) }).promise;
            const numPages = origDoc.numPages;
            setTotalPages(numPages);
            origDoc.destroy();

            setPhase("translating");
            setProgress(PHASE_PCT.translating);

            const fd = new FormData();
            fd.append("file0", file);
            fd.append("targetLanguage", targetLang);
            fd.append("sourceLanguage", sourceLang === "auto" ? "en" : sourceLang);

            const res = await fetch("/api/translate-pdf", { method: "POST", body: fd });

            if (abortRef.current) return;

            setPhase("rebuilding");
            setProgress(PHASE_PCT.rebuilding);

            if (!res.ok) {
                const errData = await res.json().catch(() => ({ error: "Translation failed" }));
                throw new Error(errData.error || `Server error ${res.status}`);
            }

            const blob = await res.blob();
            const transBuf = await blob.arrayBuffer();

            setTranslatedBlob(blob);
            setTranslatedBuf(transBuf);

            // Read total pages from header or from buffer
            const hdrPages = res.headers.get("X-Total-Pages");
            if (hdrPages) setTotalPages(Number(hdrPages));

            setPhase("rendering");
            setProgress(PHASE_PCT.rendering);

            // Render first page preview
            await renderPreview(origAB, transBuf, 1, zoom);
            setCurrentPage(1);

            setPhase("done");
            setProgress(100);
        } catch (e: any) {
            if (!abortRef.current) {
                setError(e.message || "An error occurred");
                setPhase("idle");
                setProgress(0);
            }
        }
    };

    /* download ----------------------------------------------------- */
    const handleDownload = () => {
        if (!translatedBlob) return;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(translatedBlob);
        a.download = buildDownloadName(downloadBaseName, ".pdf", "translated.pdf");
        a.click();
        URL.revokeObjectURL(a.href);
    };

    /* reset -------------------------------------------------------- */
    const handleReset = () => {
        abortRef.current = true;
        setFile(null);
        setTranslatedBlob(null);
        setTranslatedBuf(null);
        setOriginalBuf(null);
        setOrigImg(null);
        setTransImg(null);
        setTotalPages(0);
        setCurrentPage(1);
        setZoom(1.2);
        setPhase("idle");
        setProgress(0);
        setError(null);
    };

    /* derived ------------------------------------------------------ */
    const isProcessing = phase !== "idle" && phase !== "done";
    const isDone = phase === "done";

    /* ============================================================== */
    /*  RENDER                                                        */
    /* ============================================================== */
    return (
        <div className="min-h-screen p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="text-center mb-10">
                    <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
                        Translate PDF
                    </h1>
                    <p className="text-gray-500 dark:text-slate-400 text-lg max-w-2xl mx-auto">
                        Translate your PDF while preserving the original layout, images, and formatting.
                        Supports English, Marathi, Hindi and 10+ languages.
                    </p>
                </div>

                {/* Error */}
                {error && (
                    <div className="mb-6 max-w-4xl mx-auto bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-500 font-medium">
                        ⚠️ {error}
                    </div>
                )}

                {/* ---- STEP 1: Upload ---- */}
                {!file && (
                    <div className="max-w-4xl mx-auto bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 p-8">
                        <DragDropUpload
                            onFileSelect={handleFileSelect}
                            accept=".pdf"
                            multiple={false}
                            maxSize={50}
                            icon="🌐"
                            title="Drop your PDF here"
                            subtitle="or click to browse • Up to 50 MB"
                            borderColor="border-pink-300 dark:border-pink-500/40"
                            hoverColor="border-pink-500 bg-pink-500/10"
                        />
                    </div>
                )}

                {/* ---- STEP 2: Configure + Translate ---- */}
                {file && !isDone && (
                    <div className="max-w-4xl mx-auto">
                        {/* File info + language selectors */}
                        <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 p-6 mb-6">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="text-4xl">📄</div>
                                    <div>
                                        <div className="font-semibold text-gray-700 dark:text-slate-200">{file.name}</div>
                                        <div className="text-sm text-gray-400 dark:text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                                    </div>
                                </div>
                                <button onClick={handleReset} className="text-gray-400 hover:text-red-400 transition p-2" disabled={isProcessing}>✕</button>
                            </div>

                            {/* Source language */}
                            <div className="mb-5">
                                <label className="block text-sm font-semibold text-gray-600 dark:text-slate-300 mb-2">Source language</label>
                                <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                                    {SOURCE_LANGUAGES.map((l) => (
                                        <button key={l.value} onClick={() => setSourceLang(l.value)} disabled={isProcessing}
                                            className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all border-2 ${
                                                sourceLang === l.value
                                                    ? "border-pink-500 bg-pink-500 text-white"
                                                    : "border-gray-200 dark:border-white/10 text-gray-600 dark:text-slate-300 hover:border-pink-400"
                                            }`}>
                                            {l.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Target language */}
                            <div className="mb-5">
                                <label className="block text-sm font-semibold text-gray-600 dark:text-slate-300 mb-2">Translate to</label>
                                <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                                    {TARGET_LANGUAGES.map((l) => (
                                        <button key={l.value} onClick={() => setTargetLang(l.value)} disabled={isProcessing}
                                            className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all border-2 ${
                                                targetLang === l.value
                                                    ? "border-pink-500 bg-pink-500 text-white"
                                                    : "border-gray-200 dark:border-white/10 text-gray-600 dark:text-slate-300 hover:border-pink-400"
                                            }`}>
                                            {l.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Info note */}
                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-blue-600 dark:text-blue-400 text-sm">
                                ℹ️ Layout, images and formatting are preserved. Scanned PDFs are auto-detected for OCR.
                            </div>
                        </div>

                        {/* Progress bar */}
                        {isProcessing && (
                            <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 p-8 mb-6 animate-pulse-slow">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm font-semibold text-gray-600 dark:text-slate-300">{PHASE_LABELS[phase]}</span>
                                    <span className="text-sm font-mono text-gray-400 dark:text-slate-500">{progress}%</span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-white/10 rounded-full h-3 overflow-hidden">
                                    <div
                                        className="bg-gradient-to-r from-pink-500 to-rose-500 h-full transition-all duration-700 ease-out rounded-full"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                                <p className="text-xs text-gray-400 dark:text-slate-500 mt-2 text-center">
                                    This may take a moment for large documents…
                                </p>
                            </div>
                        )}

                        {/* Translate button */}
                        {!isProcessing && (
                            <button
                                onClick={handleProcess}
                                className="w-full bg-gradient-to-r from-pink-500 to-rose-500 text-white text-xl font-bold py-6 rounded-2xl hover:from-pink-600 hover:to-rose-600 transition-all shadow-xl shadow-black/10 dark:shadow-black/30 hover:shadow-2xl transform hover:scale-[1.02]"
                            >
                                🌐 Translate PDF
                            </button>
                        )}
                    </div>
                )}

                {/* ---- STEP 3: Preview + Download ---- */}
                {isDone && (
                    <div className="space-y-6">
                        {/* Language labels */}
                        <div className="flex items-center justify-center gap-8 text-sm font-semibold">
                            <span className="px-4 py-2 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                Original: {langName(sourceLang === "auto" ? "en" : sourceLang)}
                            </span>
                            <span className="text-gray-400 dark:text-slate-500 text-lg">→</span>
                            <span className="px-4 py-2 rounded-full bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20">
                                Translated: {langName(targetLang)}
                            </span>
                        </div>

                        {/* Controls bar */}
                        <div className="flex items-center justify-center gap-4 flex-wrap">
                            {/* Page navigation */}
                            <div className="flex items-center gap-2 bg-gray-100 dark:bg-white/5 rounded-xl px-4 py-2 shadow">
                                <button
                                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                    disabled={currentPage <= 1 || previewLoading}
                                    className="px-2 py-1 rounded-lg text-sm font-bold text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-white/10 disabled:opacity-30 transition"
                                >
                                    ◀
                                </button>
                                <span className="text-sm font-mono text-gray-600 dark:text-slate-300 min-w-[80px] text-center">
                                    Page {currentPage} / {totalPages}
                                </span>
                                <button
                                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={currentPage >= totalPages || previewLoading}
                                    className="px-2 py-1 rounded-lg text-sm font-bold text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-white/10 disabled:opacity-30 transition"
                                >
                                    ▶
                                </button>
                            </div>

                            {/* Zoom */}
                            <div className="flex items-center gap-2 bg-gray-100 dark:bg-white/5 rounded-xl px-4 py-2 shadow">
                                <button
                                    onClick={() => setZoom((z) => Math.max(0.5, z - 0.2))}
                                    disabled={previewLoading}
                                    className="px-2 py-1 rounded-lg text-sm font-bold text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-white/10 disabled:opacity-30 transition"
                                >
                                    −
                                </button>
                                <span className="text-sm font-mono text-gray-600 dark:text-slate-300 min-w-[50px] text-center">
                                    {Math.round(zoom * 100)}%
                                </span>
                                <button
                                    onClick={() => setZoom((z) => Math.min(3, z + 0.2))}
                                    disabled={previewLoading}
                                    className="px-2 py-1 rounded-lg text-sm font-bold text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-white/10 disabled:opacity-30 transition"
                                >
                                    +
                                </button>
                            </div>
                        </div>

                        {/* Dual preview */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Original */}
                            <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 overflow-hidden">
                                <div className="bg-blue-500/10 border-b border-blue-500/20 px-4 py-3 text-center">
                                    <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                                        📄 Original — {langName(sourceLang === "auto" ? "en" : sourceLang)}
                                    </span>
                                </div>
                                <div className="p-4 flex items-center justify-center min-h-[400px] overflow-auto">
                                    {previewLoading ? (
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                                            <span className="text-sm text-gray-400 dark:text-slate-500">Rendering…</span>
                                        </div>
                                    ) : origImg ? (
                                        <img
                                            src={origImg}
                                            alt={`Original page ${currentPage}`}
                                            className="max-w-full h-auto rounded shadow-lg border border-gray-200 dark:border-white/10 transition-all duration-300"
                                        />
                                    ) : (
                                        <span className="text-gray-400 dark:text-slate-500">No preview</span>
                                    )}
                                </div>
                            </div>

                            {/* Translated */}
                            <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 overflow-hidden">
                                <div className="bg-pink-500/10 border-b border-pink-500/20 px-4 py-3 text-center">
                                    <span className="text-sm font-semibold text-pink-600 dark:text-pink-400">
                                        🌐 Translated — {langName(targetLang)}
                                    </span>
                                </div>
                                <div className="p-4 flex items-center justify-center min-h-[400px] overflow-auto">
                                    {previewLoading ? (
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-10 h-10 border-4 border-pink-500/30 border-t-pink-500 rounded-full animate-spin" />
                                            <span className="text-sm text-gray-400 dark:text-slate-500">Rendering…</span>
                                        </div>
                                    ) : transImg ? (
                                        <img
                                            src={transImg}
                                            alt={`Translated page ${currentPage}`}
                                            className="max-w-full h-auto rounded shadow-lg border border-gray-200 dark:border-white/10 transition-all duration-300"
                                        />
                                    ) : (
                                        <span className="text-gray-400 dark:text-slate-500">No preview</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Download section */}
                        <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 p-6">
                            <div className="flex flex-col md:flex-row items-center gap-4">
                                <div className="flex-1 w-full">
                                    <label className="block text-sm font-semibold text-gray-600 dark:text-slate-300 mb-1">File name</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={downloadBaseName}
                                            onChange={(e) => setDownloadBaseName(e.target.value)}
                                            className="flex-1 px-4 py-3 border border-gray-200 dark:border-white/10 rounded-lg focus:border-pink-500 focus:outline-none bg-white dark:bg-white/5 text-gray-700 dark:text-slate-300"
                                        />
                                        <span className="px-3 py-2 bg-gray-200 dark:bg-white/10 rounded-lg text-sm text-gray-500 dark:text-slate-400">.pdf</span>
                                    </div>
                                </div>
                                <div className="flex gap-3 mt-2 md:mt-6">
                                    <button
                                        onClick={handleDownload}
                                        className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-semibold hover:from-green-600 hover:to-emerald-600 transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
                                    >
                                        📥 Download
                                    </button>
                                    <button
                                        onClick={handleReset}
                                        className="px-8 py-4 bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-slate-300 rounded-xl font-semibold hover:bg-gray-300 dark:hover:bg-white/15 transition-all"
                                    >
                                        ↺ New Translation
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
