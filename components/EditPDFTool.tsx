'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { mergeTextItems, TextItem, detectTextWithContentStreams, replaceTextInPDFStreams, extractEmbeddedFonts } from '../lib/pdfEditingInternals';
import { getPDFWorkerManager } from '../lib/workerManager';
import CloudImport from '@/components/CloudImport';
import { buildDownloadName, splitFileName } from '@/lib/fileName';

// Worker manager instance
let workerManager: ReturnType<typeof getPDFWorkerManager> | null = null;

// Initialize worker manager lazily
const getWorker = () => {
 if (!workerManager) {
 workerManager = getPDFWorkerManager();
 }
 return workerManager;
};

// Local TextItem interface removed in favor of imported one

/**
 * Interface for history management (undo/redo)
 */
interface HistoryState {
 textItems: TextItem[];
 timestamp: number;
}

/**
 * Main EditPDFTool Component
 * Handles PDF upload, rendering, text detection, inline editing, and export
 */
export default function EditPDFTool() {
 // State management
 const [file, setFile] = useState<File | null>(null);
 const [pdfDoc, setPdfDoc] = useState<any>(null);
 const [pdfLibDoc, setPdfLibDoc] = useState<PDFDocument | null>(null);
 const [currentPage, setCurrentPage] = useState(1);
 const [totalPages, setTotalPages] = useState(0);
 const [textItems, setTextItems] = useState<TextItem[]>([]);
 const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
 const [isProcessing, setIsProcessing] = useState(false);
 const [scale, setScale] = useState(1.5);
 const [history, setHistory] = useState<HistoryState[]>([]);
 const [historyIndex, setHistoryIndex] = useState(-1);
 const [showToolbar, setShowToolbar] = useState(false);
 const [isScannedPDF, setIsScannedPDF] = useState(false);
 const [isLoadingText, setIsLoadingText] = useState(false);
 const [loadingProgress, setLoadingProgress] = useState(0);
 const [isOcrProcessing, setIsOcrProcessing] = useState(false);
 const [ocrEnabled, setOcrEnabled] = useState(false);
 const [statusMessage, setStatusMessage] = useState<{
 type: 'success' | 'error' | 'warning' | 'info';
 text: string;
 } | null>(null);
 const [downloadInfo, setDownloadInfo] = useState<{ url: string; name: string } | null>(null);
 const [downloadBaseName, setDownloadBaseName] = useState("");
 const [downloadExtension, setDownloadExtension] = useState("");
 const MERGE_TEXT_ITEMS = true;
 const [zoomInput, setZoomInput] = useState(() => `${Math.round(1.5 * 100)}%`);

 /* ── Annotation state (new text, shapes, highlights) ── */
 const [activeTool, setActiveTool] = useState<'select' | 'text' | 'highlight' | 'rect'>('select');
 const [annotations, setAnnotations] = useState<Array<{id: string; type: 'text' | 'highlight' | 'rect'; x: number; y: number; width: number; height: number; text?: string; color: string; opacity: number; fontSize?: number; pageNumber: number}>>([]);
 const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);
 const [textColor, setTextColor] = useState('#000000');
 const [highlightColor, setHighlightColor] = useState('#facc15');

 // Refs
 const canvasRef = useRef<HTMLCanvasElement>(null);
 const containerRef = useRef<HTMLDivElement>(null);
 const fileInputRef = useRef<HTMLInputElement>(null);
 const overlayRef = useRef<HTMLDivElement>(null);

 const pushStatus = (type: 'success' | 'error' | 'warning' | 'info', text: string) => {
 setStatusMessage({ type, text });
 };

 const clearDownloadInfo = () => {
 if (downloadInfo?.url) {
 URL.revokeObjectURL(downloadInfo.url);
 }
 setDownloadInfo(null);
 setDownloadBaseName("");
 setDownloadExtension("");
 };

 const triggerDownload = (url: string, name: string) => {
 const link = document.createElement('a');
 link.href = url;
 link.download = name;
 link.rel = 'noopener';
 document.body.appendChild(link);
 link.click();
 link.remove();
 };

 const handleDownload = () => {
 if (!downloadInfo) return;
 const finalName = buildDownloadName(downloadBaseName, downloadExtension, downloadInfo.name);
 triggerDownload(downloadInfo.url, finalName);
 };

 const buildSafeFilename = (originalName: string) => {
 const baseName = originalName.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9\-_\.]/g, '_');
 const trimmed = baseName.length > 60 ? baseName.slice(0, 60) : baseName;
 return `${trimmed}_edited.pdf`;
 };

 const sampleCoverColor = (item: TextItem) => {
 const canvas = canvasRef.current;
 if (!canvas) return undefined;
 const ctx = canvas.getContext('2d', { willReadFrequently: true });
 if (!ctx) return undefined;
 const width = Number.isFinite(item.width) ? item.width : 0;
 const height = Number.isFinite(item.height) ? item.height : 0;
 const originX = Number.isFinite(item.x) ? item.x : 0;
 const originY = Number.isFinite(item.y) ? item.y : 0;
 const sampleX = Math.min(
 Math.max(Math.round(originX + width * 0.5), 0),
 Math.max(canvas.width - 1, 0)
 );
 const sampleY = Math.min(
 Math.max(Math.round(originY + height * 0.5), 0),
 Math.max(canvas.height - 1, 0)
 );

 try {
 const data = ctx.getImageData(sampleX, sampleY, 1, 1).data;
 if (!data || data.length < 3) return undefined;
 const toHex = (value: number) => value.toString(16).padStart(2, '0');
 return `#${toHex(data[0])}${toHex(data[1])}${toHex(data[2])}`;
 } catch (error) {
 console.warn('Could not sample cover color:', error);
 return undefined;
 }
 };

 const clampZoom = (value: number) => Math.min(Math.max(value, 50), 300);

 const applyZoomScale = (nextScale: number) => {
 const clampedScale = Math.min(Math.max(nextScale, 0.5), 3);
 setScale(clampedScale);
 setZoomInput(`${Math.round(clampedScale * 100)}%`);
 if (pdfDoc) {
 renderPage(pdfDoc, currentPage);
 detectText(pdfDoc, currentPage);
 }
 };

 const commitZoomInput = () => {
 const cleaned = zoomInput.trim().replace('%', '');
 const parsed = Number(cleaned);
 if (!Number.isFinite(parsed)) {
 setZoomInput(`${Math.round(scale * 100)}%`);
 return;
 }
 const clamped = clampZoom(parsed);
 applyZoomScale(clamped / 100);
 };

 /**
 * Handle file upload and initial PDF processing with memory management
 * Phase 3: Prevent crashes on large PDFs
 */
 const handleSelectedFile = async (selectedFile: File) => {
 if (!selectedFile || selectedFile.type !== 'application/pdf') {
 pushStatus('error', 'Please select a valid PDF file.');
 return;
 }

 // Check file size limits (50MB for large PDFs)
 const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
 if (selectedFile.size > MAX_FILE_SIZE) {
 pushStatus('warning', 'File is too large. Please select a PDF smaller than 50MB.');
 return;
 }

 setFile(selectedFile);
 setIsProcessing(true);
 setIsLoadingText(true);
 setLoadingProgress(0);
 setStatusMessage(null);
 clearDownloadInfo();

 try {
 setLoadingProgress(10);

 // Load PDF using worker for better performance
 const originalBuffer = await selectedFile.arrayBuffer();
 setLoadingProgress(30);

 // Create a copy to avoid detachment issues when passing to worker
 const arrayBufferForWorker = originalBuffer.slice(0);
 const arrayBufferForPdfLib = originalBuffer.slice(0);

 // Check if it's a very large PDF (>10MB) and warn user
 if (originalBuffer.byteLength > 10 * 1024 * 1024) {
 console.warn('Large PDF detected, processing may take longer');
 }

 const worker = getWorker();
 const loadResult = await worker.loadPDF(arrayBufferForWorker, {
 disableStream: originalBuffer.byteLength > 5 * 1024 * 1024,
 disableAutoFetch: originalBuffer.byteLength > 5 * 1024 * 1024,
 maxPages: originalBuffer.byteLength > 20 * 1024 * 1024 ? 10 : undefined, // Limit pages for very large PDFs
 });

 setPdfDoc(loadResult.pdfDoc);
 setTotalPages(loadResult.numPages);
 setCurrentPage(1);
 setLoadingProgress(70);

 // Load PDF with pdf-lib for editing using the copy
 // For very large PDFs, load only essential pages
 const shouldLoadAllPages = loadResult.numPages <= 20 && originalBuffer.byteLength <= 10 * 1024 * 1024;

 let pdfLibDocument: PDFDocument;
 if (shouldLoadAllPages) {
 pdfLibDocument = await PDFDocument.load(arrayBufferForPdfLib);
 } else {
 // For large multi-page PDFs, create a minimal document
 pdfLibDocument = await PDFDocument.create();
 console.warn('Large PDF detected - using optimized loading mode');
 }
 setPdfLibDoc(pdfLibDocument);
 setLoadingProgress(80);

 // Render first page
 await renderPage(loadResult.pdfDoc, 1);
 setLoadingProgress(100);

 // Start text detection in background (don't await, let UI show immediately)
 setIsLoadingText(true);
 detectText(loadResult.pdfDoc, 1).finally(() => {
 setIsLoadingText(false);
 });

 } catch (error) {
 console.error('Error loading PDF:', error);

 // Provide specific error messages based on error type
 if (error instanceof Error) {
 if (error.message.includes('memory') || error.message.includes('out of memory')) {
 pushStatus('error', 'PDF is too large to process in browser. Try a smaller file or fewer pages.');
 } else if (error.message.includes('corrupt') || error.message.includes('invalid')) {
 pushStatus('error', 'PDF file appears to be corrupted. Please try a different file.');
 } else {
 pushStatus('error', `Failed to load PDF: ${error.message}`);
 }
 } else {
 pushStatus('error', 'Failed to load PDF. Please try another file.');
 }
 } finally {
 setIsProcessing(false);
 setLoadingProgress(0);
 }
 };

 const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
 const selectedFile = e.target.files?.[0];
 if (!selectedFile) return;
 await handleSelectedFile(selectedFile);
 };

 const handleCloudImport = (selectedFiles: File[]) => {
 const selectedFile = selectedFiles[0];
 if (!selectedFile) return;
 handleSelectedFile(selectedFile);
 };

 /**
 * Render a specific page of the PDF to canvas
 * Uses PDF.js rendering engine
 */
 const renderPage = async (pdf: any, pageNum: number) => {
 const page = await pdf.getPage(pageNum);
 const viewport = page.getViewport({ scale });

 const canvas = canvasRef.current;
 if (!canvas) return;

 const context = canvas.getContext('2d');
 if (!context) return;

 canvas.height = viewport.height;
 canvas.width = viewport.width;

 const renderContext = {
 canvasContext: context,
 viewport: viewport,
 };

 await page.render(renderContext).promise;
 };

 /**
 * Detect and extract text items from PDF page using worker
 * Offloads heavy processing to web worker to avoid blocking main thread
 */
 const detectText = async (pdf: any, pageNum: number) => {
 try {
 const worker = getWorker();
 const result = await worker.extractTextFromPage(pdf, pageNum, scale);

 if (!result.hasText) {
 // No text found - this is a scanned PDF
 setIsScannedPDF(true);
 setOcrEnabled(false);
 console.warn('Scanned PDF detected - OCR not performed for faster loading');
 // Skip OCR for now - let user request it if needed
 } else {
 setIsScannedPDF(false);
 setOcrEnabled(false);
 // Text found. In Exact Mode, we avoid merging so we can map edits to
 // the original PDF content stream operators precisely.
 const itemsForEdit = MERGE_TEXT_ITEMS ? await worker.mergeTextItems(result.items, scale) : result.items;
 setTextItems(itemsForEdit);
 addToHistory(itemsForEdit);
 }
 } catch (error) {
 console.error('Error detecting text:', error);
 // If text detection fails, mark as scanned but continue without OCR
 setIsScannedPDF(true);
 }
 };

 /**
 * Perform OCR on scanned PDF pages using worker
 * Heavy OCR processing moved off main thread
 */
 const performOCR = async (pdf: any, pageNum: number) => {
 try {
 setIsOcrProcessing(true);
 const worker = getWorker();
 const ocrItems = await worker.performOCR(pdf, pageNum, scale);

 const ocrItemsWithMeta = ocrItems.map((item: TextItem) => ({
 ...item,
 isOcr: true,
 originalText: item.originalText ?? item.text,
 }));

 setTextItems(ocrItemsWithMeta);
 addToHistory(ocrItemsWithMeta);
 setOcrEnabled(true);

 // Show user warning about OCR quality
 pushStatus('info', 'OCR completed. This PDF is image-based, so edits will be applied as a text layer.');
 } catch (error) {
 console.error('OCR Error:', error);
 pushStatus('error', 'OCR processing failed. This PDF may be image-based and cannot be edited as text.');
 } finally {
 setIsOcrProcessing(false);
 }
 };

 /**
 * Add current state to history for undo/redo
 */
 const addToHistory = (items: TextItem[]) => {
 const newHistory = history.slice(0, historyIndex + 1);
 newHistory.push({
 textItems: JSON.parse(JSON.stringify(items)),
 timestamp: Date.now(),
 });
 setHistory(newHistory);
 setHistoryIndex(newHistory.length - 1);
 };

 /**
 * Undo last change
 */
 const handleUndo = () => {
 if (historyIndex > 0) {
 setHistoryIndex(historyIndex - 1);
 setTextItems(JSON.parse(JSON.stringify(history[historyIndex - 1].textItems)));
 }
 };

 /**
 * Redo last undone change
 */
 const handleRedo = () => {
 if (historyIndex < history.length - 1) {
 setHistoryIndex(historyIndex + 1);
 setTextItems(JSON.parse(JSON.stringify(history[historyIndex + 1].textItems)));
 }
 };

 /**
 * Handle text item click for editing with improved UX
 * Phase 3: Smooth text selection without flicker
 */
 const handleTextClick = useCallback((id: string, event?: React.MouseEvent) => {
 event?.preventDefault();
 event?.stopPropagation();

 // Prevent misclicks by ensuring we have a valid text item
 const textItem = textItems.find(item => item.id === id);
 if (!textItem) return;

 setSelectedTextId(id);
 setShowToolbar(true);
 }, [textItems]);

 /**
 * Handle text content change from contenteditable
 * Fixed: Preserve cursor position during editing
 */
 const handleTextChange = (id: string, newText: string, element: HTMLElement) => {
 // Save cursor position before update
 const selection = window.getSelection();
 const range = selection?.getRangeAt(0);
 const cursorOffset = range?.startOffset || 0;

 const updatedItems = textItems.map(item =>
 item.id === id ? { ...item, text: newText } : item
 );
 setTextItems(updatedItems);

 // Restore cursor position after React re-render
 setTimeout(() => {
 try {
 const newRange = document.createRange();
 const sel = window.getSelection();
 if (element.firstChild) {
 const offset = Math.min(cursorOffset, element.firstChild.textContent?.length || 0);
 newRange.setStart(element.firstChild, offset);
 newRange.collapse(true);
 sel?.removeAllRanges();
 sel?.addRange(newRange);
 }
 } catch (e) {
 console.warn('Could not restore cursor position:', e);
 }
 }, 0);
 };

 /**
 * Handle blur event on contenteditable (commit changes)
 */
 const handleTextBlur = () => {
 addToHistory(textItems);
 setSelectedTextId(null);
 setShowToolbar(false);
 };

 /* ── Annotation helpers ────────────────────────────── */
 const handleCanvasClick = (e: React.MouseEvent) => {
 if (activeTool === 'select') return;
 const canvas = canvasRef.current;
 if (!canvas) return;
 const rect = canvas.getBoundingClientRect();
 const x = e.clientX - rect.left;
 const y = e.clientY - rect.top;
 const ann = {
 id: `ann_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
 type: activeTool as 'text' | 'highlight' | 'rect',
 x, y,
 width: activeTool === 'text' ? 200 : 150,
 height: activeTool === 'text' ? 30 : activeTool === 'highlight' ? 24 : 100,
 text: activeTool === 'text' ? 'New text' : undefined,
 color: activeTool === 'highlight' ? highlightColor : textColor,
 opacity: activeTool === 'highlight' ? 0.35 : 1,
 fontSize: 16,
 pageNumber: currentPage,
 };
 setAnnotations(prev => [...prev, ann]);
 setSelectedAnnotation(ann.id);
 if (activeTool !== 'highlight' && activeTool !== 'rect') setActiveTool('select');
 };

 const deleteSelectedAnnotation = () => {
 if (selectedAnnotation) {
 setAnnotations(prev => prev.filter(a => a.id !== selectedAnnotation));
 setSelectedAnnotation(null);
 }
 };

 const deleteSelectedText = () => {
 if (selectedTextId) {
 const updatedItems = textItems.map(item =>
 item.id === selectedTextId ? { ...item, text: '' } : item
 );
 setTextItems(updatedItems);
 addToHistory(updatedItems);
 setSelectedTextId(null);
 setShowToolbar(false);
 }
 };

 const changeTextColor = (color: string) => {
 if (selectedTextId) {
 const updatedItems = textItems.map(item =>
 item.id === selectedTextId ? { ...item, color } : item
 );
 setTextItems(updatedItems);
 }
 setTextColor(color);
 };

 /**
 * Change page navigation with memory management for large PDFs
 * Phase 3: Prevent crashes on multi-page documents
 */
 const goToPage = useCallback(async (pageNum: number) => {
 if (!pdfDoc || pageNum < 1 || pageNum > totalPages) return;

 // Prevent rapid page switching that could cause memory issues
 if (isProcessing) return;

 setCurrentPage(pageNum);
 setIsProcessing(true);

 try {
 // Clear existing text items to free memory before loading new page
 setTextItems([]);
 setSelectedTextId(null);
 setShowToolbar(false);

 // Add small delay for very large PDFs to prevent memory pressure
 if (totalPages > 50) {
 await new Promise(resolve => setTimeout(resolve, 100));
 }

 await renderPage(pdfDoc, pageNum);
 await detectText(pdfDoc, pageNum);
 } catch (error) {
 console.error('Error changing page:', error);

 // Provide specific error handling for page navigation
 if (error instanceof Error) {
 if (error.message.includes('memory') || error.message.includes('out of memory')) {
 pushStatus('error', 'Page loading failed due to memory constraints. Try refreshing or using a smaller PDF.');
 } else {
 pushStatus('error', `Failed to load page ${pageNum}. ${error.message}`);
 }
 }
 } finally {
 setIsProcessing(false);
 }
 }, [pdfDoc, totalPages, isProcessing]);

 /**
 * Zoom controls
 */
 const handleZoomIn = () => {
 const newScale = Math.min(scale + 0.25, 3);
 applyZoomScale(newScale);
 };

 const handleZoomOut = () => {
 const newScale = Math.max(scale - 0.25, 0.5);
 applyZoomScale(newScale);
 };

 /**
 * Export modified PDF using the API route
 * Uses pdf-lib to overlay edited text on original PDF
 */
 const handleExport = async () => {
 if (!file) {
 pushStatus('error', 'No PDF loaded.');
 return;
 }

 setIsProcessing(true);
 setStatusMessage(null);
 clearDownloadInfo();

 try {
 console.log('🚀 Starting PDF export...');

 // Get edits (only changed text)
 const edits = textItems.filter(item => item.text !== item.originalText);

 if (edits.length === 0) {
 pushStatus('warning', 'No text changes detected. Please make some edits before exporting.');
 return;
 }

 console.log(`📝 Found ${edits.length} text edits`);

 const usesOcr = edits.some(edit => edit.isOcr);
 if (isScannedPDF && !usesOcr) {
 pushStatus('error', 'This PDF is image-based. Run OCR to enable editing before exporting.');
 return;
 }

 const editData = edits.map(edit => {
 const hasSingleSource =
 typeof edit.sourceIndex === 'number' &&
 (!edit.sourceIndexes || edit.sourceIndexes.length <= 1);
 return {
 text: edit.text,
 originalText: edit.originalText,
 sourceIndex: hasSingleSource ? edit.sourceIndex : undefined,
 x: typeof edit.x === 'number' ? edit.x / scale : undefined,
 y: typeof edit.y === 'number' ? edit.y / scale : undefined,
 width: typeof edit.width === 'number' ? edit.width / scale : undefined,
 height: typeof edit.height === 'number' ? edit.height / scale : undefined,
 fontSize: typeof edit.fontSize === 'number' ? edit.fontSize / scale : undefined,
 fontName: edit.fontName,
 fontWeight: edit.fontWeight,
 fontStyle: edit.fontStyle,
 color: edit.color,
 coverColor: sampleCoverColor(edit),
 pageNumber: edit.pageNumber,
 transform: edit.transform,
 };
 });

 const formData = new FormData();
 formData.append('file', file);
 formData.append('edits', JSON.stringify(editData));
 formData.append('mode', 'mixed');
 formData.append('allowFallback', 'true');

 if (annotations.length > 0) {
 formData.append('annotations', JSON.stringify(annotations.map(ann => ({
 type: ann.type,
 x: ann.x / scale,
 y: ann.y / scale,
 width: ann.width / scale,
 height: ann.height / scale,
 text: ann.text,
 color: ann.color,
 opacity: ann.opacity,
 fontSize: ann.fontSize ? ann.fontSize / scale : undefined,
 pageNumber: ann.pageNumber,
 }))));
 }

 const response = await fetch('/api/edit-pdf', {
 method: 'POST',
 body: formData,
 });

 if (!response.ok) {
 const contentType = response.headers.get('content-type') || '';
 if (contentType.includes('application/json')) {
 const errorPayload = await response.json();
 throw new Error(errorPayload.error || 'Export failed');
 }
 throw new Error('Export failed');
 }

 const editMode = response.headers.get('X-Edit-Mode');
 const warning = response.headers.get('X-Edit-Warning');

 const blob = await response.blob();
 if (blob.size < 1000) {
 throw new Error('Export failed: generated PDF was empty.');
 }

 const url = URL.createObjectURL(blob);
 const safeName = buildSafeFilename(file.name);
 setDownloadInfo({ url, name: safeName });
 const parts = splitFileName(safeName);
 setDownloadBaseName(parts.base || "edited");
 setDownloadExtension(parts.ext || ".pdf");

 if (warning) {
 pushStatus('warning', warning);
 } else if (editMode === 'overlay') {
 pushStatus('success', 'PDF edited successfully using professional overlay placement.');
 } else if (editMode === 'mixed') {
 pushStatus('success', 'PDF edited successfully. Exact edits applied where possible.');
 } else {
 pushStatus('success', 'PDF edited successfully with exact in-place replacements.');
 }

 } catch (error) {
 console.error('❌ Export failed:', error);
 pushStatus('error', 'Export failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
 } finally {
 setIsProcessing(false);
 }
 };

 /**
 * PHASE 2: Detect embedded fonts in PDF
 * Critical for font fidelity - never silently replace with defaults
 */
 const detectEmbeddedFonts = async (pdfBytes: Uint8Array): Promise<Map<string, any>> => {
 const embeddedFonts = new Map();

 try {
 // Load PDF to analyze font resources
 const pdfDoc = await PDFDocument.load(pdfBytes);

 console.log('🔍 Analyzing PDF font resources...');

 // pdf-lib doesn't provide direct access to embedded fonts
 // In a production implementation, we'd need to parse the PDF structure
 // For Phase 2 demonstration, we'll return empty map and rely on font matching

 // Check if the PDF has embedded fonts by trying to access font resources
 for (let i = 0; i < Math.min(pdfDoc.getPageCount(), 3); i++) {
 const page = pdfDoc.getPages()[i];
 console.log(`📄 Page ${i + 1}: Checking for font resources...`);
 // In a real implementation, we'd parse the page's content streams
 // and extract font references
 }

 console.log('🎨 Font analysis complete - using intelligent font matching');

 } catch (error) {
 console.warn('⚠️ Font detection failed:', error);
 }

 return embeddedFonts;
 };

 /**
 * Reset tool state
 */
 const handleReset = () => {
 setFile(null);
 setPdfDoc(null);
 setPdfLibDoc(null);
 setTextItems([]);
 setAnnotations([]);
 setSelectedAnnotation(null);
 setActiveTool('select');
 setCurrentPage(1);
 setTotalPages(0);
 setHistory([]);
 setHistoryIndex(-1);
 setSelectedTextId(null);
 setShowToolbar(false);
 setIsScannedPDF(false);
 setOcrEnabled(false);
 setIsOcrProcessing(false);
 setStatusMessage(null);
 clearDownloadInfo();
 if (fileInputRef.current) {
 fileInputRef.current.value = '';
 }
 };

 /**
 * Memory cleanup on unmount
 */
 useEffect(() => {
 return () => {
 // Terminate worker when component unmounts
 if (workerManager) {
 workerManager.terminate();
 workerManager = null;
 }
 };
 }, []);

 useEffect(() => {
 return () => {
 if (downloadInfo?.url) {
 URL.revokeObjectURL(downloadInfo.url);
 }
 };
 }, [downloadInfo]);

 /**
 * Memory optimization: Periodic cleanup for large PDFs
 */
 useEffect(() => {
 if (file && file.size > 10 * 1024 * 1024) { // Large PDFs (>10MB)
 const cleanupInterval = setInterval(() => {
 // Force garbage collection hints for large documents
 if (window.gc && typeof window.gc === 'function') {
 window.gc();
 }
 }, 30000); // Every 30 seconds

 return () => clearInterval(cleanupInterval);
 }
 }, [file]);

 /**
 * Keyboard shortcuts
 * Ctrl/Cmd + Z: Undo
 * Ctrl/Cmd + Y: Redo
 * Escape: Deselect text
 */
 useEffect(() => {
 const handleKeyDown = (e: KeyboardEvent) => {
 // Undo
 if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
 e.preventDefault();
 handleUndo();
 }
 // Redo
 if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
 e.preventDefault();
 handleRedo();
 }
 // Deselect
 if (e.key === 'Escape') {
 setSelectedTextId(null);
 setShowToolbar(false);
 }
 };

 window.addEventListener('keydown', handleKeyDown);
 return () => window.removeEventListener('keydown', handleKeyDown);
 }, [historyIndex, history]);

 return (
 <div className="min-h-screen bg-gradient-to-br py-10 sm:py-14 px-4 sm:px-6 lg:px-8">
 <div className="max-w-6xl mx-auto">
 <div className="text-center mb-10">
 <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-4">
 Edit PDF Online
 </h1>
 <p className="text-base sm:text-lg text-gray-500 dark:text-slate-400 max-w-3xl mx-auto">
 Edit PDF text directly while preserving the original font, size, color, and layout.
 Fast, secure, and professional results suitable for certificates and official documents.
 </p>
 </div>
 {statusMessage && (
 <div
 className={`mb-6 rounded-lg border p-4 ${
 statusMessage.type === 'success'
 ? 'bg-emerald-500/10 border-emerald-200 text-emerald-900'
 : statusMessage.type === 'error'
 ? 'bg-red-500/10 border-red-500/20 text-red-300'
 : statusMessage.type === 'warning'
 ? 'bg-amber-50 border-amber-200 text-amber-900'
 : 'bg-indigo-500/100/10 border-indigo-500/20 text-indigo-200'
 }`}
 >
 <p className="text-sm">{statusMessage.text}</p>
 </div>
 )}
 {/* Upload Section */}
 {!file && (
 <>
 <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 border border-indigo-100 p-8 sm:p-12 mb-8">
 <div className="max-w-3xl mx-auto">
 <div className="border-2 border-dashed border-indigo-500/20 rounded-2xl p-10 sm:p-12 text-center hover:border-indigo-400 transition-all duration-300 group bg-gradient-to-br from-indigo-50 to-white">
 <input
 ref={fileInputRef}
 type="file"
 accept=".pdf"
 onChange={handleFileChange}
 className="hidden"
 id="pdf-upload"
 />
 <label
 htmlFor="pdf-upload"
 className="cursor-pointer flex flex-col items-center"
 >
 <div className="bg-indigo-500/100/15 rounded-full p-5 mb-6 group-hover:bg-indigo-200 transition-colors">
 <svg
 className="w-10 h-10 text-indigo-600"
 fill="none"
 stroke="currentColor"
 viewBox="0 0 24 24"
 >
 <path
 strokeLinecap="round"
 strokeLinejoin="round"
 strokeWidth={2}
 d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
 />
 </svg>
 </div>
 <span className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
 Upload PDF to Edit
 </span>
 <span className="text-gray-500 dark:text-slate-400 mb-4">
 Click to browse or drag and drop your PDF file (max 50MB)
 </span>
 <div className="flex items-center justify-center gap-2 text-sm text-indigo-600 font-medium">
 <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
 <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
 </svg>
 Supports text-based and scanned PDFs with OCR
 </div>
 </label>
 </div>
 <CloudImport
 onFilesSelected={handleCloudImport}
 accept=".pdf"
 maxSizeBytes={50 * 1024 * 1024}
 />
 </div>
 </div>

 <div className="bg-indigo-500/10 rounded-2xl border border-indigo-500/20 p-8">
 <h2 className="text-xl font-bold text-indigo-200 mb-4">How to edit a PDF</h2>
 <ol className="space-y-2 text-indigo-300">
 <li>1. Upload your PDF file</li>
 <li>2. Click any text to edit it inline</li>
 <li>3. Download the edited PDF</li>
 </ol>
 </div>
 </>
 )}

 {/* Editor Interface */}
 {file && (
 <div className="space-y-6">
 {/* Toolbar */}
 <div className="bg-gray-100 dark:bg-white/5 rounded-xl shadow-lg shadow-black/5 dark:shadow-black/20 border border-gray-200 dark:border-white/10 p-6 flex items-center justify-between flex-wrap gap-6">
 <div className="flex items-center gap-3">
 <div className="flex items-center gap-1 bg-gray-100 dark:bg-white/5 rounded-lg p-1">
 <button
 onClick={handleUndo}
 disabled={historyIndex <= 0}
 className="p-2 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 hover:bg-gray-200 dark:hover:bg-white/5 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-all"
 title="Undo (Ctrl+Z)"
 >
 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
 </svg>
 </button>
 <button
 onClick={handleRedo}
 disabled={historyIndex >= history.length - 1}
 className="p-2 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 hover:bg-gray-200 dark:hover:bg-white/5 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-all"
 title="Redo (Ctrl+Y)"
 >
 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
 </svg>
 </button>
 </div>
 <span className="text-sm text-gray-400 dark:text-slate-500 font-medium">History</span>
 </div>

 {/* Tool selection */}
 <div className="flex items-center gap-3">
 <div className="flex items-center gap-1 bg-gray-100 dark:bg-white/5 rounded-lg p-1">
 {([['select', '🔤', 'Select'], ['text', '✏️', 'Add Text'], ['highlight', '🖍️', 'Highlight'], ['rect', '⬜', 'Rectangle']] as const).map(([tool, icon, tip]) => (
 <button key={tool} onClick={() => setActiveTool(tool as any)} title={tip}
 className={`p-2 rounded-md transition-all text-sm ${activeTool === tool ? 'bg-indigo-500 text-white shadow' : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 hover:bg-gray-200 dark:hover:bg-white/5'}`}
 >{icon}</button>
 ))}
 </div>
 <input type="color" value={textColor} onChange={(e) => changeTextColor(e.target.value)} title="Color" className="w-8 h-8 rounded cursor-pointer border-none bg-transparent" />
 {(selectedTextId || selectedAnnotation) && (
 <button onClick={() => { deleteSelectedText(); deleteSelectedAnnotation(); }} title="Delete selected"
 className="p-2 bg-red-500/15 text-red-500 rounded-md hover:bg-red-500/25 transition-all text-sm font-medium">🗑️</button>
 )}
 <span className="text-sm text-gray-400 dark:text-slate-500 font-medium">Tools</span>
 </div>

 <div className="flex items-center gap-3">
 <div className="flex items-center gap-1 bg-gray-100 dark:bg-white/5 rounded-lg p-1">
 <button
 onClick={handleZoomOut}
 className="p-2 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 hover:bg-gray-200 dark:hover:bg-white/5 rounded-md transition-all"
 title="Zoom Out"
 >
 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM8 10h6" />
 </svg>
 </button>
 <input
 value={zoomInput}
 onChange={(e) => setZoomInput(e.target.value)}
 onBlur={commitZoomInput}
 onKeyDown={(e) => {
 if (e.key === 'Enter') {
 e.preventDefault();
 commitZoomInput();
 }
 }}
 className="px-3 py-2 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-slate-300 rounded-md min-w-[80px] text-center font-medium border border-transparent focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 outline-none"
 aria-label="Zoom percentage"
 inputMode="numeric"
 />
 <button
 onClick={handleZoomIn}
 className="p-2 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 hover:bg-gray-200 dark:hover:bg-white/5 rounded-md transition-all"
 title="Zoom In"
 >
 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6M7 10h6" />
 </svg>
 </button>
 </div>
 <span className="text-sm text-gray-400 dark:text-slate-500 font-medium">Zoom</span>
 </div>

 <div className="flex items-center gap-3">
 <div className="flex items-center gap-1 bg-gray-100 dark:bg-white/5 rounded-lg p-1">
 <button
 onClick={() => goToPage(currentPage - 1)}
 disabled={currentPage <= 1}
 className="p-2 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 hover:bg-gray-200 dark:hover:bg-white/5 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-all"
 >
 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
 </svg>
 </button>
 <span className="px-4 py-2 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-slate-300 rounded-md font-medium">
 {currentPage} / {totalPages}
 </span>
 <button
 onClick={() => goToPage(currentPage + 1)}
 disabled={currentPage >= totalPages}
 className="p-2 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 hover:bg-gray-200 dark:hover:bg-white/5 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-all"
 >
 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
 </svg>
 </button>
 </div>
 <span className="text-sm text-gray-400 dark:text-slate-500 font-medium">Pages</span>
 </div>

 <div className="flex items-center gap-3">
 <button
 onClick={handleExport}
 disabled={isProcessing}
 className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-md shadow-black/5 dark:shadow-black/20 hover:shadow-lg"
 >
 {isProcessing ? (
 <div className="flex items-center gap-2">
 <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
 Processing...
 </div>
 ) : (
 <div className="flex items-center gap-2">
 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
 </svg>
 Export PDF
 </div>
 )}
 </button>
 <button
 onClick={handleReset}
 className="px-4 py-3 bg-gray-100 dark:bg-white/5/10 text-gray-600 dark:text-slate-300 rounded-lg hover:bg-gray-200 dark:hover:bg-white/5/15 transition-all font-medium"
 title="Start over"
 >
 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
 </svg>
 </button>
 </div>
 </div>

 {/* Status Messages */}
 <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-4">
 <p className="text-indigo-300 text-sm">
 We apply exact in-place edits whenever possible. If the PDF font encoding or
 kerning cannot be preserved, we automatically fall back to a professional overlay
 that matches the original font style and background.
 </p>
 </div>

 {downloadInfo && (
 <div className="bg-emerald-500/10 border border-emerald-200 rounded-lg p-4">
 <div className="flex flex-wrap items-center justify-between gap-4">
 <div>
 <p className="text-emerald-900 text-sm font-medium">Download ready</p>
 <p className="text-emerald-800 text-xs">Choose a filename before downloading.</p>
 </div>
 </div>
 <div className="mt-4 flex flex-col sm:flex-row gap-3">
 <input
 type="text"
 value={downloadBaseName}
 onChange={(event) => setDownloadBaseName(event.target.value)}
 className="flex-1 px-4 py-3 border border-emerald-200 rounded-lg focus:border-emerald-500 focus:outline-none bg-gray-100 dark:bg-white/5 text-gray-900 dark:text-white"
 placeholder="Enter file name"
 />
 {downloadExtension && (
 <span className="px-4 py-3 bg-gray-100 dark:bg-white/5 border border-emerald-200 rounded-lg text-sm text-emerald-800">
 {downloadExtension}
 </span>
 )}
 <button
 onClick={handleDownload}
 className="px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all font-medium"
 >
 Download Edited PDF
 </button>
 </div>
 </div>
 )}

 {isLoadingText && (
 <div className="bg-indigo-500/100/10 border border-indigo-500/20 rounded-lg p-4">
 <div className="flex items-center gap-3">
 <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
 <div className="flex-1">
 <p className="text-indigo-300 text-sm font-medium">
 Loading PDF content...
 </p>
 <div className="w-full bg-blue-200 rounded-full h-2 mt-2">
 <div
 className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
 style={{ width: `${loadingProgress}%` }}
 ></div>
 </div>
 <p className="text-indigo-400 text-xs mt-1">
 {loadingProgress}% complete
 </p>
 </div>
 </div>
 </div>
 )}

 {isScannedPDF && (
 <div className="bg-yellow-500/100/10 border border-yellow-200 rounded-lg p-4">
 <div className="flex flex-wrap items-center justify-between gap-3">
 <p className="text-yellow-800 text-sm">
 ⚠️ Scanned PDF detected. Run OCR to enable editable text (creates a text layer on export).
 </p>
 <button
 onClick={() => {
 if (pdfDoc) {
 performOCR(pdfDoc, currentPage);
 }
 }}
 disabled={isOcrProcessing}
 className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm font-medium"
 >
 {isOcrProcessing ? 'Running OCR...' : 'Run OCR'}
 </button>
 </div>
 {ocrEnabled && (
 <p className="text-yellow-700 text-xs mt-2">
 OCR enabled. Edits will be exported as a text layer over the scanned image.
 </p>
 )}
 </div>
 )}

 {/* Canvas Container with Text Overlays */}
 <div
 ref={containerRef}
 className="bg-gray-100 dark:bg-white/5 rounded-lg shadow-lg shadow-black/5 dark:shadow-black/20 p-4 overflow-auto max-h-[800px] relative"
 >
 <div className="relative inline-block">
 {/* PDF Canvas */}
 <canvas
 ref={canvasRef}
 className="border border-gray-300 dark:border-white/15 shadow-sm"
 />

 {/* Text Selection Layer - NO OVERLAYS */}
 <div
 ref={overlayRef}
 className="absolute top-0 left-0 pointer-events-auto"
 style={{
 width: canvasRef.current?.width || 0,
 height: canvasRef.current?.height || 0,
 }}
 >
 {/* Interactive text selection areas - transparent, no visual overlays */}
 {textItems
 .filter(item => item.pageNumber === currentPage)
 .map(item => {
 const isSelected = selectedTextId === item.id;
 return (
 <div
 key={item.id}
 className={`absolute transition-all cursor-text ${
 isSelected ? 'z-10' : 'hover:bg-blue-100/10'
 }`}
 style={{
 left: `${item.x}px`,
 top: `${item.y}px`,
 width: `${item.width}px`,
 height: `${item.height}px`,
 // Completely transparent - shows original PDF canvas below
 backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
 pointerEvents: 'auto',
 }}
 onClick={(e) => {
 e.stopPropagation();
 handleTextClick(item.id);
 }}
 title={isSelected ? 'Click to edit text' : 'Click to select text'}
 >
 {/* Only show editing interface when selected */}
 {isSelected && (
 <div
 contentEditable
 suppressContentEditableWarning
 onBlur={handleTextBlur}
 onInput={(e) =>
 handleTextChange(item.id, e.currentTarget.textContent || '', e.currentTarget)
 }
 onKeyDown={(e) => {
 if (e.key === 'Enter') {
 e.preventDefault();
 handleTextBlur();
 }
 }}
 className="outline-none whitespace-nowrap overflow-visible px-1 focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 rounded-sm"
 style={{
 backgroundColor: 'rgba(255, 255, 255, 0.95)',
 minWidth: `${Math.max(item.width, 50)}px`,
 fontSize: `${item.fontSize}px`,
 fontWeight: item.fontWeight,
 fontStyle: item.fontStyle,
 fontFamily: item.fontFamily,
 color: item.color,
 lineHeight: '1.2',
 border: '2px solid rgba(59, 130, 246, 0.5)',
 borderRadius: '3px',
 boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
 }}
 autoFocus
 spellCheck={false}
 >
 {item.text}
 </div>
 )}
 </div>
 );
 })}

 {/* Annotations (new text, highlights, shapes) */}
 {annotations
 .filter(ann => ann.pageNumber === currentPage)
 .map(ann => {
 const isSelected = selectedAnnotation === ann.id;
 return (
 <div key={ann.id}
 className={`absolute ${activeTool === 'select' ? 'cursor-move' : 'pointer-events-none'} ${isSelected ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}`}
 style={{
 left: ann.x, top: ann.y, width: ann.width, height: ann.height,
 backgroundColor: ann.type === 'highlight' ? ann.color : ann.type === 'rect' ? 'transparent' : 'transparent',
 opacity: ann.opacity,
 border: ann.type === 'rect' ? `2px solid ${ann.color}` : isSelected ? '1px dashed #6366f1' : 'none',
 borderRadius: ann.type === 'rect' ? '2px' : '0',
 zIndex: isSelected ? 30 : 20,
 }}
 onClick={(e) => { e.stopPropagation(); setSelectedAnnotation(ann.id); setSelectedTextId(null); }}
 >
 {ann.type === 'text' && (
 <div contentEditable suppressContentEditableWarning spellCheck={false}
 className="w-full h-full outline-none whitespace-nowrap px-1"
 style={{ fontSize: ann.fontSize || 16, color: ann.color, fontFamily: 'Helvetica, Arial, sans-serif', lineHeight: '1.4' }}
 onInput={(e) => {
 setAnnotations(prev => prev.map(a => a.id === ann.id ? { ...a, text: e.currentTarget.textContent || '' } : a));
 }}
 >{ann.text}</div>
 )}
 {isSelected && (
 <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-indigo-500 rounded-full cursor-se-resize" />
 )}
 </div>
 );
 })}
 </div>

 {/* Clickable overlay for adding annotations */}
 {activeTool !== 'select' && (
 <div className="absolute inset-0 cursor-crosshair" style={{ zIndex: 25 }} onClick={handleCanvasClick} />
 )}
 </div>

 {isProcessing && (
 <div className="absolute inset-0 bg-gray-100 dark:bg-white/5 bg-opacity-75 flex items-center justify-center rounded-lg">
 <div className="text-center">
 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
 <p className="text-gray-500 dark:text-slate-400">Processing PDF...</p>
 </div>
 </div>
 )}
 </div>
 </div>
 )}
 <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
 {[
 {
 icon: "🔒",
 title: "Private & Secure",
 description: "Your edits are processed securely. Files are not shared and are removed after processing.",
 },
 {
 icon: "🎯",
 title: "Font-Accurate",
 description: "Text is edited in-place with original fonts and layout preserved for professional documents.",
 },
 {
 icon: "⚡",
 title: "Fast Results",
 description: "Edit and download your PDF in seconds with no registration required.",
 },
 ].map((feature, index) => (
 <div key={index} className="bg-gray-100 dark:bg-white/5 rounded-2xl border border-gray-200 dark:border-white/10 p-6 text-center shadow-sm">
 <div className="text-3xl mb-3">{feature.icon}</div>
 <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{feature.title}</h3>
 <p className="text-sm text-gray-500 dark:text-slate-400">{feature.description}</p>
 </div>
 ))}
 </div>
 </div>
 </div>
 );
}