import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { url } = body;

        if (!url) {
            return NextResponse.json(
                { error: "URL is required" },
                { status: 400 }
            );
        }

        // Validate URL format
        let parsedUrl: URL;
        try {
            parsedUrl = new URL(url);
        } catch {
            return NextResponse.json(
                { error: "Invalid URL format" },
                { status: 400 }
            );
        }

        // Only allow Google Drive and OneDrive URLs
        const hostname = parsedUrl.hostname.toLowerCase();
        if (!hostname.includes("drive.google.com") && 
            !hostname.includes("1drv.ms") &&
            !hostname.includes("onedrive.live.com")) {
            return NextResponse.json(
                { error: "Only Google Drive and OneDrive links are supported" },
                { status: 400 }
            );
        }

        // Handle Google Drive links
        if (hostname.includes("drive.google.com")) {
            return await handleGoogleDrive(url);
        }

        // Handle OneDrive links
        if (hostname.includes("1drv.ms") || hostname.includes("onedrive.live.com")) {
            return await handleOneDrive(url);
        }

        return NextResponse.json(
            { error: "Unsupported link type" },
            { status: 400 }
        );
    } catch (error) {
        console.error("Cloud import error:", error);
        return NextResponse.json(
            { error: "Failed to import file" },
            { status: 500 }
        );
    }
}

async function handleGoogleDrive(url: string): Promise<NextResponse> {
    try {
        // Extract file ID from Google Drive URL
        const fileIdMatch = url.match(/[?&]id=([a-zA-Z0-9-_]+)|\/d\/([a-zA-Z0-9-_]+)/);
        const fileId = fileIdMatch?.[1] || fileIdMatch?.[2];

        if (!fileId) {
            return NextResponse.json(
                { error: "Could not extract file ID from Google Drive URL" },
                { status: 400 }
            );
        }

        // Use Google Drive export/download URL
        const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

        const response = await fetch(downloadUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            },
        });

        if (!response.ok) {
            return NextResponse.json(
                { error: "Failed to download file from Google Drive" },
                { status: response.status }
            );
        }

        const buffer = await response.arrayBuffer();
        const contentType = response.headers.get("content-type") || "application/octet-stream";
        const contentDisposition = response.headers.get("content-disposition") || "attachment; filename=google-drive-file.pdf";

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                "Content-Type": contentType,
                "Content-Disposition": contentDisposition,
                "Cache-Control": "no-store",
            },
        });
    } catch (error) {
        console.error("Google Drive import error:", error);
        return NextResponse.json(
            { error: "Failed to import from Google Drive" },
            { status: 500 }
        );
    }
}

async function handleOneDrive(url: string): Promise<NextResponse> {
    try {
        // OneDrive share links need to be converted to download links
        let downloadUrl = url;

        // If it's a 1drv.ms short URL or regular OneDrive URL, append download parameters
        if (url.includes("1drv.ms") || url.includes("onedrive.live.com")) {
            // Add download=1 parameter to get direct download
            const separator = url.includes("?") ? "&" : "?";
            downloadUrl = `${url}${separator}download=1`;
        }

        const response = await fetch(downloadUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            },
            redirect: "follow",
        });

        if (!response.ok) {
            return NextResponse.json(
                { error: "Failed to download file from OneDrive" },
                { status: response.status }
            );
        }

        const buffer = await response.arrayBuffer();
        const contentType = response.headers.get("content-type") || "application/octet-stream";
        const contentDisposition = response.headers.get("content-disposition") || "attachment; filename=onedrive-file.pdf";

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                "Content-Type": contentType,
                "Content-Disposition": contentDisposition,
                "Cache-Control": "no-store",
            },
        });
    } catch (error) {
        console.error("OneDrive import error:", error);
        return NextResponse.json(
            { error: "Failed to import from OneDrive" },
            { status: 500 }
        );
    }
}
