import { NextRequest, NextResponse } from "next/server";
import {
    ProtectPdfError,
    protectPdf,
    sanitizeBaseName,
    type PdfPermissions,
} from "@/lib/protectPdfQpdf";
import { withUsageLimit } from "@/lib/usageLimiter";

export const runtime = "nodejs";
export const maxDuration = 300;

const DEFAULT_MAX_MB = 50;

function getMaxFileSizeBytes() {
    const maxMbEnv = Number(process.env.PROTECT_PDF_MAX_MB || DEFAULT_MAX_MB);
    return Math.max(1, maxMbEnv) * 1024 * 1024;
}

function parsePermissions(raw?: string | null): PdfPermissions {
    const list = (raw || "").split(",").map((s) => s.trim()).filter(Boolean);
    return {
        print: list.includes("print"),
        copy: list.includes("copy"),
        modify: list.includes("modify"),
        annotate: list.includes("annotate"),
    };
}

export async function POST(request: NextRequest) {
    return withUsageLimit(request, async () => {
    try {
        if (request.signal.aborted) {
            return NextResponse.json({ error: "Upload cancelled." }, { status: 400 });
        }

        const formData = await request.formData();
        const file =
            (formData.get("file0") as File | null) ||
            (formData.get("file") as File | null);
        const userPasswordRaw = formData.get("userPassword");
        const ownerPasswordRaw = formData.get("ownerPassword");
        const userPassword = typeof userPasswordRaw === "string" ? userPasswordRaw : "";
        const ownerPassword = typeof ownerPasswordRaw === "string" ? ownerPasswordRaw : "";
        const permissionsRaw = formData.get("permissions") as string | null;

        if (!file) {
            return NextResponse.json({ error: "Please upload a PDF file." }, { status: 400 });
        }
        if (!userPassword.trim()) {
            return NextResponse.json({ error: "User password is required." }, { status: 400 });
        }
        if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
            return NextResponse.json({ error: "Only PDF files are supported." }, { status: 400 });
        }

        const maxBytes = getMaxFileSizeBytes();
        if (file.size > maxBytes) {
            return NextResponse.json(
                { error: `File too large. Max allowed is ${Math.round(maxBytes / 1024 / 1024)}MB.` },
                { status: 413 },
            );
        }

        // Read file bytes
        const arrayBuffer = await file.arrayBuffer();
        const pdfBytes = Buffer.from(arrayBuffer);

        const permissions = parsePermissions(permissionsRaw);
        const baseName = sanitizeBaseName(file.name);

        const result = await protectPdf({
            pdfBytes,
            outputBaseName: baseName,
            userPassword,
            ownerPassword,
            permissions,
        });

        const headers = new Headers();
        headers.set("Content-Type", result.contentType);
        headers.set("Content-Disposition", `attachment; filename="${result.fileName}"`);
        headers.set("Cache-Control", "no-store, max-age=0");
        headers.set("Content-Length", result.pdfBytes.length.toString());
        headers.set("X-Encryption", "AES-256");
        headers.set("X-Permissions-Print", String(permissions.print));
        headers.set("X-Permissions-Copy", String(permissions.copy));
        headers.set("X-Permissions-Modify", String(permissions.modify));
        headers.set("X-Permissions-Annotate", String(permissions.annotate));

        return new NextResponse(new Uint8Array(result.pdfBytes), { status: 200, headers });
    } catch (error) {
        if (error instanceof ProtectPdfError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error("[PROTECT-PDF] Error:", error);
        return NextResponse.json(
            { error: `Failed to protect PDF: ${error instanceof Error ? error.message : "Unknown error"}` },
            { status: 500 },
        );
    }
    });
}
