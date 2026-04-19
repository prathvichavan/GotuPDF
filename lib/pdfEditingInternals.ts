import { PDFDocument, PDFFont, StandardFonts, rgb } from 'pdf-lib';
import Tesseract from 'tesseract.js';

// Interface for TextItem used in merging
export interface TextItem {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontName: string;
  fontSize: number;
  fontWeight: string;
  fontStyle: string;
  fontFamily?: string; // Web-safe font family for UI
  color: string;
  transform: number[]; // Added to match usage
  pageNumber: number;
  originalText: string;
  /**
   * True when the text item came from OCR (image-based PDF).
   */
  isOcr?: boolean;
  /**
   * Index of the original PDF.js text item in the page's textContent.items array.
   * This is critical for exact, in-place content stream editing.
   */
  sourceIndex?: number;
  /**
   * When multiple items are merged, keep a list of original source indexes.
   */
  sourceIndexes?: number[];
  hasText?: boolean; // Optional flag
  originalItems?: TextItem[]; // For merged items
  contentStreamRef?: string; // Reference to content stream location
  textOperator?: string; // The PDF text operator (TJ, Tj, etc.)
  textBytes?: Uint8Array; // Raw text bytes from content stream
}

// ============================================================================
// 1. COORDINATE SYSTEM TRANSFORMATION
// ============================================================================

/**
 * PDF Coordinate System:
 * - Origin (0,0) at BOTTOM-LEFT
 * - Y increases upward
 *
 * Canvas Coordinate System:
 * - Origin (0,0) at TOP-LEFT
 * - Y increases downward
 *
 * Critical transformation for correct positioning:
 */

// When extracting text from PDF:
const extractTextPosition = (item: any, viewport: any, scale: number) => {
  const transform = item.transform; // [a, b, c, d, e, f]
  // e = x position, f = y position
  const pdfX = transform[4];
  const pdfY = transform[5];

  // Convert PDF coordinates to canvas coordinates
  const canvasX = pdfX * scale;
  const canvasY = (viewport.height - pdfY) * scale; // FLIP Y-AXIS

  return { x: canvasX, y: canvasY };
};

// When writing text back to PDF:
const convertToRDFCoordinates = (
  canvasX: number,
  canvasY: number,
  fontSize: number,
  pageHeight: number,
  scale: number
) => {
  // Convert canvas coordinates back to PDF coordinates
  const pdfX = canvasX / scale;
  const pdfY = pageHeight - (canvasY / scale) - (fontSize / scale);

  return { pdfX, pdfY };
};

// ============================================================================
// 2. FONT EXTRACTION AND MATCHING
// ============================================================================
// 4. CONTENT STREAM PARSING AND TEXT REPLACEMENT (TRUE PDF EDITING)
// ============================================================================

/**
 * Parse PDF content stream to extract text objects
 * This enables true PDF text editing by modifying content streams directly
 */

interface ContentStreamTextObject {
  operator: string; // TJ, Tj, etc.
  text: string;
  fontName: string;
  fontSize: number;
  position: { x: number; y: number };
  color?: number[];
  startOffset: number; // Position in content stream
  endOffset: number;
  streamIndex: number; // Which content stream in the page
  originalText: string; // Keep original for matching
  pageIndex: number;
}

const parseContentStream = (contentStream: Uint8Array, pageIndex: number = 0): ContentStreamTextObject[] => {
  const textObjects: ContentStreamTextObject[] = [];
  const stream = new TextDecoder().decode(contentStream);

  // Simple content stream parser for text operators
  // This is a basic implementation - real PDF content streams are complex
  const lines = stream.split('\n');

  let currentFont = '';
  let currentFontSize = 12;
  let currentPosition = { x: 0, y: 0 };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Parse font setting (Tf operator)
    const fontMatch = line.match(/\/(\w+)\s+(\d+(?:\.\d+)?)\s+Tf/);
    if (fontMatch) {
      currentFont = fontMatch[1];
      currentFontSize = parseFloat(fontMatch[2]);
      continue;
    }

    // Parse position setting (Tm operator - text matrix)
    const positionMatch = line.match(/(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+Tm/);
    if (positionMatch) {
      currentPosition.x = parseFloat(positionMatch[1]);
      currentPosition.y = parseFloat(positionMatch[2]);
      continue;
    }

    // Parse text showing operators
    if (line.includes('Tj') || line.includes('TJ')) {
      const textMatch = line.includes('TJ')
        ? line.match(/\[(.*?)\]\s*TJ/)
        : line.match(/\(([^)]+)\)\s*Tj/);

      if (textMatch) {
        const rawText = textMatch[1];
        // Decode PDF text encoding (basic implementation)
        const decodedText = decodePDFText(rawText);

        textObjects.push({
          operator: line.includes('TJ') ? 'TJ' : 'Tj',
          text: decodedText,
          originalText: decodedText,
          fontName: currentFont,
          fontSize: currentFontSize,
          position: { ...currentPosition },
          startOffset: stream.indexOf(line),
          endOffset: stream.indexOf(line) + line.length,
          streamIndex: 0, // Single stream assumption
          pageIndex,
        });
      }
    }
  }

  return textObjects;
};

// ============================================================================
// 3. COLOR EXTRACTION AND CONVERSION
// ============================================================================

/**
 * PDF colors are stored as RGB values from 0 to 1
 * We need to convert to hex for CSS and back to RGB for pdf-lib
 */

const pdfColorToHex = (pdfColor: number[]): string => {
  if (!pdfColor || pdfColor.length !== 3) {
    return '#000000'; // Default black
  }

  // Convert 0-1 range to 0-255
  const r = Math.round((pdfColor[0] || 0) * 255);
  const g = Math.round((pdfColor[1] || 0) * 255);
  const b = Math.round((pdfColor[2] || 0) * 255);

  // Convert to hex
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const hexToPdfColor = (hex: string): { r: number; g: number; b: number } => {
  // Parse hex color
  const match = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);

  if (!match) {
    return { r: 0, g: 0, b: 0 }; // Default black
  }

  // Convert to 0-1 range
  return {
    r: parseInt(match[1], 16) / 255,
    g: parseInt(match[2], 16) / 255,
    b: parseInt(match[3], 16) / 255,
  };
};

/**
 * Advanced PDF content stream parser that can handle real PDF syntax
 * This is crucial for true text editing without overlays
 */
const parsePDFContentStream = (contentStream: Uint8Array, pageIndex: number = 0): ContentStreamTextObject[] => {
  const textObjects: ContentStreamTextObject[] = [];
  const stream = new TextDecoder().decode(contentStream);

  // PDF content streams are complex and can have nested structures
  // We'll use a more sophisticated parser that handles the PDF syntax properly

  // Split by operators and process sequentially
  const tokens = tokenizeContentStream(stream);
  let currentFont = '';
  let currentFontSize = 12;
  let currentPosition = { x: 0, y: 0 };
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];

    // Font setting: /FontName size Tf
    if (token.startsWith('/') && tokens[i + 1] && !isNaN(parseFloat(tokens[i + 1])) && tokens[i + 2] === 'Tf') {
      currentFont = token.substring(1); // Remove leading /
      currentFontSize = parseFloat(tokens[i + 1]);
      i += 3;
      continue;
    }

    // Text matrix: a b c d e f Tm
    if (!isNaN(parseFloat(token)) && tokens.length >= i + 6) {
      const a = parseFloat(token);
      const b = parseFloat(tokens[i + 1]);
      const c = parseFloat(tokens[i + 2]);
      const d = parseFloat(tokens[i + 3]);
      const e = parseFloat(tokens[i + 4]);
      const f = parseFloat(tokens[i + 5]);

      if (tokens[i + 6] === 'Tm') {
        currentPosition.x = e;
        currentPosition.y = f;
        i += 7;
        continue;
      }
    }

    // Text showing operators
    if (token === 'Tj' || token === 'TJ') {
      let rawText = '';
      let startPos = i - 1; // Start from previous token

      if (token === 'Tj') {
        // Tj operator: (text) Tj
        if (tokens[i - 1] && tokens[i - 1].startsWith('(') && tokens[i - 1].endsWith(')')) {
          rawText = tokens[i - 1].slice(1, -1); // Remove parentheses
        }
      } else if (token === 'TJ') {
        // TJ operator: [text1 spacing1 text2 ...] TJ
        if (tokens[i - 1] && tokens[i - 1].startsWith('[') && tokens[i - 1].endsWith(']')) {
          // Parse TJ array - this is complex, simplified for now
          const tjArray = tokens[i - 1].slice(1, -1); // Remove brackets
          // Extract text portions (simplified)
          const textParts = tjArray.split('(').filter(p => p.includes(')'));
          rawText = textParts.map(p => p.split(')')[0]).join('');
        }
      }

      if (rawText) {
        const decodedText = decodePDFText(rawText);

        // Find the actual position in the original stream
        const searchText = token === 'Tj' ? `(${rawText}) Tj` : `[${rawText}] TJ`;
        const startOffset = stream.indexOf(searchText);
        const endOffset = startOffset + searchText.length;

        textObjects.push({
          operator: token,
          text: decodedText,
          originalText: decodedText,
          fontName: currentFont,
          fontSize: currentFontSize,
          position: { ...currentPosition },
          startOffset,
          endOffset,
          streamIndex: 0,
          pageIndex,
        });
      }
    }

    i++;
  }

  return textObjects;
};

/**
 * Tokenize PDF content stream into operators and operands
 */
const tokenizeContentStream = (stream: string): string[] => {
  const tokens: string[] = [];
  let current = '';
  let inString = false;
  let inArray = false;
  let stringChar = '';

  for (let i = 0; i < stream.length; i++) {
    const char = stream[i];

    // Handle strings
    if (!inString && (char === '(' || char === '[')) {
      if (current) {
        tokens.push(current.trim());
        current = '';
      }
      if (char === '(') {
        inString = true;
        stringChar = ')';
      } else {
        inArray = true;
        stringChar = ']';
      }
      current += char;
    } else if ((inString || inArray) && char === stringChar) {
      current += char;
      tokens.push(current);
      current = '';
      inString = false;
      inArray = false;
      stringChar = '';
    } else if (inString || inArray) {
      current += char;
    }
    // Handle whitespace as token separators
    else if (char === ' ' || char === '\n' || char === '\r' || char === '\t') {
      if (current) {
        tokens.push(current);
        current = '';
      }
    }
    // Handle operators (letters)
    else if (/[a-zA-Z]/.test(char)) {
      if (current && !/[a-zA-Z]/.test(current[0])) {
        tokens.push(current);
        current = '';
      }
      current += char;
    }
    // Handle numbers and other characters
    else {
      if (current && /[a-zA-Z]/.test(current[0])) {
        tokens.push(current);
        current = '';
      }
      current += char;
    }
  }

  if (current) {
    tokens.push(current);
  }

  return tokens.filter(t => t.trim() !== '');
};

/**
 * Decode PDF text encoding (simplified)
 * PDF text can be encoded with octal escapes, etc.
 */
const decodePDFText = (rawText: string): string => {
  // Handle octal escapes like \123
  let decoded = rawText.replace(/\\(\d{1,3})/g, (match, octal) => {
    return String.fromCharCode(parseInt(octal, 8));
  });

  // Handle escape sequences
  decoded = decoded.replace(/\\n/g, '\n');
  decoded = decoded.replace(/\\r/g, '\r');
  decoded = decoded.replace(/\\t/g, '\t');
  decoded = decoded.replace(/\\\\/g, '\\');
  decoded = decoded.replace(/\\\(/g, '(');
  decoded = decoded.replace(/\\\)/g, ')');

  return decoded;
};

/**
 * Encode text for PDF content stream
 */
const encodePDFText = (text: string): string => {
  // Escape special characters
  let encoded = text;
  encoded = encoded.replace(/\\/g, '\\\\');
  encoded = encoded.replace(/\(/g, '\\(');
  encoded = encoded.replace(/\)/g, '\\)');
  encoded = encoded.replace(/\n/g, '\\n');
  encoded = encoded.replace(/\r/g, '\\r');
  encoded = encoded.replace(/\t/g, '\\t');

  return encoded;
};

/**
 * Replace text in PDF content stream (true PDF text editing)
 */
const replaceTextInContentStream = (
  contentStream: Uint8Array,
  textObject: ContentStreamTextObject,
  newText: string
): Uint8Array => {
  const stream = new TextDecoder().decode(contentStream);

  // Find the text operator line
  const start = textObject.startOffset;
  const end = textObject.endOffset;
  const originalLine = stream.substring(start, end);

  // Replace the text content
  const encodedNewText = encodePDFText(newText);
  const newLine = originalLine.replace(
    /\(([^)]+)\)\s*Tj/,
    `(${encodedNewText}) Tj`
  ).replace(
    /\[(.*?)\]\s*TJ/,
    `[(${encodedNewText})] TJ`
  );

  // Reconstruct the content stream
  const newStream = stream.substring(0, start) + newLine + stream.substring(end);
  return new TextEncoder().encode(newStream);
};

/**
 * Extract embedded fonts from PDF and create font subsets
 */
const extractEmbeddedFonts = async (pdfDoc: PDFDocument) => {
  const fonts: { [key: string]: PDFFont } = {};

  // This is a simplified implementation
  // In a real implementation, you'd parse the PDF font objects
  try {
    // Try to extract embedded fonts (this is complex and requires parsing font objects)
    // For now, we'll use standard fonts as fallback
    fonts['Helvetica'] = await pdfDoc.embedFont(StandardFonts.Helvetica);
    fonts['Helvetica-Bold'] = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    fonts['Times-Roman'] = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    fonts['Courier'] = await pdfDoc.embedFont(StandardFonts.Courier);
  } catch (error) {
    console.warn('Font extraction failed, using defaults:', error);
  }

  return fonts;
};

/**
 * True PDF text editing: Modify content streams directly
 */
const editPDFContentStreams = async (
  pdfDoc: PDFDocument,
  edits: { pageIndex: number; textObjects: ContentStreamTextObject[]; newTexts: string[] }[]
) => {
  // This is a conceptual implementation
  // In practice, pdf-lib doesn't expose content stream modification easily
  // We'd need to use a lower-level PDF library or implement content stream reconstruction

  for (const edit of edits) {
    const page = pdfDoc.getPages()[edit.pageIndex];
    if (!page) continue;

    // Get the page's content streams (pdf-lib doesn't expose this directly)
    // This would require extending pdf-lib or using another library

    // For each text object to edit
    edit.textObjects.forEach((textObj, index) => {
      const newText = edit.newTexts[index];
      if (textObj.text !== newText) {
        // In a real implementation, we'd modify the content stream
        // For now, fall back to overlay approach
        console.log(`Would replace "${textObj.text}" with "${newText}" in content stream`);
      }
    });
  }
};

// ============================================================================
// 5. ENHANCED TEXT DETECTION WITH CONTENT STREAM AWARENESS
// ============================================================================

/**
 * Enhanced text detection that also captures content stream information
 */
const detectTextWithContentStreams = async (pdf: any, pageNum: number, scale: number = 1.5) => {
  try {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const textContent = await page.getTextContent();

    const items: TextItem[] = [];
    let hasText = false;

    // Also try to get content streams (if available)
    let contentStreamObjects: ContentStreamTextObject[] = [];
    try {
      // This would require additional PDF parsing libraries
      // For now, we'll work with what PDF.js provides
    } catch (error) {
      console.warn('Content stream parsing not available:', error);
    }

    textContent.items.forEach((item: any, index: number) => {
      if (item.str.trim() === '') return;

      hasText = true;

      // Extract transform matrix for positioning
      const transform = item.transform;

      // Correctly calculate position converting from PDF (bottom-left) to Canvas (top-left)
      const pdfX = transform[4];
      const pdfY = transform[5];
      const fontSizePdf = Math.abs(transform[3]);

      const x = pdfX * scale;
      const y = viewport.height - (pdfY * scale) - (fontSizePdf * scale);

      // Enhanced font detection
      const fontName = item.fontName || 'Helvetica';
      const fontSize = Math.abs(transform[3]) || 12;

      // Detect font weight and style
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

      // Estimate dimensions
      const width = item.width * scale;
      const height = item.height * scale;

      // Try to find corresponding content stream object
      const contentObj = contentStreamObjects.find(obj =>
        obj.text === item.str &&
        Math.abs(obj.position.x - pdfX) < 1 &&
        Math.abs(obj.position.y - pdfY) < 1
      );

      items.push({
        id: `text-${pageNum}-${index}`,
        text: item.str,
        x: x,
        y: y,
        width,
        height,
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
        contentStreamRef: contentObj?.operator,
        textOperator: contentObj?.operator,
        textBytes: contentObj ? new TextEncoder().encode(contentObj.text) : undefined,
      });
    });

    // If no text found, might be scanned PDF
    if (!hasText) {
      // OCR handling (existing implementation)
      return { items: [], hasText: false };
    }

    // Merge text items
    const mergedItems = mergeTextItems(items, scale);
    return { items: mergedItems, hasText: true };

  } catch (error) {
    console.error('Error detecting text:', error);
    return { items: [], hasText: false };
  }
};

// ============================================================================
// 6. TRUE PDF TEXT REPLACEMENT
// ============================================================================

/**
 * Replace text in PDF by modifying content streams (true editing)
 * This is the core of Phase 2 implementation
 */
const replaceTextInPDFStreams = async (
  pdfDoc: PDFDocument,
  textItems: TextItem[]
) => {
  // Group edits by page
  const editsByPage: { [pageNum: number]: TextItem[] } = {};
  textItems.forEach(item => {
    if (item.text !== item.originalText) {
      if (!editsByPage[item.pageNumber]) {
        editsByPage[item.pageNumber] = [];
      }
      editsByPage[item.pageNumber].push(item);
    }
  });

  // For now, fall back to overlay approach since content stream modification
  // requires more complex PDF parsing that pdf-lib doesn't provide
  // In a production implementation, you'd use a library like pdf-parse + pdfkit

  console.log('True PDF text editing would modify content streams for:', editsByPage);

  // Return the PDF doc for overlay-based editing as fallback
  return pdfDoc;
};

// ============================================================================
// 7. OCR FOR SCANNED PDFs
// ============================================================================

/**
 * When PDF has no text content (image-based), use OCR
 */

const detectIfScanned = (textContent: any): boolean => {
  // If no text items found, it's likely scanned
  return !textContent.items || textContent.items.length === 0;
};

const performOCROnPage = async (
  page: any,
  viewport: any,
  scale: number
): Promise<TextItem[]> => {
  // Step 1: Render page to canvas
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvasContext: context, viewport }).promise;

  // Step 2: Convert canvas to image data
  const imageData = canvas.toDataURL('image/png');

  // Step 3: Run OCR
  const result = await Tesseract.recognize(imageData, 'eng', {
    logger: (info) => console.log('OCR Progress:', info.progress),
  });

  // Step 4: Convert OCR words to TextItem objects
  const textItems: TextItem[] = [];
  const words = (result.data as any).words || [];

  words.forEach((word: any, index: number) => {
    const bbox = word.bbox;
    textItems.push({
      id: `ocr-${index}`,
      text: word.text,
      x: bbox.x0 * scale,
      y: bbox.y0 * scale,
      width: (bbox.x1 - bbox.x0) * scale,
      height: (bbox.y1 - bbox.y0) * scale,
      fontName: 'Helvetica',
      fontSize: (bbox.y1 - bbox.y0) * scale,
      fontWeight: 'normal',
      fontStyle: 'normal',
      color: '#000000',
      transform: [1, 0, 0, 1, bbox.x0, bbox.y0],
      pageNumber: 1,
      originalText: word.text,
    });
  });

  return textItems;
};

// ============================================================================
// 8. SCALE-AWARE POSITIONING
// ============================================================================

/**
 * Handle zoom/scale while maintaining position accuracy
 */

const calculateScaledPosition = (
  originalX: number,
  originalY: number,
  fromScale: number,
  toScale: number
): { x: number; y: number } => {
  // Convert to scale-independent coordinates
  const normalizedX = originalX / fromScale;
  const normalizedY = originalY / fromScale;

  // Apply new scale
  return {
    x: normalizedX * toScale,
    y: normalizedY * toScale,
  };
};

// ============================================================================
// 9. HISTORY MANAGEMENT (UNDO/REDO)
// ============================================================================

/**
 * Implement undo/redo with deep cloning
 */

interface HistoryManager {
  states: TextItem[][];
  currentIndex: number;
}

const saveState = (
  manager: HistoryManager,
  textItems: TextItem[]
): void => {
  // Remove future states if we're not at the end
  manager.states = manager.states.slice(0, manager.currentIndex + 1);

  // Add new state (deep clone)
  manager.states.push(JSON.parse(JSON.stringify(textItems)));
  manager.currentIndex = manager.states.length - 1;
};

const undo = (manager: HistoryManager): TextItem[] | null => {
  if (manager.currentIndex > 0) {
    manager.currentIndex--;
    return JSON.parse(JSON.stringify(manager.states[manager.currentIndex]));
  }
  return null;
};

const redo = (manager: HistoryManager): TextItem[] | null => {
  if (manager.currentIndex < manager.states.length - 1) {
    manager.currentIndex++;
    return JSON.parse(JSON.stringify(manager.states[manager.currentIndex]));
  }
  return null;
};

// ============================================================================
// 10. EXPORT OPTIMIZATION
// ============================================================================

/**
 * Optimize PDF export for best compatibility
 */

const exportOptimizedPDF = async (pdfDoc: PDFDocument): Promise<Uint8Array> => {
  return await pdfDoc.save({
    // Don't use object streams (better compatibility)
    useObjectStreams: false,

    // Don't add default page
    addDefaultPage: false,

    // Update metadata
    updateFieldAppearances: true,
  });
};

// ============================================================================
// 11. TEXT MERGING (SOLVES OVERLAPPING/FRAGMENTATION)
// ============================================================================

/**
 * Merges close/adjacent text items into single editable blocks
 * This prevents the "fragmented editing" experience
 */
const mergeTextItems = (items: TextItem[], scale: number): TextItem[] => {
  if (items.length === 0) return [];

  // Sort by Y (descending - top to bottom) then X (ascending - left to right)
  // Note: Y is usually bottom-up in PDF, but we've already converted to canvas Y (top-down) in detectText?
  // Let's assume input items have canvas Y (top=0).
  const sorted = [...items].sort((a, b) => {
    const yDiff = Math.abs(a.y - b.y);
    if (yDiff > 5) { // Tolerance for "same line"
      return a.y - b.y;
    }
    return a.x - b.x;
  });

  const merged: TextItem[] = [];
  let currentBlock: TextItem | null = null;

  sorted.forEach((item) => {
    if (!currentBlock) {
      currentBlock = {
        ...item,
        originalItems: [item],
        sourceIndexes: item.sourceIndexes ?? (item.sourceIndex !== undefined ? [item.sourceIndex] : []),
      };
      return;
    }

    // Check if on same line
    const yDiff = Math.abs(item.y - currentBlock.y);
    const sameLine = yDiff <= (item.height * 0.5); // 50% height tolerance

    // Check if distinct columns or far apart
    const xGap = item.x - (currentBlock.x + currentBlock.width);
    const isClose = xGap > -(item.fontSize * 0.5) && xGap < (item.fontSize * 2); // Allow slight overlap or 2-char space

    // Check if style matches (optional, but good for consistent editing)
    const sameStyle =
      item.fontName === currentBlock.fontName &&
      Math.abs(item.fontSize - currentBlock.fontSize) < 1 &&
      item.color === currentBlock.color;

    if (sameLine && isClose && sameStyle) {
      // Merge
      // Add space if gap detects it
      const hasSpace = xGap > (item.fontSize * 0.2);
      const separator = hasSpace ? ' ' : '';

      currentBlock.text += separator + item.text;
      currentBlock.originalText += separator + item.originalText;

      // Update width (simple addition + gap, or bounding box)
      // Bounding box approach is safer
      const newRight = item.x + item.width;
      currentBlock.width = newRight - currentBlock.x;

      // Keep track of originals
      if (!currentBlock.originalItems) currentBlock.originalItems = [];
      currentBlock.originalItems.push(item);
      const nextSources = item.sourceIndexes ?? (item.sourceIndex !== undefined ? [item.sourceIndex] : []);
      currentBlock.sourceIndexes = Array.from(new Set([...(currentBlock.sourceIndexes || []), ...nextSources]));

    } else {
      // Push current and start new
      merged.push(currentBlock);
      currentBlock = {
        ...item,
        originalItems: [item],
        sourceIndexes: item.sourceIndexes ?? (item.sourceIndex !== undefined ? [item.sourceIndex] : []),
      };
    }
  });

  if (currentBlock) {
    merged.push(currentBlock);
  }

  return merged;
};

export {
  extractTextPosition,
  convertToRDFCoordinates,
  pdfColorToHex,
  hexToPdfColor,
  parseContentStream,
  parsePDFContentStream,
  tokenizeContentStream,
  decodePDFText,
  encodePDFText,
  replaceTextInContentStream,
  extractEmbeddedFonts,
  editPDFContentStreams,
  detectTextWithContentStreams,
  replaceTextInPDFStreams,
  detectIfScanned,
  performOCROnPage,
  calculateScaledPosition,
  saveState,
  undo,
  redo,
  exportOptimizedPDF,
  mergeTextItems,
};
