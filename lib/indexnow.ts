/**
 * ==========================================================================
 * IndexNow Integration Module
 * ==========================================================================
 *
 * WHAT IS INDEXNOW?
 * IndexNow is an open protocol that enables website owners to instantly
 * notify search engines (Bing, Yandex, Naver, Seznam, etc.) when content
 * is created, updated, or deleted. Instead of waiting for crawlers to
 * discover changes (which can take days or weeks), IndexNow pushes
 * notifications in real-time.
 *
 * WHY IT IMPROVES SEO:
 * - Faster Indexing: New pages appear in search results within minutes
 *   instead of days/weeks.
 * - Crawl Budget Optimization: Search engines don't need to repeatedly
 *   crawl unchanged pages, freeing resources for new content.
 * - Real-time Updates: Content changes (titles, descriptions, content)
 *   are reflected in search results almost immediately.
 * - Reduced Server Load: Fewer unnecessary crawl requests from bots.
 * - Multi-engine Support: One submission notifies all participating
 *   search engines simultaneously.
 *
 * ARCHITECTURE:
 * This module is designed as a standalone utility with zero coupling to
 * business logic. It can be imported and called from:
 * - API routes (after content mutations)
 * - Build scripts (after static generation)
 * - Manual triggers (admin panel or CLI)
 * - Webhooks (post-deployment hooks)
 *
 * ==========================================================================
 */

// ---------------------------------------------------------------------------
// Configuration Constants
// ---------------------------------------------------------------------------

/** The IndexNow API endpoint for batch URL submission */
const INDEXNOW_API_ENDPOINT = "https://api.indexnow.org/indexnow";

/** Maximum number of URLs allowed per single IndexNow submission (protocol limit) */
const MAX_URLS_PER_BATCH = 10_000;

/** Timeout for the IndexNow API call in milliseconds */
const REQUEST_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Type Definitions
// ---------------------------------------------------------------------------

/** Result of a single IndexNow submission batch */
interface IndexNowBatchResult {
    /** Whether this batch was submitted successfully */
    success: boolean;
    /** HTTP status code returned by the IndexNow API */
    statusCode: number | null;
    /** Number of URLs in this batch */
    urlCount: number;
    /** Human-readable message describing the result */
    message: string;
}

/** Aggregated result of all batches in a submission */
export interface IndexNowSubmissionResult {
    /** Whether all batches were submitted successfully */
    success: boolean;
    /** Total number of unique URLs submitted */
    totalUrls: number;
    /** Number of batches processed */
    batchCount: number;
    /** Individual results for each batch */
    batches: IndexNowBatchResult[];
    /** Timestamp of the submission (ISO 8601) */
    timestamp: string;
}

// ---------------------------------------------------------------------------
// Environment Variable Helpers
// ---------------------------------------------------------------------------

/**
 * Retrieves the IndexNow API key from environment variables.
 *
 * The key must match the filename of the verification file hosted at the
 * site root (e.g., https://gotupdf.com/52b97b4fb8cf47eca98928c65e39e802.txt).
 *
 * @throws {Error} If INDEXNOW_KEY is not set
 */
function getIndexNowKey(): string {
    const key = process.env.INDEXNOW_KEY;
    if (!key || key.trim().length === 0) {
        throw new Error(
            "[IndexNow] INDEXNOW_KEY environment variable is not set. " +
            "Add it to your .env.local file."
        );
    }
    return key.trim();
}

/**
 * Retrieves the site URL from environment variables.
 *
 * Falls back to NEXT_PUBLIC_BASE_URL → SITE_URL constant. Strips trailing
 * slashes for consistency.
 *
 * @throws {Error} If no site URL can be determined
 */
function getSiteUrl(): string {
    const url =
        process.env.SITE_URL ||
        process.env.NEXT_PUBLIC_BASE_URL ||
        "";

    if (!url || url.trim().length === 0) {
        throw new Error(
            "[IndexNow] SITE_URL or NEXT_PUBLIC_BASE_URL environment variable is not set. " +
            "Add it to your .env.local file."
        );
    }

    // Remove trailing slash for consistent URL construction
    return url.trim().replace(/\/+$/, "");
}

/**
 * Extracts the hostname from a full URL.
 *
 * @example getHostFromUrl("https://www.gotupdf.com") → "www.gotupdf.com"
 */
function getHostFromUrl(url: string): string {
    try {
        return new URL(url).host;
    } catch {
        throw new Error(`[IndexNow] Invalid site URL: ${url}`);
    }
}

// ---------------------------------------------------------------------------
// URL Deduplication & Validation
// ---------------------------------------------------------------------------

/**
 * Deduplicates and validates a list of URLs.
 *
 * - Removes duplicate entries (case-insensitive comparison on normalized URLs)
 * - Filters out empty strings and malformed URLs
 * - Ensures all URLs belong to the same host as the configured SITE_URL
 *
 * @param urls - Raw list of URLs to process
 * @returns Deduplicated, validated list of URLs
 */
function deduplicateUrls(urls: string[]): string[] {
    const seen = new Set<string>();
    const unique: string[] = [];

    for (const url of urls) {
        const trimmed = url.trim();
        if (!trimmed) continue;

        // Normalize for deduplication (lowercase, strip trailing slash)
        const normalized = trimmed.toLowerCase().replace(/\/+$/, "");

        if (!seen.has(normalized)) {
            seen.add(normalized);
            unique.push(trimmed);
        }
    }

    return unique;
}

// ---------------------------------------------------------------------------
// Core Submission Functions
// ---------------------------------------------------------------------------

/**
 * Submits a single batch of URLs to the IndexNow API.
 *
 * Sends a POST request with the required JSON body:
 * {
 *   host: "www.gotupdf.com",
 *   key: "<INDEXNOW_KEY>",
 *   urlList: ["https://www.gotupdf.com/merge-pdf", ...]
 * }
 *
 * @param urlList - Array of URLs to submit (must be ≤ 10,000)
 * @param host - The host of the site (e.g., "www.gotupdf.com")
 * @param key - The IndexNow verification key
 * @returns Result of the batch submission
 */
async function submitBatch(
    urlList: string[],
    host: string,
    key: string
): Promise<IndexNowBatchResult> {
    // Build the IndexNow API request body per protocol specification
    const body = JSON.stringify({
        host,
        key,
        urlList,
    });

    try {
        // Use AbortController for request timeout to prevent hanging requests
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        const response = await fetch(INDEXNOW_API_ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type": "application/json; charset=utf-8",
            },
            body,
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // IndexNow API response codes:
        // 200 - URL submitted successfully
        // 202 - URL received, will be processed later
        // 400 - Invalid request (bad format)
        // 403 - Key not valid / not matching key file
        // 422 - URLs don't belong to the host
        // 429 - Too many requests (rate limited)
        const isSuccess = response.status === 200 || response.status === 202;

        const statusMessages: Record<number, string> = {
            200: "URLs submitted and accepted successfully",
            202: "URLs received and queued for processing",
            400: "Bad request — check URL format and request body",
            403: "Forbidden — IndexNow key is invalid or key file not accessible",
            422: "Unprocessable — URLs don't belong to the specified host",
            429: "Rate limited — too many requests, retry later",
        };

        const message =
            statusMessages[response.status] ||
            `Unexpected response status: ${response.status}`;

        if (isSuccess) {
            console.log(
                `[IndexNow] ✓ Batch submitted successfully (${urlList.length} URLs, status: ${response.status})`
            );
        } else {
            const responseText = await response.text().catch(() => "No response body");
            console.error(
                `[IndexNow] ✗ Batch submission failed (status: ${response.status}): ${message}`,
                `\n  Response: ${responseText}`
            );
        }

        return {
            success: isSuccess,
            statusCode: response.status,
            urlCount: urlList.length,
            message,
        };
    } catch (error: unknown) {
        // Handle network errors, timeouts, and other fetch failures
        const errorMessage =
            error instanceof Error ? error.message : "Unknown error occurred";

        const isTimeout =
            error instanceof Error && error.name === "AbortError";

        console.error(
            `[IndexNow] ✗ Batch submission error: ${isTimeout ? "Request timed out" : errorMessage
            }`
        );

        return {
            success: false,
            statusCode: null,
            urlCount: urlList.length,
            message: isTimeout
                ? `Request timed out after ${REQUEST_TIMEOUT_MS}ms`
                : `Network error: ${errorMessage}`,
        };
    }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Submit a list of URLs to IndexNow for instant search engine notification.
 *
 * This is the primary function to call from anywhere in the application.
 * It handles:
 * - URL deduplication (no duplicate submissions)
 * - Automatic batching (splits into chunks of 10,000 if needed)
 * - Error handling with detailed results
 * - Logging for observability
 *
 * WHERE THIS FUNCTION IS TRIGGERED:
 * 1. Post-build script: After `next build`, all sitemap URLs are submitted
 * 2. API route: POST /api/indexnow — for manual or webhook-triggered submission
 * 3. Deployment hooks: Can be called from Vercel deploy hooks
 *
 * @param urlList - Array of full URLs to submit
 *                  (e.g., ["https://www.gotupdf.com/merge-pdf"])
 * @returns Aggregated submission results
 *
 * @example
 * // Submit specific URLs after content changes
 * const result = await submitToIndexNow([
 *   "https://www.gotupdf.com/blog/new-post",
 *   "https://www.gotupdf.com/merge-pdf",
 * ]);
 *
 * @example
 * // Submit a single page
 * const result = await submitSingleURL("https://www.gotupdf.com/test-page");
 */
export async function submitToIndexNow(
    urlList: string[]
): Promise<IndexNowSubmissionResult> {
    const timestamp = new Date().toISOString();

    console.log(`\n[IndexNow] ━━━ Submission Started at ${timestamp} ━━━`);

    try {
        // 1. Retrieve configuration from environment
        const key = getIndexNowKey();
        const siteUrl = getSiteUrl();
        const host = getHostFromUrl(siteUrl);

        // 2. Deduplicate URLs to avoid wasting API quota
        const uniqueUrls = deduplicateUrls(urlList);

        if (uniqueUrls.length === 0) {
            console.warn("[IndexNow] No valid URLs to submit. Skipping.");
            return {
                success: true,
                totalUrls: 0,
                batchCount: 0,
                batches: [],
                timestamp,
            };
        }

        console.log(
            `[IndexNow] Processing ${uniqueUrls.length} unique URLs for host: ${host}`
        );

        // 3. Split URLs into batches of MAX_URLS_PER_BATCH (10,000)
        //    This ensures compliance with the IndexNow protocol limit
        const batches: string[][] = [];
        for (let i = 0; i < uniqueUrls.length; i += MAX_URLS_PER_BATCH) {
            batches.push(uniqueUrls.slice(i, i + MAX_URLS_PER_BATCH));
        }

        console.log(
            `[IndexNow] Split into ${batches.length} batch(es) (max ${MAX_URLS_PER_BATCH} URLs/batch)`
        );

        // 4. Submit each batch sequentially to respect rate limits
        const batchResults: IndexNowBatchResult[] = [];
        for (let i = 0; i < batches.length; i++) {
            console.log(
                `[IndexNow] Submitting batch ${i + 1}/${batches.length} (${batches[i].length} URLs)...`
            );
            const result = await submitBatch(batches[i], host, key);
            batchResults.push(result);
        }

        // 5. Determine overall success (all batches must succeed)
        const allSuccess = batchResults.every((r) => r.success);

        const summary = allSuccess
            ? `[IndexNow] ✓ All ${uniqueUrls.length} URLs submitted successfully`
            : `[IndexNow] ⚠ Some batches failed. Check logs for details.`;
        console.log(summary);
        console.log("[IndexNow] ━━━ Submission Complete ━━━\n");

        return {
            success: allSuccess,
            totalUrls: uniqueUrls.length,
            batchCount: batches.length,
            batches: batchResults,
            timestamp,
        };
    } catch (error: unknown) {
        // Catch configuration errors (missing env vars, invalid URLs)
        const errorMessage =
            error instanceof Error ? error.message : "Unknown error";

        console.error(`[IndexNow] ✗ Fatal error: ${errorMessage}`);
        console.log("[IndexNow] ━━━ Submission Failed ━━━\n");

        return {
            success: false,
            totalUrls: urlList.length,
            batchCount: 0,
            batches: [],
            timestamp,
        };
    }
}

/**
 * Submit a single URL to IndexNow.
 *
 * Convenience wrapper around submitToIndexNow for single-page submissions.
 * Useful for testing or when a single page is created/updated.
 *
 * @param url - Full URL to submit (e.g., "https://www.gotupdf.com/test-page")
 * @returns Submission result
 *
 * @example
 * // Test function — submit a single test URL
 * await submitSingleURL("https://www.gotupdf.com/test-page");
 */
export async function submitSingleURL(
    url: string
): Promise<IndexNowSubmissionResult> {
    console.log(`[IndexNow] Single URL submission: ${url}`);
    return submitToIndexNow([url]);
}

/**
 * Generate a complete list of all site URLs from the sitemap configuration.
 *
 * This function mirrors the logic in app/sitemap.ts but returns plain URL
 * strings instead of sitemap metadata objects. Used by:
 * - The post-build submission script
 * - The API route for full-site resubmission
 *
 * @returns Array of all known site URLs
 */
export async function getAllSiteUrls(): Promise<string[]> {
    // Dynamically import constants to avoid circular dependencies
    // and to ensure we always have the latest values
    const { SITE_URL, PDF_TOOLS } = await import("@/lib/constants");
    const { BLOG_POSTS } = await import("@/lib/blog-data");

    const urls: string[] = [];

    // 1. Homepage
    urls.push(SITE_URL);

    // 2. Static pages (mirrors sitemap.ts structure)
    const staticPaths = [
        "/about-us",
        "/contact-us",
        "/privacy",
        "/terms",
        "/disclaimer",
        "/cookie-policy",
        "/refund-policy",
        "/security-policy",
        "/dmca",
        "/faq",
        "/blog",
        "/upcoming-features",
    ];
    for (const path of staticPaths) {
        urls.push(`${SITE_URL}${path}`);
    }

    // 3. Blog posts
    for (const post of BLOG_POSTS) {
        urls.push(`${SITE_URL}/blog/${post.slug}`);
    }

    // 4. Tool pages
    for (const tool of PDF_TOOLS) {
        urls.push(`${SITE_URL}${tool.path}`);
    }

    return urls;
}
