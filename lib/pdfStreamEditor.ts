import {
    PDFArray,
    PDFDict,
    PDFDocument,
    PDFName,
    PDFRawStream,
    PDFRef,
    decodePDFRawStream,
} from "pdf-lib";

/**
 * Edit request structure for exact, in-place PDF text replacement.
 * This is intentionally strict to preserve 1:1 visual fidelity.
 */
export interface ExactTextEdit {
    pageNumber: number; // 1-based
    sourceIndex: number; // PDF.js textContent.items index (per page)
    originalText: string;
    text: string;
    x?: number;
    y?: number;
    transform?: number[];
}

interface Token {
    type: "string" | "array" | "name" | "number" | "operator" | "hex" | "other";
    value: string;
    start: number;
    end: number;
}

interface FontEncoding {
    name: string;
    toUnicodeMap?: Map<string, string>;
    reverseUnicodeMap?: Map<string, Uint8Array>;
    codeByteLengths: number[];
    maxUnicodeLen: number;
    simpleEncoding: "latin1" | "utf16be" | null;
}

interface TextRun {
    decodedText: string;
    streamIndex: number;
    literalStart: number;
    literalEnd: number;
    literalType: "literal" | "hex";
    editable: boolean;
    originalBytes: Uint8Array;
    codeCount: number;
    encoding: FontEncoding | null;
    position: { x: number; y: number } | null;
}

interface StreamEntry {
    index: number;
    ref: PDFRef | null;
    stream: PDFRawStream;
}

/**
 * Apply exact, in-place text edits by modifying PDF content streams directly.
 * Only safe, strictly matched edits are permitted.
 */
export async function applyExactTextEdits(
    pdfBytes: Uint8Array,
    edits: ExactTextEdit[]
): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const editsByPage = groupEditsByPage(edits);

    for (const [pageNumber, pageEdits] of Object.entries(editsByPage)) {
        const pageIndex = Number(pageNumber) - 1;
        const page = pages[pageIndex];
        if (!page) {
            throw new Error(`Page ${pageNumber} not found in PDF.`);
        }

        const fontEncodings = buildFontEncodings(pdfDoc, page);
        const { streams, allTextRuns } = extractTextRuns(pdfDoc, page, fontEncodings);
        const usedRunIndexes = new Set<number>();

        const replacementsByStream: Map<
            number,
            { start: number; end: number; text: string }[]
        > = new Map();

        for (const edit of pageEdits) {
            const run = findMatchingRun(allTextRuns, edit, usedRunIndexes);
            if (!run) {
                throw new Error(
                    `Exact edit failed: could not locate the selected text run in the PDF content stream.`
                );
            }

            usedRunIndexes.add(run.__index);

            const encoded = encodeTextToBytes(edit.text, run.encoding);

            if (encoded.codeCount !== run.codeCount) {
                throw new Error(
                    `Exact edit failed: replacement must use the same glyph count to preserve kerning.`
                );
            }

            if (encoded.bytes.length !== run.originalBytes.length) {
                throw new Error(
                    `Exact edit failed: replacement must preserve the encoded byte length for this font.`
                );
            }

            const replacementText =
                run.literalType === "hex"
                    ? bytesToHex(encoded.bytes)
                    : bytesToLiteral(encoded.bytes);

            if (!replacementsByStream.has(run.streamIndex)) {
                replacementsByStream.set(run.streamIndex, []);
            }
            replacementsByStream.get(run.streamIndex)!.push({
                start: run.literalStart,
                end: run.literalEnd,
                text: replacementText,
            });
        }

        // Apply replacements stream-by-stream, from back to front
        for (const [streamIndex, replacements] of replacementsByStream.entries()) {
            const streamEntry = streams[streamIndex];
            const decoded = decodeStreamToString(streamEntry.stream);
            const updated = applyReplacements(decoded, replacements);

            const newStream = pdfDoc.context.flateStream(Buffer.from(updated, "latin1"));
            const newStreamRef = pdfDoc.context.register(newStream);

            if (streams.length === 1) {
                page.node.set(PDFName.of("Contents"), newStreamRef);
            } else {
                const contents = page.node.Contents();
                if (!(contents instanceof PDFArray)) {
                    throw new Error("Unexpected PDF structure: multi-stream contents not found.");
                }
                contents.set(streamEntry.index, newStreamRef);
            }
        }
    }

    return await pdfDoc.save({
        useObjectStreams: false,
        addDefaultPage: false,
        updateFieldAppearances: false,
    });
}

/**
 * Group edits by 1-based page number.
 */
function groupEditsByPage(edits: ExactTextEdit[]) {
    const map: Record<number, ExactTextEdit[]> = {};
    for (const edit of edits) {
        if (!map[edit.pageNumber]) {
            map[edit.pageNumber] = [];
        }
        map[edit.pageNumber].push(edit);
    }
    return map;
}

/**
 * Extract text runs from all content streams of a page, preserving operator order.
 */
function extractTextRuns(
    pdfDoc: PDFDocument,
    page: any,
    fontEncodings: Map<string, FontEncoding>
): {
    streams: StreamEntry[];
    allTextRuns: TextRun[];
} {
    const contents = page.node.Contents();
    const streams: StreamEntry[] = [];

    if (contents instanceof PDFArray) {
        for (let i = 0; i < contents.size(); i++) {
            const ref = contents.get(i);
            const stream = pdfDoc.context.lookup(ref, PDFRawStream);
            streams.push({ index: i, ref: ref instanceof PDFRef ? ref : null, stream });
        }
    } else if (contents instanceof PDFRawStream) {
        streams.push({ index: 0, ref: null, stream: contents });
    } else {
        throw new Error("Unsupported PDF contents stream type.");
    }

    const allTextRuns: TextRun[] = [];

    streams.forEach((entry, streamIndex) => {
        const decoded = decodeStreamToString(entry.stream);
        const runs = parseTextRuns(decoded, streamIndex, fontEncodings);
        runs.forEach((run) => allTextRuns.push(run));
    });

    return { streams, allTextRuns };
}

/**
 * Decode PDF raw stream bytes to a Latin-1 string (1:1 byte mapping).
 */
function decodeStreamToString(stream: PDFRawStream): string {
    const decodedBytes = decodePDFRawStream(stream).decode();
    return Buffer.from(decodedBytes).toString("latin1");
}

/**
 * Parse text operators (Tj/TJ) from a content stream string.
 * Returns text runs in stream order with literal positions.
 */
function parseTextRuns(
    stream: string,
    streamIndex: number,
    fontEncodings: Map<string, FontEncoding>
): TextRun[] {
    const tokens = tokenizeWithOffsets(stream);
    const runs: TextRun[] = [];
    let currentFontName: string | null = null;
    let textMatrix: number[] = [1, 0, 0, 1, 0, 0];
    let lineMatrix: number[] = [1, 0, 0, 1, 0, 0];
    let leading = 0;

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        // Track font selection: /F1 12 Tf
        if (token.type === "operator" && token.value === "Tf") {
            const sizeToken = tokens[i - 1];
            const nameToken = tokens[i - 2];
            if (nameToken?.type === "name" && sizeToken?.type === "number") {
                currentFontName = nameToken.value.replace(/^\//, "");
            }
            continue;
        }

        if (token.type === "operator" && token.value === "BT") {
            textMatrix = [1, 0, 0, 1, 0, 0];
            lineMatrix = [1, 0, 0, 1, 0, 0];
            continue;
        }

        if (token.type === "operator" && token.value === "ET") {
            continue;
        }

        if (token.type === "operator" && token.value === "Tm") {
            const values = readNumberOperands(tokens, i, 6);
            if (values) {
                textMatrix = [...values];
                lineMatrix = [...values];
            }
            continue;
        }

        if (token.type === "operator" && token.value === "Td") {
            const values = readNumberOperands(tokens, i, 2);
            if (values) {
                lineMatrix = translateMatrix(lineMatrix, values[0], values[1]);
                textMatrix = [...lineMatrix];
            }
            continue;
        }

        if (token.type === "operator" && token.value === "TD") {
            const values = readNumberOperands(tokens, i, 2);
            if (values) {
                leading = -values[1];
                lineMatrix = translateMatrix(lineMatrix, values[0], values[1]);
                textMatrix = [...lineMatrix];
            }
            continue;
        }

        if (token.type === "operator" && token.value === "T*") {
            lineMatrix = translateMatrix(lineMatrix, 0, -leading);
            textMatrix = [...lineMatrix];
            continue;
        }

        if (token.type === "operator" && token.value === "TL") {
            const values = readNumberOperands(tokens, i, 1);
            if (values) {
                leading = values[0];
            }
            continue;
        }

        if (token.type === "operator" && (token.value === "Tj" || token.value === "TJ")) {
            const encoding = currentFontName ? fontEncodings.get(currentFontName) || null : null;
            const position = { x: textMatrix[4], y: textMatrix[5] };

            if (token.value === "Tj") {
                const operand = tokens[i - 1];
                if (!operand || (operand.type !== "string" && operand.type !== "hex")) {
                    continue;
                }

                const parsed = parseLiteralOperand(stream, operand);
                const decoded = encoding
                    ? decodeBytes(parsed.bytes, encoding)
                    : { text: "", codeCount: parsed.bytes.length };

                runs.push({
                    decodedText: decoded.text,
                    streamIndex,
                    literalStart: parsed.literalStart,
                    literalEnd: parsed.literalEnd,
                    literalType: parsed.literalType,
                    editable: Boolean(encoding),
                    originalBytes: parsed.bytes,
                    codeCount: decoded.codeCount,
                    encoding,
                    position,
                });
            }

            if (token.value === "TJ") {
                const operand = tokens[i - 1];
                if (!operand || operand.type !== "array") {
                    continue;
                }

                const parts = parseTJArray(stream, operand.start, operand.end);
                for (const part of parts.strings) {
                    const decoded = encoding
                        ? decodeBytes(part.bytes, encoding)
                        : { text: "", codeCount: part.bytes.length };

                    runs.push({
                        decodedText: decoded.text,
                        streamIndex,
                        literalStart: part.literalStart,
                        literalEnd: part.literalEnd,
                        literalType: part.literalType,
                        editable: Boolean(encoding),
                        originalBytes: part.bytes,
                        codeCount: decoded.codeCount,
                        encoding,
                        position,
                    });
                }
            }
        }

        if (token.type === "operator" && (token.value === "'" || token.value === "\"")) {
            // Move to next line (T*) then show text
            lineMatrix = translateMatrix(lineMatrix, 0, -leading);
            textMatrix = [...lineMatrix];

            const operand = findPreviousTextOperand(tokens, i - 1);
            if (!operand) {
                continue;
            }

            const encoding = currentFontName ? fontEncodings.get(currentFontName) || null : null;
            const position = { x: textMatrix[4], y: textMatrix[5] };

            const parsed = parseLiteralOperand(stream, operand);
            const decoded = encoding
                ? decodeBytes(parsed.bytes, encoding)
                : { text: "", codeCount: parsed.bytes.length };

            runs.push({
                decodedText: decoded.text,
                streamIndex,
                literalStart: parsed.literalStart,
                literalEnd: parsed.literalEnd,
                literalType: parsed.literalType,
                editable: Boolean(encoding),
                originalBytes: parsed.bytes,
                codeCount: decoded.codeCount,
                encoding,
                position,
            });
        }
    }

    return runs;
}

/**
 * Build font encodings for the page resources.
 */
function buildFontEncodings(pdfDoc: PDFDocument, page: any): Map<string, FontEncoding> {
    const encodings = new Map<string, FontEncoding>();
    const resources = page.node.Resources();
    if (!resources || !(resources instanceof PDFDict)) return encodings;

    const fontEntry = resources.get(PDFName.of("Font"));
    if (!fontEntry) return encodings;

    let fontDict: PDFDict | null = null;
    if (fontEntry instanceof PDFDict) {
        fontDict = fontEntry;
    } else if (fontEntry instanceof PDFRef) {
        fontDict = pdfDoc.context.lookupMaybe(fontEntry, PDFDict) || null;
    }
    if (!fontDict) return encodings;

    for (const [key, value] of fontDict.entries()) {
        const name = key.asString().replace(/^\//, "");
        const font = resolveFontDict(pdfDoc, value);
        if (!font) continue;

        const encoding = resolveFontEncoding(pdfDoc, font);
        encodings.set(name, encoding);
    }

    return encodings;
}

/**
 * Resolve the font encoding, including ToUnicode CMaps and ligatures.
 */
function resolveFontEncoding(pdfDoc: PDFDocument, font: PDFDict): FontEncoding {
    const baseName = readFontName(font);
    let toUnicodeStream: PDFRawStream | null = null;

    const toUnicodeRef = font.get(PDFName.of("ToUnicode"));
    if (toUnicodeRef instanceof PDFRawStream) {
        toUnicodeStream = toUnicodeRef;
    } else if (toUnicodeRef instanceof PDFRef) {
        toUnicodeStream = pdfDoc.context.lookupMaybe(toUnicodeRef, PDFRawStream) || null;
    }

    // For Type0 fonts, ToUnicode may be on the descendant
    if (!toUnicodeStream) {
        const descendant = getDescendantFont(pdfDoc, font);
        if (descendant) {
            const descendantToUnicode = descendant.get(PDFName.of("ToUnicode"));
            if (descendantToUnicode instanceof PDFRawStream) {
                toUnicodeStream = descendantToUnicode;
            } else if (descendantToUnicode instanceof PDFRef) {
                toUnicodeStream = pdfDoc.context.lookupMaybe(descendantToUnicode, PDFRawStream) || null;
            }
        }
    }

    if (toUnicodeStream) {
        const cmapText = decodeStreamToString(toUnicodeStream);
        const cmap = parseToUnicodeCMap(cmapText);
        return {
            name: baseName,
            toUnicodeMap: cmap.map,
            reverseUnicodeMap: cmap.reverseMap,
            codeByteLengths: cmap.codeByteLengths,
            maxUnicodeLen: cmap.maxUnicodeLen,
            simpleEncoding: null,
        };
    }

    // No ToUnicode - allow only simple Latin1/ASCII as strict fallback
    const encodingName = readEncodingName(font);

    if (encodingName === "Identity-H" || encodingName === "Identity-V") {
        return {
            name: baseName,
            toUnicodeMap: undefined,
            reverseUnicodeMap: undefined,
            codeByteLengths: [2],
            maxUnicodeLen: 1,
            simpleEncoding: "utf16be",
        };
    }

    const simpleEncoding =
        encodingName && ["WinAnsiEncoding", "MacRomanEncoding", "StandardEncoding"].includes(encodingName)
            ? "latin1"
            : null;

    return {
        name: baseName,
        toUnicodeMap: undefined,
        reverseUnicodeMap: undefined,
        codeByteLengths: [1],
        maxUnicodeLen: 1,
        simpleEncoding,
    };
}

function readFontName(font: PDFDict): string {
    const baseFont = font.get(PDFName.of("BaseFont"));
    if (baseFont instanceof PDFName) {
        return baseFont.asString().replace(/^\//, "");
    }
    return "UnknownFont";
}

function readEncodingName(font: PDFDict): string | null {
    const encoding = font.get(PDFName.of("Encoding"));
    if (encoding instanceof PDFName) {
        return encoding.asString().replace(/^\//, "");
    }
    return null;
}

function getDescendantFont(pdfDoc: PDFDocument, font: PDFDict): PDFDict | null {
    const descendants = font.lookupMaybe(PDFName.of("DescendantFonts"), PDFArray);
    if (!descendants || descendants.size() === 0) return null;
    const ref = descendants.get(0);
    return resolveFontDict(pdfDoc, ref);
}

function resolveFontDict(pdfDoc: PDFDocument, value: any): PDFDict | null {
    if (value instanceof PDFDict) return value;
    if (value instanceof PDFRef) return pdfDoc.context.lookupMaybe(value, PDFDict) || null;
    return null;
}

/**
 * Decode a literal or hex operand to bytes and positions.
 */
function parseLiteralOperand(
    stream: string,
    operand: Token
): { bytes: Uint8Array; literalStart: number; literalEnd: number; literalType: "literal" | "hex" } {
    if (operand.type === "hex") {
        const bytes = hexToBytes(operand.value);
        return {
            bytes,
            literalStart: operand.start + 1,
            literalEnd: operand.end - 1,
            literalType: "hex",
        };
    }

    const bytes = literalToBytes(stream.slice(operand.start, operand.end));
    return {
        bytes,
        literalStart: operand.start + 1,
        literalEnd: operand.end - 1,
        literalType: "literal",
    };
}

/**
 * Decode bytes using a font encoding (ToUnicode or Latin1).
 */
function decodeBytes(bytes: Uint8Array, encoding: FontEncoding): { text: string; codeCount: number } {
    if (encoding.toUnicodeMap) {
        return decodeViaCMap(bytes, encoding);
    }

    if (encoding.simpleEncoding) {
        if (encoding.simpleEncoding === "latin1") {
            let text = "";
            for (const byte of bytes) {
                text += String.fromCharCode(byte);
            }
            return { text, codeCount: bytes.length };
        }

        if (encoding.simpleEncoding === "utf16be") {
            let text = "";
            for (let i = 0; i + 1 < bytes.length; i += 2) {
                text += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
            }
            return { text, codeCount: Math.floor(bytes.length / 2) };
        }
    }

    return { text: "", codeCount: bytes.length };
}

function decodeViaCMap(bytes: Uint8Array, encoding: FontEncoding): { text: string; codeCount: number } {
    const lengths = [...encoding.codeByteLengths].sort((a, b) => b - a);
    const map = encoding.toUnicodeMap!;
    let i = 0;
    let text = "";
    let codeCount = 0;

    while (i < bytes.length) {
        let matched = false;
        for (const len of lengths) {
            if (i + len > bytes.length) continue;
            const slice = bytes.slice(i, i + len);
            const key = bytesToHex(slice);
            const mapped = map.get(key);
            if (mapped !== undefined) {
                text += mapped;
                codeCount += 1;
                i += len;
                matched = true;
                break;
            }
        }
        if (!matched) {
            // Cannot decode this byte sequence
            return { text: "", codeCount: 0 };
        }
    }

    return { text, codeCount };
}

/**
 * Encode a Unicode string to bytes using a font encoding.
 */
function encodeTextToBytes(
    text: string,
    encoding: FontEncoding
): { bytes: Uint8Array; codeCount: number } {
    if (encoding.reverseUnicodeMap) {
        const bytes: number[] = [];
        let i = 0;
        let codeCount = 0;
        const maxLen = encoding.maxUnicodeLen;

        while (i < text.length) {
            let matched = false;
            const remaining = text.length - i;
            const limit = Math.min(maxLen, remaining);

            for (let len = limit; len >= 1; len--) {
                const slice = text.slice(i, i + len);
                const mapped = encoding.reverseUnicodeMap.get(slice);
                if (mapped) {
                    bytes.push(...mapped);
                    codeCount += 1;
                    i += len;
                    matched = true;
                    break;
                }
            }

            if (!matched) {
                throw new Error("Exact edit failed: the replacement text cannot be encoded in the original font.");
            }
        }

        return { bytes: new Uint8Array(bytes), codeCount };
    }

    if (encoding.simpleEncoding) {
        if (encoding.simpleEncoding === "latin1") {
            const bytes = new Uint8Array(text.length);
            for (let i = 0; i < text.length; i++) {
                const code = text.charCodeAt(i);
                if (code > 0xff) {
                    throw new Error("Exact edit failed: Unicode characters not supported in this font.");
                }
                bytes[i] = code;
            }
            return { bytes, codeCount: text.length };
        }

        if (encoding.simpleEncoding === "utf16be") {
            const bytes = new Uint8Array(text.length * 2);
            for (let i = 0; i < text.length; i++) {
                const code = text.charCodeAt(i);
                if (code >= 0xd800 && code <= 0xdfff) {
                    throw new Error("Exact edit failed: unsupported Unicode surrogate in this font.");
                }
                bytes[i * 2] = (code >> 8) & 0xff;
                bytes[i * 2 + 1] = code & 0xff;
            }
            return { bytes, codeCount: text.length };
        }
    }

    throw new Error("Exact edit failed: unsupported font encoding.");
}

/**
 * Parse a TJ array token and extract string components with offsets.
 */
function parseTJArray(
    stream: string,
    start: number,
    end: number
): { strings: { bytes: Uint8Array; literalStart: number; literalEnd: number; literalType: "literal" | "hex" }[] } {
    const strings: { bytes: Uint8Array; literalStart: number; literalEnd: number; literalType: "literal" | "hex" }[] = [];
    let i = start + 1;
    const limit = end - 1;

    while (i < limit) {
        const ch = stream[i];
        if (isWhitespace(ch)) {
            i++;
            continue;
        }

        if (ch === "(") {
            const sStart = i;
            i++;
            let depth = 1;
            while (i < limit && depth > 0) {
                const c = stream[i];
                if (c === "\\") {
                    i += 2;
                    continue;
                }
                if (c === "(") depth++;
                if (c === ")") depth--;
                i++;
            }
            const sEnd = i;
            const literal = stream.slice(sStart, sEnd);
            const bytes = literalToBytes(literal);
            strings.push({
                bytes,
                literalStart: sStart + 1,
                literalEnd: sEnd - 1,
                literalType: "literal",
            });
            continue;
        }

        if (ch === "<") {
            const sStart = i;
            i++;
            while (i < limit && stream[i] !== ">") i++;
            i++;
            const sEnd = i;
            const literal = stream.slice(sStart, sEnd);
            const bytes = hexToBytes(literal);
            strings.push({
                bytes,
                literalStart: sStart + 1,
                literalEnd: sEnd - 1,
                literalType: "hex",
            });
            continue;
        }

        // Skip numeric adjustments or other tokens
        i++;
    }

    return { strings };
}

/**
 * Tokenize a PDF content stream while keeping byte offsets.
 */
function tokenizeWithOffsets(stream: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;

    while (i < stream.length) {
        const ch = stream[i];

        if (isWhitespace(ch)) {
            i++;
            continue;
        }

        if (ch === "(") {
            const start = i;
            i++;
            let depth = 1;
            while (i < stream.length && depth > 0) {
                const c = stream[i];
                if (c === "\\") {
                    i += 2;
                    continue;
                }
                if (c === "(") depth++;
                if (c === ")") depth--;
                i++;
            }
            const end = i;
            tokens.push({ type: "string", value: stream.slice(start, end), start, end });
            continue;
        }

        if (ch === "[") {
            const start = i;
            i++;
            let depth = 1;
            while (i < stream.length && depth > 0) {
                const c = stream[i];
                if (c === "\\") {
                    i += 2;
                    continue;
                }
                if (c === "(") {
                    i++;
                    let sDepth = 1;
                    while (i < stream.length && sDepth > 0) {
                        const sc = stream[i];
                        if (sc === "\\") {
                            i += 2;
                            continue;
                        }
                        if (sc === "(") sDepth++;
                        if (sc === ")") sDepth--;
                        i++;
                    }
                    continue;
                }
                if (c === "[") depth++;
                if (c === "]") depth--;
                i++;
            }
            const end = i;
            tokens.push({ type: "array", value: stream.slice(start, end), start, end });
            continue;
        }

        if (ch === "<" && stream[i + 1] !== "<") {
            const start = i;
            i++;
            while (i < stream.length && stream[i] !== ">") i++;
            i++;
            tokens.push({ type: "hex", value: stream.slice(start, i), start, end: i });
            continue;
        }

        const start = i;
        while (i < stream.length && !isWhitespace(stream[i]) && !isDelimiter(stream[i])) {
            i++;
        }
        const value = stream.slice(start, i);
        const type = classifyToken(value);
        tokens.push({ type, value, start, end: i });
    }

    return tokens;
}

/**
 * Apply replacements within a stream string. Replacements must be non-overlapping.
 */
function applyReplacements(
    stream: string,
    replacements: { start: number; end: number; text: string }[]
): string {
    const sorted = [...replacements].sort((a, b) => b.start - a.start);
    let updated = stream;
    for (const rep of sorted) {
        updated = updated.slice(0, rep.start) + rep.text + updated.slice(rep.end);
    }
    return updated;
}

/**
 * Decode literal string to bytes.
 */
function literalToBytes(literal: string): Uint8Array {
    const bytes: number[] = [];
    let i = 0;
    if (literal.startsWith("(") && literal.endsWith(")")) {
        i = 1;
    }
    const end = literal.endsWith(")") ? literal.length - 1 : literal.length;

    while (i < end) {
        const ch = literal[i];
        if (ch === "\\") {
            const next = literal[i + 1];
            if (next === undefined) break;
            if (/[0-7]/.test(next)) {
                let octal = next;
                let count = 1;
                while (count < 3 && /[0-7]/.test(literal[i + 1 + count] || "")) {
                    octal += literal[i + 1 + count];
                    count += 1;
                }
                bytes.push(parseInt(octal, 8));
                i += 1 + count;
                continue;
            }
            switch (next) {
                case "n":
                    bytes.push(0x0a);
                    i += 2;
                    continue;
                case "r":
                    bytes.push(0x0d);
                    i += 2;
                    continue;
                case "t":
                    bytes.push(0x09);
                    i += 2;
                    continue;
                case "b":
                    bytes.push(0x08);
                    i += 2;
                    continue;
                case "f":
                    bytes.push(0x0c);
                    i += 2;
                    continue;
                case "\\":
                case "(":
                case ")":
                    bytes.push(next.charCodeAt(0));
                    i += 2;
                    continue;
                case "\n":
                    i += 2;
                    continue;
                case "\r":
                    if (literal[i + 2] === "\n") {
                        i += 3;
                    } else {
                        i += 2;
                    }
                    continue;
                default:
                    bytes.push(next.charCodeAt(0));
                    i += 2;
                    continue;
            }
        }

        bytes.push(ch.charCodeAt(0));
        i += 1;
    }

    return new Uint8Array(bytes);
}

function hexToBytes(literal: string): Uint8Array {
    let hex = literal.replace(/[<>\s]/g, "");
    if (hex.length % 2 === 1) {
        hex += "0";
    }
    const bytes: number[] = [];
    for (let i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.slice(i, i + 2), 16));
    }
    return new Uint8Array(bytes);
}

function bytesToLiteral(bytes: Uint8Array): string {
    let out = "";
    for (const byte of bytes) {
        switch (byte) {
            case 0x0a:
                out += "\\n";
                continue;
            case 0x0d:
                out += "\\r";
                continue;
            case 0x09:
                out += "\\t";
                continue;
            case 0x08:
                out += "\\b";
                continue;
            case 0x0c:
                out += "\\f";
                continue;
            case 0x28:
                out += "\\(";
                continue;
            case 0x29:
                out += "\\)";
                continue;
            case 0x5c:
                out += "\\\\";
                continue;
            default:
                if (byte >= 0x20 && byte <= 0x7e) {
                    out += String.fromCharCode(byte);
                } else {
                    out += `\\${byte.toString(8).padStart(3, "0")}`;
                }
        }
    }
    return out;
}

function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase();
}

/**
 * Parse ToUnicode CMap to build code -> unicode and unicode -> code maps.
 */
function parseToUnicodeCMap(cmapText: string): {
    map: Map<string, string>;
    reverseMap: Map<string, Uint8Array>;
    codeByteLengths: number[];
    maxUnicodeLen: number;
} {
    const map = new Map<string, string>();
    const reverseMap = new Map<string, Uint8Array>();
    const codeByteLengths = new Set<number>();
    let maxUnicodeLen = 1;

    const bfcharMatches = [...cmapText.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)];
    for (const match of bfcharMatches) {
        const section = match[1];
        const hexTokens = [...section.matchAll(/<([0-9A-Fa-f]+)>/g)].map((m) => m[1]);
        for (let i = 0; i + 1 < hexTokens.length; i += 2) {
            const srcHex = hexTokens[i];
            const dstHex = hexTokens[i + 1];
            const unicode = decodeUnicodeHex(dstHex);
            const key = srcHex.toUpperCase();
            map.set(key, unicode);
            codeByteLengths.add(srcHex.length / 2);
            if (!reverseMap.has(unicode)) {
                reverseMap.set(unicode, hexStringToBytes(srcHex));
                maxUnicodeLen = Math.max(maxUnicodeLen, unicode.length);
            }
        }
    }

    const bfrangeMatches = [...cmapText.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)];
    for (const match of bfrangeMatches) {
        const section = match[1];
        const tokens = section.match(/<[^>]+>|\[[^\]]+]/g) || [];
        let idx = 0;
        while (idx + 2 < tokens.length) {
            const startToken = tokens[idx++];
            const endToken = tokens[idx++];
            const targetToken = tokens[idx++];

            if (!startToken.startsWith("<") || !endToken.startsWith("<")) {
                continue;
            }

            const startHex = startToken.slice(1, -1);
            const endHex = endToken.slice(1, -1);
            const startCode = parseInt(startHex, 16);
            const endCode = parseInt(endHex, 16);
            const codeLen = startHex.length / 2;

            codeByteLengths.add(codeLen);

            if (targetToken.startsWith("[")) {
                const arrayHex = [...targetToken.matchAll(/<([0-9A-Fa-f]+)>/g)].map((m) => m[1]);
                for (let i = 0; i < arrayHex.length && startCode + i <= endCode; i++) {
                    const codeHex = (startCode + i)
                        .toString(16)
                        .padStart(startHex.length, "0")
                        .toUpperCase();
                    const unicode = decodeUnicodeHex(arrayHex[i]);
                    map.set(codeHex, unicode);
                    if (!reverseMap.has(unicode)) {
                        reverseMap.set(unicode, hexStringToBytes(codeHex));
                        maxUnicodeLen = Math.max(maxUnicodeLen, unicode.length);
                    }
                }
            } else if (targetToken.startsWith("<")) {
                const startUnicodeHex = targetToken.slice(1, -1);
                for (let offset = 0; startCode + offset <= endCode; offset++) {
                    const codeHex = (startCode + offset)
                        .toString(16)
                        .padStart(startHex.length, "0")
                        .toUpperCase();
                    const unicode = incrementUnicodeHex(startUnicodeHex, offset);
                    map.set(codeHex, unicode);
                    if (!reverseMap.has(unicode)) {
                        reverseMap.set(unicode, hexStringToBytes(codeHex));
                        maxUnicodeLen = Math.max(maxUnicodeLen, unicode.length);
                    }
                }
            }
        }
    }

    return {
        map,
        reverseMap,
        codeByteLengths: Array.from(codeByteLengths),
        maxUnicodeLen,
    };
}

function decodeUnicodeHex(hex: string): string {
    const bytes = hexStringToBytes(hex);
    if (bytes.length === 0) return "";
    if (bytes.length % 2 !== 0) {
        return String.fromCharCode(...bytes);
    }
    const codeUnits: number[] = [];
    for (let i = 0; i < bytes.length; i += 2) {
        codeUnits.push((bytes[i] << 8) | bytes[i + 1]);
    }
    return String.fromCharCode(...codeUnits);
}

function incrementUnicodeHex(startHex: string, offset: number): string {
    const bytes = hexStringToBytes(startHex);
    if (bytes.length % 2 !== 0) {
        const val = parseInt(startHex, 16) + offset;
        return String.fromCharCode(val);
    }
    const codeUnits: number[] = [];
    for (let i = 0; i < bytes.length; i += 2) {
        codeUnits.push((bytes[i] << 8) | bytes[i + 1]);
    }
    codeUnits[codeUnits.length - 1] += offset;
    return String.fromCharCode(...codeUnits);
}

function hexStringToBytes(hex: string): Uint8Array {
    const clean = hex.replace(/\s+/g, "");
    const bytes: number[] = [];
    for (let i = 0; i < clean.length; i += 2) {
        bytes.push(parseInt(clean.slice(i, i + 2), 16));
    }
    return new Uint8Array(bytes);
}

function classifyToken(value: string): Token["type"] {
    if (value === "'" || value === "\"") return "operator";
    if (value.startsWith("/")) return "name";
    if (/^[\+\-]?\d+(\.\d+)?$/.test(value)) return "number";
    if (/^[A-Za-z]+$/.test(value)) return "operator";
    return "other";
}

function isWhitespace(ch: string) {
    return ch === " " || ch === "\n" || ch === "\r" || ch === "\t" || ch === "\f";
}

function isDelimiter(ch: string) {
    return ch === "(" || ch === ")" || ch === "[" || ch === "]" || ch === "<" || ch === ">";
}

function findPreviousTextOperand(tokens: Token[], startIndex: number): Token | null {
    for (let i = startIndex; i >= 0; i--) {
        const token = tokens[i];
        if (token.type === "string" || token.type === "hex") {
            return token;
        }
    }
    return null;
}

function readNumberOperands(tokens: Token[], operatorIndex: number, count: number): number[] | null {
    const values: number[] = [];
    for (let i = operatorIndex - count; i < operatorIndex; i++) {
        const token = tokens[i];
        if (!token || token.type !== "number") {
            return null;
        }
        values.push(Number(token.value));
    }
    return values;
}

function translateMatrix(matrix: number[], tx: number, ty: number): number[] {
    const [a, b, c, d, e, f] = matrix;
    const newE = a * tx + c * ty + e;
    const newF = b * tx + d * ty + f;
    return [a, b, c, d, newE, newF];
}

function findMatchingRun(
    runs: TextRun[],
    edit: ExactTextEdit,
    used: Set<number>
): (TextRun & { __index: number }) | null {
    const position = extractEditPosition(edit);
    const direct = runs[edit.sourceIndex];
    const editText = edit.originalText ?? "";
    const editNorm = normalizeForMatch(editText);
    const editTight = stripSpaces(editNorm);

    if (direct && !used.has(edit.sourceIndex)) {
        if (direct.editable && direct.encoding) {
            const directNorm = normalizeForMatch(direct.decodedText || "");
            if (
                direct.decodedText === editText ||
                (editNorm && directNorm === editNorm) ||
                (editTight && stripSpaces(directNorm) === editTight)
            ) {
                return { ...direct, __index: edit.sourceIndex };
            }
        }
    }

    const candidates: Array<{ run: TextRun; index: number; score: number }> = [];
    for (let i = 0; i < runs.length; i++) {
        if (used.has(i)) continue;
        const run = runs[i];
        if (!run.editable || !run.encoding) continue;
        const runText = run.decodedText || "";
        if (!isTextMatch(runText, editText, editNorm, editTight)) continue;

        let score = Math.abs(i - edit.sourceIndex) * 10;
        if (position && run.position) {
            const dx = run.position.x - position.x;
            const dy = run.position.y - position.y;
            score += Math.hypot(dx, dy);
        }
        if (runText !== editText) {
            score += 5;
        }
        candidates.push({ run, index: i, score });
    }

    candidates.sort((a, b) => a.score - b.score);
    const best = candidates[0];
    if (!best) return null;
    return { ...best.run, __index: best.index };
}

function isTextMatch(runText: string, editText: string, editNorm: string, editTight: string) {
    if (runText === editText) return true;
    const runNorm = normalizeForMatch(runText);
    if (editNorm && runNorm === editNorm) return true;
    if (editTight && stripSpaces(runNorm) === editTight) return true;
    return false;
}

function stripSpaces(value: string) {
    return value.replace(/\s+/g, "");
}

function normalizeForMatch(text: string) {
    if (!text) return "";
    let normalized = text
        .replace(/\u00a0/g, " ")
        .replace(/\u00ad/g, "")
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .replace(/\s+/g, " ")
        .trim();

    try {
        normalized = normalized.normalize("NFKC");
    } catch {
        // ignore normalization errors
    }

    const ligatures: Record<string, string> = {
        "\uFB00": "ff",
        "\uFB01": "fi",
        "\uFB02": "fl",
        "\uFB03": "ffi",
        "\uFB04": "ffl",
        "\uFB05": "ft",
        "\uFB06": "st",
    };

    normalized = normalized.replace(/[\uFB00-\uFB06]/g, (char) => ligatures[char] || char);
    return normalized;
}

function extractEditPosition(edit: ExactTextEdit): { x: number; y: number } | null {
    if (edit.transform && edit.transform.length >= 6) {
        return { x: edit.transform[4], y: edit.transform[5] };
    }
    if (typeof edit.x === "number" && typeof edit.y === "number") {
        return { x: edit.x, y: edit.y };
    }
    return null;
}
