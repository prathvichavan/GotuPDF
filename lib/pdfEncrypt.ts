/**
 * Pure JavaScript PDF Encryption Module
 * Implements PDF Standard Security Handler (Revision 3, 128-bit RC4)
 * Following ISO 32000-1:2008 specification
 *
 * This module encrypts an existing PDF's stream data and adds proper
 * /Encrypt dictionary via incremental update. No external binaries needed.
 */

import crypto from "node:crypto";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** Standard padding as defined in PDF Reference Table 21 */
const PDF_PADDING = Buffer.from([
    0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41,
    0x64, 0x00, 0x4b, 0x49, 0x17, 0x32, 0x13, 0xb7,
    0x53, 0x07, 0xcf, 0x15, 0x14, 0xe5, 0x5d, 0xc8,
    0x59, 0x59, 0x7e, 0x21, 0xe0, 0x88, 0xad, 0x64,
]);

/* ------------------------------------------------------------------ */
/*  Public types                                                       */
/* ------------------------------------------------------------------ */

export interface EncryptionPermissions {
    print: boolean;
    copy: boolean;
    modify: boolean;
    annotate: boolean;
}

/* ------------------------------------------------------------------ */
/*  Primitive helpers                                                  */
/* ------------------------------------------------------------------ */

function md5(data: Buffer): Buffer {
    return crypto.createHash("md5").update(data).digest();
}

function rc4(key: Buffer, data: Buffer): Buffer {
    const cipher = crypto.createCipheriv("rc4", key, Buffer.alloc(0));
    return Buffer.concat([cipher.update(data), cipher.final()]);
}

function int32LE(v: number): Buffer {
    const b = Buffer.alloc(4);
    b.writeInt32LE(v, 0);
    return b;
}

function int24LE(v: number): Buffer {
    return Buffer.from([v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff]);
}

function int16LE(v: number): Buffer {
    const b = Buffer.alloc(2);
    b.writeUInt16LE(v, 0);
    return b;
}

/* ------------------------------------------------------------------ */
/*  Password handling                                                  */
/* ------------------------------------------------------------------ */

function padPassword(password: string): Buffer {
    const raw = Buffer.from(password, "latin1");
    const padded = Buffer.alloc(32);
    const n = Math.min(raw.length, 32);
    raw.copy(padded, 0, 0, n);
    PDF_PADDING.copy(padded, n, 0, 32 - n);
    return padded;
}

/* ------------------------------------------------------------------ */
/*  Permission flag                                                    */
/* ------------------------------------------------------------------ */

function computePermissionValue(p: EncryptionPermissions): number {
    // Bits 1-2 must be 0, bits 7-8 must be 1, bits 13-32 must be 1
    let v = 0xfffff0c0; // sets reserved high bits + bits 7-8
    if (p.print) v |= 0x0004 | 0x0800; // bit 3 + bit 12 (high-quality)
    if (p.modify) v |= 0x0008;          // bit 4
    if (p.copy) v |= 0x0010;            // bit 5
    if (p.annotate) v |= 0x0020;        // bit 6
    v |= 0x0100 | 0x0200;               // fill-forms + accessibility always on
    return v | 0; // force signed 32-bit
}

/* ------------------------------------------------------------------ */
/*  Algorithm 3 — O value                                              */
/* ------------------------------------------------------------------ */

function computeOValue(ownerPass: string, userPass: string, keyLen: number): Buffer {
    const paddedOwner = padPassword(ownerPass || userPass);
    let hash = md5(paddedOwner);
    for (let i = 0; i < 50; i++) hash = md5(hash.subarray(0, keyLen));
    const key = hash.subarray(0, keyLen);
    let result = rc4(key, padPassword(userPass));
    for (let i = 1; i <= 19; i++) {
        const xorKey = Buffer.alloc(keyLen);
        for (let j = 0; j < keyLen; j++) xorKey[j] = key[j] ^ i;
        result = rc4(xorKey, result);
    }
    return result;
}

/* ------------------------------------------------------------------ */
/*  Algorithm 2 — Encryption key                                       */
/* ------------------------------------------------------------------ */

function computeEncryptionKey(
    userPass: string,
    oValue: Buffer,
    pValue: number,
    fileId: Buffer,
    keyLen: number,
): Buffer {
    const input = Buffer.concat([padPassword(userPass), oValue, int32LE(pValue), fileId]);
    let hash = md5(input);
    for (let i = 0; i < 50; i++) hash = md5(hash.subarray(0, keyLen));
    return hash.subarray(0, keyLen);
}

/* ------------------------------------------------------------------ */
/*  Algorithm 5 — U value (Revision 3)                                 */
/* ------------------------------------------------------------------ */

function computeUValue(encKey: Buffer, fileId: Buffer): Buffer {
    const hash = md5(Buffer.concat([PDF_PADDING, fileId]));
    let result = rc4(encKey, hash);
    for (let i = 1; i <= 19; i++) {
        const xorKey = Buffer.alloc(encKey.length);
        for (let j = 0; j < encKey.length; j++) xorKey[j] = encKey[j] ^ i;
        result = rc4(xorKey, result);
    }
    return Buffer.concat([result, Buffer.alloc(16)]); // pad to 32 bytes
}

/* ------------------------------------------------------------------ */
/*  Per-object key (Algorithm 1, step 1-3)                             */
/* ------------------------------------------------------------------ */

function objectKey(encKey: Buffer, objNum: number, genNum: number): Buffer {
    const input = Buffer.concat([encKey, int24LE(objNum), int16LE(genNum)]);
    return md5(input).subarray(0, Math.min(encKey.length + 5, 16));
}

/* ------------------------------------------------------------------ */
/*  Xref parsing                                                       */
/* ------------------------------------------------------------------ */

interface XrefEntry {
    objNum: number;
    offset: number;
    genNum: number;
    inUse: boolean;
}

interface XrefData {
    xrefOffset: number;
    size: number;
    rootRef: string;
    entries: XrefEntry[];
}

function parseXref(pdf: Buffer): XrefData {
    const ascii = pdf.toString("ascii");

    // Find startxref from end (search last 128 bytes)
    const tail = ascii.slice(-128);
    const sxMatch = tail.match(/startxref\s+(\d+)/);
    if (!sxMatch) throw new Error("Cannot find startxref in PDF");
    const xrefOffset = parseInt(sxMatch[1], 10);

    // Read xref table
    const xrefRegion = ascii.substring(xrefOffset);
    const lines = xrefRegion.split(/\r?\n/);
    const entries: XrefEntry[] = [];
    let idx = 1; // skip "xref" line
    let curObj = 0;

    while (idx < lines.length) {
        const line = lines[idx].trim();
        if (line === "trailer" || line.startsWith("trailer")) break;

        const sub = line.match(/^(\d+)\s+(\d+)$/);
        if (sub) {
            curObj = parseInt(sub[1], 10);
            const count = parseInt(sub[2], 10);
            for (let j = 0; j < count; j++) {
                idx++;
                const e = lines[idx].trim().split(/\s+/);
                entries.push({
                    objNum: curObj + j,
                    offset: parseInt(e[0], 10),
                    genNum: parseInt(e[1], 10),
                    inUse: e[2] === "n",
                });
            }
        }
        idx++;
    }

    // Trailer
    const trailerStart = xrefRegion.indexOf("trailer");
    const trailerStr = xrefRegion.substring(trailerStart);
    const sizeMatch = trailerStr.match(/\/Size\s+(\d+)/);
    const rootMatch = trailerStr.match(/\/Root\s+(\d+\s+\d+\s+R)/);

    return {
        xrefOffset,
        size: sizeMatch ? parseInt(sizeMatch[1], 10) : entries.length,
        rootRef: rootMatch ? rootMatch[1] : "1 0 R",
        entries,
    };
}

/* ------------------------------------------------------------------ */
/*  Stream encryption (in-place, RC4 preserves byte length)            */
/* ------------------------------------------------------------------ */

function encryptStreamAtOffset(
    pdf: Buffer,
    offset: number,
    objNum: number,
    genNum: number,
    encKey: Buffer,
): void {
    // Safety: don't read past buffer
    const end = Math.min(offset + 65536, pdf.length);
    const region = pdf.toString("ascii", offset, end);

    // Verify this is an object header
    const headerMatch = region.match(/^\s*\d+\s+\d+\s+obj/);
    if (!headerMatch) return;

    // Check if object has a stream
    const streamKeyword = region.indexOf("stream");
    if (streamKeyword === -1) return;

    // Make sure 'endobj' doesn't appear before 'stream'
    const endobjPos = region.indexOf("endobj");
    if (endobjPos !== -1 && endobjPos < streamKeyword) return;

    // Extract /Length from dictionary (before "stream")
    const dictPart = region.substring(0, streamKeyword);
    const lenMatch = dictPart.match(/\/Length\s+(\d+)/);
    if (!lenMatch) return;

    const streamLen = parseInt(lenMatch[1], 10);
    if (streamLen <= 0 || streamLen > 100_000_000) return;

    // Find exact start of stream data
    let dataStart = offset + streamKeyword + 6; // "stream" = 6 chars
    if (dataStart < pdf.length && pdf[dataStart] === 0x0d) dataStart++;
    if (dataStart < pdf.length && pdf[dataStart] === 0x0a) dataStart++;

    if (dataStart + streamLen > pdf.length) return;

    // Compute per-object key & encrypt
    const key = objectKey(encKey, objNum, genNum);
    const plaintext = Buffer.from(pdf.subarray(dataStart, dataStart + streamLen));
    const ciphertext = rc4(key, plaintext);
    ciphertext.copy(pdf, dataStart);
}

/* ------------------------------------------------------------------ */
/*  Main entry point                                                   */
/* ------------------------------------------------------------------ */

/**
 * Encrypt a PDF with password protection (128-bit RC4, Standard Security Handler Rev 3).
 *
 * The function:
 *   1. Parses the xref to locate all indirect objects
 *   2. RC4-encrypts every stream in-place (same byte length → offsets preserved)
 *   3. Appends an incremental update with the /Encrypt dictionary and /ID
 *
 * @returns Encrypted PDF bytes
 */
export function encryptPdf(
    pdfBytes: Buffer,
    userPassword: string,
    ownerPassword: string,
    permissions: EncryptionPermissions,
): Buffer {
    const KEY_LEN = 16; // 128-bit
    const fileId = crypto.randomBytes(16);
    const pValue = computePermissionValue(permissions);
    const oValue = computeOValue(ownerPassword || userPassword, userPassword, KEY_LEN);
    const encKey = computeEncryptionKey(userPassword, oValue, pValue, fileId, KEY_LEN);
    const uValue = computeUValue(encKey, fileId);

    // Work on a mutable copy
    const result = Buffer.from(pdfBytes);

    // Parse xref and encrypt every stream
    const xref = parseXref(result);

    for (const entry of xref.entries) {
        if (!entry.inUse || entry.offset <= 0) continue;
        encryptStreamAtOffset(result, entry.offset, entry.objNum, entry.genNum, encKey);
    }

    // Build incremental update
    const nextObj = xref.size;
    const oHex = oValue.toString("hex").toUpperCase();
    const uHex = uValue.toString("hex").toUpperCase();
    const idHex = fileId.toString("hex").toUpperCase();

    // /Encrypt dictionary object
    const encryptObj =
        `\n${nextObj} 0 obj\n` +
        `<< /Type /Encrypt /Filter /Standard /V 2 /R 3 /Length 128 ` +
        `/O <${oHex}> /U <${uHex}> /P ${pValue} >>\n` +
        `endobj\n`;

    const encryptObjOffset = result.length;
    const xrefNewOffset = encryptObjOffset + Buffer.byteLength(encryptObj, "ascii");

    const xrefSection =
        `xref\n` +
        `${nextObj} 1\n` +
        `${String(encryptObjOffset).padStart(10, "0")} 00000 n \n` +
        `trailer\n` +
        `<< /Size ${nextObj + 1} /Root ${xref.rootRef} ` +
        `/Encrypt ${nextObj} 0 R ` +
        `/ID [<${idHex}> <${idHex}>] ` +
        `/Prev ${xref.xrefOffset} >>\n` +
        `startxref\n${xrefNewOffset}\n%%EOF\n`;

    return Buffer.concat([result, Buffer.from(encryptObj, "ascii"), Buffer.from(xrefSection, "ascii")]);
}
