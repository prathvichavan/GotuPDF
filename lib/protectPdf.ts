/**
 * PDF Protection Module – Pure JavaScript implementation
 *
 * Uses pdf-lib to normalise the input and lib/pdfEncrypt for
 * 128-bit RC4 encryption (Standard Security Handler, Revision 3).
 *
 * No external binaries (qpdf, etc.) are required.
 */

import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { PDFDocument } from "pdf-lib";
import { encryptPdf, type EncryptionPermissions } from "./pdfEncrypt";

/* ------------------------------------------------------------------ */
/*  Error class                                                        */
/* ------------------------------------------------------------------ */

export class ProtectPdfError extends Error {
    status: number;
    code?: string;
    constructor(message: string, status = 500, code?: string) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

/* ------------------------------------------------------------------ */
/*  Public types                                                       */
/* ------------------------------------------------------------------ */

export interface TempFileResult {
    tempDir: string;
    filePath: string;
    cleanup: () => Promise<void>;
}

export interface ProtectionResult {
    pdfBytes: Buffer;
    fileName: string;
    contentType: string;
}

export interface PdfPermissions {
    print: boolean;
    copy: boolean;
    modify: boolean;
    annotate: boolean;
}

/* ------------------------------------------------------------------ */
/*  Utility helpers                                                    */
/* ------------------------------------------------------------------ */

export function sanitizeBaseName(name: string) {
    const base = name.replace(/\.[^/.]+$/, "");
    const safe = base.replace(/[^a-z0-9-_]+/gi, "_").replace(/^_+|_+$/g, "");
    return safe.slice(0, 80) || "protected";
}

export async function saveFileToTemp(file: File, prefix = "protect-pdf"): Promise<TempFileResult> {
    const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), `${prefix}-`));
    const extension = path.extname(file.name || ".pdf") || ".pdf";
    const fileName = `${prefix}-${crypto.randomUUID()}${extension}`;
    const filePath = path.join(tempDir, fileName);
    const nodeStream = Readable.fromWeb(file.stream() as any);
    await pipeline(nodeStream, fs.createWriteStream(filePath));
    return {
        tempDir,
        filePath,
        cleanup: async () => {
            await fsp.rm(tempDir, { recursive: true, force: true });
        },
    };
}

export async function assertPdfHeader(filePath: string) {
    const fd = await fsp.open(filePath, "r");
    try {
        const buf = Buffer.alloc(5);
        const { bytesRead } = await fd.read(buf, 0, 5, 0);
        if (bytesRead < 5 || buf.toString("utf8") !== "%PDF-") {
            throw new ProtectPdfError("Invalid PDF file. Please upload a valid PDF.", 400, "invalid_pdf");
        }
    } finally {
        await fd.close();
    }
}

export async function detectEncryptedPdf(filePath: string) {
    const fd = await fsp.open(filePath, "r");
    try {
        const max = 2 * 1024 * 1024;
        const stat = await fd.stat();
        const head = Buffer.alloc(Math.min(max, stat.size));
        await fd.read(head, 0, head.length, 0);
        if (head.includes("/Encrypt")) {
            throw new ProtectPdfError(
                "This PDF is already password-protected. Please unlock it first.",
                400,
                "encrypted_pdf",
            );
        }
        if (stat.size > max) {
            const tail = Buffer.alloc(max);
            await fd.read(tail, 0, tail.length, Math.max(0, stat.size - max));
            if (tail.includes("/Encrypt")) {
                throw new ProtectPdfError(
                    "This PDF is already password-protected. Please unlock it first.",
                    400,
                    "encrypted_pdf",
                );
            }
        }
    } finally {
        await fd.close();
    }
}

/* ------------------------------------------------------------------ */
/*  Password validation                                                */
/* ------------------------------------------------------------------ */

function validatePassword(password: string, label: "user" | "owner") {
    if (!password) return;
    if (/[\r\n\0]/.test(password)) {
        throw new ProtectPdfError(
            `${label === "user" ? "User" : "Owner"} password contains invalid characters.`,
            400,
            "invalid_password",
        );
    }
    if (password.length > 127) {
        throw new ProtectPdfError(
            `${label === "user" ? "User" : "Owner"} password is too long (max 127 characters).`,
            400,
            "invalid_password",
        );
    }
}

/* ------------------------------------------------------------------ */
/*  Main protection function                                           */
/* ------------------------------------------------------------------ */

/**
 * Protect a PDF with password encryption (pure JavaScript, no qpdf).
 *
 * 1. Normalises the PDF via pdf-lib (fixes structure, removes old encryption)
 * 2. Encrypts with 128-bit RC4 via lib/pdfEncrypt
 */
export async function protectPdfPure(options: {
    pdfBytes: Buffer;
    outputBaseName: string;
    userPassword: string;
    ownerPassword?: string;
    permissions: PdfPermissions;
}): Promise<ProtectionResult> {
    validatePassword(options.userPassword, "user");
    if (options.ownerPassword) validatePassword(options.ownerPassword, "owner");

    const ownerPass = options.ownerPassword?.trim()
        ? options.ownerPassword
        : crypto.randomBytes(16).toString("hex");

    // Normalise via pdf-lib (produces clean xref table output)
    const pdfDoc = await PDFDocument.load(options.pdfBytes, { ignoreEncryption: true });
    const normalised = Buffer.from(await pdfDoc.save());

    // Encrypt
    const encrypted = encryptPdf(normalised, options.userPassword, ownerPass, {
        print: options.permissions.print,
        copy: options.permissions.copy,
        modify: options.permissions.modify,
        annotate: options.permissions.annotate,
    });

    return {
        pdfBytes: encrypted,
        fileName: `${options.outputBaseName}_protected.pdf`,
        contentType: "application/pdf",
    };
}
