// PDF Processing Web Worker
// Handles heavy PDF operations off the main thread

importScripts('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');

// Configure PDF.js worker (disable nested worker inside this worker)
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

// State to hold the loaded PDF document
let currentPDF = null;

// Lazy load Tesseract only when needed
let tesseractLoaded = false;
let Tesseract = null;

async function loadTesseract() {
  if (!tesseractLoaded) {
    // Load Tesseract from CDN for worker
    importScripts('https://cdn.jsdelivr.net/npm/tesseract.js@5.0.4/dist/tesseract.min.js');
    Tesseract = self.Tesseract || self.Tesseract;
    tesseractLoaded = true;
  }
  return Tesseract;
}

// ============================================================================
// PDF LOADING AND PARSING (OFF MAIN THREAD)
// ============================================================================

/**
 * Load and parse PDF document with memory optimization
 */
async function loadPDF(arrayBuffer, options = {}) {
  const {
    disableStream = false,
    disableAutoFetch = false,
    maxPages = null
  } = options;

  try {
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      disableStream: arrayBuffer.byteLength > 5 * 1024 * 1024 || disableStream,
      disableAutoFetch: arrayBuffer.byteLength > 5 * 1024 * 1024 || disableAutoFetch,
    });

    const pdf = await loadingTask.promise;
    currentPDF = pdf; // Store in worker state

    // Limit pages for large PDFs to prevent memory issues
    const numPages = maxPages ? Math.min(pdf.numPages, maxPages) : pdf.numPages;

    return {
      // Do NOT return the PDF object itself as it's not transferable
      numPages,
      info: {
        title: pdf.info?.Title || '',
        author: pdf.info?.Author || '',
        pages: numPages,
        originalPages: pdf.numPages
      },
      workerLoaded: true
    };
  } catch (error) {
    throw new Error(`PDF loading failed: ${error.message}`);
  }
}

/**
 * Render PDF page to image data for OCR
 */
async function renderPageForOCR(pdf, pageNum, scale = 1.5) {
  try {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    // Create offscreen canvas
    const canvas = new OffscreenCanvas(viewport.width, viewport.height);
    const context = canvas.getContext('2d');

    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };

    await page.render(renderContext).promise;
    return canvas;
  } catch (error) {
    throw new Error(`Page rendering failed: ${error.message}`);
  }
}

/**
 * Extract text content from PDF page
 */
async function extractTextFromPage(pageNum, scale = 1.5) {
  if (!currentPDF) {
    throw new Error("No PDF loaded in worker");
  }

  try {
    const page = await currentPDF.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const textContent = await page.getTextContent();

    // Check if page has text
    const hasText = textContent.items && textContent.items.length > 0 &&
      textContent.items.some(item => item.str && item.str.trim() !== '');

    if (!hasText) {
      return { items: [], hasText: false };
    }

    // Process text items
    const items = textContent.items.map((item, index) => {
      if (!item.str || item.str.trim() === '') return null;

      const transform = item.transform;
      const pdfX = transform[4];
      const pdfY = transform[5];
      const fontSizePdf = Math.abs(transform[3]);

      const x = pdfX * scale;
      const y = viewport.height - (pdfY * scale) - (fontSizePdf * scale);

      // Extract font info
      const fontName = item.fontName || 'Helvetica';
      const fontSize = Math.abs(transform[3]) || 12;
      let fontWeight = 'normal';
      let fontStyle = 'normal';
      const lowerFontName = fontName.toLowerCase();

      if (lowerFontName.includes('bold')) fontWeight = 'bold';
      if (lowerFontName.includes('italic') || lowerFontName.includes('oblique')) fontStyle = 'italic';

      // Map to web-safe font family
      let fontFamily = 'Arial, Helvetica, sans-serif';
      if (lowerFontName.includes('times') || lowerFontName.includes('serif')) {
        fontFamily = 'Georgia, "Times New Roman", Times, serif';
      } else if (lowerFontName.includes('courier') || lowerFontName.includes('mono')) {
        fontFamily = '"Courier New", Courier, monospace';
      }

      // Extract color
      let color = '#000000';
      try {
        if (item.color && Array.isArray(item.color)) {
          const r = Math.round((item.color[0] || 0) * 255);
          const g = Math.round((item.color[1] || 0) * 255);
          const b = Math.round((item.color[2] || 0) * 255);
          color = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        }
      } catch (e) {
        // Keep default black
      }

      return {
        id: `text-${pageNum}-${index}`,
        text: item.str,
        x: x,
        y: y,
        width: item.width * scale,
        height: item.height * scale,
        fontName,
        fontSize: fontSize * scale,
        fontWeight,
        fontStyle,
        fontFamily,
        color,
        transform,
        pageNumber: pageNum,
        originalText: item.str,
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

/**
 * Perform OCR on a page
 */
async function performOCR(pageNum, scale = 1.5) {
  if (!currentPDF) {
    throw new Error("No PDF loaded in worker");
  }

  try {
    // Load Tesseract lazily
    const tesseract = await loadTesseract();

    // Render page
    const canvas = await renderPageForOCR(currentPDF, pageNum, scale);

    // Convert to blob for Tesseract
    const blob = await canvas.convertToBlob();
    const imageData = await blob.arrayBuffer();

    // Perform OCR
    const result = await tesseract.recognize(new Uint8Array(imageData), 'eng', {
      logger: (info) => {
        // Could send progress updates back to main thread
        if (info.progress) {
          self.postMessage({
            type: 'ocr_progress',
            progress: Math.round(info.progress * 100),
            pageNum
          });
        }
      }
    });

    // Convert to text items
    const items = [];
    const words = result.data.words || [];

    words.forEach((word, index) => {
      const bbox = word.bbox;
      items.push({
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
      });
    });

    return items;
  } catch (error) {
    throw new Error(`OCR failed: ${error.message}`);
  }
}

/**
 * Merge text items into editable blocks
 */
function mergeTextItems(items, scale) {
  if (!items || items.length === 0) return [];

  const sorted = [...items].sort((a, b) => {
    const yDiff = Math.abs(a.y - b.y);
    if (yDiff > 5) {
      return a.y - b.y;
    }
    return a.x - b.x;
  });

  const merged = [];
  let currentBlock = null;

  sorted.forEach((item) => {
    if (!currentBlock) {
      currentBlock = {
        ...item,
        originalItems: [item],
        sourceIndexes: item.sourceIndexes || (typeof item.sourceIndex === 'number' ? [item.sourceIndex] : []),
      };
      return;
    }

    const yDiff = Math.abs(item.y - currentBlock.y);
    const sameLine = yDiff <= (item.height * 0.5);
    const xGap = item.x - (currentBlock.x + currentBlock.width);
    const isClose = xGap > -(item.fontSize * 0.5) && xGap < (item.fontSize * 2);
    const sameStyle =
      item.fontName === currentBlock.fontName &&
      Math.abs(item.fontSize - currentBlock.fontSize) < 1 &&
      item.color === currentBlock.color;

    if (sameLine && isClose && sameStyle) {
      const hasSpace = xGap > (item.fontSize * 0.2);
      const separator = hasSpace ? ' ' : '';
      currentBlock.text += separator + item.text;
      currentBlock.originalText += separator + item.originalText;
      const newRight = item.x + item.width;
      currentBlock.width = newRight - currentBlock.x;
      if (!currentBlock.originalItems) currentBlock.originalItems = [];
      currentBlock.originalItems.push(item);
      const nextSources = item.sourceIndexes || (typeof item.sourceIndex === 'number' ? [item.sourceIndex] : []);
      currentBlock.sourceIndexes = Array.from(new Set([...(currentBlock.sourceIndexes || []), ...nextSources]));
    } else {
      merged.push(currentBlock);
      currentBlock = {
        ...item,
        originalItems: [item],
        sourceIndexes: item.sourceIndexes || (typeof item.sourceIndex === 'number' ? [item.sourceIndex] : []),
      };
    }
  });

  if (currentBlock) {
    merged.push(currentBlock);
  }

  return merged;
}

// ============================================================================
// MESSAGE HANDLER
// ============================================================================

self.onmessage = async function (e) {
  const { type, data, messageId } = e.data;

  try {
    let result;

    switch (type) {
      case 'load_pdf':
        result = await loadPDF(data.arrayBuffer, data.options);
        break;

      case 'extract_text':
        // Note: data.pdf is ignored, uses currentPDF
        result = await extractTextFromPage(data.pageNum, data.scale);
        break;

      case 'perform_ocr':
        // Note: data.pdf is ignored, uses currentPDF
        result = await performOCR(data.pageNum, data.scale);
        break;

      case 'merge_text':
        result = mergeTextItems(data.items, data.scale);
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }

    // Send success response
    self.postMessage({
      type: 'success',
      messageId,
      result
    });

  } catch (error) {
    // Send error response
    self.postMessage({
      type: 'error',
      messageId,
      error: error.message || String(error)
    });
  }
};

// ============================================================================
// MEMORY MANAGEMENT
// ============================================================================

// Periodic cleanup to prevent memory leaks
setInterval(() => {
  if (self.gc) {
    self.gc(); // Force garbage collection if available
  }
}, 30000); // Every 30 seconds
