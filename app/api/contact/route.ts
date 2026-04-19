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

// Email validation regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Validation function
function validateContactData(data: {
    name?: string;
    email?: string;
    subject?: string;
    message?: string;
}): { valid: boolean; errors: { field: string; message: string }[] } {
    const errors: { field: string; message: string }[] = [];

    // Name validation
    if (!data.name || typeof data.name !== "string") {
        errors.push({ field: "name", message: "Name is required" });
    } else if (data.name.trim().length < 2) {
        errors.push({ field: "name", message: "Name must be at least 2 characters" });
    } else if (data.name.trim().length > 100) {
        errors.push({ field: "name", message: "Name cannot exceed 100 characters" });
    }

    // Email validation
    if (!data.email || typeof data.email !== "string") {
        errors.push({ field: "email", message: "Email is required" });
    } else if (!emailRegex.test(data.email.trim())) {
        errors.push({ field: "email", message: "Please enter a valid email address" });
    }

    // Subject validation
    if (!data.subject || typeof data.subject !== "string") {
        errors.push({ field: "subject", message: "Subject is required" });
    } else if (data.subject.trim().length < 5) {
        errors.push({ field: "subject", message: "Subject must be at least 5 characters" });
    } else if (data.subject.trim().length > 200) {
        errors.push({ field: "subject", message: "Subject cannot exceed 200 characters" });
    }

    // Message validation
    if (!data.message || typeof data.message !== "string") {
        errors.push({ field: "message", message: "Message is required" });
    } else if (data.message.trim().length < 10) {
        errors.push({ field: "message", message: "Message must be at least 10 characters" });
    } else if (data.message.trim().length > 2000) {
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

        // Create contact message
        const contact = await Contact.create({
            name: body.name.trim(),
            email: body.email.toLowerCase().trim(),
            subject: body.subject.trim(),
            message: body.message.trim(),
            ipAddress: ip,
            status: "new",
        });

        return NextResponse.json(
            {
                success: true,
                message: "Message sent successfully! We will get back to you soon.",
                id: contact._id.toString(),
            },
            { status: 201 }
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

