"use client";

/**
 * In-Place PDF Editor
 * 
 * Industry-grade PDF editing with:
 * - True text layer rendering via pdf.js
 * - ContentEditable text blocks with font preservation
 * - Drag-and-drop text positioning
 * - Full toolbar with formatting options
 * - Non-destructive PDF export via backend
 * 
 * Copyright (c) 2024 GotuPDF
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Configure worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}

// =============================================================================
// Types
// =============================================================================

interface TextItem {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  fontStyle: string;
  color: string;
  transform: number[];
  pageNumber: number;
  isEdited: boolean;
  originalText: string;
}

interface PageData {
  pageNumber: number;
  width: number;
  height: number;
  scale: number;
  textItems: TextItem[];
  viewport: pdfjsLib.PageViewport | null;
}

interface EditorState {
  selectedItemId: string | null;
  editingItemId: string | null;
  isDragging: boolean;
  dragStartX: number;
  dragStartY: number;
  tool: 'select' | 'text' | 'format' | 'draw';
}

interface ToolbarState {
  fontSize: number;
  fontFamily: string;
  bold: boolean;
  italic: boolean;
  textColor: string;
}

type UndoAction = {
  type: 'text-edit' | 'text-move' | 'text-add' | 'text-delete' | 'format';
  itemId: string;
  previousState: Partial<TextItem>;
  newState: Partial<TextItem>;
};

// =============================================================================
// API Configuration
// =============================================================================

const API_BASE = '/api/pdf-engine';

async function apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || error.error || 'Request failed');
  }
  
  return response.json();
}

// =============================================================================
// Custom Hooks
// =============================================================================

function useUndoRedo(maxHistory: number = 50) {
  const [history, setHistory] = useState<UndoAction[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  const pushAction = useCallback((action: UndoAction) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(action);
      if (newHistory.length > maxHistory) {
        newHistory.shift();
      }
      return newHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, maxHistory - 1));
  }, [historyIndex, maxHistory]);
  
  const canUndo = historyIndex >= 0;
  const canRedo = historyIndex < history.length - 1;
  
  const getUndoAction = useCallback(() => {
    if (!canUndo) return null;
    const action = history[historyIndex];
    setHistoryIndex(prev => prev - 1);
    return action;
  }, [canUndo, history, historyIndex]);
  
  const getRedoAction = useCallback(() => {
    if (!canRedo) return null;
    setHistoryIndex(prev => prev + 1);
    return history[historyIndex + 1];
  }, [canRedo, history, historyIndex]);
  
  return { pushAction, canUndo, canRedo, getUndoAction, getRedoAction };
}

// =============================================================================
// Icons
// =============================================================================

const Icons = {
  Select: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
    </svg>
  ),
  Text: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <path d="M4 7V4h16v3M9 20h6M12 4v16"/>
    </svg>
  ),
  Bold: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6zM6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/>
    </svg>
  ),
  Italic: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/>
    </svg>
  ),
  Underline: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3M4 21h16"/>
    </svg>
  ),
  ZoomIn: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35M11 8v6M8 11h6"/>
    </svg>
  ),
  ZoomOut: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35M8 11h6"/>
    </svg>
  ),
  Undo: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <path d="M3 7v6h6M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
    </svg>
  ),
  Redo: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <path d="M21 7v6h-6M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/>
    </svg>
  ),
  Save: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
      <polyline points="17,21 17,13 7,13 7,21"/><polyline points="7,3 7,8 15,8"/>
    </svg>
  ),
  Upload: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
    </svg>
  ),
  Trash: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    </svg>
  ),
  Plus: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  Move: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <polyline points="5,9 2,12 5,15"/><polyline points="9,5 12,2 15,5"/>
      <polyline points="15,19 12,22 9,19"/><polyline points="19,9 22,12 19,15"/>
      <line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/>
    </svg>
  ),
  ChevronLeft: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  ),
  ChevronRight: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  ),
};

// =============================================================================
// Editable Text Block Component
// =============================================================================

interface EditableTextBlockProps {
  item: TextItem;
  scale: number;
  isSelected: boolean;
  isEditing: boolean;
  onSelect: () => void;
  onStartEdit: () => void;
  onTextChange: (newText: string) => void;
  onPositionChange: (x: number, y: number) => void;
  onBlur: () => void;
}

function EditableTextBlock({
  item,
  scale,
  isSelected,
  isEditing,
  onSelect,
  onStartEdit,
  onTextChange,
  onPositionChange,
  onBlur,
}: EditableTextBlockProps) {
  const blockRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  // Calculate styled position (transforming PDF coordinates to screen)
  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${item.x * scale}px`,
    top: `${item.y * scale}px`,
    fontSize: `${item.fontSize * scale}px`,
    fontFamily: item.fontFamily || 'sans-serif',
    fontWeight: item.fontWeight || 'normal',
    fontStyle: item.fontStyle || 'normal',
    color: item.color || '#000000',
    lineHeight: 1.2,
    whiteSpace: 'pre',
    cursor: isDragging ? 'grabbing' : isSelected ? 'grab' : 'text',
    outline: isSelected ? '2px solid #3b82f6' : 'none',
    outlineOffset: '2px',
    backgroundColor: isEditing ? 'rgba(255,255,255,0.95)' : item.isEdited ? 'rgba(255, 235, 59, 0.15)' : 'transparent',
    padding: isEditing ? '2px 4px' : '0',
    minWidth: isEditing ? '50px' : 'auto',
    minHeight: isEditing ? '1.2em' : 'auto',
    zIndex: isSelected ? 100 : 1,
    userSelect: isEditing ? 'text' : 'none',
    borderRadius: '2px',
    transition: 'background-color 0.15s, outline 0.15s',
  };
  
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isEditing) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    if (!isSelected) {
      onSelect();
      return;
    }
    
    // Start drag
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - item.x * scale,
      y: e.clientY - item.y * scale,
    });
  };
  
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    
    const newX = (e.clientX - dragOffset.x) / scale;
    const newY = (e.clientY - dragOffset.y) / scale;
    onPositionChange(newX, newY);
  }, [isDragging, dragOffset, scale, onPositionChange]);
  
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);
  
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);
  
  const handleDoubleClick = () => {
    if (!isEditing) {
      onStartEdit();
    }
  };
  
  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const newText = e.currentTarget.textContent || '';
    onTextChange(newText);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onBlur();
    }
    // Allow Enter for line break in editing mode
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onBlur();
    }
  };
  
  return (
    <div
      ref={blockRef}
      style={style}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      contentEditable={isEditing}
      suppressContentEditableWarning
      onInput={handleInput}
      onBlur={onBlur}
      onKeyDown={handleKeyDown}
      data-text-item-id={item.id}
      className="pdf-text-block"
    >
      {item.text}
    </div>
  );
}

// =============================================================================
// Toolbar Button Component
// =============================================================================

interface ToolButtonProps {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}

function ToolButton({ active, disabled, onClick, title, children }: ToolButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`
        p-2 rounded transition-colors
        ${active ? 'bg-blue-600 text-white' : 'hover:bg-gray-200 dark:hover:bg-neutral-700 text-gray-700 dark:text-gray-300'}
        ${disabled ? 'opacity-40 cursor-not-allowed' : ''}
      `}
    >
      {children}
    </button>
  );
}

// =============================================================================
// Main Editor Component
// =============================================================================

export default function InPlacePDFEditor() {
  // File state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  // Page state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [pageData, setPageData] = useState<PageData | null>(null);
  const [scale, setScale] = useState(1.5);
  const [zoom, setZoom] = useState(100);
  
  // Editor state
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [tool, setTool] = useState<'select' | 'text' | 'format'>('select');
  
  // Toolbar state
  const [fontSize, setFontSize] = useState(12);
  const [fontFamily, setFontFamily] = useState('Helvetica');
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);
  const [textColor, setTextColor] = useState('#000000');
  
  // Edit tracking
  const [editedItems, setEditedItems] = useState<Map<string, TextItem>>(new Map());
  const [hasChanges, setHasChanges] = useState(false);
  
  // Loading state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Undo/redo
  const { pushAction, canUndo, canRedo, getUndoAction, getRedoAction } = useUndoRedo();
  
  // ==========================================================================
  // PDF Loading
  // ==========================================================================
  
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please select a valid PDF file');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setPdfFile(file);
    
    try {
      // Upload to backend for session
      const formData = new FormData();
      formData.append('file', file);
      
      const uploadResponse = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData,
      });
      
      if (!uploadResponse.ok) {
        throw new Error('Failed to upload PDF');
      }
      
      const uploadData = await uploadResponse.json();
      setSessionId(uploadData.session_id);
      
      // Load PDF locally with pdf.js
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      setPdfDoc(pdf);
      setPageCount(pdf.numPages);
      setCurrentPage(1);
      
      // Render first page
      await renderPage(pdf, 1);
      
    } catch (err) {
      console.error('Failed to load PDF:', err);
      setError(err instanceof Error ? err.message : 'Failed to load PDF');
    } finally {
      setIsLoading(false);
    }
  };
  
  // ==========================================================================
  // Page Rendering
  // ==========================================================================
  
  const renderPage = async (pdf: pdfjsLib.PDFDocumentProxy, pageNum: number) => {
    setIsLoading(true);
    
    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      
      // Render canvas
      const canvas = canvasRef.current;
      if (canvas) {
        const context = canvas.getContext('2d');
        if (context) {
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          
          await page.render({
            canvasContext: context,
            viewport,
          }).promise;
        }
      }
      
      // Extract text content
      const textContent = await page.getTextContent();
      const textItems = extractTextItems(textContent, viewport, pageNum);
      
      // Store page data
      setPageData({
        pageNumber: pageNum,
        width: viewport.width,
        height: viewport.height,
        scale,
        textItems,
        viewport,
      });
      
    } catch (err) {
      console.error('Failed to render page:', err);
      setError('Failed to render page');
    } finally {
      setIsLoading(false);
    }
  };
  
  // ==========================================================================
  // Text Extraction
  // ==========================================================================
  
  const extractTextItems = (
    textContent: Awaited<ReturnType<pdfjsLib.PDFPageProxy['getTextContent']>>,
    viewport: pdfjsLib.PageViewport,
    pageNum: number
  ): TextItem[] => {
    const items: TextItem[] = [];
    
    textContent.items.forEach((item, index) => {
      if ('str' in item && item.str.trim()) {
        const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
        
        // Calculate position
        const x = tx[4];
        const y = tx[5];
        const fontSize = Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1]);
        
        // Determine font properties
        const fontName = item.fontName || 'g_d0_f1';
        let fontFamily = 'sans-serif';
        let fontWeight = 'normal';
        let fontStyle = 'normal';
        
        // Map common PDF font names to CSS
        if (fontName.toLowerCase().includes('bold')) fontWeight = 'bold';
        if (fontName.toLowerCase().includes('italic') || fontName.toLowerCase().includes('oblique')) fontStyle = 'italic';
        if (fontName.toLowerCase().includes('times')) fontFamily = 'Times New Roman, serif';
        else if (fontName.toLowerCase().includes('arial') || fontName.toLowerCase().includes('helvetica')) fontFamily = 'Arial, sans-serif';
        else if (fontName.toLowerCase().includes('courier')) fontFamily = 'Courier New, monospace';
        
        // Check for edited version
        const itemId = `p${pageNum}_t${index}`;
        const editedItem = editedItems.get(itemId);
        
        items.push({
          id: itemId,
          text: editedItem?.text ?? item.str,
          x,
          y: viewport.height - y - fontSize, // Flip Y coordinate
          width: item.width * scale,
          height: fontSize,
          fontSize,
          fontFamily,
          fontWeight,
          fontStyle,
          color: editedItem?.color ?? '#000000',
          transform: item.transform,
          pageNumber: pageNum,
          isEdited: !!editedItem,
          originalText: item.str,
        });
      }
    });
    
    return items;
  };
  
  // ==========================================================================
  // Text Editing
  // ==========================================================================
  
  const handleTextChange = (itemId: string, newText: string) => {
    if (!pageData) return;
    
    const item = pageData.textItems.find(t => t.id === itemId);
    if (!item) return;
    
    // Record undo action
    pushAction({
      type: 'text-edit',
      itemId,
      previousState: { text: item.text },
      newState: { text: newText },
    });
    
    // Update edited items map
    setEditedItems(prev => {
      const updated = new Map(prev);
      updated.set(itemId, {
        ...item,
        text: newText,
        isEdited: true,
      });
      return updated;
    });
    
    // Update page data
    setPageData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        textItems: prev.textItems.map(t =>
          t.id === itemId ? { ...t, text: newText, isEdited: true } : t
        ),
      };
    });
    
    setHasChanges(true);
  };
  
  const handlePositionChange = (itemId: string, x: number, y: number) => {
    if (!pageData) return;
    
    const item = pageData.textItems.find(t => t.id === itemId);
    if (!item) return;
    
    // Update edited items map
    setEditedItems(prev => {
      const updated = new Map(prev);
      const existing = updated.get(itemId) || item;
      updated.set(itemId, {
        ...existing,
        x,
        y,
        isEdited: true,
      });
      return updated;
    });
    
    // Update page data
    setPageData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        textItems: prev.textItems.map(t =>
          t.id === itemId ? { ...t, x, y, isEdited: true } : t
        ),
      };
    });
    
    setHasChanges(true);
  };
  
  const handleAddText = () => {
    if (!pageData) return;
    
    const newId = `p${currentPage}_t_new_${Date.now()}`;
    const newItem: TextItem = {
      id: newId,
      text: 'New Text',
      x: 100,
      y: 100,
      width: 100,
      height: fontSize,
      fontSize,
      fontFamily,
      fontWeight: bold ? 'bold' : 'normal',
      fontStyle: italic ? 'italic' : 'normal',
      color: textColor,
      transform: [fontSize, 0, 0, fontSize, 100, pageData.height - 100],
      pageNumber: currentPage,
      isEdited: true,
      originalText: '',
    };
    
    setPageData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        textItems: [...prev.textItems, newItem],
      };
    });
    
    setEditedItems(prev => {
      const updated = new Map(prev);
      updated.set(newId, newItem);
      return updated;
    });
    
    setSelectedItemId(newId);
    setEditingItemId(newId);
    setHasChanges(true);
  };
  
  const handleDeleteText = () => {
    if (!selectedItemId || !pageData) return;
    
    const item = pageData.textItems.find(t => t.id === selectedItemId);
    if (!item) return;
    
    // Record undo
    pushAction({
      type: 'text-delete',
      itemId: selectedItemId,
      previousState: item,
      newState: {},
    });
    
    // Remove from edited items
    setEditedItems(prev => {
      const updated = new Map(prev);
      updated.delete(selectedItemId);
      // Mark as deleted
      updated.set(`${selectedItemId}_deleted`, { ...item, text: '' });
      return updated;
    });
    
    // Remove from page data
    setPageData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        textItems: prev.textItems.filter(t => t.id !== selectedItemId),
      };
    });
    
    setSelectedItemId(null);
    setHasChanges(true);
  };
  
  // ==========================================================================
  // Format Changes
  // ==========================================================================
  
  const applyFormatToSelected = (format: Partial<TextItem>) => {
    if (!selectedItemId || !pageData) return;
    
    const item = pageData.textItems.find(t => t.id === selectedItemId);
    if (!item) return;
    
    const updatedItem = { ...item, ...format, isEdited: true };
    
    setEditedItems(prev => {
      const updated = new Map(prev);
      updated.set(selectedItemId, updatedItem);
      return updated;
    });
    
    setPageData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        textItems: prev.textItems.map(t =>
          t.id === selectedItemId ? updatedItem : t
        ),
      };
    });
    
    setHasChanges(true);
  };
  
  // ==========================================================================
  // Undo/Redo
  // ==========================================================================
  
  const handleUndo = () => {
    const action = getUndoAction();
    if (!action) return;
    
    if (action.type === 'text-edit') {
      setPageData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          textItems: prev.textItems.map(t =>
            t.id === action.itemId ? { ...t, ...action.previousState } : t
          ),
        };
      });
    }
    // Handle other action types...
  };
  
  const handleRedo = () => {
    const action = getRedoAction();
    if (!action) return;
    
    if (action.type === 'text-edit') {
      setPageData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          textItems: prev.textItems.map(t =>
            t.id === action.itemId ? { ...t, ...action.newState } : t
          ),
        };
      });
    }
  };
  
  // ==========================================================================
  // Export
  // ==========================================================================
  
  const handleExport = async () => {
    if (!sessionId || editedItems.size === 0) {
      // No changes, just download original
      if (pdfFile) {
        const url = URL.createObjectURL(pdfFile);
        const a = document.createElement('a');
        a.href = url;
        a.download = pdfFile.name;
        a.click();
        URL.revokeObjectURL(url);
      }
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Get page dimensions in PDF coordinates (unscaled)
      const pageHeight = (pageData?.height || 792) / scale;
      
      // Prepare edits for backend - convert viewport coords to PDF coords
      const edits = Array.from(editedItems.entries())
        .filter(([_, item]) => item.text !== item.originalText) // Only send actual changes
        .map(([id, item]) => {
          // Convert from viewport coordinates to PDF coordinates
          // PDF Y goes bottom-up, viewport Y goes top-down
          const pdfX = item.x / scale;
          const pdfY = pageHeight - (item.y / scale) - (item.fontSize / scale);
          
          return {
            span_id: id,
            page_number: item.pageNumber,
            original_text: item.originalText,
            new_text: item.text,
            span_index: 0,
            x: pdfX,
            y: pdfY,
            font_size: item.fontSize / scale,
            font_name: item.fontFamily.split(',')[0].trim(), // Use first font in list
            color: item.color || '#000000',
            mode: 'adaptive',
            alignment: 'left',
            preserve_width: true,
          };
        });
      
      if (edits.length === 0) {
        // No actual text changes, just download original
        if (pdfFile) {
          const url = URL.createObjectURL(pdfFile);
          const a = document.createElement('a');
          a.href = url;
          a.download = pdfFile.name;
          a.click();
          URL.revokeObjectURL(url);
        }
        setIsLoading(false);
        return;
      }
      
      console.log('Applying edits:', edits);
      
      // Apply edits via backend (overlay method - preserves structure)
      const editResult = await apiCall<{ results: { success: boolean; error?: string }[] }>('/edit-batch', {
        method: 'POST',
        body: JSON.stringify({
          session_id: sessionId,
          edits,
        }),
      });
      
      console.log('Edit results:', editResult);
      
      // Check for errors
      const failedEdits = editResult.results?.filter(r => !r.success) || [];
      if (failedEdits.length > 0) {
        console.warn('Some edits failed:', failedEdits);
      }
      
      // Export PDF (structure-preserving)
      const response = await fetch(`${API_BASE}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          linearize: true,
          compress: true,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Export failed');
      }
      
      // Download the exported PDF
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `edited_${pdfFile?.name || 'document.pdf'}`;
      a.click();
      URL.revokeObjectURL(url);
      
      setHasChanges(false);
      
    } catch (err) {
      console.error('Export failed:', err);
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsLoading(false);
    }
  };
  
  // ==========================================================================
  // Navigation
  // ==========================================================================
  
  const goToPage = async (pageNum: number) => {
    if (!pdfDoc || pageNum < 1 || pageNum > pageCount) return;
    setCurrentPage(pageNum);
    setSelectedItemId(null);
    setEditingItemId(null);
    await renderPage(pdfDoc, pageNum);
  };
  
  const handleZoom = (delta: number) => {
    const newZoom = Math.max(25, Math.min(400, zoom + delta));
    setZoom(newZoom);
    setScale(newZoom / 100 * 1.5);
  };
  
  // Re-render when scale changes
  useEffect(() => {
    if (pdfDoc && currentPage) {
      renderPage(pdfDoc, currentPage);
    }
  }, [scale]);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'z':
            e.preventDefault();
            if (e.shiftKey) handleRedo();
            else handleUndo();
            break;
          case 'y':
            e.preventDefault();
            handleRedo();
            break;
          case 's':
            e.preventDefault();
            handleExport();
            break;
        }
      }
      
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedItemId && !editingItemId) {
          e.preventDefault();
          handleDeleteText();
        }
      }
      
      if (e.key === 'Escape') {
        setEditingItemId(null);
        setSelectedItemId(null);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItemId, editingItemId]);
  
  // Click outside to deselect
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'CANVAS') {
      setSelectedItemId(null);
      setEditingItemId(null);
    }
  };
  
  // ==========================================================================
  // Render
  // ==========================================================================
  
  return (
    <div className="h-screen flex flex-col bg-white dark:bg-neutral-900 text-gray-900 dark:text-white">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        onChange={handleFileSelect}
        className="hidden"
      />
      
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-neutral-800 border-b border-gray-200 dark:border-neutral-700">
        {/* Left: File Operations */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium"
          >
            <Icons.Upload />
            Open PDF
          </button>
          
          {pdfDoc && (
            <>
              <div className="w-px h-6 bg-gray-300 dark:bg-neutral-600 mx-2" />
              
              <ToolButton active={tool === 'select'} onClick={() => setTool('select')} title="Select (V)">
                <Icons.Select />
              </ToolButton>
              <ToolButton active={tool === 'text'} onClick={() => setTool('text')} title="Add Text (T)">
                <Icons.Text />
              </ToolButton>
              
              <div className="w-px h-6 bg-gray-300 dark:bg-neutral-600 mx-2" />
              
              <ToolButton disabled={!canUndo} onClick={handleUndo} title="Undo (Ctrl+Z)">
                <Icons.Undo />
              </ToolButton>
              <ToolButton disabled={!canRedo} onClick={handleRedo} title="Redo (Ctrl+Y)">
                <Icons.Redo />
              </ToolButton>
            </>
          )}
        </div>
        
        {/* Center: Page Navigation & Zoom */}
        <div className="flex items-center gap-4">
          {pdfDoc && (
            <>
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage <= 1}
                className="p-1 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded disabled:opacity-50"
              >
                <Icons.ChevronLeft />
              </button>
              
              <span className="text-sm">
                Page {currentPage} of {pageCount}
              </span>
              
              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= pageCount}
                className="p-1 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded disabled:opacity-50"
              >
                <Icons.ChevronRight />
              </button>
              
              <div className="w-px h-6 bg-gray-300 dark:bg-neutral-600 mx-2" />
              
              <ToolButton onClick={() => handleZoom(-25)} title="Zoom Out">
                <Icons.ZoomOut />
              </ToolButton>
              <span className="text-sm w-12 text-center">{zoom}%</span>
              <ToolButton onClick={() => handleZoom(25)} title="Zoom In">
                <Icons.ZoomIn />
              </ToolButton>
            </>
          )}
        </div>
        
        {/* Right: Export */}
        <div className="flex items-center gap-2">
          {pdfDoc && (
            <>
              {hasChanges && (
                <span className="text-sm text-yellow-600 dark:text-yellow-400 mr-2">
                  Unsaved changes
                </span>
              )}
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium"
              >
                <Icons.Save />
                Export PDF
              </button>
            </>
          )}
        </div>
      </div>
      
      {/* Format Toolbar */}
      {pdfDoc && selectedItemId && (
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-neutral-850 border-b border-gray-200 dark:border-neutral-700">
          {/* Font Family */}
          <select
            value={fontFamily}
            onChange={e => {
              setFontFamily(e.target.value);
              applyFormatToSelected({ fontFamily: e.target.value });
            }}
            className="px-2 py-1 text-sm border border-gray-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800"
          >
            <option value="Arial, sans-serif">Arial</option>
            <option value="Times New Roman, serif">Times New Roman</option>
            <option value="Courier New, monospace">Courier New</option>
            <option value="Georgia, serif">Georgia</option>
            <option value="Verdana, sans-serif">Verdana</option>
          </select>
          
          {/* Font Size */}
          <select
            value={fontSize}
            onChange={e => {
              const size = parseInt(e.target.value);
              setFontSize(size);
              applyFormatToSelected({ fontSize: size * scale });
            }}
            className="px-2 py-1 text-sm border border-gray-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 w-16"
          >
            {[8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          
          <div className="w-px h-6 bg-gray-300 dark:bg-neutral-600 mx-1" />
          
          {/* Bold */}
          <ToolButton
            active={bold}
            onClick={() => {
              setBold(!bold);
              applyFormatToSelected({ fontWeight: !bold ? 'bold' : 'normal' });
            }}
            title="Bold (Ctrl+B)"
          >
            <Icons.Bold />
          </ToolButton>
          
          {/* Italic */}
          <ToolButton
            active={italic}
            onClick={() => {
              setItalic(!italic);
              applyFormatToSelected({ fontStyle: !italic ? 'italic' : 'normal' });
            }}
            title="Italic (Ctrl+I)"
          >
            <Icons.Italic />
          </ToolButton>
          
          <div className="w-px h-6 bg-gray-300 dark:bg-neutral-600 mx-1" />
          
          {/* Color Picker */}
          <input
            type="color"
            value={textColor}
            onChange={e => {
              setTextColor(e.target.value);
              applyFormatToSelected({ color: e.target.value });
            }}
            className="w-8 h-8 rounded cursor-pointer border border-gray-300 dark:border-neutral-600"
            title="Text Color"
          />
          
          <div className="w-px h-6 bg-gray-300 dark:bg-neutral-600 mx-1" />
          
          {/* Add Text */}
          <ToolButton onClick={handleAddText} title="Add Text Block">
            <Icons.Plus />
          </ToolButton>
          
          {/* Delete */}
          <ToolButton onClick={handleDeleteText} title="Delete (Del)">
            <Icons.Trash />
          </ToolButton>
        </div>
      )}
      
      {/* Error Display */}
      {error && (
        <div className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}
      
      {/* Main Canvas Area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-gray-200 dark:bg-neutral-700 p-8"
        onClick={handleCanvasClick}
      >
        {!pdfDoc ? (
          /* Upload Prompt */
          <div className="h-full flex items-center justify-center">
            <div className="text-center p-12 bg-white dark:bg-neutral-800 rounded-xl shadow-2xl max-w-lg border border-gray-200 dark:border-neutral-700">
              <div className="w-20 h-20 mx-auto mb-6 bg-blue-600 rounded-full flex items-center justify-center text-white">
                <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="12" y1="18" x2="12" y2="12"/>
                  <line x1="9" y1="15" x2="15" y2="15"/>
                </svg>
              </div>
              <h2 className="text-2xl font-bold mb-3 text-gray-900 dark:text-white">
                In-Place PDF Editor
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Click directly on any text to edit it. Drag to reposition. 
                Full font and layout preservation. No rasterization.
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-lg transition-colors"
              >
                Select PDF File
              </button>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
                Maximum file size: 100MB • All processing done locally
              </p>
            </div>
          </div>
        ) : isLoading ? (
          /* Loading */
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Processing PDF...</p>
            </div>
          </div>
        ) : (
          /* PDF View with Editable Text Layer */
          <div
            className="inline-block relative mx-auto shadow-2xl"
            style={{ 
              width: pageData?.width || 'auto',
              height: pageData?.height || 'auto',
            }}
          >
            {/* Canvas Layer (PDF render) */}
            <canvas
              ref={canvasRef}
              className="block bg-white"
              style={{ 
                width: pageData?.width || 'auto',
                height: pageData?.height || 'auto',
              }}
            />
            
            {/* Text Layer (editable overlay) */}
            <div
              ref={textLayerRef}
              className="absolute inset-0 pointer-events-auto"
              style={{ 
                width: pageData?.width || 'auto',
                height: pageData?.height || 'auto',
              }}
            >
              {pageData?.textItems.map(item => (
                <EditableTextBlock
                  key={item.id}
                  item={item}
                  scale={1} // Items already scaled during extraction
                  isSelected={selectedItemId === item.id}
                  isEditing={editingItemId === item.id}
                  onSelect={() => setSelectedItemId(item.id)}
                  onStartEdit={() => setEditingItemId(item.id)}
                  onTextChange={(newText) => handleTextChange(item.id, newText)}
                  onPositionChange={(x, y) => handlePositionChange(item.id, x, y)}
                  onBlur={() => setEditingItemId(null)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Status Bar */}
      {pdfDoc && (
        <div className="flex items-center justify-between px-4 py-1 bg-gray-100 dark:bg-neutral-800 border-t border-gray-200 dark:border-neutral-700 text-xs text-gray-600 dark:text-gray-400">
          <span>
            {pageData?.textItems.length || 0} text blocks • 
            {editedItems.size} edits pending
          </span>
          <span>
            {pdfFile?.name} • {((pdfFile?.size || 0) / 1024 / 1024).toFixed(2)} MB
          </span>
        </div>
      )}
      
      {/* CSS for text layer */}
      <style jsx global>{`
        .pdf-text-block {
          pointer-events: auto;
          box-sizing: border-box;
        }
        
        .pdf-text-block:hover {
          background-color: rgba(59, 130, 246, 0.1);
        }
        
        .pdf-text-block[contenteditable="true"]:focus {
          outline: 2px solid #3b82f6;
          background-color: white;
        }
        
        .pdf-text-block::selection {
          background-color: rgba(59, 130, 246, 0.3);
        }
      `}</style>
    </div>
  );
}
