// PDF Worker Manager
// Handles communication with the PDF processing web worker

interface PDFWorkerResponse {
  type: 'success' | 'error' | 'ocr_progress';
  messageId: number;
  result?: any;
  error?: string;
  progress?: number;
  pageNum?: number;
}

class PDFWorkerManager {
  private worker: Worker | null = null;
  private messageId = 0;
  private pendingRequests = new Map<number, { resolve: Function; reject: Function }>();
  private workerLoaded = false;
  private static readonly ENABLE_CUSTOM_PDF_WORKER = false; // PDF.js main build relies on window/document; fails inside our custom worker.

  constructor() {
    this.initializeWorker();
  }

  private initializeWorker() {
    if (typeof window === 'undefined') return; // SSR safety
    if (!PDFWorkerManager.ENABLE_CUSTOM_PDF_WORKER) return;

    try {
      this.worker = new Worker('/pdf-worker.js');

      // Handle messages from worker
      this.worker.onmessage = (e) => {
        const { type, messageId, result, error } = e.data as PDFWorkerResponse;

        if (type === 'success' && this.pendingRequests.has(messageId)) {
          const { resolve } = this.pendingRequests.get(messageId)!;
          this.pendingRequests.delete(messageId);
          resolve(result);
        } else if (type === 'error' && this.pendingRequests.has(messageId)) {
          const { reject } = this.pendingRequests.get(messageId)!;
          this.pendingRequests.delete(messageId);
          reject(new Error(error));
        } else if (type === 'ocr_progress') {
          console.log(`OCR Progress: ${e.data.progress}% (Page ${e.data.pageNum})`);
        }
      };

      this.worker.onerror = (error) => {
        console.error('Worker error:', error);
        // Note: Do not reject all pending requests immediately on minor errors,
        // but if the worker crashes (error is generic), we might needed to restart or fail.
        // For now, simple logging.
        this.workerLoaded = false;
      };

      this.workerLoaded = true;

    } catch (error) {
      console.error('Failed to initialize PDF worker:', error);
      this.workerLoaded = false;
    }
  }

  private async postMessage(type: string, data: any): Promise<any> {
    if (!this.worker) {
      throw new Error('Worker not initialized');
    }

    const messageId = this.messageId++;
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(messageId, { resolve, reject });
      this.worker!.postMessage({
        type,
        messageId,
        data
      });
    });
  }

  // Load PDF document
  async loadPDF(arrayBuffer: ArrayBuffer, options?: any): Promise<any> {
    if (!this.worker || !this.workerLoaded) {
      console.warn('Worker not available, processing on main thread');
      return this.fallbackLoadPDF(arrayBuffer, options);
    }

    try {
      // Send to worker
      const result = await this.postMessage('load_pdf', { arrayBuffer, options });

      // Mark result as worker-loaded so we know to use worker for subsequent calls
      return {
        ...result,
        workerSessionId: true // Marker
      };
    } catch (error) {
      console.error('Worker PDF loading failed:', error);
      return this.fallbackLoadPDF(arrayBuffer, options);
    }
  }

  // Extract text from page
  async extractTextFromPage(pdf: any, pageNum: number, scale = 1.5): Promise<any> {
    // If PDF was loaded via worker (has marker), use worker
    if (pdf && pdf.workerSessionId && this.worker) {
      try {
        return await this.postMessage('extract_text', { pageNum, scale });
      } catch (error) {
        console.error('Worker text extraction failed:', error);
        // Fallback might fail if we don't have the real PDF object, 
        // but we can try if 'pdf' happens to have the object attached (unlikely in this design)
        if (pdf.pdfDoc) return this.fallbackExtractText(pdf.pdfDoc, pageNum, scale);
        return { items: [], hasText: false };
      }
    }

    // Direct fallback if not worker loaded
    const pdfDoc = pdf.pdfDoc || pdf;
    return this.fallbackExtractText(pdfDoc, pageNum, scale);
  }

  // Perform OCR
  async performOCR(pdf: any, pageNum: number, scale = 1.5): Promise<any> {
    if (pdf && pdf.workerSessionId && this.worker) {
      try {
        return await this.postMessage('perform_ocr', { pageNum, scale });
      } catch (error) {
        console.error('Worker OCR failed:', error);
        // fallback
        const pdfDoc = pdf.pdfDoc || pdf;
        return this.fallbackPerformOCR(pdfDoc, pageNum, scale);
      }
    }

    const pdfDoc = pdf.pdfDoc || pdf;
    return this.fallbackPerformOCR(pdfDoc, pageNum, scale);
  }

  // Merge text items
  async mergeTextItems(items: any[], scale: number): Promise<any[]> {
    if (this.worker && this.workerLoaded) {
      try {
        return await this.postMessage('merge_text', { items, scale });
      } catch (error) {
        console.warn('Worker merge failed, using fallback');
      }
    }
    return this.fallbackMergeTextItems(items, scale);
  }

  // ============================================================================
  // FALLBACK METHODS (MAIN THREAD PROCESSING)
  // ============================================================================

  private async fallbackLoadPDF(arrayBuffer: ArrayBuffer, options: any = {}): Promise<any> {
    // Import PDF.js dynamically for lazy loading
    const pdfjsLib = await import('pdfjs-dist');

    if (typeof window !== 'undefined') {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    }

    const { disableStream = false, disableAutoFetch = false, maxPages = null } = options;

    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      disableStream: arrayBuffer.byteLength > 5 * 1024 * 1024 || disableStream,
      disableAutoFetch: arrayBuffer.byteLength > 5 * 1024 * 1024 || disableAutoFetch,
    });

    const pdf = await loadingTask.promise;
    const numPages = maxPages ? Math.min(pdf.numPages, maxPages) : pdf.numPages;

    return {
      pdfDoc: pdf,
      numPages,
      info: {
        title: '',
        author: '',
        pages: numPages,
        originalPages: pdf.numPages
      }
    };
  }

  private async fallbackExtractText(pdf: any, pageNum: number, scale = 1.5): Promise<any> {
    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const textContent = await page.getTextContent();

      const hasText = textContent.items && textContent.items.length > 0 &&
        textContent.items.some((item: any) => item.str && item.str.trim() !== '');

      if (!hasText) {
        return { items: [], hasText: false };
      }

      const items = textContent.items.map((item: any, index: number) => {
        if (!item.str || item.str.trim() === '') return null;

        const transform = item.transform;
        const pdfX = transform[4];
        const pdfY = transform[5];
        const fontSizePdf = Math.abs(transform[3]);

        const x = pdfX * scale;
        const y = viewport.height - (pdfY * scale) - (fontSizePdf * scale);

        const fontName = item.fontName || 'Helvetica';
        const fontSize = Math.abs(transform[3]) || 12;
        let fontWeight = 'normal';
        let fontStyle = 'normal';
        const lowerFontName = fontName.toLowerCase();

        if (lowerFontName.includes('bold')) fontWeight = 'bold';
        if (lowerFontName.includes('italic') || lowerFontName.includes('oblique')) fontStyle = 'italic';

        let fontFamily = 'Arial, Helvetica, sans-serif';
        if (lowerFontName.includes('times') || lowerFontName.includes('serif')) {
          fontFamily = 'Georgia, "Times New Roman", Times, serif';
        } else if (lowerFontName.includes('courier') || lowerFontName.includes('mono')) {
          fontFamily = '"Courier New", Courier, monospace';
        }

        let color = '#000000';
        try {
          if (item.color && Array.isArray(item.color)) {
            const r = Math.round((item.color[0] || 0) * 255);
            const g = Math.round((item.color[1] || 0) * 255);
            const b = Math.round((item.color[2] || 0) * 255);
            color = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
          }
        } catch (e) { }

        return {
          id: `text-${pageNum}-${index}`,
          text: item.str,
          x, y,
          width: item.width * scale,
          height: item.height * scale,
          fontName, fontSize: fontSize * scale, fontWeight, fontStyle, fontFamily, color,
          transform, pageNumber: pageNum, originalText: item.str,
          sourceIndex: index,
          sourceIndexes: [index],
        };
      }).filter(Boolean);

      return { items, hasText: true };
    } catch (error) {
      console.error('Text extraction error:', error);
      return { items: [], hasText: false };
    }
  }

  private async fallbackPerformOCR(pdf: any, pageNum: number, scale = 1.5): Promise<any[]> {
    try {
      // Lazy load Tesseract
      const Tesseract = await import('tesseract.js');

      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      // Create canvas for rendering
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d')!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: context, viewport }).promise;

      const result = await Tesseract.recognize(canvas, 'eng', {
        logger: (info) => console.log('OCR Progress:', info.progress),
      });

      const items = ((result.data as any).words || []).map((word: any, index: number) => {
        const bbox = word.bbox;
        return {
          id: `ocr-${pageNum}-${index}`,
          text: word.text,
          x: bbox.x0 * scale,
          y: bbox.y0 * scale,
          width: (bbox.x1 - bbox.x0) * scale,
          height: (bbox.y1 - bbox.y0) * scale,
          fontName: 'Helvetica',
          fontSize: (bbox.y1 - bbox.y0) * scale,
          fontWeight: 'normal',
          fontStyle: 'normal',
          fontFamily: 'Arial, Helvetica, sans-serif',
          color: '#000000',
          transform: [1, 0, 0, 1, bbox.x0, bbox.y0],
          pageNumber: pageNum,
          originalText: word.text,
        };
      });

      return items;
    } catch (error) {
      console.error('OCR error:', error);
      return [];
    }
  }

  private fallbackMergeTextItems(items: any[], scale: number): any[] {
    // Import the merge function
    const { mergeTextItems } = require('../lib/pdfEditingInternals');
    return mergeTextItems(items, scale);
  }

  // Cleanup
  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pendingRequests.clear();
    this.workerLoaded = false;
  }
}

// Singleton instance
let workerManager: PDFWorkerManager | null = null;

export function getPDFWorkerManager(): PDFWorkerManager {
  if (!workerManager) {
    workerManager = new PDFWorkerManager();
  }
  return workerManager;
}

export { PDFWorkerManager };
