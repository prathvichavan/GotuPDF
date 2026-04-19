import { NextRequest, NextResponse } from "next/server";
import { withUsageLimit } from "@/lib/usageLimiter";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    return withUsageLimit(req, async () => {
    try {
        const formData = await req.formData();
        const file1 = formData.get("file0") as File | null;
        const file2 = formData.get("file1") as File | null;

        if (!file1 || !file2) {
            return NextResponse.json({ error: "Two PDF files are required" }, { status: 400 });
        }

        // Extract text from both PDFs using pdfjs-dist
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "";

        const text1 = await extractText(pdfjs, await file1.arrayBuffer());
        const text2 = await extractText(pdfjs, await file2.arrayBuffer());

        // Compute line-by-line diff
        const lines1 = text1.split("\n");
        const lines2 = text2.split("\n");

        const diff = computeDiff(lines1, lines2);

        const report = {
            file1: { name: file1.name, pages: lines1.length > 0 ? "Extracted" : "Empty", lineCount: lines1.length },
            file2: { name: file2.name, pages: lines2.length > 0 ? "Extracted" : "Empty", lineCount: lines2.length },
            identical: lines1.join("\n") === lines2.join("\n"),
            additions: diff.filter(d => d.type === "added").length,
            deletions: diff.filter(d => d.type === "removed").length,
            unchanged: diff.filter(d => d.type === "same").length,
            diff: diff.slice(0, 5000), // Limit to first 5000 diff entries
        };

        return NextResponse.json(report, {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (error: any) {
        console.error("Compare PDF error:", error);
        return NextResponse.json(
            { error: error?.message || "Failed to compare PDFs" },
            { status: 500 }
        );
    }
    });
}

async function extractText(pdfjs: any, buffer: ArrayBuffer): Promise<string> {
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), disableWorker: true, isEvalSupported: false }).promise;
    const textParts: string[] = [];

    for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map((item: any) => item.str).join(" ");
        textParts.push(pageText);
    }

    return textParts.join("\n");
}

interface DiffLine {
    type: "same" | "added" | "removed";
    text: string;
    lineNumber?: number;
}

function computeDiff(lines1: string[], lines2: string[]): DiffLine[] {
    const result: DiffLine[] = [];
    const maxLen = Math.max(lines1.length, lines2.length);

    // Simple line-by-line comparison (LCS-based would be better for production)
    let i = 0, j = 0;

    while (i < lines1.length || j < lines2.length) {
        if (i >= lines1.length) {
            result.push({ type: "added", text: lines2[j], lineNumber: j + 1 });
            j++;
        } else if (j >= lines2.length) {
            result.push({ type: "removed", text: lines1[i], lineNumber: i + 1 });
            i++;
        } else if (lines1[i] === lines2[j]) {
            result.push({ type: "same", text: lines1[i], lineNumber: i + 1 });
            i++;
            j++;
        } else {
            // Look ahead to see if lines1[i] appears soon in lines2
            let foundInB = -1;
            for (let k = j + 1; k < Math.min(j + 5, lines2.length); k++) {
                if (lines1[i] === lines2[k]) { foundInB = k; break; }
            }
            let foundInA = -1;
            for (let k = i + 1; k < Math.min(i + 5, lines1.length); k++) {
                if (lines2[j] === lines1[k]) { foundInA = k; break; }
            }

            if (foundInB >= 0 && (foundInA < 0 || foundInB - j <= foundInA - i)) {
                // Lines were added in file2
                while (j < foundInB) {
                    result.push({ type: "added", text: lines2[j], lineNumber: j + 1 });
                    j++;
                }
            } else if (foundInA >= 0) {
                // Lines were removed from file1
                while (i < foundInA) {
                    result.push({ type: "removed", text: lines1[i], lineNumber: i + 1 });
                    i++;
                }
            } else {
                result.push({ type: "removed", text: lines1[i], lineNumber: i + 1 });
                result.push({ type: "added", text: lines2[j], lineNumber: j + 1 });
                i++;
                j++;
            }
        }
    }

    return result;
}
