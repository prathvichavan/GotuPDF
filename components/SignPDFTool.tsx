"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import DragDropUpload from "./DragDropUpload";
import { splitFileName, buildDownloadName } from "@/lib/fileName";

type SigMode = "draw" | "upload" | "type";

const SIG_FONTS = [
    { label: "Script", family: "'Brush Script MT', 'Segoe Script', cursive" },
    { label: "Handwriting", family: "'Dancing Script', 'Comic Sans MS', cursive" },
    { label: "Formal", family: "'Times New Roman', serif" },
    { label: "Elegant", family: "'Georgia', serif" },
];

export default function SignPDFTool() {
    /* ── state ─────────────────────────────────────────── */
    const [file, setFile] = useState<File | null>(null);
    const [totalPages, setTotalPages] = useState(1);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageImage, setPageImage] = useState<string | null>(null);
    const [pageWidth, setPageWidth] = useState(612);
    const [pageHeight, setPageHeight] = useState(792);
    const [sigMode, setSigMode] = useState<SigMode>("draw");
    const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
    const [typedText, setTypedText] = useState("");
    const [typedFont, setTypedFont] = useState(SIG_FONTS[0].family);

    /* placement */
    const [sigX, setSigX] = useState(100);
    const [sigY, setSigY] = useState(600);
    const [sigW, setSigW] = useState(200);
    const [sigH, setSigH] = useState(80);
    const [sigRot, setSigRot] = useState(0);
    const [sigOpacity, setSigOpacity] = useState(1);
    const [applyAll, setApplyAll] = useState(false);

    /* processing */
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
    const [downloadBaseName, setDownloadBaseName] = useState("");
    const [error, setError] = useState<string | null>(null);

    /* refs */
    const drawCanvasRef = useRef<HTMLCanvasElement>(null);
    const drawingRef = useRef(false);
    const lastPosRef = useRef({ x: 0, y: 0 });
    const previewRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
    const resizeRef = useRef<string | null>(null);

    /* ── file selection ────────────────────────────────── */
    const handleFileSelect = useCallback(async (selectedFiles: File[]) => {
        const f = selectedFiles[0];
        if (!f) return;
        setError(null);
        setFile(f);
        setDownloadUrl(null);
        const parts = splitFileName(f.name);
        setDownloadBaseName(parts.base ? parts.base + "-signed" : "signed");
        try {
            const { PDFDocument } = await import("pdf-lib");
            const ab = await f.arrayBuffer();
            const pdf = await PDFDocument.load(ab, { ignoreEncryption: true });
            setTotalPages(pdf.getPageCount());
            const p = pdf.getPage(0);
            setPageWidth(p.getWidth());
            setPageHeight(p.getHeight());
        } catch { setTotalPages(1); }
    }, []);

    /* ── render PDF page to preview image ──────────────── */
    useEffect(() => {
        if (!file) return;
        let cancelled = false;
        (async () => {
            try {
                const pdfjsLib = await import("pdfjs-dist");
                if (typeof window !== "undefined") {
                    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
                }
                const ab = await file.arrayBuffer();
                const doc = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
                const page = await doc.getPage(currentPage);
                const vp = page.getViewport({ scale: 1 });
                const scale = 600 / vp.width;
                const viewport = page.getViewport({ scale });
                const canvas = document.createElement("canvas");
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                const ctx = canvas.getContext("2d")!;
                await page.render({ canvasContext: ctx, viewport }).promise;
                if (!cancelled) setPageImage(canvas.toDataURL("image/png"));
            } catch (e: any) {
                console.warn("Could not render page preview:", e);
            }
        })();
        return () => { cancelled = true; };
    }, [file, currentPage]);

    /* ── draw canvas init ──────────────────────────────── */
    useEffect(() => {
        const canvas = drawCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
    }, [file, sigMode]);

    /* ── drawing helpers ───────────────────────────────── */
    const canvasPos = (e: React.MouseEvent | React.TouchEvent) => {
        const c = drawCanvasRef.current!;
        const r = c.getBoundingClientRect();
        if ("touches" in e) return { x: e.touches[0].clientX - r.left, y: e.touches[0].clientY - r.top };
        return { x: (e as React.MouseEvent).clientX - r.left, y: (e as React.MouseEvent).clientY - r.top };
    };
    const startDraw = (e: React.MouseEvent | React.TouchEvent) => { e.preventDefault(); drawingRef.current = true; lastPosRef.current = canvasPos(e); };
    const moveDraw = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        if (!drawingRef.current) return;
        const ctx = drawCanvasRef.current?.getContext("2d"); if (!ctx) return;
        const pos = canvasPos(e);
        ctx.beginPath(); ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y); ctx.lineTo(pos.x, pos.y); ctx.stroke();
        lastPosRef.current = pos;
    };
    const endDraw = () => {
        drawingRef.current = false;
        const c = drawCanvasRef.current;
        if (c) setSignatureDataUrl(c.toDataURL("image/png"));
    };
    const clearCanvas = () => {
        const c = drawCanvasRef.current; const ctx = c?.getContext("2d");
        if (!ctx || !c) return;
        ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, c.width, c.height);
        setSignatureDataUrl(null);
    };

    /* ── upload signature image ────────────────────────── */
    const handleSigUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0]; if (!f) return;
        const reader = new FileReader();
        reader.onload = () => setSignatureDataUrl(reader.result as string);
        reader.readAsDataURL(f);
    };

    /* ── typed signature → dataURL ─────────────────────── */
    useEffect(() => {
        if (sigMode !== "type" || !typedText.trim()) { if (sigMode === "type") setSignatureDataUrl(null); return; }
        const c = document.createElement("canvas"); c.width = 400; c.height = 100;
        const ctx = c.getContext("2d")!;
        ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, 400, 100);
        ctx.font = `36px ${typedFont}`; ctx.fillStyle = "#000000"; ctx.textBaseline = "middle";
        ctx.fillText(typedText, 10, 50);
        setSignatureDataUrl(c.toDataURL("image/png"));
    }, [typedText, typedFont, sigMode]);

    /* ── drag & drop on preview ────────────────────────── */
    const previewScale = pageImage ? 600 / pageWidth : 1;
    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation();
        const t = (e.target as HTMLElement).dataset.resize;
        if (t) { resizeRef.current = t; dragRef.current = { startX: e.clientX, startY: e.clientY, origX: sigW, origY: sigH }; return; }
        dragRef.current = { startX: e.clientX, startY: e.clientY, origX: sigX, origY: sigY };
    };
    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (!dragRef.current) return;
            const dx = (e.clientX - dragRef.current.startX) / previewScale;
            const dy = (e.clientY - dragRef.current.startY) / previewScale;
            if (resizeRef.current) {
                setSigW(Math.max(50, dragRef.current.origX + dx));
                setSigH(Math.max(30, dragRef.current.origY + dy));
            } else {
                setSigX(Math.max(0, dragRef.current.origX + dx));
                setSigY(Math.max(0, dragRef.current.origY + dy));
            }
        };
        const onUp = () => { dragRef.current = null; resizeRef.current = null; };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    }, [previewScale]);

    /* ── process ───────────────────────────────────────── */
    const handleProcess = async () => {
        if (!file || !signatureDataUrl) return;
        setIsProcessing(true); setProgress(10); setError(null);
        try {
            const res = await fetch(signatureDataUrl); const sigBlob = await res.blob();
            const sigFile = new File([sigBlob], "signature.png", { type: "image/png" });
            const formData = new FormData();
            formData.append("file0", file);
            formData.append("signature", sigFile);
            formData.append("pages", applyAll ? "all" : String(currentPage));
            formData.append("x", String(Math.round(sigX)));
            formData.append("y", String(Math.round(sigY)));
            formData.append("width", String(Math.round(sigW)));
            formData.append("height", String(Math.round(sigH)));
            formData.append("rotation", String(sigRot));
            formData.append("opacity", String(sigOpacity));
            setProgress(30);
            const resp = await fetch("/api/sign-pdf", { method: "POST", body: formData });
            setProgress(70);
            if (!resp.ok) { const err = await resp.json(); throw new Error(err.error || "Processing failed"); }
            const blob = await resp.blob();
            setDownloadUrl(URL.createObjectURL(blob));
            setProgress(100);
        } catch (e: any) { setError(e.message || "An error occurred"); } finally { setIsProcessing(false); }
    };

    const handleDownload = () => {
        if (!downloadUrl) return;
        const a = document.createElement("a"); a.href = downloadUrl;
        a.download = buildDownloadName(downloadBaseName, ".pdf", "output.pdf"); a.click();
    };
    const handleReset = () => {
        if (downloadUrl) URL.revokeObjectURL(downloadUrl);
        setFile(null); setDownloadUrl(null); setError(null); setProgress(0); setSignatureDataUrl(null); setPageImage(null);
    };

    /* ── quick positions ───────────────────────────────── */
    const quickPositions = [
        { label: "Bottom Left", x: 50, y: pageHeight - 100 },
        { label: "Bottom Center", x: pageWidth / 2 - 100, y: pageHeight - 100 },
        { label: "Bottom Right", x: pageWidth - 250, y: pageHeight - 100 },
        { label: "Top Right", x: pageWidth - 250, y: 30 },
    ];

    /* ── render ────────────────────────────────────────── */
    return (
        <div className="min-h-screen p-4 md:p-8">
            <div className="max-w-5xl mx-auto">
                <div className="text-center mb-12">
                    <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">Sign PDF</h1>
                    <p className="text-gray-500 dark:text-slate-400 text-lg">Draw, type or upload a signature and place it visually on your PDF</p>
                </div>

                {error && <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-500 font-medium">{error}</div>}

                {/* Upload */}
                {!file && (
                    <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 p-8 mb-8">
                        <DragDropUpload onFileSelect={handleFileSelect} accept=".pdf" multiple={false} maxSize={50}
                            icon="✍️" title="Drop your PDF here" subtitle="or click to browse"
                            borderColor="border-violet-300" hoverColor="border-violet-500 bg-violet-500/10" />
                    </div>
                )}

                {file && !downloadUrl && (
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                        {/* ── Left panel: Signature creation ────── */}
                        <div className="lg:col-span-2 space-y-4">
                            <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 p-5">
                                <h2 className="text-lg font-bold text-gray-700 dark:text-slate-200 mb-4">Create Signature</h2>

                                {/* Mode tabs */}
                                <div className="flex gap-1 mb-4 bg-gray-200 dark:bg-white/10 rounded-lg p-1">
                                    {(["draw", "upload", "type"] as SigMode[]).map((m) => (
                                        <button key={m} onClick={() => { setSigMode(m); if (m !== "type") setSignatureDataUrl(null); }}
                                            className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all ${
                                                sigMode === m ? "bg-violet-500 text-white shadow" : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"}`}>
                                            {m === "draw" ? "✏️ Draw" : m === "upload" ? "📷 Upload" : "⌨️ Type"}
                                        </button>
                                    ))}
                                </div>

                                {sigMode === "draw" && (
                                    <div>
                                        <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 dark:border-white/20 p-2 inline-block w-full">
                                            <canvas ref={drawCanvasRef} width={360} height={120}
                                                className="cursor-crosshair rounded-lg touch-none w-full"
                                                onMouseDown={startDraw} onMouseMove={moveDraw} onMouseUp={endDraw} onMouseLeave={endDraw}
                                                onTouchStart={startDraw} onTouchMove={moveDraw} onTouchEnd={endDraw} />
                                        </div>
                                        <button onClick={clearCanvas} className="mt-2 px-4 py-2 bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-slate-300 rounded-lg hover:bg-gray-300 dark:hover:bg-white/15 text-sm font-medium">Clear</button>
                                    </div>
                                )}

                                {sigMode === "upload" && (
                                    <div className="border-2 border-dashed border-violet-300 dark:border-violet-500/30 rounded-xl p-6 text-center">
                                        <label className="cursor-pointer">
                                            <input type="file" accept=".png,.jpg,.jpeg,.svg" onChange={handleSigUpload} className="hidden" />
                                            {signatureDataUrl ? (
                                                <img src={signatureDataUrl} alt="Uploaded signature" className="max-h-24 mx-auto" />
                                            ) : (
                                                <>
                                                    <div className="text-3xl mb-2">📷</div>
                                                    <div className="text-sm font-semibold text-gray-700 dark:text-slate-200">Click to upload signature image</div>
                                                    <div className="text-xs text-gray-400 dark:text-slate-500">PNG, JPG, or SVG</div>
                                                </>
                                            )}
                                        </label>
                                    </div>
                                )}

                                {sigMode === "type" && (
                                    <div className="space-y-3">
                                        <input type="text" value={typedText} onChange={(e) => setTypedText(e.target.value)} placeholder="Type your name..."
                                            className="w-full px-4 py-3 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-gray-700 dark:text-slate-200 focus:border-violet-500 focus:outline-none text-lg"
                                            style={{ fontFamily: typedFont }} />
                                        <div className="flex flex-wrap gap-2">
                                            {SIG_FONTS.map((f) => (
                                                <button key={f.label} onClick={() => setTypedFont(f.family)}
                                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                                                        typedFont === f.family
                                                            ? "border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-400"
                                                            : "border-gray-200 dark:border-white/10 text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/5"}`}
                                                    style={{ fontFamily: f.family }}>
                                                    {f.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Controls */}
                            <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 p-5 space-y-4">
                                <h2 className="text-lg font-bold text-gray-700 dark:text-slate-200">Placement</h2>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1">Width: {Math.round(sigW)}</label>
                                        <input type="range" min={50} max={500} value={sigW} onChange={(e) => setSigW(Number(e.target.value))} className="w-full accent-violet-500" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1">Height: {Math.round(sigH)}</label>
                                        <input type="range" min={30} max={300} value={sigH} onChange={(e) => setSigH(Number(e.target.value))} className="w-full accent-violet-500" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1">Rotation: {sigRot}°</label>
                                        <input type="range" min={-45} max={45} value={sigRot} onChange={(e) => setSigRot(Number(e.target.value))} className="w-full accent-violet-500" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1">Opacity: {Math.round(sigOpacity * 100)}%</label>
                                        <input type="range" min={10} max={100} value={sigOpacity * 100} onChange={(e) => setSigOpacity(Number(e.target.value) / 100)} className="w-full accent-violet-500" />
                                    </div>
                                </div>

                                {/* Quick positions */}
                                <div className="flex flex-wrap gap-2">
                                    {quickPositions.map((pos) => (
                                        <button key={pos.label} onClick={() => { setSigX(pos.x); setSigY(pos.y); }}
                                            className="px-3 py-1.5 bg-violet-500/10 text-violet-600 dark:text-violet-400 rounded-lg hover:bg-violet-500/20 text-xs font-medium border border-violet-300 dark:border-violet-500/30">
                                            {pos.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Page navigation */}
                                <div className="flex items-center gap-3">
                                    <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage <= 1}
                                        className="px-3 py-2 bg-gray-200 dark:bg-white/10 rounded-lg disabled:opacity-50 text-gray-600 dark:text-slate-300">◀</button>
                                    <span className="text-sm font-semibold text-gray-600 dark:text-slate-300">Page {currentPage} / {totalPages}</span>
                                    <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage >= totalPages}
                                        className="px-3 py-2 bg-gray-200 dark:bg-white/10 rounded-lg disabled:opacity-50 text-gray-600 dark:text-slate-300">▶</button>
                                </div>

                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input type="checkbox" checked={applyAll} onChange={(e) => setApplyAll(e.target.checked)} className="w-5 h-5 accent-violet-500 rounded" />
                                    <span className="text-sm font-semibold text-gray-600 dark:text-slate-300">Apply to all pages</span>
                                </label>
                            </div>
                        </div>

                        {/* ── Right panel: PDF preview + signature overlay ── */}
                        <div className="lg:col-span-3">
                            <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 p-4" ref={previewRef}>
                                <div className="text-xs text-gray-400 dark:text-slate-500 mb-2">Click and drag the signature on the preview to position it. Drag the bottom-right corner to resize.</div>
                                <div className="relative inline-block bg-white border border-gray-300 dark:border-white/20 rounded-lg overflow-hidden shadow-sm" style={{ width: 600, height: (pageHeight / pageWidth) * 600 }}>
                                    {pageImage && <img src={pageImage} alt="PDF preview" className="absolute inset-0 w-full h-full object-contain" draggable={false} />}

                                    {/* Signature overlay (draggable + resizable) */}
                                    {signatureDataUrl && (
                                        <div
                                            onMouseDown={handleMouseDown}
                                            className="absolute cursor-move border-2 border-violet-500 border-dashed rounded-lg bg-violet-500/5 select-none"
                                            style={{
                                                left: sigX * previewScale, top: sigY * previewScale,
                                                width: sigW * previewScale, height: sigH * previewScale,
                                                transform: `rotate(${sigRot}deg)`,
                                                opacity: sigOpacity,
                                            }}>
                                            <img src={signatureDataUrl} alt="Signature" className="w-full h-full object-contain pointer-events-none" draggable={false} />
                                            {/* Resize handle */}
                                            <div data-resize="br"
                                                className="absolute -bottom-2 -right-2 w-5 h-5 bg-violet-500 rounded-full cursor-se-resize border-2 border-white shadow-md"
                                                onMouseDown={(e) => { e.stopPropagation(); resizeRef.current = "br"; dragRef.current = { startX: e.clientX, startY: e.clientY, origX: sigW, origY: sigH }; }} />
                                        </div>
                                    )}

                                    {!pageImage && (
                                        <div className="absolute inset-0 flex items-center justify-center text-gray-400 dark:text-slate-500">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500"></div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Action buttons */}
                            <div className="mt-4 space-y-3">
                                {isProcessing && (
                                    <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 p-6">
                                        <div className="text-center mb-3"><div className="text-lg font-semibold text-gray-600 dark:text-slate-300">Signing PDF...</div></div>
                                        <div className="w-full bg-gray-200 dark:bg-white/15 rounded-full h-4 overflow-hidden">
                                            <div className="bg-gradient-to-r from-violet-500 to-purple-500 h-full transition-all duration-300 rounded-full" style={{ width: `${progress}%` }} />
                                        </div>
                                    </div>
                                )}
                                {!isProcessing && signatureDataUrl && (
                                    <button onClick={handleProcess}
                                        className="w-full bg-gradient-to-r from-violet-500 to-purple-500 text-white text-xl font-bold py-5 rounded-2xl hover:from-violet-600 hover:to-purple-600 transition-all shadow-xl hover:shadow-2xl transform hover:scale-105">
                                        ✍️ Sign PDF
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Download */}
                {downloadUrl && (
                    <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 p-8 text-center">
                        <div className="w-20 h-20 bg-emerald-500/15 rounded-full flex items-center justify-center mx-auto mb-6"><span className="text-4xl">✅</span></div>
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">PDF Signed!</h3>
                        <p className="text-gray-500 dark:text-slate-400 mb-6">Your signed PDF is ready to download.</p>
                        <div className="max-w-md mx-auto mb-6 text-left">
                            <label className="block text-sm font-semibold text-gray-600 dark:text-slate-300 mb-2">File name</label>
                            <div className="flex items-center gap-2">
                                <input type="text" value={downloadBaseName} onChange={(e) => setDownloadBaseName(e.target.value)}
                                    className="flex-1 px-4 py-3 border border-gray-200 dark:border-white/10 rounded-lg focus:border-violet-500 focus:outline-none bg-white dark:bg-white/5 text-gray-600 dark:text-slate-300" />
                                <span className="px-3 py-2 bg-gray-100 dark:bg-white/10 rounded-lg text-sm text-gray-500 dark:text-slate-400">.pdf</span>
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <button onClick={handleDownload} className="px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg">📥 Download PDF</button>
                            <button onClick={handleReset} className="px-8 py-4 bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-slate-300 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-white/15 transition-all">Sign Another PDF</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
