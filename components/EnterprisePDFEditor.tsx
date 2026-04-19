"use client";

/**
 * GotuPDF Enterprise PDF Editor
 * 
 * Full-featured PDF editing UI with:
 * - Text editing with font preservation
 * - Image editing (replace, resize, rotate)
 * - Annotations (highlight, underline, strike-through, sticky notes, freehand)
 * - Page operations (add, delete, duplicate, reorder, rotate, crop)
 * - Layer management
 * - Quality validation
 * 
 * Copyright (c) 2024 GotuPDF
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';

// =============================================================================
// Types
// =============================================================================

interface BoundingBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface TextSpan {
  id: string;
  text: string;
  page_number: number;
  x: number;
  y: number;
  width: number;
  height: number;
  font_name: string;
  font_size: number;
  color: string;
  is_bold: boolean;
  is_italic: boolean;
  span_index: number;
}

interface ImageObject {
  id: string;
  page_number: number;
  x: number;
  y: number;
  width: number;
  height: number;
  original_width: number;
  original_height: number;
  dpi_x: number;
  dpi_y: number;
}

interface VectorObject {
  id: string;
  page_number: number;
  bbox: BoundingBox;
  fill_color: string | null;
  stroke_color: string | null;
  stroke_width: number;
}

interface Annotation {
  id: string;
  page_number: number;
  type: string;
  bbox: BoundingBox;
  content: string;
  color: string;
  opacity: number;
}

interface PageInfo {
  number: number;
  width: number;
  height: number;
  rotation: number;
  text_count: number;
  image_count: number;
  annotation_count: number;
}

interface QualityReport {
  valid: boolean;
  page_count_match: boolean;
  dimensions_match: boolean;
  rasterization_detected: boolean;
  layout_shift_detected: boolean;
  warnings: string[];
  errors: string[];
}

type Tool = 'select' | 'text' | 'image' | 'highlight' | 'underline' | 'strikethrough' | 'sticky' | 'freehand' | 'textbox' | 'shape';
type EditMode = 'exact' | 'adaptive' | 'smart';

// =============================================================================
// API Client
// =============================================================================

// Use Next.js API proxy to avoid CORS issues
// Requests go: Browser -> Next.js /api/pdf-engine/* -> Python backend
const API_BASE = '/api/pdf-engine';

// Debug: Log API_BASE on load
if (typeof window !== 'undefined') {
  console.log('PDF Editor API_BASE:', API_BASE, '(proxied to Python backend)');
}

async function apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  console.log('API Request:', options.method || 'GET', url);
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
      console.error('API Error:', response.status, error);
      throw new Error(error.detail || `Request failed: ${response.status}`);
    }
    
    return response.json();
  } catch (err) {
    console.error('API Connection Failed:', url, err);
    if (err instanceof TypeError && err.message.includes('fetch')) {
      throw new Error(`Cannot connect to PDF Engine at ${API_BASE}. Please ensure the backend is running.`);
    }
    throw err;
  }
}

async function uploadPDF(file: File, password?: string): Promise<{
  session_id: string;
  page_count: number;
  is_encrypted: boolean;
  metadata: Record<string, string>;
}> {
  const formData = new FormData();
  formData.append('file', file);
  if (password) {
    formData.append('password', password);
  }
  
  const url = `${API_BASE}/upload`;
  console.log('Uploading PDF to:', url);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: `Upload failed: ${response.status}` }));
      console.error('Upload Error:', response.status, error);
      throw new Error(error.detail || 'Upload failed');
    }
    
    const result = await response.json();
    console.log('Upload successful:', result);
    return result;
  } catch (err) {
    console.error('Upload Connection Failed:', err);
    if (err instanceof TypeError && err.message.includes('fetch')) {
      throw new Error(`Cannot connect to PDF Engine at ${API_BASE}. Please ensure the backend is running on port 8000.`);
    }
    throw err;
  }
}

// =============================================================================
// Component
// =============================================================================

export default function EnterprisePDFEditor() {
  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Document state
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [thumbnails, setThumbnails] = useState<Map<number, string>>(new Map());
  
  // Content state
  const [textSpans, setTextSpans] = useState<TextSpan[]>([]);
  const [images, setImages] = useState<ImageObject[]>([]);
  const [vectors, setVectors] = useState<VectorObject[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  
  // Selection state
  const [selectedTool, setSelectedTool] = useState<Tool>('select');
  const [selectedElement, setSelectedElement] = useState<{
    type: 'text' | 'image' | 'vector' | 'annotation';
    id: string;
    data: TextSpan | ImageObject | VectorObject | Annotation;
  } | null>(null);
  
  // Editor state
  const [editMode, setEditMode] = useState<EditMode>('adaptive');
  const [zoom, setZoom] = useState(100);
  const [showGrid, setShowGrid] = useState(false);
  const [showRulers, setShowRulers] = useState(true);
  
  // Edit state
  const [editingText, setEditingText] = useState<{
    span: TextSpan;
    newText: string;
  } | null>(null);
  
  // Quality state
  const [qualityReport, setQualityReport] = useState<QualityReport | null>(null);
  const [showQualityModal, setShowQualityModal] = useState(false);
  
  // Pending edits
  const [pendingEdits, setPendingEdits] = useState<Map<string, string>>(new Map());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Page render state
  const [pageImage, setPageImage] = useState<string | null>(null);
  const [pageWidth, setPageWidth] = useState(0);
  const [pageHeight, setPageHeight] = useState(0);
  
  // ==========================================================================
  // Document Operations
  // ==========================================================================
  
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please select a PDF file');
      return;
    }
    
    if (file.size > 100 * 1024 * 1024) {
      setError('File size exceeds 100MB limit');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await uploadPDF(file);
      
      setSessionId(result.session_id);
      setPageCount(result.page_count);
      setCurrentPage(1);
      
      // Load document info
      await loadDocumentInfo(result.session_id);
      
      // Load first page
      await loadPage(result.session_id, 1);
      
      // Load thumbnails
      loadThumbnails(result.session_id, result.page_count);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load PDF');
    } finally {
      setIsLoading(false);
    }
  };
  
  const loadDocumentInfo = async (sid: string) => {
    try {
      const info = await apiCall<{
        pages: PageInfo[];
        metadata: Record<string, string>;
      }>(`/info/${sid}`);
      
      setPages(info.pages);
    } catch (err) {
      console.error('Failed to load document info:', err);
    }
  };
  
  const loadPage = async (sid: string, pageNum: number) => {
    setIsLoading(true);
    
    try {
      // Fetch page render
      const scale = zoom / 100 * 1.5;
      const renderResponse = await fetch(
        `${API_BASE}/render/${sid}/${pageNum}?scale=${scale}`
      );
      
      if (renderResponse.ok) {
        const blob = await renderResponse.blob();
        const url = URL.createObjectURL(blob);
        setPageImage(url);
        
        // Get dimensions from image
        const img = new Image();
        img.onload = () => {
          setPageWidth(img.width);
          setPageHeight(img.height);
        };
        img.src = url;
      }
      
      // Extract all objects
      const data = await apiCall<{
        page: { width: number; height: number };
        text_spans: TextSpan[];
        images: ImageObject[];
        vectors: VectorObject[];
        annotations: Annotation[];
      }>('/extract-all', {
        method: 'POST',
        body: JSON.stringify({ session_id: sid, page_number: pageNum }),
      });
      
      setTextSpans(data.text_spans);
      setImages(data.images);
      setVectors(data.vectors);
      setAnnotations(data.annotations);
      setPageWidth(data.page.width);
      setPageHeight(data.page.height);
      
    } catch (err) {
      console.error('Failed to load page:', err);
      setError('Failed to load page');
    } finally {
      setIsLoading(false);
    }
  };
  
  const loadThumbnails = async (sid: string, count: number) => {
    const newThumbnails = new Map<number, string>();
    
    for (let i = 1; i <= count; i++) {
      try {
        const response = await fetch(
          `${API_BASE}/thumbnail/${sid}/${i}?width=120`
        );
        if (response.ok) {
          const blob = await response.blob();
          newThumbnails.set(i, URL.createObjectURL(blob));
        }
      } catch (err) {
        console.error(`Failed to load thumbnail ${i}:`, err);
      }
    }
    
    setThumbnails(newThumbnails);
  };
  
  // ==========================================================================
  // Navigation
  // ==========================================================================
  
  const goToPage = (pageNum: number) => {
    if (!sessionId || pageNum < 1 || pageNum > pageCount) return;
    setCurrentPage(pageNum);
    loadPage(sessionId, pageNum);
  };
  
  const handleZoom = (delta: number) => {
    const newZoom = Math.max(25, Math.min(400, zoom + delta));
    setZoom(newZoom);
    if (sessionId) {
      loadPage(sessionId, currentPage);
    }
  };
  
  // ==========================================================================
  // Element Selection
  // ==========================================================================
  
  const handleElementClick = (
    type: 'text' | 'image' | 'vector' | 'annotation',
    element: TextSpan | ImageObject | VectorObject | Annotation
  ) => {
    if (selectedTool !== 'select') return;
    
    setSelectedElement({ type, id: element.id, data: element });
    
    // If text and double-click should enable editing
    if (type === 'text') {
      const span = element as TextSpan;
      setEditingText({ span, newText: span.text });
    }
  };
  
  const handleTextEdit = (spanId: string, newText: string) => {
    setPendingEdits(prev => new Map(prev).set(spanId, newText));
    setHasUnsavedChanges(true);
  };
  
  // ==========================================================================
  // Applying Edits
  // ==========================================================================
  
  const applyEdits = async () => {
    if (!sessionId || pendingEdits.size === 0) return;
    
    setIsLoading(true);
    
    try {
      const edits = Array.from(pendingEdits.entries()).map(([spanId, newText]) => {
        const span = textSpans.find(s => s.id === spanId);
        if (!span) return null;
        
        return {
          span_id: spanId,
          page_number: span.page_number,
          original_text: span.text,
          new_text: newText,
          span_index: span.span_index,
          x: span.x,
          y: span.y,
          font_size: span.font_size,
          font_name: span.font_name,
          color: span.color,
          mode: editMode,
          alignment: 'left',
          preserve_width: true,
        };
      }).filter(Boolean);
      
      const result = await apiCall<{
        results: { span_id: string; success: boolean; error?: string }[];
        successful: number;
      }>('/edit-batch', {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId, edits }),
      });
      
      if (result.successful === edits.length) {
        setPendingEdits(new Map());
        setHasUnsavedChanges(false);
        
        // Reload page
        await loadPage(sessionId, currentPage);
      } else {
        const failed = result.results.filter(r => !r.success);
        setError(`Some edits failed: ${failed.map(f => f.error).join(', ')}`);
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply edits');
    } finally {
      setIsLoading(false);
    }
  };
  
  // ==========================================================================
  // Annotations
  // ==========================================================================
  
  const addAnnotation = async (
    type: string,
    bbox: BoundingBox,
    content?: string,
    color?: string
  ) => {
    if (!sessionId) return;
    
    try {
      await apiCall('/annotation?session_id=' + sessionId, {
        method: 'POST',
        body: JSON.stringify({
          page_number: currentPage,
          type,
          bbox,
          content: content || '',
          color: color || '#FFFF00',
          opacity: 1.0,
          points: [],
        }),
      });
      
      // Reload page
      await loadPage(sessionId, currentPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add annotation');
    }
  };
  
  // ==========================================================================
  // Page Operations
  // ==========================================================================
  
  const performPageOperation = async (operation: string, options: Record<string, unknown> = {}) => {
    if (!sessionId) return;
    
    setIsLoading(true);
    
    try {
      const result = await apiCall<{ success: boolean; page_count: number }>('/page-operation?session_id=' + sessionId, {
        method: 'POST',
        body: JSON.stringify({
          operation,
          page_number: currentPage,
          ...options,
        }),
      });
      
      if (result.success) {
        setPageCount(result.page_count);
        
        // Adjust current page if needed
        if (currentPage > result.page_count) {
          setCurrentPage(result.page_count);
        }
        
        // Reload thumbnails and current page
        loadThumbnails(sessionId, result.page_count);
        await loadPage(sessionId, Math.min(currentPage, result.page_count));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Page operation failed');
    } finally {
      setIsLoading(false);
    }
  };
  
  // ==========================================================================
  // Undo/Redo
  // ==========================================================================
  
  const handleUndo = async () => {
    if (!sessionId) return;
    
    try {
      const result = await apiCall<{ success: boolean }>(`/${sessionId}/undo`, {
        method: 'POST',
      });
      
      if (result.success) {
        await loadPage(sessionId, currentPage);
      }
    } catch (err) {
      console.error('Undo failed:', err);
    }
  };
  
  const handleRedo = async () => {
    if (!sessionId) return;
    
    try {
      const result = await apiCall<{ success: boolean }>(`/${sessionId}/redo`, {
        method: 'POST',
      });
      
      if (result.success) {
        await loadPage(sessionId, currentPage);
      }
    } catch (err) {
      console.error('Redo failed:', err);
    }
  };
  
  // ==========================================================================
  // Quality & Export
  // ==========================================================================
  
  const validateQuality = async () => {
    if (!sessionId) return;
    
    try {
      const report = await apiCall<QualityReport>('/validate', {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId }),
      });
      setQualityReport(report);
      setShowQualityModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed');
    }
  };
  
  const exportPDF = async () => {
    if (!sessionId) return;
    
    // Apply pending edits first
    if (pendingEdits.size > 0) {
      await applyEdits();
    }
    
    setIsLoading(true);
    
    try {
      const response = await fetch(`${API_BASE}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          linearize: true,
          compress: true,
          encrypt: false,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Export failed');
      }
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `edited_${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsLoading(false);
    }
  };
  
  // ==========================================================================
  // Scale Factor
  // ==========================================================================
  
  const getScaleFactor = () => {
    if (!pageWidth || !pageHeight) return 1;
    const page = pages.find(p => p.number === currentPage);
    if (!page) return zoom / 100;
    return (pageWidth / page.width) * (zoom / 100);
  };
  
  // ==========================================================================
  // Render
  // ==========================================================================
  
  return (
    <div className="flex flex-col h-screen bg-white dark:bg-neutral-900 text-black dark:text-white transition-colors">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-neutral-800 border-b border-gray-200 dark:border-neutral-700">
        {/* Left: File & Edit */}
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium"
          >
            Open PDF
          </button>
          
          {sessionId && (
            <>
              <div className="w-px h-6 bg-gray-300 dark:bg-neutral-600 mx-2" />
              
              <button
                onClick={handleUndo}
                className="p-2 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded text-gray-700 dark:text-gray-300"
                title="Undo"
              >
                <UndoIcon />
              </button>
              <button
                onClick={handleRedo}
                className="p-2 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded text-gray-700 dark:text-gray-300"
                title="Redo"
              >
                <RedoIcon />
              </button>
              
              {hasUnsavedChanges && (
                <button
                  onClick={applyEdits}
                  className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium"
                >
                  Apply Changes
                </button>
              )}
            </>
          )}
        </div>
        
        {/* Center: Navigation & Zoom */}
        <div className="flex items-center gap-4">
          {pageCount > 0 && (
            <>
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage <= 1}
                className="p-1 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded disabled:opacity-50 text-gray-700 dark:text-gray-300"
              >
                <ChevronLeftIcon />
              </button>
              
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Page {currentPage} of {pageCount}
              </span>
              
              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= pageCount}
                className="p-1 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded disabled:opacity-50 text-gray-700 dark:text-gray-300"
              >
                <ChevronRightIcon />
              </button>
              
              <div className="w-px h-6 bg-gray-300 dark:bg-neutral-600 mx-2" />
              
              <button
                onClick={() => handleZoom(-25)}
                className="p-1 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded text-gray-700 dark:text-gray-300"
                title="Zoom Out"
              >
                <ZoomOutIcon />
              </button>
              
              <span className="text-sm w-12 text-center text-gray-700 dark:text-gray-300">{zoom}%</span>
              
              <button
                onClick={() => handleZoom(25)}
                className="p-1 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded text-gray-700 dark:text-gray-300"
                title="Zoom In"
              >
                <ZoomInIcon />
              </button>
            </>
          )}
        </div>
        
        {/* Right: Export */}
        <div className="flex items-center gap-2">
          {sessionId && (
            <>
              <button
                onClick={validateQuality}
                className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-sm font-medium"
              >
                Validate
              </button>
              <button
                onClick={exportPDF}
                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium"
              >
                Export PDF
              </button>
            </>
          )}
        </div>
      </div>
      
      {/* Tool Bar */}
      {sessionId && (
        <div className="flex items-center gap-1 px-4 py-2 bg-gray-100 dark:bg-neutral-800 border-b border-gray-200 dark:border-neutral-700">
          <ToolButton
            active={selectedTool === 'select'}
            onClick={() => setSelectedTool('select')}
            title="Select"
          >
            <SelectIcon />
          </ToolButton>
          <ToolButton
            active={selectedTool === 'text'}
            onClick={() => setSelectedTool('text')}
            title="Edit Text"
          >
            <TextIcon />
          </ToolButton>
          <ToolButton
            active={selectedTool === 'textbox'}
            onClick={() => setSelectedTool('textbox')}
            title="Add Text Box"
          >
            <TextBoxIcon />
          </ToolButton>
          
          <div className="w-px h-6 bg-gray-300 dark:bg-neutral-600 mx-2" />
          
          <ToolButton
            active={selectedTool === 'highlight'}
            onClick={() => setSelectedTool('highlight')}
            title="Highlight"
          >
            <HighlightIcon />
          </ToolButton>
          <ToolButton
            active={selectedTool === 'underline'}
            onClick={() => setSelectedTool('underline')}
            title="Underline"
          >
            <UnderlineIcon />
          </ToolButton>
          <ToolButton
            active={selectedTool === 'strikethrough'}
            onClick={() => setSelectedTool('strikethrough')}
            title="Strikethrough"
          >
            <StrikethroughIcon />
          </ToolButton>
          <ToolButton
            active={selectedTool === 'sticky'}
            onClick={() => setSelectedTool('sticky')}
            title="Sticky Note"
          >
            <StickyIcon />
          </ToolButton>
          <ToolButton
            active={selectedTool === 'freehand'}
            onClick={() => setSelectedTool('freehand')}
            title="Freehand Draw"
          >
            <PenIcon />
          </ToolButton>
          
          <div className="w-px h-6 bg-gray-300 dark:bg-neutral-600 mx-2" />
          
          <ToolButton
            active={selectedTool === 'image'}
            onClick={() => setSelectedTool('image')}
            title="Add Image"
          >
            <ImageIcon />
          </ToolButton>
          <ToolButton
            active={selectedTool === 'shape'}
            onClick={() => setSelectedTool('shape')}
            title="Add Shape"
          >
            <ShapeIcon />
          </ToolButton>
          
          <div className="flex-1" />
          
          {/* Edit Mode */}
          <select
            value={editMode}
            onChange={e => setEditMode(e.target.value as EditMode)}
            className="px-2 py-1 bg-white dark:bg-neutral-700 border border-gray-300 dark:border-neutral-600 rounded text-sm text-gray-800 dark:text-white"
          >
            <option value="exact">Exact</option>
            <option value="adaptive">Adaptive</option>
            <option value="smart">Smart</option>
          </select>
          
          <label className="flex items-center gap-2 text-sm ml-4 text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={showGrid}
              onChange={e => setShowGrid(e.target.checked)}
              className="rounded"
            />
            Grid
          </label>
          
          <label className="flex items-center gap-2 text-sm ml-2 text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={showRulers}
              onChange={e => setShowRulers(e.target.checked)}
              className="rounded"
            />
            Rulers
          </label>
        </div>
      )}
      
      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Page Thumbnails */}
        {sessionId && (
          <div className="w-48 bg-gray-100 dark:bg-neutral-800 border-r border-gray-200 dark:border-neutral-700 overflow-y-auto">
            <div className="p-2 text-sm font-medium text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-neutral-700">
              Pages
            </div>
            <div className="p-2 space-y-2">
              {Array.from({ length: pageCount }, (_, i) => i + 1).map(num => (
                <div
                  key={num}
                  onClick={() => goToPage(num)}
                  className={`
                    relative cursor-pointer rounded overflow-hidden border-2 transition
                    ${currentPage === num ? 'border-blue-500' : 'border-transparent hover:border-gray-400 dark:hover:border-neutral-600'}
                  `}
                >
                  {thumbnails.get(num) ? (
                    <img
                      src={thumbnails.get(num)}
                      alt={`Page ${num}`}
                      className="w-full"
                    />
                  ) : (
                    <div className="w-full aspect-[3/4] bg-gray-200 dark:bg-neutral-700 flex items-center justify-center">
                      <span className="text-gray-500 dark:text-gray-400 text-xs">Loading...</span>
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-center text-xs py-0.5">
                    {num}
                  </div>
                </div>
              ))}
              
              {/* Page Operations */}
              <div className="pt-2 border-t border-gray-200 dark:border-neutral-700 space-y-1">
                <button
                  onClick={() => performPageOperation('add')}
                  className="w-full px-2 py-1 text-xs bg-white dark:bg-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-600 border border-gray-300 dark:border-neutral-600 rounded text-gray-800 dark:text-white"
                >
                  + Add Page
                </button>
                <button
                  onClick={() => performPageOperation('duplicate')}
                  className="w-full px-2 py-1 text-xs bg-white dark:bg-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-600 border border-gray-300 dark:border-neutral-600 rounded text-gray-800 dark:text-white"
                >
                  Duplicate
                </button>
                <button
                  onClick={() => performPageOperation('delete')}
                  disabled={pageCount <= 1}
                  className="w-full px-2 py-1 text-xs bg-red-600 hover:bg-red-700 rounded disabled:opacity-50 text-white"
                >
                  Delete
                </button>
                <button
                  onClick={() => performPageOperation('rotate', { rotation: 90 })}
                  className="w-full px-2 py-1 text-xs bg-white dark:bg-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-600 border border-gray-300 dark:border-neutral-600 rounded text-gray-800 dark:text-white"
                >
                  Rotate 90°
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Canvas Area */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto bg-gray-200 dark:bg-neutral-700 p-4"
        >
          {!sessionId ? (
            // Upload prompt
            <div className="h-full flex items-center justify-center">
              <div className="text-center p-8 bg-white dark:bg-neutral-800 rounded-lg shadow-xl max-w-md border border-gray-200 dark:border-neutral-700">
                <div className="w-16 h-16 mx-auto mb-4 bg-blue-600 rounded-full flex items-center justify-center text-white">
                  <UploadIcon />
                </div>
                <h2 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">Upload PDF to Edit</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
                  Enterprise-grade PDF editing with true structure-level changes.
                  No rasterization, no quality loss.
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium"
                >
                  Select PDF File
                </button>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                  Maximum file size: 100MB
                </p>
              </div>
            </div>
          ) : isLoading ? (
            // Loading
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">Loading...</p>
              </div>
            </div>
          ) : (
            // PDF Canvas
            <div className="inline-block relative shadow-2xl bg-white dark:bg-[#111111]" style={{ minWidth: pageWidth, minHeight: pageHeight }}>
              {/* Rulers */}
              {showRulers && (
                <>
                  <div className="absolute -top-5 left-0 right-0 h-5 bg-gray-300 dark:bg-neutral-700 border-b border-gray-400 dark:border-neutral-600" />
                  <div className="absolute top-0 -left-5 bottom-0 w-5 bg-gray-300 dark:bg-neutral-700 border-r border-gray-400 dark:border-neutral-600" />
                </>
              )}
              
              {/* Page Image */}
              {pageImage && (
                <img
                  src={pageImage}
                  alt={`Page ${currentPage}`}
                  className="block"
                  style={{ width: pageWidth, height: pageHeight }}
                />
              )}
              
              {/* Grid Overlay */}
              {showGrid && (
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    backgroundImage: 'linear-gradient(to right, rgba(128,128,128,0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(128,128,128,0.2) 1px, transparent 1px)',
                    backgroundSize: '20px 20px',
                  }}
                />
              )}
              
              {/* Text Spans Overlay */}
              {textSpans.map(span => {
                const scale = getScaleFactor();
                const isPending = pendingEdits.has(span.id);
                const isSelected = selectedElement?.id === span.id;
                const isEditing = editingText?.span.id === span.id;
                
                return (
                  <div
                    key={span.id}
                    onClick={() => handleElementClick('text', span)}
                    className={`
                      absolute cursor-pointer transition-all
                      ${isSelected ? 'ring-2 ring-blue-500' : 'hover:bg-blue-500/10'}
                      ${isPending ? 'bg-yellow-500/20' : ''}
                    `}
                    style={{
                      left: span.x * scale,
                      top: span.y * scale,
                      width: span.width * scale,
                      height: span.height * scale,
                    }}
                    title={span.text}
                  >
                    {isEditing && (
                      <input
                        type="text"
                        value={editingText.newText}
                        onChange={e => {
                          setEditingText({ ...editingText, newText: e.target.value });
                          handleTextEdit(span.id, e.target.value);
                        }}
                        onBlur={() => setEditingText(null)}
                        className="w-full h-full bg-white text-black px-1 text-sm"
                        style={{ fontSize: span.font_size * scale * 0.8 }}
                        autoFocus
                      />
                    )}
                  </div>
                );
              })}
              
              {/* Images Overlay */}
              {images.map(img => {
                const scale = getScaleFactor();
                const isSelected = selectedElement?.id === img.id;
                
                return (
                  <div
                    key={img.id}
                    onClick={() => handleElementClick('image', img)}
                    className={`
                      absolute cursor-pointer border-2 transition-all
                      ${isSelected ? 'border-green-500' : 'border-transparent hover:border-green-500/50'}
                    `}
                    style={{
                      left: img.x * scale,
                      top: img.y * scale,
                      width: img.width * scale,
                      height: img.height * scale,
                    }}
                  >
                    {isSelected && (
                      <>
                        {/* Resize handles */}
                        <div className="absolute -top-1 -left-1 w-3 h-3 bg-white border border-green-500 cursor-nw-resize" />
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-white border border-green-500 cursor-ne-resize" />
                        <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-white border border-green-500 cursor-sw-resize" />
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-white border border-green-500 cursor-se-resize" />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Right Panel - Properties Inspector */}
        {sessionId && selectedElement && (
          <div className="w-64 bg-gray-100 dark:bg-neutral-800 border-l border-gray-200 dark:border-neutral-700 overflow-y-auto">
            <div className="p-2 text-sm font-medium text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-neutral-700 flex items-center justify-between">
              <span>Properties</span>
              <button
                onClick={() => setSelectedElement(null)}
                className="p-1 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded text-gray-700 dark:text-gray-300"
              >
                <CloseIcon />
              </button>
            </div>
            
            <div className="p-3 space-y-4">
              {/* Type badge */}
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-blue-600 text-white rounded text-xs uppercase">
                  {selectedElement.type}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{selectedElement.id}</span>
              </div>
              
              {/* Text properties */}
              {selectedElement.type === 'text' && (
                <TextProperties
                  span={selectedElement.data as TextSpan}
                  pendingText={pendingEdits.get(selectedElement.id)}
                  onTextChange={(text) => handleTextEdit(selectedElement.id, text)}
                />
              )}
              
              {/* Image properties */}
              {selectedElement.type === 'image' && (
                <ImageProperties image={selectedElement.data as ImageObject} />
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-3 z-50">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="hover:bg-red-700 rounded p-1">
            <CloseIcon />
          </button>
        </div>
      )}
      
      {/* Quality Report Modal */}
      {showQualityModal && qualityReport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl max-w-md w-full mx-4 border border-gray-200 dark:border-neutral-700">
            <div className="p-4 border-b border-gray-200 dark:border-neutral-700 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Quality Report</h3>
              <button
                onClick={() => setShowQualityModal(false)}
                className="p-1 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded text-gray-700 dark:text-gray-300"
              >
                <CloseIcon />
              </button>
            </div>
            
            <div className="p-4 space-y-3">
              <StatusItem
                label="Overall"
                status={qualityReport.valid ? 'pass' : 'fail'}
              />
              <StatusItem
                label="Page Count Match"
                status={qualityReport.page_count_match ? 'pass' : 'fail'}
              />
              <StatusItem
                label="Dimensions Match"
                status={qualityReport.dimensions_match ? 'pass' : 'fail'}
              />
              <StatusItem
                label="No Rasterization"
                status={!qualityReport.rasterization_detected ? 'pass' : 'fail'}
              />
              <StatusItem
                label="No Layout Shift"
                status={!qualityReport.layout_shift_detected ? 'pass' : 'warn'}
              />
              
              {qualityReport.warnings.length > 0 && (
                <div className="mt-4">
                  <div className="text-sm font-medium text-yellow-500 mb-1">Warnings:</div>
                  <ul className="text-sm text-gray-600 dark:text-gray-400 list-disc list-inside">
                    {qualityReport.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {qualityReport.errors.length > 0 && (
                <div className="mt-4">
                  <div className="text-sm font-medium text-red-500 mb-1">Errors:</div>
                  <ul className="text-sm text-gray-600 dark:text-gray-400 list-disc list-inside">
                    {qualityReport.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-gray-200 dark:border-neutral-700 flex justify-end">
              <button
                onClick={() => setShowQualityModal(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function ToolButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`
        p-2 rounded transition
        ${active ? 'bg-blue-600 text-white' : 'hover:bg-gray-200 dark:hover:bg-neutral-700 text-gray-700 dark:text-gray-300'}
      `}
    >
      {children}
    </button>
  );
}

function TextProperties({
  span,
  pendingText,
  onTextChange,
}: {
  span: TextSpan;
  pendingText?: string;
  onTextChange: (text: string) => void;
}) {
  return (
    <>
      <div>
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Text Content</label>
        <textarea
          value={pendingText ?? span.text}
          onChange={e => onTextChange(e.target.value)}
          className="w-full px-2 py-1 bg-white dark:bg-neutral-700 border border-gray-300 dark:border-neutral-600 rounded text-sm text-gray-900 dark:text-white"
          rows={3}
        />
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Font</label>
          <div className="text-sm truncate text-gray-800 dark:text-gray-200">{span.font_name}</div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Size</label>
          <div className="text-sm text-gray-800 dark:text-gray-200">{span.font_size.toFixed(1)}pt</div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Color</label>
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded border border-gray-400 dark:border-neutral-600"
              style={{ backgroundColor: span.color }}
            />
            <span className="text-sm text-gray-800 dark:text-gray-200">{span.color}</span>
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Style</label>
          <div className="text-sm text-gray-800 dark:text-gray-200">
            {span.is_bold && <span className="font-bold mr-1">B</span>}
            {span.is_italic && <span className="italic">I</span>}
            {!span.is_bold && !span.is_italic && <span className="text-gray-500">Normal</span>}
          </div>
        </div>
      </div>
      
      <div>
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Position</label>
        <div className="text-sm text-gray-800 dark:text-gray-200">
          X: {span.x.toFixed(1)}, Y: {span.y.toFixed(1)}
        </div>
        <div className="text-sm text-gray-800 dark:text-gray-200">
          W: {span.width.toFixed(1)}, H: {span.height.toFixed(1)}
        </div>
      </div>
    </>
  );
}

function ImageProperties({ image }: { image: ImageObject }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Width</label>
          <div className="text-sm text-gray-800 dark:text-gray-200">{image.width.toFixed(1)}</div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Height</label>
          <div className="text-sm text-gray-800 dark:text-gray-200">{image.height.toFixed(1)}</div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Original</label>
          <div className="text-sm text-gray-800 dark:text-gray-200">{image.original_width}×{image.original_height}</div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">DPI</label>
          <div className="text-sm text-gray-800 dark:text-gray-200">{image.dpi_x.toFixed(0)}×{image.dpi_y.toFixed(0)}</div>
        </div>
      </div>
      
      <div>
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Position</label>
        <div className="text-sm text-gray-800 dark:text-gray-200">
          X: {image.x.toFixed(1)}, Y: {image.y.toFixed(1)}
        </div>
      </div>
    </>
  );
}

function StatusItem({ label, status }: { label: string; status: 'pass' | 'fail' | 'warn' }) {
  const colors = {
    pass: 'text-green-500',
    fail: 'text-red-500',
    warn: 'text-yellow-500',
  };
  
  const icons = {
    pass: '✓',
    fail: '✗',
    warn: '!',
  };
  
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-800 dark:text-gray-200">{label}</span>
      <span className={`font-bold ${colors[status]}`}>{icons[status]}</span>
    </div>
  );
}

// =============================================================================
// Icons
// =============================================================================

function UndoIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function ZoomInIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
    </svg>
  );
}

function ZoomOutIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
    </svg>
  );
}

function SelectIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
    </svg>
  );
}

function TextIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

function TextBoxIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
    </svg>
  );
}

function HighlightIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M15.243 4.515l-6.738 6.737-.707 2.121-1.04 1.041 2.828 2.829 1.04-1.041 2.122-.707 6.737-6.738-4.242-4.242zm6.364 3.536a1 1 0 010 1.414l-7.779 7.779-2.12.707-1.415 1.414a1 1 0 01-1.414 0l-4.243-4.243a1 1 0 010-1.414l1.414-1.414.707-2.121 7.779-7.779a1 1 0 011.414 0l5.657 5.657zM5.636 18.364L8 20.728V22H3v-5h1.272l2.364 2.364z" />
    </svg>
  );
}

function UnderlineIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 19h16M6 6v6a6 6 0 0012 0V6" />
    </svg>
  );
}

function StrikethroughIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h16M9 6v3m6-3v3M9 15v3m6-3v3" />
    </svg>
  );
}

function StickyIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
    </svg>
  );
}

function PenIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function ShapeIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
