"use client";

import { useState, useCallback } from "react";
import DragDropUpload from "./DragDropUpload";
import { splitFileName, buildDownloadName } from "@/lib/fileName";

type WatermarkMode = "text" | "image";

export default function AddWatermarkTool() {
    /* ── File state ─────────────────────────────────────── */
    const [file, setFile] = useState<File | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
    const [downloadBaseName, setDownloadBaseName] = useState("");
    const [error, setError] = useState<string | null>(null);

    /* ── Mode ──────────────────────────────────────────── */
    const [mode, setMode] = useState<WatermarkMode>("text");

    /* ── Text watermark controls ───────────────────────── */
    const [watermarkText, setWatermarkText] = useState("CONFIDENTIAL");
    const [fontSize, setFontSize] = useState(48);
    const [fontFamily, setFontFamily] = useState("Helvetica-Bold");
    const [color, setColor] = useState("#888888");
    const [textRepeat, setTextRepeat] = useState(false);

    /* ── Image watermark controls ──────────────────────── */
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [imgWidth, setImgWidth] = useState(200);
    const [imgRepeat, setImgRepeat] = useState(false);
    const [position, setPosition] = useState("center");

    /* ── Shared controls ───────────────────────────────── */
    const [opacity, setOpacity] = useState(0.15);
    const [rotation, setRotation] = useState(-45);

    /* ── Handlers ──────────────────────────────────────── */
    const handleFileSelect = useCallback((selectedFiles: File[]) => {
        const f = selectedFiles[0];
        if (!f) return;
        setError(null);
        setFile(f);
        setDownloadUrl(null);
        const parts = splitFileName(f.name);
        setDownloadBaseName(parts.base ? parts.base + "-watermarked" : "watermarked");
    }, []);

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setImageFile(f);
        const reader = new FileReader();
        reader.onload = () => setImagePreview(reader.result as string);
        reader.readAsDataURL(f);
    };

    const handleProcess = async () => {
        if (!file) return;
        if (mode === "text" && !watermarkText.trim()) return;
        if (mode === "image" && !imageFile) return;

        setIsProcessing(true);
        setProgress(10);
        setError(null);
        try {
            const formData = new FormData();
            formData.append("file0", file);
            formData.append("mode", mode);
            formData.append("opacity", String(opacity));
            formData.append("rotation", String(rotation));

            if (mode === "text") {
                formData.append("text", watermarkText);
                formData.append("fontSize", String(fontSize));
                formData.append("color", color);
                formData.append("fontFamily", fontFamily);
                formData.append("repeat", textRepeat ? "true" : "false");
            } else {
                formData.append("image", imageFile!);
                formData.append("imgWidth", String(imgWidth));
                formData.append("position", position);
                formData.append("repeat", imgRepeat ? "true" : "false");
            }

            setProgress(30);
            const res = await fetch("/api/add-watermark", { method: "POST", body: formData });
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
        setImageFile(null);
        setImagePreview(null);
    };

    /* ── Position options ──────────────────────────────── */
    const positions = [
        { label: "Center", value: "center" },
        { label: "Top Left", value: "top-left" },
        { label: "Top Right", value: "top-right" },
        { label: "Bottom Left", value: "bottom-left" },
        { label: "Bottom Right", value: "bottom-right" },
    ];

    const fonts = [
        { label: "Helvetica Bold", value: "Helvetica-Bold" },
        { label: "Helvetica", value: "Helvetica" },
        { label: "Times Bold", value: "Times-Bold" },
        { label: "Times Roman", value: "Times" },
        { label: "Courier Bold", value: "Courier-Bold" },
        { label: "Courier", value: "Courier" },
    ];

    /* ── Render ────────────────────────────────────────── */
    return (
        <div className="min-h-screen p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-12">
                    <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">Add Watermark</h1>
                    <p className="text-gray-500 dark:text-slate-400 text-lg">
                        Add text or image watermarks to your PDF with full control
                    </p>
                </div>

                {error && (
                    <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-500 font-medium">{error}</div>
                )}

                {/* ── Upload ────────────────────────────────── */}
                {!file && (
                    <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 p-8 mb-8">
                        <DragDropUpload onFileSelect={handleFileSelect} accept=".pdf" multiple={false} maxSize={50}
                            icon="💧" title="Drop your PDF here" subtitle="or click to browse"
                            borderColor="border-cyan-300" hoverColor="border-cyan-500 bg-cyan-500/10" />
                    </div>
                )}

                {/* ── Settings ──────────────────────────────── */}
                {file && !downloadUrl && (
                    <>
                        <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 p-6 mb-8">
                            {/* File info */}
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

                            {/* Mode tabs */}
                            <div className="flex gap-2 mb-6">
                                {(["text", "image"] as WatermarkMode[]).map((m) => (
                                    <button key={m} onClick={() => setMode(m)}
                                        className={`flex-1 py-3 rounded-xl font-semibold text-center transition-all ${
                                            mode === m
                                                ? "bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-lg"
                                                : "bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-slate-400 hover:bg-gray-300 dark:hover:bg-white/15"
                                        }`}>
                                        {m === "text" ? "✏️ Text Watermark" : "🖼️ Image Watermark"}
                                    </button>
                                ))}
                            </div>

                            {/* ── Text watermark settings ──────────── */}
                            {mode === "text" && (
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-600 dark:text-slate-300 mb-2">Watermark Text</label>
                                        <input type="text" value={watermarkText} onChange={(e) => setWatermarkText(e.target.value)}
                                            className="w-full px-4 py-3 border border-gray-200 dark:border-white/10 rounded-lg focus:border-cyan-500 focus:outline-none bg-white dark:bg-white/5 text-gray-600 dark:text-slate-300"
                                            placeholder="Enter watermark text..." />
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-600 dark:text-slate-300 mb-2">Font Family</label>
                                            <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-gray-600 dark:text-slate-300 focus:outline-none focus:border-cyan-500">
                                                {fonts.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-600 dark:text-slate-300 mb-2">Font Size: {fontSize}pt</label>
                                            <input type="range" min="12" max="120" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))}
                                                className="w-full accent-cyan-500" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-600 dark:text-slate-300 mb-2">Color</label>
                                            <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
                                                className="w-full h-10 rounded-lg cursor-pointer border border-gray-200 dark:border-white/10" />
                                        </div>
                                    </div>

                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input type="checkbox" checked={textRepeat} onChange={(e) => setTextRepeat(e.target.checked)}
                                            className="w-5 h-5 accent-cyan-500 rounded" />
                                        <span className="text-sm font-semibold text-gray-600 dark:text-slate-300">Tile watermark across entire page</span>
                                    </label>
                                </div>
                            )}

                            {/* ── Image watermark settings ─────────── */}
                            {mode === "image" && (
                                <div className="space-y-6">
                                    {!imageFile ? (
                                        <div className="border-2 border-dashed border-cyan-300 dark:border-cyan-500/30 rounded-xl p-8 text-center hover:bg-cyan-500/5 transition-colors">
                                            <label className="cursor-pointer">
                                                <input type="file" accept=".png,.jpg,.jpeg" onChange={handleImageSelect} className="hidden" />
                                                <div className="text-4xl mb-3">🖼️</div>
                                                <div className="font-semibold text-gray-700 dark:text-slate-200 mb-1">Upload Watermark Image</div>
                                                <div className="text-sm text-gray-400 dark:text-slate-500">PNG (transparent supported) or JPG</div>
                                            </label>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-4 p-4 bg-white dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10">
                                            {imagePreview && <img src={imagePreview} alt="Watermark" className="w-16 h-16 object-contain rounded-lg border border-gray-200 dark:border-white/10" />}
                                            <div className="flex-1">
                                                <div className="font-semibold text-gray-700 dark:text-slate-200">{imageFile.name}</div>
                                                <div className="text-sm text-gray-400 dark:text-slate-500">{(imageFile.size / 1024).toFixed(1)} KB</div>
                                            </div>
                                            <button onClick={() => { setImageFile(null); setImagePreview(null); }}
                                                className="text-gray-400 hover:text-red-400 transition-colors">✕</button>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-600 dark:text-slate-300 mb-2">Width: {imgWidth}px</label>
                                            <input type="range" min="50" max="800" value={imgWidth} onChange={(e) => setImgWidth(Number(e.target.value))}
                                                className="w-full accent-cyan-500" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-600 dark:text-slate-300 mb-2">Position</label>
                                            <select value={position} onChange={(e) => setPosition(e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-gray-600 dark:text-slate-300 focus:outline-none focus:border-cyan-500">
                                                {positions.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input type="checkbox" checked={imgRepeat} onChange={(e) => setImgRepeat(e.target.checked)}
                                            className="w-5 h-5 accent-cyan-500 rounded" />
                                        <span className="text-sm font-semibold text-gray-600 dark:text-slate-300">Repeat on every position (tile)</span>
                                    </label>
                                </div>
                            )}

                            {/* ── Shared controls ─────────────────── */}
                            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-white/10">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-600 dark:text-slate-300 mb-2">Opacity: {Math.round(opacity * 100)}%</label>
                                        <input type="range" min="5" max="100" value={opacity * 100} onChange={(e) => setOpacity(Number(e.target.value) / 100)}
                                            className="w-full accent-cyan-500" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-600 dark:text-slate-300 mb-2">Rotation: {rotation}°</label>
                                        <input type="range" min="-90" max="90" value={rotation} onChange={(e) => setRotation(Number(e.target.value))}
                                            className="w-full accent-cyan-500" />
                                    </div>
                                </div>
                            </div>

                            {/* ── Preview ──────────────────────────── */}
                            <div className="mt-6 p-6 bg-white dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10">
                                <div className="text-xs text-gray-400 dark:text-slate-500 mb-3">Preview</div>
                                <div className="relative w-48 h-64 mx-auto bg-white dark:bg-slate-800 border border-gray-300 dark:border-white/20 rounded shadow-sm overflow-hidden flex items-center justify-center">
                                    {mode === "text" ? (
                                        <div style={{
                                            transform: `rotate(${rotation}deg)`,
                                            fontSize: `${Math.max(fontSize / 4, 8)}px`,
                                            opacity: opacity,
                                            color: color,
                                            fontWeight: fontFamily.includes("Bold") ? "bold" : "normal",
                                            fontStyle: fontFamily.includes("Italic") || fontFamily.includes("Oblique") ? "italic" : "normal",
                                            whiteSpace: "nowrap",
                                        }}>
                                            {watermarkText || "WATERMARK"}
                                        </div>
                                    ) : imagePreview ? (
                                        <img src={imagePreview} alt="Preview" style={{
                                            transform: `rotate(${rotation}deg)`,
                                            opacity: opacity,
                                            maxWidth: `${Math.min(imgWidth / 4, 120)}px`,
                                            maxHeight: "100px",
                                        }} />
                                    ) : (
                                        <div className="text-gray-300 dark:text-slate-600 text-sm">No image</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* ── Progress ────────────────────────────── */}
                        {isProcessing && (
                            <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 p-8 mb-8">
                                <div className="text-center mb-4">
                                    <div className="text-xl font-semibold text-gray-600 dark:text-slate-300">Adding watermark...</div>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-white/15 rounded-full h-4 overflow-hidden">
                                    <div className="bg-gradient-to-r from-cyan-500 to-teal-500 h-full transition-all duration-300 rounded-full"
                                        style={{ width: `${progress}%` }} />
                                </div>
                            </div>
                        )}

                        {/* ── Action button ──────────────────────── */}
                        {!isProcessing && (mode === "text" ? watermarkText.trim() : imageFile) && (
                            <button onClick={handleProcess}
                                className="w-full bg-gradient-to-r from-cyan-500 to-teal-500 text-white text-xl font-bold py-6 rounded-2xl hover:from-cyan-600 hover:to-teal-600 transition-all shadow-xl shadow-black/10 dark:shadow-black/30 hover:shadow-2xl transform hover:scale-105">
                                💧 Add Watermark
                            </button>
                        )}
                    </>
                )}

                {/* ── Download ──────────────────────────────── */}
                {downloadUrl && (
                    <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 p-8 text-center">
                        <div className="w-20 h-20 bg-emerald-500/15 rounded-full flex items-center justify-center mx-auto mb-6"><span className="text-4xl">✅</span></div>
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Watermark Added!</h3>
                        <p className="text-gray-500 dark:text-slate-400 mb-6">Your watermarked PDF is ready to download.</p>
                        <div className="max-w-md mx-auto mb-6 text-left">
                            <label className="block text-sm font-semibold text-gray-600 dark:text-slate-300 mb-2">File name</label>
                            <div className="flex items-center gap-2">
                                <input type="text" value={downloadBaseName} onChange={(e) => setDownloadBaseName(e.target.value)}
                                    className="flex-1 px-4 py-3 border border-gray-200 dark:border-white/10 rounded-lg focus:border-cyan-500 focus:outline-none bg-white dark:bg-white/5 text-gray-600 dark:text-slate-300" />
                                <span className="px-3 py-2 bg-gray-100 dark:bg-white/10 rounded-lg text-sm text-gray-500 dark:text-slate-400">.pdf</span>
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <button onClick={handleDownload} className="px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg">📥 Download PDF</button>
                            <button onClick={handleReset} className="px-8 py-4 bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-slate-300 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-white/15 transition-all">Watermark Another PDF</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
