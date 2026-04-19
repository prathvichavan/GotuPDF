"use client";

import { useState, type DragEvent } from "react";
import FileUpload from "@/components/FileUpload";
import ProgressBar from "@/components/ProgressBar";
import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE } from "@/lib/constants";
import { buildDownloadName, splitFileName } from "@/lib/fileName";

interface ToolPageProps {
    toolId: string;
    toolName: string;
    toolDescription: string;
    acceptedFileTypes: Record<string, string[]>;
    apiEndpoint: string;
    outputFileName: string;
    instructions?: string[];
}

export default function ToolPage({
    toolId,
    toolName,
    toolDescription,
    acceptedFileTypes,
    apiEndpoint,
    outputFileName,
    instructions,
}: ToolPageProps) {
    const [files, setFiles] = useState<File[]>([]);
    const [processing, setProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
    const [message, setMessage] = useState("");
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
    const [downloadName, setDownloadName] = useState<string>("");
    const [downloadBaseName, setDownloadBaseName] = useState<string>("");
    const [downloadExtension, setDownloadExtension] = useState<string>("");
    const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    const allowMultiple = toolId === "merge-pdf" || toolId === "jpg-to-pdf" || toolId === "png-to-pdf";

    const handleFilesSelected = (selectedFiles: File[]) => {
        if (downloadUrl) {
            URL.revokeObjectURL(downloadUrl);
        }
        setFiles((prevFiles) => (allowMultiple ? [...prevFiles, ...selectedFiles] : selectedFiles));
        setDownloadUrl(null);
        setDownloadName("");
        setDownloadBaseName("");
        setDownloadExtension("");
        setMessage("");
    };

    const moveFile = (fromIndex: number, toIndex: number) => {
        setFiles((prevFiles) => {
            if (toIndex < 0 || toIndex >= prevFiles.length || fromIndex === toIndex) return prevFiles;
            const nextFiles = [...prevFiles];
            const [moved] = nextFiles.splice(fromIndex, 1);
            nextFiles.splice(toIndex, 0, moved);
            return nextFiles;
        });
        if (downloadUrl) {
            URL.revokeObjectURL(downloadUrl);
            setDownloadUrl(null);
            setDownloadName("");
            setDownloadBaseName("");
            setDownloadExtension("");
        }
    };

    const removeFile = (index: number) => {
        setFiles((prevFiles) => prevFiles.filter((_, fileIndex) => fileIndex !== index));
        if (downloadUrl) {
            URL.revokeObjectURL(downloadUrl);
            setDownloadUrl(null);
            setDownloadName("");
            setDownloadBaseName("");
            setDownloadExtension("");
        }
    };

    const handleDragStart = (index: number) => {
        setDraggingIndex(index);
        setDragOverIndex(index);
    };

    const handleDragOver = (event: DragEvent<HTMLDivElement>, index: number) => {
        event.preventDefault();
        if (dragOverIndex !== index) {
            setDragOverIndex(index);
        }
    };

    const handleDrop = (event: DragEvent<HTMLDivElement>, index: number) => {
        event.preventDefault();
        if (draggingIndex === null) return;
        moveFile(draggingIndex, index);
        setDraggingIndex(null);
        setDragOverIndex(null);
    };

    const handleDragEnd = () => {
        setDraggingIndex(null);
        setDragOverIndex(null);
    };

    const handleProcess = async () => {
        if (files.length === 0) {
            setMessage("Please select a file first");
            return;
        }

        const resolveDownloadFilename = (headerFilename?: string) => {
            let filename = headerFilename || outputFileName;
            if (!filename || filename === outputFileName) {
                const originalFile = files[0];
                if (originalFile) {
                    const baseName = originalFile.name.replace(/\.[^/.]+$/, "");
                    const extension = outputFileName.split(".").pop();
                    filename = `${baseName}.${extension}`;
                }
            }
            return filename;
        };

        const updateDownloadState = (filename: string) => {
            const parts = splitFileName(filename);
            const fallbackExtension = splitFileName(outputFileName).ext;
            setDownloadName(filename);
            setDownloadBaseName(parts.base || "converted");
            setDownloadExtension(parts.ext || fallbackExtension || "");
        };

        if (toolId === "merge-pdf") {
            if (files.length < 2) {
                setStatus("error");
                setMessage("Please select at least 2 PDF files to merge");
                return;
            }

            setProcessing(true);
            setProgress(0);
            setStatus("processing");
            setMessage("Merging your PDF files...");

            try {
                const { PDFDocument } = await import("pdf-lib");
                const mergedPdf = await PDFDocument.create();

                for (let i = 0; i < files.length; i += 1) {
                    const file = files[i];
                    const arrayBuffer = await file.arrayBuffer();
                    const pdf = await PDFDocument.load(arrayBuffer);
                    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                    copiedPages.forEach((page) => mergedPdf.addPage(page));
                    setProgress(Math.round(((i + 1) / files.length) * 100));
                }

                const mergedPdfBytes = await mergedPdf.save({
                    useObjectStreams: false,
                    addDefaultPage: false,
                    objectsPerTick: 50,
                    updateFieldAppearances: true,
                });

                const blob = new Blob([mergedPdfBytes], { type: "application/pdf" });
                const url = URL.createObjectURL(blob);

                const filename = resolveDownloadFilename();
                setProgress(100);
                setStatus("success");
                setMessage("Processing complete! Your file is ready to download.");
                setDownloadUrl(url);
                updateDownloadState(filename);
            } catch (error) {
                setStatus("error");
                const errorMessage = error instanceof Error ? error.message : "Failed to merge PDF files. Please try again.";
                setMessage(errorMessage);
                console.error(error);
            } finally {
                setProcessing(false);
            }
            return;
        }

        setProcessing(true);
        setProgress(0);
        setStatus("processing");
        setMessage("Uploading and processing your file...");

        try {
            const formData = new FormData();
            files.forEach((file, index) => {
                formData.append(`file${index}`, file);
            });

            const progressInterval = setInterval(() => {
                setProgress((prev) => {
                    if (prev >= 90) {
                        clearInterval(progressInterval);
                        return 90;
                    }
                    return prev + 10;
                });
            }, 200);

            const response = await fetch(apiEndpoint, {
                method: "POST",
                body: formData,
            });

            clearInterval(progressInterval);

            if (!response.ok) {
                let errorMessage = "Processing failed";
                try {
                    const contentType = response.headers.get("content-type");
                    if (contentType && contentType.includes("application/json")) {
                        const errorData = await response.json();
                        errorMessage = errorData.error || errorMessage;
                    } else {
                        const errorText = await response.text();
                        if (errorText) errorMessage = errorText;
                    }
                } catch (e) {
                    console.error("Error parsing error response:", e);
                }
                throw new Error(errorMessage);
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);

            let filename = outputFileName;
            const contentDisposition = response.headers.get("Content-Disposition");
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                if (filenameMatch && filenameMatch[1]) {
                    filename = filenameMatch[1].replace(/['"]/g, "");
                }
            }

            filename = resolveDownloadFilename(filename);

            setProgress(100);
            setStatus("success");
            setMessage("Processing complete! Your file is ready to download.");
            setDownloadUrl(url);
            updateDownloadState(filename);
        } catch (error) {
            setStatus("error");
            const errorMessage = error instanceof Error ? error.message : "An error occurred while processing your file. Please try again.";
            setMessage(errorMessage);
            console.error(error);
        } finally {
            setProcessing(false);
        }
    };

    const handleDownload = () => {
        if (downloadUrl) {
            const link = document.createElement("a");
            link.href = downloadUrl;
            link.download = buildDownloadName(downloadBaseName, downloadExtension, downloadName || outputFileName);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const handleReset = () => {
        if (downloadUrl) {
            URL.revokeObjectURL(downloadUrl);
        }
        setFiles([]);
        setProcessing(false);
        setProgress(0);
        setStatus("processing");
        setMessage("");
        setDownloadUrl(null);
        setDownloadName("");
        setDownloadBaseName("");
        setDownloadExtension("");
    };

    return (
        <div className="max-w-4xl mx-auto px-4 py-12">
            <div className="text-center mb-12">
                <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">{toolName}</h1>
                <p className="text-xl text-gray-500 dark:text-slate-400">{toolDescription}</p>
            </div>

            <div className="glass-card rounded-2xl p-8 mb-8">
                {!processing && !downloadUrl && (
                    <>
                        <FileUpload
                            accept={acceptedFileTypes}
                            maxSize={MAX_FILE_SIZE}
                            multiple={allowMultiple}
                            onFilesSelected={handleFilesSelected}
                        />
                        {files.length > 0 && (
                            <div className="mt-6">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="font-semibold text-gray-900 dark:text-white">Selected Files:</h3>
                                    {allowMultiple && files.length > 1 && (
                                        <span className="text-xs text-gray-400 dark:text-slate-500">Drag to reorder</span>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    {files.map((file, index) => (
                                        <div
                                            key={index}
                                            className={`flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border transition-colors ${allowMultiple && files.length > 1 ? "cursor-move" : ""} ${dragOverIndex === index ? "border-indigo-500/40 bg-indigo-500/10" : "border-gray-200 dark:border-white/5 bg-gray-100 dark:bg-white/5"} ${draggingIndex === index ? "opacity-60" : ""}`}
                                            draggable={allowMultiple && files.length > 1}
                                            onDragStart={() => handleDragStart(index)}
                                            onDragOver={(event) => handleDragOver(event, index)}
                                            onDrop={(event) => handleDrop(event, index)}
                                            onDragEnd={handleDragEnd}
                                        >
                                            <div className="flex items-center gap-3">
                                                <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                                {allowMultiple && (
                                                    <span className="text-xs font-semibold text-gray-400 dark:text-slate-500 w-6 text-right">
                                                        {index + 1}.
                                                    </span>
                                                )}
                                                <span className="text-sm font-medium text-gray-600 dark:text-slate-300">{file.name}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-gray-400 dark:text-slate-500">
                                                    {(file.size / 1024 / 1024).toFixed(2)} MB
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => removeFile(index)}
                                                    disabled={processing}
                                                    aria-label="Remove file"
                                                    className="px-2 py-1 text-xs bg-red-500/100/20 text-red-400 rounded-md hover:bg-red-500/100/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <button
                                    onClick={handleProcess}
                                    className="mt-6 w-full py-4 btn-primary rounded-xl font-semibold text-lg"
                                >
                                    Process File{files.length > 1 ? "s" : ""}
                                </button>
                            </div>
                        )}
                    </>
                )}

                {processing && (
                    <div className="py-8">
                        <ProgressBar progress={progress} status={status} message={message} />
                    </div>
                )}

                {downloadUrl && !processing && (
                    <div className="text-center py-8">
                        <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 bg-emerald-500/100/20 border border-emerald-500/30">
                            <svg className="w-10 h-10 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Success!</h3>
                        <p className="text-gray-500 dark:text-slate-400 mb-6">{message}</p>
                        <div className="max-w-md mx-auto mb-6 text-left">
                            <label className="block text-sm font-semibold text-gray-600 dark:text-slate-300 mb-2">File name</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={downloadBaseName}
                                    onChange={(event) => setDownloadBaseName(event.target.value)}
                                    className="flex-1 px-4 py-3 glass border border-gray-200 dark:border-white/10 rounded-lg focus:border-indigo-500/50 focus:outline-none text-gray-900 dark:text-white bg-gray-100 dark:bg-white/5"
                                    placeholder="Enter file name"
                                />
                                {downloadExtension && (
                                    <span className="px-3 py-2 glass rounded-lg text-sm text-gray-400 dark:text-slate-400 border border-gray-200 dark:border-white/10">
                                        {downloadExtension}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">Customize the output file name before downloading.</p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <button
                                onClick={handleDownload}
                                className="px-8 py-4 btn-primary rounded-xl font-semibold"
                            >
                                Download File
                            </button>
                            <button
                                onClick={handleReset}
                                className="px-8 py-4 btn-ghost rounded-xl font-semibold"
                            >
                                Process Another File
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {instructions && instructions.length > 0 && (
                <div className="glass-card rounded-xl p-6 mb-8 border-indigo-500/20">
                    <h3 className="font-semibold text-indigo-600 dark:text-indigo-300 mb-3">How to use:</h3>
                    <ol className="list-decimal list-inside space-y-2 text-gray-500 dark:text-slate-400">
                        {instructions.map((instruction, index) => (
                            <li key={index}>{instruction}</li>
                        ))}
                    </ol>
                </div>
            )}

            {/* Features */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    {
                        title: "Secure",
                        description: "Files are encrypted and deleted after processing",
                        icon: (
                            <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        ),
                    },
                    {
                        title: "Fast",
                        description: "Process files in seconds with our optimized engine",
                        icon: (
                            <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        ),
                    },
                    {
                        title: "Free",
                        description: "No registration or payment required",
                        icon: (
                            <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        ),
                    },
                ].map((feature, index) => (
                    <div key={index} className="text-center p-6 glass-card rounded-xl">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gray-100 dark:bg-white/5 mb-3">
                            {feature.icon}
                        </div>
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-2">{feature.title}</h4>
                        <p className="text-sm text-gray-500 dark:text-slate-400">{feature.description}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
