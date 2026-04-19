'use client';

/**
 * AdvancedPDFEditor - Industry-Grade PDF Editing Component
 * 
 * This component integrates with the Python FastAPI backend for true
 * content stream editing. Features:
 * 
 * - True in-place text editing (NO overlays)
 * - Exact font preservation
 * - Exact positioning preservation
 * - Real-time preview
 * - Quality validation before export
 * - Diff preview
 * 
 * @copyright 2024 GotuPDF
 */

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { PDFDocument } from 'pdf-lib';
import CloudImport from '@/components/CloudImport';
import { buildDownloadName, splitFileName } from '@/lib/fileName';

// Types
interface TextSpan {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontName: string;
  fontSize: number;
  fontFlags: number;
  color: string;
  transform: number[];
  pageNumber: number;
  spanIndex: number;
  isEditable: boolean;
  isRotated: boolean;
  originalText: string;
}

interface EditItem {
  spanId: string;
  pageNumber: number;
  originalText: string;
  newText: string;
  spanIndex: number;
  x: number;
  y: number;
  fontSize: number;
  fontName: string;
  color: string;
  mode: 'exact' | 'adaptive' | 'smart';
}

interface EditResult {
  success: boolean;
  spanId: string;
  message: string;
  originalText: string;
  newText: string;
  methodUsed: string;
}

interface QualityReport {
  passed: boolean;
  objectCountBefore: number;
  objectCountAfter: number;
  imageCountBefore: number;
  imageCountAfter: number;
  dimensionsMatch: boolean;
  integrityValid: boolean;
  rasterizationDetected: boolean;
  layoutShiftDetected: boolean;
  warnings: string[];
  errors: string[];
}

interface StatusMessage {
  type: 'success' | 'error' | 'warning' | 'info';
  text: string;
}

// Configuration
const PYTHON_API_URL = process.env.NEXT_PUBLIC_PDF_ENGINE_URL || 'http://localhost:8000';

/**
 * Main Advanced PDF Editor Component
 */
export default function AdvancedPDFEditor() {
  // Core state
  const [file, setFile] = useState<File | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  
  // Text and editing state
  const [textSpans, setTextSpans] = useState<TextSpan[]>([]);
  const [editedSpans, setEditedSpans] = useState<Map<string, string>>(new Map());
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(null);
  
  // UI state
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingText, setIsLoadingText] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);
  const [showQualityReport, setShowQualityReport] = useState(false);
  const [qualityReport, setQualityReport] = useState<QualityReport | null>(null);
  const [editMode, setEditMode] = useState<'exact' | 'adaptive' | 'smart'>('adaptive');
  const [showDiffPreview, setShowDiffPreview] = useState(false);
  
  // Download state
  const [downloadInfo, setDownloadInfo] = useState<{ url: string; name: string } | null>(null);
  const [downloadBaseName, setDownloadBaseName] = useState("");
  const [downloadExtension, setDownloadExtension] = useState("");
  
  // Zoom input
  const [zoomInput, setZoomInput] = useState(() => `${Math.round(1.5 * 100)}%`);
  
  // Canvas state for PDF rendering
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  
  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // ============================================================================
  // Status Messages
  // ============================================================================
  
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

  // ============================================================================
  // Python Backend API Calls
  // ============================================================================

  /**
   * Upload PDF to Python backend and create editing session
   */
  const uploadToPythonBackend = async (pdfFile: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', pdfFile);
    
    const response = await fetch(`${PYTHON_API_URL}/api/pdf/upload`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Upload failed');
    }
    
    const data = await response.json();
    return data.sessionId;
  };

  /**
   * Extract text spans from PDF using Python backend
   */
  const extractTextSpans = async (
    sId: string, 
    pageNum?: number
  ): Promise<TextSpan[]> => {
    const pdfBytes = await file!.arrayBuffer();
    const pdfBase64 = btoa(
      new Uint8Array(pdfBytes).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        ''
      )
    );
    
    const response = await fetch(`${PYTHON_API_URL}/api/pdf/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pdfBase64,
        pageNumber: pageNum,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Extraction failed');
    }
    
    const data = await response.json();
    setSessionId(data.sessionId);
    setTotalPages(data.pageCount);
    
    // Map spans with original text
    return data.spans.map((span: any) => ({
      ...span,
      originalText: span.text,
    }));
  };

  /**
   * Apply edits via Python backend
   */
  const applyEditsViaBackend = async (edits: EditItem[]): Promise<EditResult[]> => {
    if (!sessionId) throw new Error('No active session');
    
    const response = await fetch(`${PYTHON_API_URL}/api/pdf/edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        edits,
        allowFallback: true,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Edit failed');
    }
    
    const data = await response.json();
    
    if (data.qualityReport) {
      setQualityReport(data.qualityReport);
    }
    
    return data.results;
  };

  /**
   * Export edited PDF from Python backend
   */
  const exportFromBackend = async (): Promise<Blob> => {
    if (!sessionId) throw new Error('No active session');
    
    const response = await fetch(`${PYTHON_API_URL}/api/pdf/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        reencrypt: true,
        validateQuality: true,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Export failed');
    }
    
    const data = await response.json();
    
    if (data.qualityReport) {
      setQualityReport(data.qualityReport);
    }
    
    if (!data.success) {
      throw new Error(data.message || 'Export failed quality validation');
    }
    
    // Decode base64 to blob
    const pdfBytes = Uint8Array.from(atob(data.pdfBase64), c => c.charCodeAt(0));
    return new Blob([pdfBytes], { type: 'application/pdf' });
  };

  /**
   * Validate PDF quality
   */
  const validateQuality = async (): Promise<QualityReport> => {
    if (!sessionId) throw new Error('No active session');
    
    const response = await fetch(`${PYTHON_API_URL}/api/pdf/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Validation failed');
    }
    
    const data = await response.json();
    return data.report;
  };

  /**
   * Close session and cleanup
   */
  const closeSession = async () => {
    if (!sessionId) return;
    
    try {
      await fetch(`${PYTHON_API_URL}/api/pdf/session/${sessionId}`, {
        method: 'DELETE',
      });
    } catch (e) {
      console.warn('Failed to close session:', e);
    }
  };

  // ============================================================================
  // File Handling
  // ============================================================================

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

  const handleSelectedFile = async (selectedFile: File) => {
    if (!selectedFile || selectedFile.type !== 'application/pdf') {
      pushStatus('error', 'Please select a valid PDF file.');
      return;
    }

    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    if (selectedFile.size > MAX_FILE_SIZE) {
      pushStatus('warning', 'File is too large. Please select a PDF smaller than 50MB.');
      return;
    }

    // Close previous session
    await closeSession();
    
    setFile(selectedFile);
    setIsProcessing(true);
    setIsLoadingText(true);
    setLoadingProgress(0);
    setStatusMessage(null);
    clearDownloadInfo();
    setEditedSpans(new Map());

    try {
      setLoadingProgress(10);
      
      // Load PDF for rendering using PDF.js
      const arrayBuffer = await selectedFile.arrayBuffer();
      setLoadingProgress(30);
      
      // Import PDF.js dynamically
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
      
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      setPdfDoc(pdf);
      setTotalPages(pdf.numPages);
      setCurrentPage(1);
      setLoadingProgress(50);
      
      // Render first page
      await renderPage(pdf, 1);
      setLoadingProgress(70);
      
      // Extract text spans from Python backend
      const spans = await extractTextSpans('', 1);
      setTextSpans(spans);
      setLoadingProgress(100);
      
      pushStatus('success', `PDF loaded successfully. ${spans.length} text elements detected.`);
      
    } catch (error) {
      console.error('Error loading PDF:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('password')) {
          pushStatus('error', 'PDF is encrypted. Password support coming soon.');
        } else {
          pushStatus('error', `Failed to load PDF: ${error.message}`);
        }
      } else {
        pushStatus('error', 'Failed to load PDF. Please try another file.');
      }
    } finally {
      setIsProcessing(false);
      setIsLoadingText(false);
      setLoadingProgress(0);
    }
  };

  // ============================================================================
  // PDF Rendering
  // ============================================================================

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

  // ============================================================================
  // Page Navigation
  // ============================================================================

  const goToPage = useCallback(async (pageNum: number) => {
    if (!pdfDoc || pageNum < 1 || pageNum > totalPages) return;
    if (isProcessing) return;

    setCurrentPage(pageNum);
    setIsProcessing(true);
    setIsLoadingText(true);

    try {
      setTextSpans([]);
      setSelectedSpanId(null);

      await renderPage(pdfDoc, pageNum);
      
      // Extract text for new page
      const spans = await extractTextSpans(sessionId || '', pageNum);
      
      // Restore any edited text for this page
      const spansWithEdits = spans.map(span => {
        const editedText = editedSpans.get(span.id);
        if (editedText !== undefined) {
          return { ...span, text: editedText };
        }
        return span;
      });
      
      setTextSpans(spansWithEdits);

    } catch (error) {
      console.error('Error changing page:', error);
      pushStatus('error', `Failed to load page ${pageNum}.`);
    } finally {
      setIsProcessing(false);
      setIsLoadingText(false);
    }
  }, [pdfDoc, totalPages, isProcessing, sessionId, editedSpans]);

  // ============================================================================
  // Text Editing
  // ============================================================================

  const handleTextClick = useCallback((id: string, event?: React.MouseEvent) => {
    event?.preventDefault();
    event?.stopPropagation();
    
    const span = textSpans.find(s => s.id === id);
    if (!span || !span.isEditable) return;
    
    setSelectedSpanId(id);
  }, [textSpans]);

  const handleTextChange = (id: string, newText: string) => {
    // Update local state
    setTextSpans(prev => prev.map(span =>
      span.id === id ? { ...span, text: newText } : span
    ));
    
    // Track edit
    setEditedSpans(prev => {
      const updated = new Map(prev);
      updated.set(id, newText);
      return updated;
    });
  };

  const handleTextBlur = () => {
    setSelectedSpanId(null);
  };

  // ============================================================================
  // Export
  // ============================================================================

  const handleExport = async () => {
    if (!file) {
      pushStatus('error', 'No PDF loaded.');
      return;
    }

    // Get all edits
    const edits: EditItem[] = [];
    
    textSpans.forEach(span => {
      const editedText = editedSpans.get(span.id);
      if (editedText !== undefined && editedText !== span.originalText) {
        edits.push({
          spanId: span.id,
          pageNumber: span.pageNumber,
          originalText: span.originalText,
          newText: editedText,
          spanIndex: span.spanIndex,
          x: span.x / scale,
          y: span.y / scale,
          fontSize: span.fontSize,
          fontName: span.fontName,
          color: span.color,
          mode: editMode,
        });
      }
    });

    if (edits.length === 0) {
      pushStatus('warning', 'No text changes detected. Please make some edits before exporting.');
      return;
    }

    setIsProcessing(true);
    setStatusMessage(null);
    clearDownloadInfo();

    try {
      console.log(`📝 Applying ${edits.length} edits via Python backend...`);
      
      // Apply edits via backend
      const results = await applyEditsViaBackend(edits);
      
      // Check results
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      
      if (failCount > 0) {
        console.warn(`⚠️ ${failCount} edits failed`);
        results.filter(r => !r.success).forEach(r => {
          console.warn(`  - ${r.originalText} -> ${r.newText}: ${r.message}`);
        });
      }
      
      // Export PDF
      const blob = await exportFromBackend();
      
      if (blob.size < 1000) {
        throw new Error('Export failed: generated PDF was empty.');
      }

      const url = URL.createObjectURL(blob);
      const safeName = file.name.replace(/\.pdf$/i, '_edited.pdf');
      
      setDownloadInfo({ url, name: safeName });
      const parts = splitFileName(safeName);
      setDownloadBaseName(parts.base || "edited");
      setDownloadExtension(parts.ext || ".pdf");

      // Show quality report if available
      if (qualityReport) {
        setShowQualityReport(true);
        
        if (!qualityReport.passed) {
          pushStatus('warning', `Export complete with warnings. ${qualityReport.warnings.join(', ')}`);
        } else {
          pushStatus('success', `PDF edited successfully using ${results[0]?.methodUsed || 'adaptive'} mode.`);
        }
      } else {
        pushStatus('success', `PDF edited successfully. ${successCount} edits applied.`);
      }

    } catch (error) {
      console.error('❌ Export failed:', error);
      pushStatus('error', 'Export failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsProcessing(false);
    }
  };

  const triggerDownload = () => {
    if (!downloadInfo) return;
    
    const link = document.createElement('a');
    link.href = downloadInfo.url;
    link.download = downloadInfo.name;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // ============================================================================
  // Zoom Controls
  // ============================================================================

  const clampZoom = (value: number) => Math.min(Math.max(value, 50), 300);

  const applyZoomScale = async (nextScale: number) => {
    const clampedScale = Math.min(Math.max(nextScale, 0.5), 3);
    setScale(clampedScale);
    setZoomInput(`${Math.round(clampedScale * 100)}%`);
    
    if (pdfDoc) {
      await renderPage(pdfDoc, currentPage);
    }
  };

  const handleZoomIn = () => applyZoomScale(scale + 0.25);
  const handleZoomOut = () => applyZoomScale(scale - 0.25);

  // ============================================================================
  // Diff Preview
  // ============================================================================

  const getEditsForDiff = useMemo(() => {
    const diffs: Array<{ original: string; edited: string; spanId: string }> = [];
    
    textSpans.forEach(span => {
      const editedText = editedSpans.get(span.id);
      if (editedText !== undefined && editedText !== span.originalText) {
        diffs.push({
          original: span.originalText,
          edited: editedText,
          spanId: span.id,
        });
      }
    });
    
    return diffs;
  }, [textSpans, editedSpans]);

  // ============================================================================
  // Cleanup
  // ============================================================================

  useEffect(() => {
    return () => {
      closeSession();
      clearDownloadInfo();
    };
  }, []);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="w-full max-w-6xl mx-auto p-4">
      {/* Status Message */}
      {statusMessage && (
        <div className={`mb-4 p-4 rounded-lg ${
          statusMessage.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
          statusMessage.type === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
          statusMessage.type === 'warning' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
          'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
        }`}>
          {statusMessage.text}
        </div>
      )}

      {/* File Upload */}
      {!file && (
        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            className="hidden"
            id="pdf-upload"
          />
          
          <div className="mb-4">
            <svg className="w-16 h-16 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 4v5h5" />
            </svg>
          </div>
          
          <h3 className="text-lg font-medium mb-2">Upload PDF to Edit</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Industry-grade editing with true content stream modification
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <label
              htmlFor="pdf-upload"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer inline-flex items-center justify-center"
            >
              Select PDF
            </label>
            
            <CloudImport 
              accept="application/pdf"
              onFilesSelected={handleCloudImport}
            />
          </div>
          
          <p className="text-xs text-gray-400 mt-4">Maximum file size: 50MB</p>
        </div>
      )}

      {/* Loading Progress */}
      {isProcessing && loadingProgress > 0 && (
        <div className="mb-4">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
          <p className="text-sm text-center mt-1 text-gray-500">
            Loading... {loadingProgress}%
          </p>
        </div>
      )}

      {/* PDF Editor */}
      {file && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
            {/* Page Navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage <= 1 || isProcessing}
                className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
                title="Previous page"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              <span className="text-sm whitespace-nowrap">
                Page {currentPage} of {totalPages}
              </span>
              
              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= totalPages || isProcessing}
                className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
                title="Next page"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            
            <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />
            
            {/* Zoom Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleZoomOut}
                disabled={scale <= 0.5}
                className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
                title="Zoom out"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                </svg>
              </button>
              
              <span className="text-sm w-16 text-center">{zoomInput}</span>
              
              <button
                onClick={handleZoomIn}
                disabled={scale >= 3}
                className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
                title="Zoom in"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                </svg>
              </button>
            </div>
            
            <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />
            
            {/* Edit Mode */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Mode:</span>
              <select
                value={editMode}
                onChange={(e) => setEditMode(e.target.value as any)}
                className="text-sm p-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
              >
                <option value="exact">Exact (strict)</option>
                <option value="adaptive">Adaptive (auto-scale)</option>
                <option value="smart">Smart (kerning)</option>
              </select>
            </div>
            
            <div className="flex-1" />
            
            {/* Actions */}
            <div className="flex items-center gap-2">
              {getEditsForDiff.length > 0 && (
                <button
                  onClick={() => setShowDiffPreview(!showDiffPreview)}
                  className="px-3 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  {showDiffPreview ? 'Hide' : 'Show'} Changes ({getEditsForDiff.length})
                </button>
              )}
              
              <button
                onClick={handleExport}
                disabled={isProcessing || editedSpans.size === 0}
                className="px-4 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? 'Processing...' : 'Export PDF'}
              </button>
            </div>
          </div>
          
          {/* Diff Preview */}
          {showDiffPreview && getEditsForDiff.length > 0 && (
            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <h4 className="font-medium mb-3">Changes Preview</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {getEditsForDiff.map((diff, i) => (
                  <div key={i} className="text-sm p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                    <div className="flex items-start gap-2">
                      <span className="text-red-500 line-through">{diff.original}</span>
                      <span className="text-gray-400">→</span>
                      <span className="text-green-500">{diff.edited}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* PDF Canvas with Text Overlay */}
          <div 
            ref={containerRef}
            className="relative overflow-auto border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-200 dark:bg-gray-900"
            style={{ maxHeight: '70vh' }}
          >
            {/* PDF Canvas */}
            <canvas
              ref={canvasRef}
              className="block mx-auto"
            />
            
            {/* Text Overlay */}
            <div
              ref={overlayRef}
              className="absolute top-0 left-0 pointer-events-none"
              style={{
                width: canvasRef.current?.width || 0,
                height: canvasRef.current?.height || 0,
              }}
            >
              {textSpans
                .filter(span => span.pageNumber === currentPage)
                .map(span => {
                  const isSelected = selectedSpanId === span.id;
                  const isEdited = editedSpans.has(span.id);
                  
                  return (
                    <div
                      key={span.id}
                      className={`absolute pointer-events-auto cursor-text transition-all ${
                        isSelected 
                          ? 'ring-2 ring-blue-500 bg-blue-100/50' 
                          : isEdited
                          ? 'bg-yellow-100/30 hover:bg-yellow-100/50'
                          : 'hover:bg-blue-100/30'
                      }`}
                      style={{
                        left: span.x,
                        top: span.y,
                        width: span.width,
                        height: span.height,
                        fontSize: span.fontSize,
                        fontFamily: span.fontName.includes('Serif') ? 'serif' : 
                                   span.fontName.includes('Mono') ? 'monospace' : 'sans-serif',
                        color: span.color,
                        lineHeight: 1,
                        whiteSpace: 'pre',
                        overflow: 'hidden',
                      }}
                      onClick={(e) => handleTextClick(span.id, e)}
                    >
                      {isSelected ? (
                        <input
                          type="text"
                          value={editedSpans.get(span.id) ?? span.text}
                          onChange={(e) => handleTextChange(span.id, e.target.value)}
                          onBlur={handleTextBlur}
                          autoFocus
                          className="w-full h-full bg-transparent border-none outline-none p-0 m-0"
                          style={{
                            fontSize: 'inherit',
                            fontFamily: 'inherit',
                            color: 'inherit',
                          }}
                        />
                      ) : (
                        <span className="opacity-0">
                          {editedSpans.get(span.id) ?? span.text}
                        </span>
                      )}
                    </div>
                  );
                })}
            </div>
            
            {/* Loading Overlay */}
            {isLoadingText && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-black/50">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">Loading text...</span>
                </div>
              </div>
            )}
          </div>
          
          {/* Download Button */}
          {downloadInfo && (
            <div className="flex items-center justify-center gap-4 p-4 bg-green-50 dark:bg-green-900/30 rounded-lg">
              <span className="text-green-700 dark:text-green-300">
                PDF ready for download!
              </span>
              <button
                onClick={triggerDownload}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Download {downloadBaseName}{downloadExtension}
              </button>
            </div>
          )}
          
          {/* Quality Report Modal */}
          {showQualityReport && qualityReport && (
            <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium">Quality Report</h3>
                  <button
                    onClick={() => setShowQualityReport(false)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <div className={`p-3 rounded mb-4 ${
                  qualityReport.passed 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                }`}>
                  {qualityReport.passed ? '✓ Quality check passed' : '✗ Quality check failed'}
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Object count:</span>
                    <span>{qualityReport.objectCountBefore} → {qualityReport.objectCountAfter}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Image count:</span>
                    <span>{qualityReport.imageCountBefore} → {qualityReport.imageCountAfter}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Dimensions match:</span>
                    <span>{qualityReport.dimensionsMatch ? '✓' : '✗'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Integrity valid:</span>
                    <span>{qualityReport.integrityValid ? '✓' : '✗'}</span>
                  </div>
                  {qualityReport.rasterizationDetected && (
                    <div className="text-red-600">⚠ Rasterization detected</div>
                  )}
                  {qualityReport.layoutShiftDetected && (
                    <div className="text-yellow-600">⚠ Layout shift detected</div>
                  )}
                </div>
                
                {qualityReport.warnings.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-medium mb-2">Warnings:</h4>
                    <ul className="list-disc list-inside text-sm text-yellow-600">
                      {qualityReport.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                <button
                  onClick={() => setShowQualityReport(false)}
                  className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Close
                </button>
              </div>
            </div>
          )}
          
          {/* Upload New Button */}
          <div className="text-center">
            <button
              onClick={() => {
                closeSession();
                setFile(null);
                setTextSpans([]);
                setEditedSpans(new Map());
                clearDownloadInfo();
              }}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Upload a different PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
