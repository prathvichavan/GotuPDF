/**
 * ==========================================================================
 * IndexNow API Route — POST /api/indexnow
 * ==========================================================================
 *
 * This API route provides a server-side endpoint to trigger IndexNow
 * URL submissions. It can be called from:
 *
 * 1. Vercel Deploy Hooks — automatically notify search engines after deploy
 * 2. Admin actions — manually trigger resubmission of all site URLs
 * 3. CMS webhooks — when blog posts or pages are created/updated/deleted
 * 4. Cron jobs — periodic resubmission for freshness
 *
 * Security: Protected by an optional INDEXNOW_API_SECRET env var.
 * If set, requests must include a matching Authorization header.
 *
 * Endpoints:
 * - POST /api/indexnow         → Submit specific URLs or all site URLs
 * - GET  /api/indexnow         → Health check / status
 *
 * ==========================================================================
 */

import { NextRequest, NextResponse } from "next/server";
import {
    submitToIndexNow,
    submitSingleURL,
    getAllSiteUrls,
    type IndexNowSubmissionResult,
} from "@/lib/indexnow";

// ---------------------------------------------------------------------------
// Authorization Helper
// ---------------------------------------------------------------------------

/**
 * Validates the request authorization if INDEXNOW_API_SECRET is configured.
 *
 * If INDEXNOW_API_SECRET is not set, all requests are allowed (useful for
 * development). In production, set this env var to prevent unauthorized
 * submissions.
 *
 * Expected header: Authorization: Bearer <INDEXNOW_API_SECRET>
 */
function isAuthorized(request: NextRequest): boolean {
    const secret = process.env.INDEXNOW_API_SECRET;

    // If no secret is configured, allow all requests
    if (!secret) return true;

    const authHeader = request.headers.get("authorization");
    if (!authHeader) return false;

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    return token === secret;
}

// ---------------------------------------------------------------------------
// GET /api/indexnow — Health Check
// ---------------------------------------------------------------------------

/**
 * Returns the IndexNow integration status.
 * Useful for monitoring and verifying the integration is live.
 */
export async function GET() {
    const hasKey = !!process.env.INDEXNOW_KEY;
    const hasSiteUrl = !!(process.env.SITE_URL || process.env.NEXT_PUBLIC_BASE_URL);

    return NextResponse.json(
        {
            status: "ok",
            integration: "indexnow",
            configured: hasKey && hasSiteUrl,
            keyPresent: hasKey,
            siteUrlPresent: hasSiteUrl,
            timestamp: new Date().toISOString(),
        },
        { status: 200 }
    );
}

// ---------------------------------------------------------------------------
// POST /api/indexnow — Submit URLs
// ---------------------------------------------------------------------------

/**
 * Submit URLs to IndexNow.
 *
 * Request body options:
 *
 * 1. Submit specific URLs:
 *    { "urls": ["https://www.gotupdf.com/merge-pdf", ...] }
 *
 * 2. Submit a single URL:
 *    { "url": "https://www.gotupdf.com/merge-pdf" }
 *
 * 3. Submit ALL site URLs (full reindex):
 *    { "all": true }
 *
 * Response:
 *    { success: boolean, totalUrls: number, batchCount: number, ... }
 */
export async function POST(request: NextRequest) {
    // 1. Authorization check
    if (!isAuthorized(request)) {
        return NextResponse.json(
            {
                success: false,
                error: "Unauthorized. Provide a valid Authorization: Bearer <secret> header.",
            },
            { status: 401 }
        );
    }

    try {
        // 2. Parse request body
        const body = await request.json().catch(() => null);

        if (!body) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Invalid JSON body. Expected { urls: [...] } or { all: true }",
                },
                { status: 400 }
            );
        }

        let result: IndexNowSubmissionResult;

        // 3. Determine submission mode
        if (body.all === true) {
            // Mode: Submit all known site URLs (mirrors sitemap)
            console.log("[IndexNow API] Full site URL submission requested");
            const allUrls = await getAllSiteUrls();
            result = await submitToIndexNow(allUrls);
        } else if (body.url && typeof body.url === "string") {
            // Mode: Submit a single URL
            console.log(`[IndexNow API] Single URL submission: ${body.url}`);
            result = await submitSingleURL(body.url);
        } else if (body.urls && Array.isArray(body.urls)) {
            // Mode: Submit a list of specific URLs
            console.log(`[IndexNow API] Batch URL submission: ${body.urls.length} URLs`);
            result = await submitToIndexNow(body.urls);
        } else {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        'Invalid body format. Use { "urls": [...] }, { "url": "..." }, or { "all": true }',
                },
                { status: 400 }
            );
        }

        // 4. Return the result
        return NextResponse.json(result, {
            status: result.success ? 200 : 207, // 207 Multi-Status if partial failure
        });
    } catch (error: unknown) {
        const message =
            error instanceof Error ? error.message : "Internal server error";

        console.error(`[IndexNow API] Error: ${message}`);

        return NextResponse.json(
            {
                success: false,
                error: message,
            },
            { status: 500 }
        );
    }
}
