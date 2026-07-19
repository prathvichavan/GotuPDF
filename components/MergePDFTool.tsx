"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { PDFDocument } from "pdf-lib";
import DragDropUpload from "./DragDropUpload";
import { buildDownloadName, splitFileName } from "@/lib/fileName";

if (typeof window !== "undefined") {
	pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
}

interface MergeFileItem {
	id: string;
	file: File;
	previewUrl: string | null;
	previewStatus: "loading" | "ready" | "error";
	totalPages: number | null;
}

function createId() {
	return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function PdfPlaceholderIcon() {
	return (
		<svg className="h-12 w-12 text-violet-500 dark:text-violet-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
		</svg>
	);
}

export default function MergePDFTool() {
	const [files, setFiles] = useState<MergeFileItem[]>([]);
	const [isProcessing, setIsProcessing] = useState(false);
	const [progress, setProgress] = useState(0);
	const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
	const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
	const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
	const [downloadName, setDownloadName] = useState("");
	const [downloadBaseName, setDownloadBaseName] = useState("");
	const [downloadExtension, setDownloadExtension] = useState("");
	const generatingIds = useRef(new Set<string>());

	useEffect(() => {
		return () => {
			if (downloadUrl) {
				URL.revokeObjectURL(downloadUrl);
			}
		};
	}, [downloadUrl]);

	useEffect(() => {
		let cancelled = false;
		const pending = files.filter((item) => item.previewStatus === "loading" && !generatingIds.current.has(item.id));

		if (pending.length === 0) {
			return;
		}

		const generatePreviews = async () => {
			for (const item of pending) {
				generatingIds.current.add(item.id);
				try {
					const arrayBuffer = await item.file.arrayBuffer();
					const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
					const pdf = await loadingTask.promise;
					const page = await pdf.getPage(1);
					const viewport = page.getViewport({ scale: 0.22 });
					const canvas = document.createElement("canvas");
					const context = canvas.getContext("2d");

					if (!context) {
						throw new Error("Unable to render preview.");
					}

					canvas.width = viewport.width;
					canvas.height = viewport.height;

					await page.render({ canvasContext: context, viewport }).promise;
					const previewUrl = canvas.toDataURL("image/png");
					pdf.destroy?.();

					if (cancelled) return;

					setFiles((prev) => prev.map((entry) => (
						entry.id === item.id
							? { ...entry, previewUrl, previewStatus: "ready", totalPages: pdf.numPages }
							: entry
					)));
				} catch (error) {
					console.error("Preview generation failed:", error);
					if (cancelled) return;
					setFiles((prev) => prev.map((entry) => (
						entry.id === item.id
							? { ...entry, previewUrl: null, previewStatus: "error", totalPages: null }
							: entry
					)));
				} finally {
					generatingIds.current.delete(item.id);
				}
			}
		};

		void generatePreviews();

		return () => {
			cancelled = true;
		};
	}, [files]);

	const clearDownload = () => {
		if (downloadUrl) {
			URL.revokeObjectURL(downloadUrl);
		}
		setDownloadUrl(null);
		setDownloadName("");
		setDownloadBaseName("");
		setDownloadExtension("");
	};

	const handleFileSelect = (selectedFiles: File[]) => {
		const newItems = selectedFiles.map((file) => ({
			id: createId(),
			file,
			previewUrl: null,
			previewStatus: "loading" as const,
			totalPages: null,
		}));

		setFiles((prevFiles) => [...prevFiles, ...newItems]);
		clearDownload();
	};

	const removeFile = (index: number) => {
		setFiles((prevFiles) => prevFiles.filter((_, currentIndex) => currentIndex !== index));
		clearDownload();
		setDraggingIndex((current) => (current === index ? null : current));
		setDragOverIndex((current) => (current === index ? null : current));
	};

	const moveFile = (fromIndex: number, toIndex: number) => {
		setFiles((prevFiles) => {
			if (fromIndex === toIndex || fromIndex < 0 || fromIndex >= prevFiles.length) return prevFiles;
			const targetIndex = Math.max(0, Math.min(toIndex, prevFiles.length));
			const nextFiles = [...prevFiles];
			const [moved] = nextFiles.splice(fromIndex, 1);
			const adjustedTarget = fromIndex < targetIndex ? targetIndex - 1 : targetIndex;
			nextFiles.splice(adjustedTarget, 0, moved);
			return nextFiles;
		});
		clearDownload();
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

	const handleContainerDragOver = (event: DragEvent<HTMLDivElement>) => {
		if (draggingIndex === null) return;
		event.preventDefault();
		setDragOverIndex(files.length);
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

	const mergePDFs = async () => {
		if (files.length < 2) {
			alert("Please select at least 2 PDF files to merge");
			return;
		}

		setIsProcessing(true);
		setProgress(0);

		try {
			const mergedPdf = await PDFDocument.create();

			for (let i = 0; i < files.length; i += 1) {
				const file = files[i].file;
				const arrayBuffer = await file.arrayBuffer();
				const pdf = await PDFDocument.load(arrayBuffer);
				const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
				copiedPages.forEach((page) => {
					mergedPdf.addPage(page);
				});
				setProgress(Math.round(((i + 1) / files.length) * 100));
			}

			const pdfBytes = await mergedPdf.save({
				useObjectStreams: false,
				addDefaultPage: false,
				objectsPerTick: 50,
				updateFieldAppearances: true,
			});

			const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
			const url = URL.createObjectURL(blob);
			const defaultName = `merged_${Date.now()}.pdf`;
			const parts = splitFileName(defaultName);

			clearDownload();
			setDownloadUrl(url);
			setDownloadName(defaultName);
			setDownloadBaseName(parts.base || "merged");
			setDownloadExtension(parts.ext || ".pdf");
			setProgress(100);
		} catch (error) {
			console.error("Error merging PDFs:", error);
			alert("Failed to merge PDFs. Please try again.");
		} finally {
			setIsProcessing(false);
		}
	};

	const handleDownload = () => {
		if (!downloadUrl) return;
		const finalName = buildDownloadName(downloadBaseName, downloadExtension, downloadName || "merged.pdf");
		const link = document.createElement("a");
		link.href = downloadUrl;
		link.download = finalName;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	};

	const handleReset = () => {
		clearDownload();
		setFiles([]);
		setProgress(0);
		setDraggingIndex(null);
		setDragOverIndex(null);
	};

	const renderItems = useMemo(() => {
		const items: Array<{ type: "file"; item: MergeFileItem; index: number } | { type: "placeholder"; key: string }> = [];

		files.forEach((item, index) => {
			if (draggingIndex !== null && dragOverIndex === index && draggingIndex !== index) {
				items.push({ type: "placeholder", key: `placeholder-${index}` });
			}

			items.push({ type: "file", item, index });
		});

		if (draggingIndex !== null && dragOverIndex === files.length && draggingIndex !== files.length) {
			items.push({ type: "placeholder", key: `placeholder-end` });
		}

		return items;
	}, [dragOverIndex, draggingIndex, files]);

	const totalPagesLoaded = files.reduce((count, item) => count + (item.totalPages || 0), 0);

	return (
		<div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50 p-4 sm:p-6 lg:p-8 dark:from-[#0b1020] dark:via-[#0f172a] dark:to-[#111827]">
			<div className="mx-auto max-w-7xl">
				<div className="mb-10 text-center">
					<h1 className="mb-4 text-4xl font-bold tracking-tight text-gray-900 dark:text-white md:text-5xl">
						<span className="bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">Merge PDFs</span>
					</h1>
					<p className="mx-auto max-w-2xl text-base leading-relaxed text-gray-600 dark:text-slate-400 md:text-lg">
						Combine multiple PDF files into one document with a smooth, thumbnail-based drag-and-drop workflow.
					</p>
				</div>

				<div className="rounded-[2rem] border border-gray-200/70 bg-white/80 p-5 shadow-[0_20px_80px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/5 dark:bg-white/5 md:p-8 mb-8">
					<DragDropUpload
						onFileSelect={handleFileSelect}
						accept=".pdf"
						multiple={true}
						maxSize={50}
						disabled={isProcessing}
						icon="📁"
						title="Click to select PDF files"
						subtitle="or drag and drop files here"
						borderColor="border-violet-300"
						hoverColor="border-violet-500 bg-violet-500/10"
					/>
				</div>

				<div className="mb-8 rounded-[2rem] border border-violet-500/15 bg-violet-500/10 p-6 shadow-[0_16px_60px_rgba(124,58,237,0.08)]">
					<p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-violet-600 dark:text-violet-300">
						How to use
					</p>
					<ol className="space-y-2 text-sm leading-7 text-gray-700 dark:text-slate-300 sm:text-base">
						<li>1. Select or drag multiple PDF files into the upload area.</li>
						<li>2. Reorder the thumbnail cards by dragging them naturally.</li>
						<li>3. Review the order, then click Merge PDFs to combine them.</li>
						<li>4. Rename the output and download the merged file.</li>
					</ol>
				</div>

				{files.length > 0 && (
					<div className="mb-8 rounded-[2rem] border border-gray-200/70 bg-white/80 p-5 shadow-[0_20px_80px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/5 dark:bg-white/5 md:p-8">
						<div className="mb-6 flex flex-wrap items-center justify-between gap-3">
							<div>
								<h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
									Selected Files ({files.length})
								</h2>
								<p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
									{files.length > 1 ? "Drag the cards to change merge order." : "Add more PDFs to enable reordering."}
								</p>
							</div>
							<div className="rounded-full bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-600 dark:text-violet-300">
								{totalPagesLoaded} total pages
							</div>
						</div>

						<div className="mb-4 flex items-center justify-between gap-3">
							<span className="text-sm font-medium text-gray-500 dark:text-slate-400">Drag to reorder</span>
							{files.length > 1 && (
								<span className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 dark:text-slate-500">
									{draggingIndex !== null ? "Dragging" : "Ready"}
								</span>
							)}
						</div>

						<div
							className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
							onDragOver={handleContainerDragOver}
							onDrop={(event) => {
								event.preventDefault();
								if (draggingIndex === null) return;
								moveFile(draggingIndex, files.length);
								handleDragEnd();
							}}
						>
							{renderItems.map((item) => {
								if (item.type === "placeholder") {
									return (
										<div
											key={item.key}
											className="h-full min-h-[280px] rounded-[1.5rem] border-2 border-dashed border-violet-500/50 bg-violet-500/8 shadow-[0_0_0_1px_rgba(124,58,237,0.12)] animate-pulse"
										/>
									);
								}

								const { item: fileItem, index } = item;
								const isDragging = draggingIndex === index;

								return (
									<div
										key={fileItem.id}
										className={`group relative mx-auto flex h-full w-full max-w-[220px] cursor-grab flex-col rounded-[1.5rem] border bg-white/90 p-3 shadow-[0_12px_40px_rgba(15,23,42,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_50px_rgba(124,58,237,0.12)] active:cursor-grabbing dark:border-white/5 dark:bg-white/5 ${
											dragOverIndex === index && draggingIndex !== index
												? "border-violet-500 bg-violet-500/10 ring-4 ring-violet-500/10"
												: "border-gray-200/70"
										} ${isDragging ? "scale-[0.96] opacity-60 shadow-[0_20px_60px_rgba(124,58,237,0.16)]" : ""}`}
										draggable={!isProcessing && files.length > 1}
										onDragStart={() => handleDragStart(index)}
										onDragOver={(event) => handleDragOver(event, index)}
										onDrop={(event) => handleDrop(event, index)}
										onDragEnd={handleDragEnd}
									>
										<div className="relative overflow-hidden rounded-[1.1rem] border border-gray-200/70 bg-gray-50 dark:border-white/10 dark:bg-white/5">
											<div className="absolute left-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-900/85 text-sm font-bold text-white shadow-lg shadow-black/20">
												{index + 1}
											</div>

											<div className="flex aspect-[3/4] items-center justify-center bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-white/5 dark:to-white/10">
												{fileItem.previewStatus === "ready" && fileItem.previewUrl ? (
													<img
														src={fileItem.previewUrl}
														alt={`${fileItem.file.name} preview`}
														className="h-full w-full object-cover"
													/>
												) : (
													<div className="flex h-full w-full flex-col items-center justify-center gap-3 px-4 text-center">
														<PdfPlaceholderIcon />
														<div>
															<p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500 dark:text-slate-500">
																{fileItem.previewStatus === "error" ? "Preview unavailable" : "Generating preview"}
															</p>
															{fileItem.previewStatus === "loading" && (
																<p className="mt-2 text-xs text-gray-400 dark:text-slate-500">
																	Rendering first page
																</p>
															)}
														</div>
													</div>
												)}
											</div>
										</div>

										<div className="flex min-h-0 flex-1 flex-col gap-3 p-2 pt-4">
											<div>
												<div className="mb-2 flex items-center justify-between gap-2">
													<span className="rounded-full bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-300">
														{index + 1}
													</span>
													<button
														type="button"
														onClick={(event) => {
															event.stopPropagation();
															removeFile(index);
														}}
														disabled={isProcessing}
														className="inline-flex items-center justify-center rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-600 transition-colors hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-300"
													>
														Remove
													</button>
												</div>
												<h3 className="line-clamp-2 text-sm font-semibold leading-6 text-gray-900 dark:text-white">
													{fileItem.file.name}
												</h3>
											</div>

											<div className="mt-auto space-y-1 text-xs text-gray-500 dark:text-slate-400">
												<div>{(fileItem.file.size / 1024 / 1024).toFixed(2)} MB</div>
												<div>{fileItem.totalPages !== null ? `${fileItem.totalPages} total pages` : "Total pages loading"}</div>
											</div>
										</div>
									</div>
								);
							})}
						</div>
					</div>
				)}

				{isProcessing && (
					<div className="mb-8 rounded-[2rem] border border-gray-200/70 bg-white/80 p-8 shadow-[0_20px_80px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/5 dark:bg-white/5">
						<div className="mb-4 text-center">
							<div className="mb-2 text-xl font-semibold text-gray-700 dark:text-slate-200">
								Merging PDFs...
							</div>
							<div className="text-4xl font-bold text-violet-600 dark:text-violet-300">
								{progress}%
							</div>
						</div>
						<div className="h-4 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
							<div
								className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-300"
								style={{ width: `${progress}%` }}
							/>
						</div>
					</div>
				)}

				{downloadUrl && !isProcessing && (
					<div className="mb-8 rounded-[2rem] border border-emerald-500/20 bg-emerald-500/10 p-8 text-center shadow-[0_20px_80px_rgba(15,23,42,0.08)]" role="status">
						<div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15">
							<svg className="h-10 w-10 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
								<path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
							</svg>
						</div>
						<h3 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">Merge Complete</h3>
						<p className="mb-6 text-emerald-700 dark:text-emerald-300">Your merged PDF is ready to download.</p>
						<div className="mx-auto mb-6 max-w-md text-left">
							<label className="mb-2 block text-sm font-semibold text-gray-600 dark:text-slate-300">File name</label>
							<div className="flex items-center gap-2">
								<input
									type="text"
									value={downloadBaseName}
									onChange={(event) => setDownloadBaseName(event.target.value)}
									className="flex-1 rounded-2xl border border-gray-200/80 bg-white/80 px-4 py-3 text-gray-700 outline-none focus:border-violet-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
									placeholder="Enter file name"
								/>
								{downloadExtension && (
									<span className="rounded-2xl border border-gray-200/80 bg-white/80 px-3 py-3 text-sm text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
										{downloadExtension}
									</span>
								)}
							</div>
						</div>
						<div className="flex flex-col justify-center gap-4 sm:flex-row">
							<button
								onClick={handleDownload}
								className="rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-8 py-4 font-semibold text-white shadow-lg shadow-violet-500/20 transition-all hover:shadow-xl hover:shadow-violet-500/25"
							>
								Download PDF
							</button>
							<button
								onClick={handleReset}
								className="rounded-2xl border border-gray-200/80 bg-white px-8 py-4 font-semibold text-gray-700 transition-colors hover:border-violet-500/30 hover:text-violet-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
							>
								Merge Another File
							</button>
						</div>
					</div>
				)}

				{files.length >= 2 && !isProcessing && !downloadUrl && (
					<button
						onClick={mergePDFs}
						className="w-full rounded-[1.75rem] bg-gradient-to-r from-violet-500 to-fuchsia-500 py-6 text-xl font-bold text-white shadow-xl shadow-violet-500/20 transition-all hover:scale-[1.01] hover:shadow-2xl hover:shadow-violet-500/25"
					>
						Merge {files.length} PDFs
					</button>
				)}
			</div>
		</div>
	);
}