"use client";

import { useState } from "react";
import FileUpload from "@/components/FileUpload";
import ProgressBar from "@/components/ProgressBar";
import { MAX_FILE_SIZE } from "@/lib/constants";
import { buildDownloadName, splitFileName } from "@/lib/fileName";

interface ConversionInfo {
    engine: string;
    pages: number;
    images: number;
    tables: number;
    hasWatermark: boolean;
    hasHeaders: boolean;
    hasFooters: boolean;
    elapsed: number;
    warnings: string[];
    validationPassed: boolean;
    validationDetails: string[];
    qualityScore: number;
}

export default function PDFToWordTool() {
    const [files, setFiles] = useState<File[]>([]);
    const [processing, setProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
    const [message, setMessage] = useState("");
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
    const [downloadName, setDownloadName] = useState("");
    const [downloadBaseName, setDownloadBaseName] = useState("");
    const [downloadExtension, setDownloadExtension] = useState("");
    const [conversionInfo, setConversionInfo] = useState<ConversionInfo | null>(null);

    // Tool is currently disabled as UPCOMING
    const isUpcoming = true;

    const handleFilesSelected = (selectedFiles: File[]) => {
        if (downloadUrl) URL.revokeObjectURL(downloadUrl);
        setFiles(selectedFiles);
        setDownloadUrl(null);
        setDownloadName("");
        setDownloadBaseName("");
        setDownloadExtension("");
        setMessage("");
        setConversionInfo(null);
    };

    const removeFile = (index: number) => {
        setFiles((prev) => prev.filter((_, i) => i !== index));
        if (downloadUrl) {
            URL.revokeObjectURL(downloadUrl);
            setDownloadUrl(null);
            setDownloadName("");
            setDownloadBaseName("");
            setDownloadExtension("");
        }
    };

    const handleProcess = async () => {
        if (files.length === 0) {
            setMessage("Please select a file first");
            return;
        }

        setProcessing(true);
        setProgress(0);
        setStatus("processing");
        setMessage("Preparing PDF for conversion…");
        setConversionInfo(null);

        try {
            const file = files[0];
            setProgress(10);
            setMessage("Uploading to Word COM engine…");

            const formData = new FormData();
            formData.append("file0", file);

            setProgress(20);
            setMessage("Converting with Microsoft Word engine — preserving all layout, fonts, images, tables…");

            const response = await fetch("/api/pdf-to-word", {
                method: "POST",
                body: formData,
            });

            setProgress(80);

            if (!response.ok) {
                let errorMessage = "Processing failed";
                try {
                    const contentType = response.headers.get("content-type");
                    if (contentType && contentType.includes("application/json")) {
                        const errorData = await response.json();
                        errorMessage = errorData.error || errorMessage;
                    }
                } catch { /* ignore */ }
                throw new Error(errorMessage);
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);

            // Parse rich metadata from response headers
            const engine = response.headers.get("X-Conversion-Engine") || "word-com";
            const pages = parseInt(response.headers.get("X-Original-Pages") || "0", 10);
            const images = parseInt(response.headers.get("X-Image-Count") || "0", 10);
            const tables = parseInt(response.headers.get("X-Table-Count") || "0", 10);
            const hasWatermark = response.headers.get("X-Has-Watermark") === "true";
            const hasHeaders = response.headers.get("X-Has-Headers") === "true";
            const hasFooters = response.headers.get("X-Has-Footers") === "true";
            const elapsed = parseInt(response.headers.get("X-Elapsed-Ms") || "0", 10);
            const warningsRaw = response.headers.get("X-Conversion-Warnings") || "";
            const warnings = warningsRaw ? warningsRaw.split("; ") : [];
            const validationPassed = response.headers.get("X-Validation-Passed") === "true";
            const validationDetailsRaw = response.headers.get("X-Validation-Details") || "";
            const validationDetails = validationDetailsRaw ? validationDetailsRaw.split("; ") : [];
            const qualityScore = parseInt(response.headers.get("X-Quality-Score") || "0", 10);

            setConversionInfo({
                engine, pages, images, tables, hasWatermark, hasHeaders, hasFooters,
                elapsed, warnings, validationPassed, validationDetails, qualityScore,
            });

            // Build filename
            let filename = "converted.docx";
            const contentDisposition = response.headers.get("Content-Disposition");
            if (contentDisposition) {
                const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                if (match && match[1]) filename = decodeURIComponent(match[1].replace(/['"]/g, ""));
            }
            if (!filename || filename === "converted.docx") {
                filename = `${file.name.replace(/\.[^/.]+$/, "")}.docx`;
            }

            const parts = splitFileName(filename);
            setProgress(100);
            setStatus("success");
            setMessage("Conversion complete! Microsoft Word engine preserved full layout fidelity.");
            setDownloadUrl(url);
            setDownloadName(filename);
            setDownloadBaseName(parts.base || "converted");
            setDownloadExtension(parts.ext || ".docx");
        } catch (error) {
            setStatus("error");
            setMessage(error instanceof Error ? error.message : "An error occurred. Please try again.");
            console.error(error);
        } finally {
            setProcessing(false);
        }
    };

    const handleDownload = () => {
        if (downloadUrl) {
            const link = document.createElement("a");
            link.href = downloadUrl;
            link.download = buildDownloadName(downloadBaseName, downloadExtension, downloadName || "converted.docx");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const handleReset = () => {
        if (downloadUrl) URL.revokeObjectURL(downloadUrl);
        setFiles([]);
        setProcessing(false);
        setProgress(0);
        setStatus("processing");
        setMessage("");
        setDownloadUrl(null);
        setDownloadName("");
        setDownloadBaseName("");
        setDownloadExtension("");
        setConversionInfo(null);
    };

    return (
        <div className="max-w-4xl mx-auto px-4 py-12">
            {/* UPCOMING Banner */}
            {isUpcoming && (
                <div className="mb-8 bg-amber-50 dark:bg-amber-500/10 border-2 border-amber-400 dark:border-amber-500/50 rounded-2xl p-6">
                    <div className="flex items-start gap-4">
                        <div className="flex-shrink-0">
                            <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-amber-900 dark:text-amber-200 mb-1">
                                🚀 UPCOMING FEATURE
                            </h3>
                            <p className="text-amber-800 dark:text-amber-300 mb-2">
                                PDF to Word conversion is coming soon! We're building enterprise-grade support with full layout preservation and Microsoft Word COM engine integration.
                            </p>
                            <p className="text-sm text-amber-700 dark:text-amber-400">
                                ✓ Advanced table preservation  •  ✓ Image optimization  •  ✓ Header/footer support  •  ✓ 99% visual fidelity
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="text-center mb-12">
                <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
                    PDF to Word
                </h1>
                <p className="text-xl text-gray-500 dark:text-slate-400">
                    Enterprise-grade PDF to DOCX — powered by Microsoft Word COM engine with 99% visual fidelity
                </p>
            </div>

            <div className={`bg-gray-100 dark:bg-white/5 rounded-2xl shadow-lg shadow-black/5 dark:shadow-black/20 p-8 mb-8 ${isUpcoming ? 'opacity-60 pointer-events-none' : ''}`}>
                {/* Upload State */}
                {!processing && !downloadUrl && (
                    <>
                        <FileUpload
                            accept={{ "application/pdf": [".pdf"] }}
                            maxSize={MAX_FILE_SIZE}
                            multiple={false}
                            onFilesSelected={handleFilesSelected}
                        />
                        {files.length > 0 && (
                            <div className="mt-6">
                                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Selected File:</h3>
                                {files.map((file, index) => (
                                    <div key={index} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-transparent bg-gray-50 dark:bg-white/5">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <svg className="w-8 h-8 text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M4 18h12a2 2 0 002-2V6l-4-4H4a2 2 0 00-2 2v12a2 2 0 002 2zm8-14l4 4h-4V4z" />
                                            </svg>
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{file.name}</p>
                                                <p className="text-xs text-gray-400 dark:text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                            </div>
                                        </div>
                                        <button onClick={() => removeFile(index)} className="text-red-400 hover:text-red-500 p-1" title="Remove file">
                                            <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                                <path d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                                <button onClick={handleProcess}
                                    className="mt-6 w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-[1.01]">
                                    Convert to Word
                                </button>
                            </div>
                        )}
                    </>
                )}

                {/* Processing State */}
                {processing && (
                    <div className="text-center py-8">
                        <ProgressBar progress={progress} status={status} />
                        <p className="mt-4 text-gray-500 dark:text-slate-400">{message}</p>
                    </div>
                )}

                {/* Download State */}
                {downloadUrl && !processing && (
                    <div className="text-center py-8">
                        <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${status === "success" ? "bg-emerald-500/15" : "bg-red-500/15"}`}>
                            {status === "success" ? (
                                <svg className="w-8 h-8 text-emerald-400" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                    <path d="M5 13l4 4L19 7" />
                                </svg>
                            ) : (
                                <svg className="w-8 h-8 text-red-400" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                    <path d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            )}
                        </div>
                        <p className="text-gray-600 dark:text-slate-300 mb-2">{message}</p>

                        {/* Conversion metadata */}
                        {conversionInfo && (
                            <div className="mb-6 space-y-3">
                                {/* Engine & Quality Row */}
                                <div className="inline-flex flex-wrap items-center gap-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 px-4 py-2 rounded-lg text-sm font-medium">
                                    <span>Engine: Microsoft Word COM</span>
                                    <span className="text-blue-400 dark:text-blue-500">&bull;</span>
                                    <span>{conversionInfo.pages} page(s)</span>
                                    {conversionInfo.qualityScore > 0 && (<>
                                        <span className="text-blue-400 dark:text-blue-500">&bull;</span>
                                        <span className={conversionInfo.qualityScore >= 90 ? "text-emerald-500" : conversionInfo.qualityScore >= 70 ? "text-amber-500" : "text-red-500"}>
                                            Quality: {conversionInfo.qualityScore}/100
                                        </span>
                                    </>)}
                                    <span className="text-blue-400 dark:text-blue-500">&bull;</span>
                                    <span className={conversionInfo.validationPassed ? "text-emerald-500" : "text-amber-500"}>
                                        {conversionInfo.validationPassed ? "\u2713 QC Passed" : "\u26A0 QC Warnings"}
                                    </span>
                                </div>

                                {/* Document details */}
                                <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-gray-500 dark:text-slate-400">
                                    {conversionInfo.images > 0 && (
                                        <span className="bg-purple-500/10 text-purple-600 dark:text-purple-400 px-3 py-1 rounded-full">
                                            {conversionInfo.images} image(s)
                                        </span>
                                    )}
                                    {conversionInfo.tables > 0 && (
                                        <span className="bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 px-3 py-1 rounded-full">
                                            {conversionInfo.tables} table(s)
                                        </span>
                                    )}
                                    {conversionInfo.hasWatermark && (
                                        <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 px-3 py-1 rounded-full">
                                            Watermark preserved
                                        </span>
                                    )}
                                    {conversionInfo.hasHeaders && (
                                        <span className="bg-green-500/10 text-green-600 dark:text-green-400 px-3 py-1 rounded-full">
                                            Headers preserved
                                        </span>
                                    )}
                                    {conversionInfo.hasFooters && (
                                        <span className="bg-green-500/10 text-green-600 dark:text-green-400 px-3 py-1 rounded-full">
                                            Footers preserved
                                        </span>
                                    )}
                                    {conversionInfo.elapsed > 0 && (
                                        <span className="text-gray-400 dark:text-slate-500">
                                            {(conversionInfo.elapsed / 1000).toFixed(1)}s
                                        </span>
                                    )}
                                </div>

                                {/* Validation details */}
                                {conversionInfo.validationDetails.length > 0 && (
                                    <div className="bg-slate-500/10 text-gray-600 dark:text-slate-400 px-4 py-2 rounded-lg text-xs max-w-lg mx-auto">
                                        {conversionInfo.validationDetails.map((d, i) => (
                                            <p key={i}>{d}</p>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Filename input */}
                        <div className="max-w-md mx-auto mb-6">
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={downloadBaseName}
                                    onChange={(e) => setDownloadBaseName(e.target.value)}
                                    className="flex-1 px-4 py-3 border border-gray-200 dark:border-white/10 rounded-lg focus:border-blue-500 focus:outline-none bg-white dark:bg-white/5 text-gray-700 dark:text-slate-300"
                                />
                                <span className="px-3 py-2 bg-gray-100 dark:bg-white/10 rounded-lg text-sm text-gray-500 dark:text-slate-400">.docx</span>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <button onClick={handleDownload}
                                className="bg-gradient-to-r from-emerald-600 to-green-600 text-white px-8 py-3 rounded-xl font-semibold hover:from-emerald-700 hover:to-green-700 transition-all shadow-lg">
                                Download Word File
                            </button>
                            <button onClick={handleReset}
                                className="bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-slate-300 px-8 py-3 rounded-xl font-semibold hover:bg-gray-300 dark:hover:bg-white/15 transition-all">
                                Convert Another File
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Info section */}
            <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-lg shadow-black/5 dark:shadow-black/20 p-8">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">How It Works</h2>
                <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        {[
                            ["1", "Upload your PDF file (up to 100 MB)"],
                            ["2", "Click \"Convert to Word\" — Microsoft Word COM engine processes the file"],
                            ["3", "Download your Word document with all visual layers preserved"],
                            ["4", "Edit in Microsoft Word, Google Docs, or LibreOffice Writer"],
                        ].map(([num, text]) => (
                            <div key={num} className="flex items-start gap-3">
                                <span className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center font-bold text-sm">
                                    {num}
                                </span>
                                <p className="text-gray-600 dark:text-slate-300">{text}</p>
                            </div>
                        ))}
                    </div>
                    <div className="space-y-4">
                        <div className="bg-blue-500/10 rounded-xl p-6">
                            <h3 className="font-semibold text-blue-700 dark:text-blue-300 mb-2">Microsoft Word COM Engine</h3>
                            <p className="text-blue-600 dark:text-blue-400 text-sm">
                                Uses Word&apos;s native PDF import engine via COM automation — the same engine
                                that runs when you open a PDF in Microsoft Word. Maximum layout fidelity
                                with no third-party processing.
                            </p>
                        </div>
                        <div className="bg-emerald-500/10 rounded-xl p-6">
                            <h3 className="font-semibold text-emerald-700 dark:text-emerald-300 mb-2">Full Layout Preservation</h3>
                            <p className="text-emerald-600 dark:text-emerald-400 text-sm">
                                Preserves fonts, images, tables, headers, footers, watermarks, backgrounds,
                                SmartArt, shapes, hyperlinks, multi-column layouts, and page breaks.
                                No rasterization. No layout flattening.
                            </p>
                        </div>
                        <div className="bg-purple-500/10 rounded-xl p-6">
                            <h3 className="font-semibold text-purple-700 dark:text-purple-300 mb-2">Quality Verification</h3>
                            <p className="text-purple-600 dark:text-purple-400 text-sm">
                                Automated QC checks page count, image count, watermark detection,
                                header/footer preservation, and table structure. Quality score 0-100
                                with detailed conversion metadata.
                            </p>
                        </div>
                        <div className="bg-amber-500/10 rounded-xl p-6">
                            <h3 className="font-semibold text-amber-700 dark:text-amber-300 mb-2">Enterprise Ready</h3>
                            <p className="text-amber-600 dark:text-amber-400 text-sm">
                                Supports documents up to 300 pages. Conversion queue prevents conflicts.
                                Automatic timeout and resource cleanup. Process isolation ensures stability.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
