import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Contact from "@/models/Contact";

// Rate limiting map
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const maxRequests = 5;

    const record = rateLimitMap.get(ip);

    if (!record || now > record.resetTime) {
        rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
        return true;
    }

    if (record.count >= maxRequests) {
        return false;
    }

    record.count++;
    return true;
}

function getClientIP(request: NextRequest): string {
    const forwarded = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    return forwarded?.split(",")[0].trim() || realIp || "unknown";
}

function sanitizeText(value: unknown): string {
    if (typeof value !== "string") return "";
    return value
        .replace(/\u0000/g, "")
        .replace(/[\u0001-\u001F\u007F]/g, "")
        .trim();
}

function normalizeEmail(value: unknown): string {
    return sanitizeText(value).toLowerCase();
}

// Email validation regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Validation function
function validateContactData(data: {
    fullName?: string;
    email?: string;
    subject?: string;
    message?: string;
}): { valid: boolean; errors: { field: string; message: string }[] } {
    const errors: { field: string; message: string }[] = [];

    const fullName = sanitizeText(data.fullName);
    const email = normalizeEmail(data.email);
    const subject = sanitizeText(data.subject);
    const message = sanitizeText(data.message);

    // Full name validation
    if (!fullName) {
        errors.push({ field: "fullName", message: "Full Name is required" });
    } else if (fullName.length > 100) {
        errors.push({ field: "fullName", message: "Full Name cannot exceed 100 characters" });
    }

    // Email validation
    if (!email) {
        errors.push({ field: "email", message: "Email is required" });
    } else if (!emailRegex.test(email)) {
        errors.push({ field: "email", message: "Please enter a valid email address" });
    }

    // Subject validation
    if (!subject) {
        errors.push({ field: "subject", message: "Subject is required" });
    } else if (subject.length > 200) {
        errors.push({ field: "subject", message: "Subject cannot exceed 200 characters" });
    }

    // Message validation
    if (!message) {
        errors.push({ field: "message", message: "Message is required" });
    } else if (message.length > 2000) {
        errors.push({ field: "message", message: "Message cannot exceed 2000 characters" });
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

export async function POST(request: NextRequest) {
    try {
        // Get client IP for rate limiting
        const ip = getClientIP(request);

        // Check rate limit
        if (!checkRateLimit(ip)) {
            return NextResponse.json(
                { error: "Too many requests. Please try again later." },
                { status: 429 }
            );
        }

        // Parse request body
        let body;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                { error: "Invalid JSON in request body" },
                { status: 400 }
            );
        }

        // Validate input
        const validation = validateContactData(body);
        if (!validation.valid) {
            return NextResponse.json(
                { error: "Validation failed", details: validation.errors },
                { status: 400 }
            );
        }

        // Connect to MongoDB
        await connectDB();

        const fullName = sanitizeText(body.fullName ?? body.name);
        const email = normalizeEmail(body.email);
        const subject = sanitizeText(body.subject);
        const message = sanitizeText(body.message);

        // Create contact message
        const contact = await Contact.create({
            fullName,
            email,
            subject,
            message,
            read: false,
            replied: false,
            source: "website",
            ipAddress: ip,
            userAgent: request.headers.get("user-agent") || "unknown",
            status: "new",
        });

        return NextResponse.json(
            { success: true },
            { status: 200 }
        );
    } catch (error) {
        console.error("Contact API Error:", error);

        // Handle MongoDB validation errors
        if (error instanceof Error && error.name === "ValidationError") {
            return NextResponse.json(
                { error: "Validation failed. Please check your input." },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { error: "Failed to send message. Please try again later." },
            { status: 500 }
        );
    }
}

