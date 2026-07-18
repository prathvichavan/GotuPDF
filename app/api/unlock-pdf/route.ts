import { NextRequest, NextResponse } from "next/server";
import {
    UnlockPdfError,
    assertPdfHeader,
    detectEncryptedPdf,
    sanitizeBaseName,
    saveFileToTemp,
    unlockPdfWithQpdf,
} from "@/lib/unlockPdf";
import { withUsageLimit } from "@/lib/usageLimiter";

export const runtime = "nodejs";
export const maxDuration = 300;

const DEFAULT_MAX_MB = 50;

/** Calculate the maximum file size for uploads. */
function getMaxFileSizeBytes() {
    const maxMbEnv = Number(process.env.UNLOCK_PDF_MAX_MB || DEFAULT_MAX_MB);
    return Math.max(1, maxMbEnv) * 1024 * 1024;
}

/** Unlock (decrypt) password-protected PDFs. */
export async function POST(request: NextRequest) {
    return withUsageLimit(request, async () => {
    let cleanup: (() => Promise<void>) | null = null;

    try {
        if (process.env.VERCEL === "1") {
            return NextResponse.json(
                { error: "PDF unlock is not available on Vercel because it requires qpdf. Deploy this feature on a self-hosted server with qpdf installed." },
                { status: 501 },
            );
        }

        if (request.signal.aborted) {
            return NextResponse.json({ error: "Upload cancelled." }, { status: 400 });
        }

        const formData = await request.formData();
        const file =
            (formData.get("file0") as File | null) ||
            (formData.get("file") as File | null);
        const passwordRaw = formData.get("password");
        const password = typeof passwordRaw === "string" ? passwordRaw : "";

        if (!file) {
            return NextResponse.json({ error: "Please upload a PDF file." }, { status: 400 });
        }

        if (!password.trim()) {
            return NextResponse.json({ error: "Please enter the PDF password." }, { status: 400 });
        }

        if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
            return NextResponse.json({ error: "Only PDF files are supported." }, { status: 400 });
        }

        const maxBytes = getMaxFileSizeBytes();
        if (file.size > maxBytes) {
            return NextResponse.json(
                { error: `File too large. Max allowed is ${Math.round(maxBytes / 1024 / 1024)}MB.` },
                { status: 413 }
            );
        }

        const tempFile = await saveFileToTemp(file, "unlock-pdf");
        cleanup = tempFile.cleanup;

        await assertPdfHeader(tempFile.filePath);

        const encrypted = await detectEncryptedPdf(tempFile.filePath);
        if (!encrypted) {
            return NextResponse.json(
                { error: "This PDF is not password-protected." },
                { status: 400 }
            );
        }

        const baseName = sanitizeBaseName(file.name);
        const result = await unlockPdfWithQpdf({
            inputPath: tempFile.filePath,
            outputBaseName: baseName,
            password,
            signal: request.signal,
            timeoutMs: Number(process.env.UNLOCK_PDF_TIMEOUT_MS || 120000),
        });

        const headers = new Headers();
        headers.set("Content-Type", result.contentType);
        headers.set("Content-Disposition", `attachment; filename="${result.fileName}"`);
        headers.set("Cache-Control", "no-store, max-age=0");
        headers.set("X-Unlock-Type", "qpdf-decrypt");
        if (result.contentLength) {
            headers.set("Content-Length", result.contentLength.toString());
        }

        return new NextResponse(result.stream, {
            status: 200,
            headers,
        });
    } catch (error) {
        if (error instanceof UnlockPdfError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }

        if ((error as any)?.name === "AbortError") {
            return NextResponse.json({ error: "Unlock cancelled." }, { status: 400 });
        }

        return NextResponse.json(
            { error: `Failed to unlock PDF: ${error instanceof Error ? error.message : "Unknown error"}` },
            { status: 500 }
        );
    } finally {
        if (cleanup) {
            await cleanup();
        }
    }
    });
}
