"use client";

import { useEffect, useRef, useState } from "react";
import FileUpload from "@/components/FileUpload";
import ProgressBar from "@/components/ProgressBar";
import { MAX_FILE_SIZE } from "@/lib/constants";
import { buildDownloadName, splitFileName } from "@/lib/fileName";

interface ConversionInfo {
    engine: string;
    pages: number;
    elapsed: number;
    warnings: string[];
    validationPassed: boolean;
    validationDetails: string[];
    qualityScore: number;
}

function parseErrorResponse(xhr: XMLHttpRequest): Promise<string> {
    const body = xhr.response as Blob | null;
    if (body && typeof body.text === "function") {
        return body.text().then((text) => {
            try {
                const data = JSON.parse(text);
                return data.error || text || "Processing failed";
            } catch {
                return text || "Processing failed";
            }
        });
    }
    return Promise.resolve("Processing failed");
}

export default function WordToPDFTool() {
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
    const xhrRef = useRef<XMLHttpRequest | null>(null);

    useEffect(() => {
        return () => {
            if (downloadUrl) {
                URL.revokeObjectURL(downloadUrl);
            }
            xhrRef.current?.abort();
        };
    }, [downloadUrl]);

    const handleFilesSelected = (selectedFiles: File[]) => {
        if (downloadUrl) URL.revokeObjectURL(downloadUrl);
        setFiles(selectedFiles);
        setDownloadUrl(null);
        setDownloadName("");
        setDownloadBaseName("");
        setDownloadExtension("");
        setMessage("");
        setConversionInfo(null);
        setProgress(0);
        setStatus("processing");
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
        setMessage("Preparing document for conversion…");
        setConversionInfo(null);

        const file = files[0];
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        let uploadComplete = false;

        try {
            setMessage("Uploading to Word COM engine…");
            xhr.open("POST", "/api/word-to-pdf", true);
            xhr.responseType = "blob";

            xhr.upload.onprogress = (event) => {
                if (!event.lengthComputable) return;
                setProgress(Math.min(Math.round((event.loaded / event.total) * 60), 60));
            };

            xhr.upload.onload = () => {
                uploadComplete = true;
                setMessage("Converting with Microsoft Word engine — preserving all formatting, images, watermarks…");
                setProgress((prev) => Math.max(prev, 70));
            };

            xhr.onprogress = (event) => {
                if (!uploadComplete || !event.lengthComputable) return;
                const percent = 70 + Math.round((event.loaded / event.total) * 25);
                setProgress(Math.min(percent, 95));
            };

            const responseBlob: Blob = await new Promise((resolve, reject) => {
                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(xhr.response);
                        return;
                    }

                    parseErrorResponse(xhr).then((errorMessage) => reject(new Error(errorMessage)));
                };

                xhr.onerror = () => reject(new Error("Network error. Please try again."));
                xhr.onabort = () => reject(new Error("Upload cancelled."));

                const formData = new FormData();
                formData.append("file0", file);
                xhr.send(formData);
            });

            const url = URL.createObjectURL(responseBlob);
            const engine = xhr.getResponseHeader("X-Conversion-Engine") || "word-com";
            const pages = parseInt(xhr.getResponseHeader("X-Total-Pages") || "0", 10);
            const elapsed = parseInt(xhr.getResponseHeader("X-Elapsed-Ms") || "0", 10);
            const warnings = (xhr.getResponseHeader("X-Conversion-Warnings") || "").split("; ").filter(Boolean);
            const validationPassed = xhr.getResponseHeader("X-Validation-Passed") === "true";
            const validationDetails = (xhr.getResponseHeader("X-Validation-Details") || "").split("; ").filter(Boolean);
            const qualityScore = parseInt(xhr.getResponseHeader("X-Quality-Score") || "0", 10);

            setConversionInfo({ engine, pages, elapsed, warnings, validationPassed, validationDetails, qualityScore });

            let filename = "converted.pdf";
            const contentDisposition = xhr.getResponseHeader("Content-Disposition");
            if (contentDisposition) {
                const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                if (match?.[1]) {
                    filename = decodeURIComponent(match[1].replace(/['"]/g, ""));
                }
            }
            if (!filename || filename === "converted.pdf") {
                filename = `${file.name.replace(/\.[^/.]+$/, "")}.pdf`;
            }

            const parts = splitFileName(filename);
            setProgress(100);
            setStatus("success");
            setMessage("Conversion complete! Microsoft Word engine produced a pixel-perfect PDF.");
            setDownloadUrl(url);
            setDownloadName(filename);
            setDownloadBaseName(parts.base || "converted");
            setDownloadExtension(parts.ext || ".pdf");
        } catch (error) {
            setStatus("error");
            setMessage(error instanceof Error ? error.message : "An error occurred. Please try again.");
            console.error(error);
        } finally {
            xhrRef.current = null;
            setProcessing(false);
        }
    };

    const handleDownload = () => {
        if (!downloadUrl) return;
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = buildDownloadName(downloadBaseName, downloadExtension, downloadName || "converted.pdf");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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
            <div className="text-center mb-12">
                <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">Word to PDF</h1>
                <p className="text-xl text-gray-500 dark:text-slate-400">
                    Enterprise-grade Word to PDF — powered by Microsoft Word COM engine with pixel-perfect output
                </p>
            </div>

            <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-lg shadow-black/5 dark:shadow-black/20 p-8 mb-8">
                {!processing && !downloadUrl && (
                    <>
                        <FileUpload
                            accept={{
                                "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
                                "application/msword": [".doc"],
                                "application/rtf": [".rtf"],
                            }}
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
                                            <svg className="w-8 h-8 text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
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

                                <button
                                    onClick={handleProcess}
                                    className="mt-6 w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-[1.01]"
                                >
                                    Convert to PDF
                                </button>
                            </div>
                        )}
                    </>
                )}

                {processing && (
                    <div className="text-center py-8">
                        <ProgressBar progress={progress} status={status} />
                        <p className="mt-4 text-gray-500 dark:text-slate-400">{message}</p>
                    </div>
                )}

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

                        {conversionInfo && (
                            <div className="mb-6 space-y-3">
                                <div className="inline-flex flex-wrap items-center gap-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 px-4 py-2 rounded-lg text-sm font-medium">
                                    <span>Engine: Microsoft Word COM</span>
                                    <span className="text-blue-400 dark:text-blue-500">&bull;</span>
                                    <span>{conversionInfo.pages} page(s)</span>
                                    {conversionInfo.qualityScore > 0 && (
                                        <>
                                            <span className="text-blue-400 dark:text-blue-500">&bull;</span>
                                            <span className={conversionInfo.qualityScore >= 90 ? "text-emerald-500" : conversionInfo.qualityScore >= 70 ? "text-amber-500" : "text-red-500"}>
                                                Quality: {conversionInfo.qualityScore}/100
                                            </span>
                                        </>
                                    )}
                                    <span className="text-blue-400 dark:text-blue-500">&bull;</span>
                                    <span className={conversionInfo.validationPassed ? "text-emerald-500" : "text-amber-500"}>
                                        {conversionInfo.validationPassed ? "✓ QC Passed" : "⚠ QC Warnings"}
                                    </span>
                                    {conversionInfo.elapsed > 0 && (
                                        <>
                                            <span className="text-blue-400 dark:text-blue-500">&bull;</span>
                                            <span>{conversionInfo.elapsed} ms</span>
                                        </>
                                    )}
                                </div>

                                {conversionInfo.warnings.length > 0 && (
                                    <div className="text-left text-sm text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-lg p-3">
                                        <div className="font-semibold mb-1">Warnings:</div>
                                        <ul className="list-disc list-inside space-y-1">
                                            {conversionInfo.warnings.map((warning, index) => (
                                                <li key={index}>{warning}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {conversionInfo.validationDetails.length > 0 && (
                                    <div className="text-left text-sm text-slate-500 dark:text-slate-400 bg-slate-500/10 rounded-lg p-3">
                                        <div className="font-semibold mb-1">Validation Details:</div>
                                        <ul className="list-disc list-inside space-y-1">
                                            {conversionInfo.validationDetails.map((detail, index) => (
                                                <li key={index}>{detail}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex flex-wrap justify-center gap-4">
                            <button
                                onClick={handleDownload}
                                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                            >
                                Download PDF
                            </button>
                            <button
                                onClick={handleReset}
                                className="px-6 py-3 bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-slate-300 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-white/15 transition-colors"
                            >
                                Convert Another File
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
