/**
 * ==========================================================================
 * IndexNow Post-Build Submission Script
 * ==========================================================================
 *
 * This script runs AFTER `next build` completes and automatically submits
 * all site URLs to IndexNow. This ensures that every deployment triggers
 * a full search engine notification — keeping content indexed and fresh.
 *
 * HOW IT WORKS:
 * 1. Reads site configuration from environment variables
 * 2. Builds a comprehensive list of all site URLs (static pages, tools, blog)
 * 3. Submits them to the IndexNow API in deduplicated, batched requests
 *
 * WHEN THIS RUNS:
 * - Triggered via the `postbuild` npm script after `next build`
 * - Can also be run manually: `node scripts/indexnow-submit.js`
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - INDEXNOW_KEY: Your IndexNow verification key
 * - SITE_URL or NEXT_PUBLIC_BASE_URL: The production site URL
 *
 * NOTE: This script uses dynamic imports to load the project modules
 * after the build output is available.
 *
 * ==========================================================================
 */

// ---------------------------------------------------------------------------
// Site URL Builder (standalone — no dependency on compiled app code)
// ---------------------------------------------------------------------------

/**
 * Hardcoded fallback list of all known site URLs.
 *
 * This is intentionally duplicated from the app's sitemap.ts to ensure
 * the post-build script works even without loading the Next.js app.
 * The list should be kept in sync with app/sitemap.ts.
 */
function buildAllSiteUrls(siteUrl) {
    const urls = [];

    // Homepage
    urls.push(siteUrl);

    // Static pages
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
    ];
    staticPaths.forEach((path) => urls.push(`${siteUrl}${path}`));

    // Tool pages (mirrors PDF_TOOLS from lib/constants.ts)
    const toolPaths = [
        "/merge-pdf",
        "/split-pdf",
        "/compress-pdf",
        "/pdf-to-word",
        "/word-to-pdf",
        "/pdf-to-jpg",
        "/jpg-to-pdf",
        "/pdf-to-png",
        "/png-to-pdf",
        "/pdf-to-excel",
        "/excel-to-pdf",
        "/pdf-to-ppt",
        "/protect-pdf",
        "/unlock-pdf",
        "/rotate-pdf",
        "/reorder-pdf",
        "/edit-pdf",
        "/convert-python-jupyter-to-pdf",
    ];
    toolPaths.forEach((path) => urls.push(`${siteUrl}${path}`));

    return urls;
}

// ---------------------------------------------------------------------------
// IndexNow Submission (standalone fetch-based implementation)
// ---------------------------------------------------------------------------

async function submitToIndexNowDirect(urls, host, key) {
    const INDEXNOW_API = "https://api.indexnow.org/indexnow";
    const MAX_BATCH = 10000;

    // Deduplicate
    const unique = [...new Set(urls.map((u) => u.trim()).filter(Boolean))];

    if (unique.length === 0) {
        console.log("[IndexNow] No URLs to submit.");
        return;
    }

    // Batch
    const batches = [];
    for (let i = 0; i < unique.length; i += MAX_BATCH) {
        batches.push(unique.slice(i, i + MAX_BATCH));
    }

    console.log(
        `[IndexNow] Submitting ${unique.length} URL(s) in ${batches.length} batch(es)...`
    );

    for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`\n[IndexNow] Batch ${i + 1}/${batches.length} (${batch.length} URLs)`);

        try {
            const response = await fetch(INDEXNOW_API, {
                method: "POST",
                headers: { "Content-Type": "application/json; charset=utf-8" },
                body: JSON.stringify({ host, key, urlList: batch }),
            });

            if (response.status === 200 || response.status === 202) {
                console.log(`[IndexNow] ✓ Batch ${i + 1} accepted (status: ${response.status})`);
            } else {
                const text = await response.text().catch(() => "");
                console.error(
                    `[IndexNow] ✗ Batch ${i + 1} rejected (status: ${response.status}): ${text}`
                );
            }
        } catch (error) {
            console.error(`[IndexNow] ✗ Batch ${i + 1} network error:`, error.message);
        }
    }
}

// ---------------------------------------------------------------------------
// Main Entrypoint
// ---------------------------------------------------------------------------

async function main() {
    console.log("\n════════════════════════════════════════════════════════");
    console.log("  IndexNow Post-Build Submission");
    console.log("════════════════════════════════════════════════════════\n");

    // 1. Read environment variables
    const key = process.env.INDEXNOW_KEY;
    const siteUrl = (
        process.env.SITE_URL ||
        process.env.NEXT_PUBLIC_BASE_URL ||
        ""
    ).replace(/\/+$/, "");

    if (!key) {
        console.warn("[IndexNow] ⚠ INDEXNOW_KEY not set. Skipping submission.");
        console.warn("  Set INDEXNOW_KEY in your environment or .env.local file.");
        process.exit(0);
    }

    if (!siteUrl) {
        console.warn(
            "[IndexNow] ⚠ SITE_URL / NEXT_PUBLIC_BASE_URL not set. Skipping."
        );
        process.exit(0);
    }

    // 2. Extract host from URL
    let host;
    try {
        host = new URL(siteUrl).host;
    } catch {
        console.error(`[IndexNow] ✗ Invalid SITE_URL: ${siteUrl}`);
        process.exit(1);
    }

    console.log(`[IndexNow] Site URL : ${siteUrl}`);
    console.log(`[IndexNow] Host     : ${host}`);
    console.log(`[IndexNow] Key      : ${key.substring(0, 8)}...`);

    // 3. Build URL list
    const urls = buildAllSiteUrls(siteUrl);
    console.log(`[IndexNow] Total URLs: ${urls.length}`);

    // 4. Submit
    await submitToIndexNowDirect(urls, host, key);

    console.log("\n════════════════════════════════════════════════════════");
    console.log("  IndexNow Submission Complete");
    console.log("════════════════════════════════════════════════════════\n");
}

main().catch((err) => {
    console.error("[IndexNow] Fatal error:", err);
    // Don't fail the build — IndexNow submission failure is non-critical
    process.exit(0);
});
