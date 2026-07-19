"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import DragDropUpload from "./DragDropUpload";
import { buildDownloadName, splitFileName } from "@/lib/fileName";

if (typeof window !== "undefined") {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
}

type HandlePosition = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

type InteractionState =
    | null
    | {
          type: "draw";
          page: number;
          start: { x: number; y: number };
          current: { x: number; y: number };
      }
    | {
          type: "move";
          rectId: string;
          page: number;
          startPointer: { x: number; y: number };
          startRect: RedactArea;
      }
    | {
          type: "resize";
          rectId: string;
          page: number;
          handle: HandlePosition;
          startPointer: { x: number; y: number };
          startRect: RedactArea;
      };

interface RedactArea {
    id: string;
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
}

interface PageSize {
    width: number;
    height: number;
}

interface Point {
    x: number;
    y: number;
}

const MIN_RECT_SIZE = 8;
const MIN_ZOOM = 0.65;
const MAX_ZOOM = 2.25;
const ZOOM_STEP = 0.15;

const HANDLE_POSITIONS: HandlePosition[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

function createId() {
    return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function roundCoord(value: number) {
    return Math.round(value * 100) / 100;
}

function pointFromEvent(event: React.PointerEvent<HTMLDivElement>, scale: number, bounds: DOMRect): Point {
    return {
        x: (event.clientX - bounds.left) / scale,
        y: (event.clientY - bounds.top) / scale,
    };
}

function createAreaFromDrag(page: number, start: Point, current: Point, pageSize: PageSize): RedactArea | null {
    const left = clamp(Math.min(start.x, current.x), 0, pageSize.width);
    const top = clamp(Math.min(start.y, current.y), 0, pageSize.height);
    const right = clamp(Math.max(start.x, current.x), 0, pageSize.width);
    const bottom = clamp(Math.max(start.y, current.y), 0, pageSize.height);
    const width = right - left;
    const height = bottom - top;

    if (width < MIN_RECT_SIZE || height < MIN_RECT_SIZE) {
        return null;
    }

    return {
        id: createId(),
        page,
        x: roundCoord(left),
        y: roundCoord(top),
        width: roundCoord(width),
        height: roundCoord(height),
    };
}

function resizeArea(area: RedactArea, handle: HandlePosition, startPointer: Point, currentPointer: Point, pageSize: PageSize): RedactArea {
    const dx = currentPointer.x - startPointer.x;
    const dy = currentPointer.y - startPointer.y;

    let left = area.x;
    let right = area.x + area.width;
    let top = area.y;
    let bottom = area.y + area.height;

    if (handle.includes("w")) {
        left = clamp(area.x + dx, 0, right - MIN_RECT_SIZE);
    }
    if (handle.includes("e")) {
        right = clamp(area.x + area.width + dx, left + MIN_RECT_SIZE, pageSize.width);
    }
    if (handle.includes("n")) {
        top = clamp(area.y + dy, 0, bottom - MIN_RECT_SIZE);
    }
    if (handle.includes("s")) {
        bottom = clamp(area.y + area.height + dy, top + MIN_RECT_SIZE, pageSize.height);
    }

    if (right - left < MIN_RECT_SIZE) {
        if (handle.includes("w")) {
            left = right - MIN_RECT_SIZE;
        } else {
            right = left + MIN_RECT_SIZE;
        }
    }

    if (bottom - top < MIN_RECT_SIZE) {
        if (handle.includes("n")) {
            top = bottom - MIN_RECT_SIZE;
        } else {
            bottom = top + MIN_RECT_SIZE;
        }
    }

    left = clamp(left, 0, pageSize.width - MIN_RECT_SIZE);
    top = clamp(top, 0, pageSize.height - MIN_RECT_SIZE);
    right = clamp(right, left + MIN_RECT_SIZE, pageSize.width);
    bottom = clamp(bottom, top + MIN_RECT_SIZE, pageSize.height);

    return {
        ...area,
        x: roundCoord(left),
        y: roundCoord(top),
        width: roundCoord(right - left),
        height: roundCoord(bottom - top),
    };
}

function updateMoveArea(area: RedactArea, startPointer: Point, currentPointer: Point, pageSize: PageSize): RedactArea {
    const dx = currentPointer.x - startPointer.x;
    const dy = currentPointer.y - startPointer.y;
    const maxX = Math.max(0, pageSize.width - area.width);
    const maxY = Math.max(0, pageSize.height - area.height);

    return {
        ...area,
        x: roundCoord(clamp(area.x + dx, 0, maxX)),
        y: roundCoord(clamp(area.y + dy, 0, maxY)),
    };
}

function getHandleCursor(handle: HandlePosition) {
    switch (handle) {
        case "nw":
        case "se":
            return "cursor-nwse-resize";
        case "ne":
        case "sw":
            return "cursor-nesw-resize";
        case "n":
        case "s":
            return "cursor-ns-resize";
        case "e":
        case "w":
            return "cursor-ew-resize";
        default:
            return "cursor-default";
    }
}

function PdfThumbnail({
    pdfDoc,
    pageNumber,
    active,
    onClick,
}: {
    pdfDoc: any;
    pageNumber: number;
    active: boolean;
    onClick: () => void;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        let cancelled = false;
        let renderTask: any = null;

        const render = async () => {
            const canvas = canvasRef.current;
            if (!canvas || !pdfDoc) return;

            const page = await pdfDoc.getPage(pageNumber);
            if (cancelled) return;
            const viewport = page.getViewport({ scale: 0.18 });
            const context = canvas.getContext("2d");
            if (!context) return;

            canvas.width = viewport.width;
            canvas.height = viewport.height;
            canvas.style.width = `${viewport.width}px`;
            canvas.style.height = `${viewport.height}px`;

            renderTask = page.render({ canvasContext: context, viewport });
            await renderTask.promise;
        };

        render().catch((error) => console.error("Thumbnail render failed:", error));

        return () => {
            cancelled = true;
            renderTask?.cancel?.();
        };
    }, [pdfDoc, pageNumber]);

    return (
        <button
            type="button"
            onClick={onClick}
            className={`group w-full rounded-2xl border p-3 text-left transition-all duration-200 ${
                active
                    ? "border-violet-500 bg-violet-500/10 shadow-lg shadow-violet-500/10"
                    : "border-gray-200/80 dark:border-white/10 bg-white/70 dark:bg-white/5 hover:border-violet-500/30 hover:bg-violet-500/5"
            }`}
        >
            <div className="overflow-hidden rounded-xl border border-gray-200/60 dark:border-white/10 bg-white dark:bg-white/5">
                <canvas ref={canvasRef} className="block w-full h-auto" />
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-slate-500">
                    Page {pageNumber}
                </span>
                <span className={`text-xs font-medium ${active ? "text-violet-600 dark:text-violet-300" : "text-gray-400 dark:text-slate-500"}`}>
                    View
                </span>
            </div>
        </button>
    );
}

function PdfPageView({
    pdfDoc,
    pageNumber,
    pageSize,
    scale,
    areas,
    selectedAreaId,
    draftArea,
    activePage,
    onSelectPage,
    onSelectArea,
    onDeleteArea,
    onBeginDraw,
    onBeginMove,
    onBeginResize,
    onRegisterPage,
}: {
    pdfDoc: any;
    pageNumber: number;
    pageSize: PageSize;
    scale: number;
    areas: RedactArea[];
    selectedAreaId: string | null;
    draftArea: RedactArea | null;
    activePage: number;
    onSelectPage: (page: number) => void;
    onSelectArea: (area: RedactArea) => void;
    onDeleteArea: (id: string) => void;
    onBeginDraw: (page: number, point: Point) => void;
    onBeginMove: (area: RedactArea, startPointer: Point) => void;
    onBeginResize: (area: RedactArea, handle: HandlePosition, startPointer: Point) => void;
    onRegisterPage: (page: number, element: HTMLElement | null) => void;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let cancelled = false;
        let renderTask: any = null;

        const render = async () => {
            const canvas = canvasRef.current;
            if (!canvas || !pdfDoc) return;

            const page = await pdfDoc.getPage(pageNumber);
            if (cancelled) return;
            const viewport = page.getViewport({ scale });
            const context = canvas.getContext("2d");
            if (!context) return;

            canvas.width = viewport.width;
            canvas.height = viewport.height;
            canvas.style.width = `${viewport.width}px`;
            canvas.style.height = `${viewport.height}px`;

            renderTask = page.render({ canvasContext: context, viewport });
            await renderTask.promise;
        };

        render().catch((error) => console.error("PDF page render failed:", error));

        return () => {
            cancelled = true;
            renderTask?.cancel?.();
        };
    }, [pdfDoc, pageNumber, scale]);

    const pageAreas = areas.filter((area) => area.page === pageNumber);
    const pageWidth = pageSize.width * scale;
    const pageHeight = pageSize.height * scale;
    const draftPreview = draftArea && draftArea.page === pageNumber ? draftArea : null;

    useEffect(() => {
        onRegisterPage(pageNumber, wrapperRef.current);

        return () => {
            onRegisterPage(pageNumber, null);
        };
    }, [onRegisterPage, pageNumber]);

    const getPoint = (event: React.PointerEvent<HTMLDivElement>) => {
        const bounds = wrapperRef.current?.getBoundingClientRect();
        if (!bounds) return null;
        return pointFromEvent(event, scale, bounds);
    };

    return (
        <section
            ref={wrapperRef}
            className={`relative mx-auto mb-8 rounded-[1.75rem] border bg-white shadow-[0_18px_60px_rgba(15,23,42,0.08)] transition-all ${
                activePage === pageNumber
                    ? "border-violet-500/40 ring-4 ring-violet-500/10"
                    : "border-gray-200/70 dark:border-white/5"
            }`}
            style={{ width: pageWidth }}
            onPointerDown={() => onSelectPage(pageNumber)}
        >
            <div className="absolute left-4 top-4 z-20 rounded-full bg-gray-900/80 px-3 py-1 text-xs font-semibold tracking-[0.2em] text-white backdrop-blur-sm">
                Page {pageNumber}
            </div>

            <canvas ref={canvasRef} className="block rounded-[1.75rem]" />

            <div
                className="absolute inset-0 rounded-[1.75rem]"
                style={{ width: pageWidth, height: pageHeight }}
                onPointerDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    const point = getPoint(event);
                    if (!point) return;
                    onSelectPage(pageNumber);
                    onBeginDraw(pageNumber, point);
                }}
            >
                {draftPreview && (
                    <div
                        className="pointer-events-none absolute border-2 border-dashed border-violet-500 bg-violet-500/10 shadow-[0_0_0_1px_rgba(124,58,237,0.18)]"
                        style={{
                            left: Math.min(draftPreview.x, draftPreview.x + draftPreview.width) * scale,
                            top: Math.min(draftPreview.y, draftPreview.y + draftPreview.height) * scale,
                            width: Math.abs(draftPreview.width) * scale,
                            height: Math.abs(draftPreview.height) * scale,
                        }}
                    />
                )}

                {pageAreas.map((area) => {
                    const selected = area.id === selectedAreaId;
                    const left = area.x * scale;
                    const top = area.y * scale;
                    const width = area.width * scale;
                    const height = area.height * scale;

                    return (
                        <div
                            key={area.id}
                            className={`absolute select-none rounded-lg border-2 transition-all ${
                                selected
                                    ? "border-violet-500 bg-violet-500/15 shadow-[0_0_0_1px_rgba(124,58,237,0.35),0_12px_30px_rgba(124,58,237,0.18)]"
                                    : "border-rose-500/80 bg-rose-500/10 hover:border-rose-500"
                            }`}
                            style={{ left, top, width, height }}
                            onPointerDown={(event) => {
                                event.stopPropagation();
                                const point = getPoint(event);
                                if (!point) return;
                                onSelectArea(area);
                                onBeginMove(area, point);
                            }}
                        >
                            {selected && (
                                <>
                                    <button
                                        type="button"
                                        aria-label="Delete redaction area"
                                        className="absolute -right-3 -top-3 z-30 inline-flex h-7 w-7 items-center justify-center rounded-full border border-white bg-rose-500 text-white shadow-lg shadow-rose-500/25 transition-transform hover:scale-105"
                                        onPointerDown={(event) => event.stopPropagation()}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            onDeleteArea(area.id);
                                        }}
                                    >
                                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>

                                    {HANDLE_POSITIONS.map((handle) => {
                                        const handleClass =
                                            handle === "nw" ? "-left-1.5 -top-1.5" :
                                                handle === "n" ? "left-1/2 -top-1.5 -translate-x-1/2" :
                                                handle === "ne" ? "-right-1.5 -top-1.5" :
                                                handle === "e" ? "-right-1.5 top-1/2 -translate-y-1/2" :
                                                handle === "se" ? "-right-1.5 -bottom-1.5" :
                                                handle === "s" ? "left-1/2 -bottom-1.5 -translate-x-1/2" :
                                                handle === "sw" ? "-left-1.5 -bottom-1.5" : "-left-1.5 top-1/2 -translate-y-1/2";

                                        return (
                                            <button
                                                key={handle}
                                                type="button"
                                                aria-label={`Resize from ${handle}`}
                                                className={`absolute z-20 h-3.5 w-3.5 rounded-full border border-white bg-violet-500 shadow-md shadow-violet-500/30 ${getHandleCursor(handle)} ${handleClass}`}
                                                onPointerDown={(event) => {
                                                    event.stopPropagation();
                                                    const point = getPoint(event);
                                                    if (!point) return;
                                                    onSelectArea(area);
                                                    onBeginResize(area, handle, point);
                                                }}
                                            />
                                        );
                                    })}
                                </>
                            )}

                            <div className="absolute inset-0 rounded-lg bg-black/5" />
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

export default function RedactPDFStudio() {
    const [file, setFile] = useState<File | null>(null);
    const [pdfDoc, setPdfDoc] = useState<any>(null);
    const [pageSizes, setPageSizes] = useState<PageSize[]>([]);
    const [areas, setAreas] = useState<RedactArea[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
    const [interaction, setInteraction] = useState<InteractionState>(null);
    const [viewerWidth, setViewerWidth] = useState(960);
    const [zoom, setZoom] = useState(1);
    const [showThumbnails, setShowThumbnails] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
    const [downloadBaseName, setDownloadBaseName] = useState("");
    const [error, setError] = useState<string | null>(null);

    const viewerRef = useRef<HTMLDivElement>(null);
    const pageRefs = useRef<Record<number, HTMLElement | null>>({});
    const loadRequestId = useRef(0);

    const totalPages = pageSizes.length;

    const selectedArea = useMemo(
        () => areas.find((area) => area.id === selectedAreaId) || null,
        [areas, selectedAreaId]
    );

    const baseFitScale = useCallback(
        (pageNumber: number) => {
            const pageSize = pageSizes[pageNumber - 1];
            if (!pageSize) return 1;
            const availableWidth = Math.max(320, viewerWidth - 48);
            return availableWidth / pageSize.width;
        },
        [pageSizes, viewerWidth]
    );

    const pageScale = useCallback(
        (pageNumber: number) => baseFitScale(pageNumber) * zoom,
        [baseFitScale, zoom]
    );

    useEffect(() => {
        const element = viewerRef.current;
        if (!element) return;

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry) {
                setViewerWidth(Math.max(320, Math.floor(entry.contentRect.width)));
            }
        });

        observer.observe(element);
        setViewerWidth(Math.max(320, Math.floor(element.getBoundingClientRect().width)));

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        return () => {
            if (downloadUrl) {
                URL.revokeObjectURL(downloadUrl);
            }
            pdfDoc?.destroy?.();
        };
    }, [downloadUrl, pdfDoc]);

    useEffect(() => {
        const handleMove = (event: PointerEvent) => {
            if (!interaction || !file) return;

            const current = {
                x: 0,
                y: 0,
            };

            const pageSize = pageSizes[interaction.page - 1];
            const pageElement = pageRefs.current[interaction.page];
            if (!pageSize || !pageElement) return;
            const bounds = pageElement.getBoundingClientRect();
            const scale = pageScale(interaction.page);
            current.x = (event.clientX - bounds.left) / scale;
            current.y = (event.clientY - bounds.top) / scale;

            if (interaction.type === "draw") {
                setInteraction({ ...interaction, current });
                return;
            }

            if (interaction.type === "move") {
                setAreas((prev) =>
                    prev.map((area) =>
                        area.id === interaction.rectId
                            ? updateMoveArea(interaction.startRect, interaction.startPointer, current, pageSize)
                            : area
                    )
                );
                return;
            }

            if (interaction.type === "resize") {
                setAreas((prev) =>
                    prev.map((area) =>
                        area.id === interaction.rectId
                            ? resizeArea(interaction.startRect, interaction.handle, interaction.startPointer, current, pageSize)
                            : area
                    )
                );
            }
        };

        const finishInteraction = () => {
            if (!interaction) return;

            if (interaction.type === "draw") {
                const pageSize = pageSizes[interaction.page - 1];
                if (pageSize) {
                    const area = createAreaFromDrag(interaction.page, interaction.start, interaction.current, pageSize);
                    if (area) {
                        setAreas((prev) => [...prev, area]);
                        setSelectedAreaId(area.id);
                    }
                }
            }

            setInteraction(null);
        };

        window.addEventListener("pointermove", handleMove);
        window.addEventListener("pointerup", finishInteraction);
        window.addEventListener("pointercancel", finishInteraction);

        return () => {
            window.removeEventListener("pointermove", handleMove);
            window.removeEventListener("pointerup", finishInteraction);
            window.removeEventListener("pointercancel", finishInteraction);
        };
    }, [file, interaction, pageScale, pageSizes]);

    const handleFileSelect = useCallback(async (selectedFiles: File[]) => {
        const nextFile = selectedFiles[0];
        if (!nextFile) return;

        setError(null);
        setFile(nextFile);
        setAreas([]);
        setSelectedAreaId(null);
        setDownloadUrl(null);
        setCurrentPage(1);
        setZoom(1);
        setProgress(0);

        const parts = splitFileName(nextFile.name);
        setDownloadBaseName(parts.base ? `${parts.base}-redacted` : "redacted");

        const requestId = ++loadRequestId.current;
        setIsLoading(true);

        try {
            const arrayBuffer = await nextFile.arrayBuffer();
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            const pdf = await loadingTask.promise;

            if (requestId !== loadRequestId.current) {
                pdf.destroy?.();
                return;
            }

            const sizes: PageSize[] = [];
            for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
                const page = await pdf.getPage(pageNumber);
                const viewport = page.getViewport({ scale: 1 });
                sizes.push({ width: viewport.width, height: viewport.height });
            }

            if (requestId !== loadRequestId.current) {
                pdf.destroy?.();
                return;
            }

            pdfDoc?.destroy?.();
            setPdfDoc(pdf);
            setPageSizes(sizes);
            setCurrentPage(1);

            requestAnimationFrame(() => {
                pageRefs.current[1]?.scrollIntoView({ behavior: "smooth", block: "start" });
            });
        } catch (loadError) {
            console.error("Failed to load PDF:", loadError);
            setError("Failed to load PDF. Please try again.");
            setFile(null);
            setPdfDoc(null);
            setPageSizes([]);
        } finally {
            if (requestId === loadRequestId.current) {
                setIsLoading(false);
            }
        }
    }, [pdfDoc]);

    const applyRedaction = async () => {
        if (!file || areas.length === 0) return;

        setIsProcessing(true);
        setProgress(10);
        setError(null);

        try {
            const payload = areas.map(({ id, ...area }) => area);
            const formData = new FormData();
            formData.append("file0", file);
            formData.append("areas", JSON.stringify(payload));

            setProgress(30);
            const response = await fetch("/api/redact-pdf", { method: "POST", body: formData });
            setProgress(70);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: "Processing failed" }));
                throw new Error(errorData.error || "Processing failed");
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);

            if (downloadUrl) {
                URL.revokeObjectURL(downloadUrl);
            }

            setDownloadUrl(url);
            setProgress(100);
        } catch (applyError) {
            const message = applyError instanceof Error ? applyError.message : "An error occurred while applying redaction.";
            setError(message);
        } finally {
            setIsProcessing(false);
        }
    };

    const downloadRedacted = () => {
        if (!downloadUrl) return;
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = buildDownloadName(downloadBaseName, ".pdf", "redacted.pdf");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const resetTool = () => {
        if (downloadUrl) {
            URL.revokeObjectURL(downloadUrl);
        }
        pdfDoc?.destroy?.();
        loadRequestId.current += 1;
        setFile(null);
        setPdfDoc(null);
        setPageSizes([]);
        setAreas([]);
        setSelectedAreaId(null);
        setInteraction(null);
        setCurrentPage(1);
        setZoom(1);
        setIsLoading(false);
        setIsProcessing(false);
        setProgress(0);
        setDownloadUrl(null);
        setDownloadBaseName("");
        setError(null);
    };

    const selectArea = (area: RedactArea) => {
        setSelectedAreaId(area.id);
        setCurrentPage(area.page);
        pageRefs.current[area.page]?.scrollIntoView({ behavior: "smooth", block: "center" });
    };

    const deleteArea = (areaId: string) => {
        setAreas((prev) => prev.filter((area) => area.id !== areaId));
        setSelectedAreaId((prev) => (prev === areaId ? null : prev));
    };

    const navigateToPage = (page: number) => {
        const nextPage = clamp(page, 1, Math.max(1, totalPages));
        setCurrentPage(nextPage);
        pageRefs.current[nextPage]?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const registerPageRef = useCallback((page: number, element: HTMLElement | null) => {
        pageRefs.current[page] = element;
    }, []);

    const beginDraw = (page: number, point: Point) => {
        const pageSize = pageSizes[page - 1];
        if (!pageSize) return;
        setSelectedAreaId(null);
        setCurrentPage(page);
        setInteraction({
            type: "draw",
            page,
            start: point,
            current: point,
        });
    };

    const beginMove = (area: RedactArea, startPointer: Point) => {
        setInteraction({
            type: "move",
            rectId: area.id,
            page: area.page,
            startPointer,
            startRect: area,
        });
    };

    const beginResize = (area: RedactArea, handle: HandlePosition, startPointer: Point) => {
        setInteraction({
            type: "resize",
            rectId: area.id,
            page: area.page,
            handle,
            startPointer,
            startRect: area,
        });
    };

    const activeDraft = interaction?.type === "draw" ? interaction : null;
    const canApply = areas.length > 0 && !isLoading && !isProcessing && !!file;

    return (
        <div className="min-h-screen bg-[var(--bg-primary)] py-6 md:py-10">
            <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8">
                <div className="mb-8 overflow-hidden rounded-[2rem] border border-gray-200/70 bg-white/80 p-6 shadow-[0_16px_60px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/5 dark:bg-white/5 md:p-8">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-3xl">
                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-500 dark:text-violet-300 mb-3">
                                Adobe-style redaction workspace
                            </p>
                            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 dark:text-white">
                                Redact PDF with direct page editing
                            </h1>
                            <p className="mt-4 text-base md:text-lg leading-relaxed text-gray-600 dark:text-slate-400">
                                Upload a PDF, draw redaction boxes directly on the page, resize or move them as needed, and apply the result with one secure action.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[520px]">
                            {[
                                { label: "Pages", value: totalPages || "-" },
                                { label: "Areas", value: areas.length },
                                { label: "Zoom", value: `${Math.round(zoom * 100)}%` },
                                { label: "Mode", value: showThumbnails ? "Thumbs on" : "Thumbs off" },
                            ].map((item) => (
                                <div key={item.label} className="rounded-2xl border border-gray-200/70 bg-white/80 px-4 py-3 text-center dark:border-white/5 dark:bg-white/5">
                                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-slate-500">
                                        {item.label}
                                    </div>
                                    <div className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{item.value}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 dark:text-red-300">
                        {error}
                    </div>
                )}

                {!file && (
                    <div className="mb-8 rounded-[2rem] border border-gray-200/70 bg-white/80 p-5 shadow-[0_16px_60px_rgba(15,23,42,0.08)] dark:border-white/5 dark:bg-white/5 md:p-8">
                        <DragDropUpload
                            onFileSelect={(files) => void handleFileSelect(files)}
                            accept=".pdf"
                            multiple={false}
                            maxSize={50}
                            icon="🔒"
                            title="Drop your PDF to open the redaction editor"
                            subtitle="Then draw black-out regions directly on the page"
                            borderColor="border-violet-300"
                            hoverColor="border-violet-500 bg-violet-500/10"
                        />
                    </div>
                )}

                {file && !downloadUrl && (
                    <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)_340px]">
                        <aside className={`space-y-4 ${showThumbnails ? "block" : "hidden lg:block"}`}>
                            <div className="rounded-[2rem] border border-gray-200/70 bg-white/80 p-5 shadow-[0_16px_60px_rgba(15,23,42,0.08)] dark:border-white/5 dark:bg-white/5">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-500 dark:text-violet-300">Thumbnails</p>
                                        <h2 className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">Pages</h2>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowThumbnails((value) => !value)}
                                        className="rounded-full border border-gray-200/80 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-violet-500/30 hover:text-violet-600 dark:border-white/10 dark:text-slate-300 dark:hover:text-violet-300"
                                    >
                                        {showThumbnails ? "Hide" : "Show"}
                                    </button>
                                </div>

                                <div className="mt-4 max-h-[70vh] space-y-3 overflow-y-auto pr-1">
                                    {pdfDoc && pageSizes.map((_, index) => (
                                        <PdfThumbnail
                                            key={index + 1}
                                            pdfDoc={pdfDoc}
                                            pageNumber={index + 1}
                                            active={currentPage === index + 1}
                                            onClick={() => navigateToPage(index + 1)}
                                        />
                                    ))}
                                </div>
                            </div>
                        </aside>

                        <main ref={viewerRef} className="min-w-0 space-y-6">
                            <div className="sticky top-4 z-30 rounded-[1.75rem] border border-gray-200/70 bg-white/90 p-4 shadow-[0_16px_60px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/5 dark:bg-[#0f172a]/90">
                                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={() => navigateToPage(currentPage - 1)}
                                            disabled={currentPage <= 1}
                                            className="inline-flex items-center gap-2 rounded-2xl border border-gray-200/80 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-violet-500/30 hover:text-violet-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                                        >
                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 18l-6-6 6-6" />
                                            </svg>
                                            Prev
                                        </button>
                                        <div className="flex items-center gap-2 rounded-2xl border border-gray-200/80 bg-white px-4 py-2 dark:border-white/10 dark:bg-white/5">
                                            <span className="text-sm text-gray-500 dark:text-slate-400">Page</span>
                                            <input
                                                type="number"
                                                min={1}
                                                max={totalPages || 1}
                                                value={currentPage}
                                                onChange={(event) => navigateToPage(Number(event.target.value))}
                                                className="w-16 bg-transparent text-center text-sm font-semibold text-gray-900 outline-none dark:text-white"
                                            />
                                            <span className="text-sm text-gray-500 dark:text-slate-400">/ {totalPages || 1}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => navigateToPage(currentPage + 1)}
                                            disabled={currentPage >= totalPages}
                                            className="inline-flex items-center gap-2 rounded-2xl border border-gray-200/80 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-violet-500/30 hover:text-violet-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                                        >
                                            Next
                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 6l6 6-6 6" />
                                            </svg>
                                        </button>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setZoom((value) => clamp(Number((value - ZOOM_STEP).toFixed(2)), MIN_ZOOM, MAX_ZOOM))}
                                            className="inline-flex items-center gap-2 rounded-2xl border border-gray-200/80 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-violet-500/30 hover:text-violet-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                                        >
                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                            </svg>
                                            Zoom out
                                        </button>
                                        <span className="rounded-2xl border border-gray-200/80 bg-white px-4 py-2 text-sm font-semibold text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-white">
                                            {Math.round(zoom * 100)}%
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setZoom((value) => clamp(Number((value + ZOOM_STEP).toFixed(2)), MIN_ZOOM, MAX_ZOOM))}
                                            className="inline-flex items-center gap-2 rounded-2xl border border-gray-200/80 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-violet-500/30 hover:text-violet-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                                        >
                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                            </svg>
                                            Zoom in
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowThumbnails((value) => !value)}
                                            className="inline-flex items-center gap-2 rounded-2xl border border-gray-200/80 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-violet-500/30 hover:text-violet-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                                        >
                                            {showThumbnails ? "Hide thumbnails" : "Show thumbnails"}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-[2rem] border border-gray-200/70 bg-white/80 p-4 shadow-[0_16px_60px_rgba(15,23,42,0.08)] dark:border-white/5 dark:bg-white/5 md:p-6">
                                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Redaction canvas</h2>
                                        <p className="text-sm text-gray-600 dark:text-slate-400">
                                            Click and drag on any page to create a redaction area. Select an area to move or resize it.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowThumbnails((value) => !value)}
                                        className="rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-300 lg:hidden"
                                    >
                                        Thumbnails
                                    </button>
                                </div>

                                {isLoading && (
                                    <div className="rounded-[1.75rem] border border-dashed border-gray-200/80 bg-white/70 p-10 text-center dark:border-white/10 dark:bg-white/5">
                                        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
                                        <p className="text-sm font-medium text-gray-700 dark:text-slate-300">Preparing PDF pages for editing...</p>
                                    </div>
                                )}

                                {!isLoading && pdfDoc && pageSizes.length > 0 && (
                                    <div className="max-h-[76vh] overflow-y-auto pr-1">
                                        {pageSizes.map((pageSize, index) => {
                                            const pageNumber = index + 1;
                                            const scale = pageScale(pageNumber);

                                            return (
                                                <PdfPageView
                                                    key={pageNumber}
                                                    pdfDoc={pdfDoc}
                                                    pageNumber={pageNumber}
                                                    pageSize={pageSize}
                                                    scale={scale}
                                                    areas={areas}
                                                    selectedAreaId={selectedAreaId}
                                                    draftArea={activeDraft}
                                                    activePage={currentPage}
                                                    onSelectPage={setCurrentPage}
                                                    onSelectArea={selectArea}
                                                    onDeleteArea={deleteArea}
                                                    onBeginDraw={beginDraw}
                                                    onBeginMove={beginMove}
                                                    onBeginResize={beginResize}
                                                    onRegisterPage={registerPageRef}
                                                />
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <div className="rounded-[2rem] border border-gray-200/70 bg-white/80 p-5 shadow-[0_16px_60px_rgba(15,23,42,0.08)] dark:border-white/5 dark:bg-white/5">
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Redaction summary</h3>
                                        <p className="text-sm text-gray-600 dark:text-slate-400">
                                            {areas.length} redaction area{areas.length === 1 ? "" : "s"} ready to apply on {areas.length ? new Set(areas.map((area) => area.page)).size : 0} page{areas.length > 0 && new Set(areas.map((area) => area.page)).size === 1 ? "" : "s"}.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={applyRedaction}
                                        disabled={!canApply}
                                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 to-red-500 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-rose-500/20 transition-all hover:shadow-xl hover:shadow-rose-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {isProcessing ? "Applying..." : "Apply Redaction"}
                                    </button>
                                </div>

                                {isProcessing && (
                                    <div className="mt-4">
                                        <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-slate-500">
                                            <span>Processing</span>
                                            <span>{progress}%</span>
                                        </div>
                                        <div className="h-3 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
                                            <div className="h-full rounded-full bg-gradient-to-r from-rose-500 to-red-500 transition-all" style={{ width: `${progress}%` }} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </main>

                        <aside className="space-y-4">
                            <div className="rounded-[2rem] border border-gray-200/70 bg-white/80 p-5 shadow-[0_16px_60px_rgba(15,23,42,0.08)] dark:border-white/5 dark:bg-white/5">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-500 dark:text-violet-300">Redaction areas</p>
                                        <h2 className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">All rectangles</h2>
                                    </div>
                                    <span className="rounded-full bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-600 dark:text-rose-300">
                                        {areas.length}
                                    </span>
                                </div>

                                <div className="mt-4 max-h-[40vh] space-y-3 overflow-y-auto pr-1">
                                    {areas.length === 0 && (
                                        <div className="rounded-2xl border border-dashed border-gray-200/80 bg-white/70 p-4 text-sm text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                                            No redaction areas yet. Draw one directly on the page.
                                        </div>
                                    )}

                                    {areas.map((area, index) => {
                                        const isSelected = area.id === selectedAreaId;
                                        return (
                                            <button
                                                key={area.id}
                                                type="button"
                                                onClick={() => selectArea(area)}
                                                className={`w-full rounded-2xl border p-4 text-left transition-all ${
                                                    isSelected
                                                        ? "border-violet-500 bg-violet-500/10 shadow-lg shadow-violet-500/10"
                                                        : "border-gray-200/80 bg-white/70 hover:border-violet-500/30 hover:bg-violet-500/5 dark:border-white/10 dark:bg-white/5"
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-slate-500">
                                                            Area {index + 1}
                                                        </div>
                                                        <div className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
                                                            Page {area.page}
                                                        </div>
                                                        <div className="mt-1 text-xs leading-6 text-gray-600 dark:text-slate-400">
                                                            {area.x.toFixed(1)}, {area.y.toFixed(1)} • {area.width.toFixed(1)} × {area.height.toFixed(1)}
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        aria-label="Delete redaction area"
                                                        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/10 text-rose-500 transition-colors hover:bg-rose-500/15 hover:text-rose-600 dark:text-rose-300"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            deleteArea(area.id);
                                                        }}
                                                    >
                                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="rounded-[2rem] border border-gray-200/70 bg-white/80 p-5 shadow-[0_16px_60px_rgba(15,23,42,0.08)] dark:border-white/5 dark:bg-white/5">
                                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-500 dark:text-violet-300">How it works</p>
                                <ol className="mt-4 space-y-3 text-sm leading-7 text-gray-600 dark:text-slate-400">
                                    <li>1. Upload a PDF and wait for the pages to render.</li>
                                    <li>2. Click and drag directly on any page to create a redaction area.</li>
                                    <li>3. Select a rectangle to move or resize it, or delete it from the sidebar.</li>
                                    <li>4. Apply the redactions once everything looks correct.</li>
                                </ol>
                                <div className="mt-4 rounded-2xl border border-amber-500/15 bg-amber-500/10 p-4 text-sm leading-6 text-amber-700 dark:text-amber-300">
                                    Redaction is permanent. The content behind each black box cannot be recovered after applying the change.
                                </div>
                            </div>
                        </aside>
                    </div>
                )}

                {downloadUrl && !isLoading && (
                    <div className="mx-auto max-w-3xl rounded-[2rem] border border-gray-200/70 bg-white/80 p-8 text-center shadow-[0_16px_60px_rgba(15,23,42,0.08)] dark:border-white/5 dark:bg-white/5">
                        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 shadow-lg shadow-emerald-500/10">
                            <svg className="h-10 w-10" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Redaction applied</h2>
                        <p className="mt-3 text-base leading-7 text-gray-600 dark:text-slate-400">
                            Your redacted PDF is ready for download.
                        </p>
                        <div className="mx-auto mt-6 max-w-md text-left">
                            <label className="mb-2 block text-sm font-semibold text-gray-600 dark:text-slate-300">File name</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={downloadBaseName}
                                    onChange={(event) => setDownloadBaseName(event.target.value)}
                                    className="flex-1 rounded-2xl border border-gray-200/80 bg-white/80 px-4 py-3 text-gray-900 outline-none focus:border-violet-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
                                />
                                <span className="rounded-2xl border border-gray-200/80 bg-white/80 px-3 py-3 text-sm text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                                    .pdf
                                </span>
                            </div>
                        </div>
                        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                            <button
                                type="button"
                                onClick={downloadRedacted}
                                className="rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-6 py-3.5 font-semibold text-white shadow-lg shadow-violet-500/20 transition-all hover:shadow-xl hover:shadow-violet-500/25"
                            >
                                Download PDF
                            </button>
                            <button
                                type="button"
                                onClick={resetTool}
                                className="rounded-2xl border border-gray-200/80 bg-white px-6 py-3.5 font-semibold text-gray-700 transition-colors hover:border-violet-500/30 hover:text-violet-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                            >
                                Redact another PDF
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
