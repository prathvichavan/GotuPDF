import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import crypto from "crypto";
import connectDB from "./mongodb";
import UsageLimit from "@/models/UsageLimit";
import User from "@/models/User";
import { authOptions } from "./authOptions";

// Constants
const GUEST_LIMIT = 10;
const FREE_USER_LIMIT = 25;
const ROLLING_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 20; // max requests per minute

// In-memory rate limiter (for production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Error codes
export const USAGE_ERROR_CODES = {
    LOGIN_REQUIRED: "LOGIN_REQUIRED",
    LIMIT_REACHED: "LIMIT_REACHED",
    RATE_LIMITED: "RATE_LIMITED",
} as const;

export type UsageErrorCode = typeof USAGE_ERROR_CODES[keyof typeof USAGE_ERROR_CODES];

interface UsageCheckResult {
    allowed: boolean;
    errorCode?: UsageErrorCode;
    message?: string;
    remaining?: number;
    resetAt?: Date;
}

interface UserInfo {
    identifier: string;
    type: "guest" | "user";
    plan: "free" | "pro";
    userId?: string;
}

/**
 * Generate a secure hash from IP and User-Agent
 * Never stores raw IP addresses
 */
function generateGuestIdentifier(request: NextRequest): string {
    // Get IP from various headers (handles proxies)
    const forwardedFor = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const cfConnectingIp = request.headers.get("cf-connecting-ip");
    
    const ip = cfConnectingIp || realIp || forwardedFor?.split(",")[0]?.trim() || "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";
    
    // Create SHA256 hash - never store raw IP
    const data = `${ip}:${userAgent}:gotupdf-salt-2024`;
    return crypto.createHash("sha256").update(data).digest("hex");
}

/**
 * Check rate limiting (brute force protection)
 */
function checkRateLimit(identifier: string): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    const record = rateLimitStore.get(identifier);
    
    if (!record || now > record.resetTime) {
        rateLimitStore.set(identifier, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
        return { allowed: true };
    }
    
    if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
        const retryAfter = Math.ceil((record.resetTime - now) / 1000);
        return { allowed: false, retryAfter };
    }
    
    record.count++;
    return { allowed: true };
}

/**
 * Clean up old rate limit entries periodically
 */
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of rateLimitStore.entries()) {
        if (now > value.resetTime) {
            rateLimitStore.delete(key);
        }
    }
}, 60000); // Clean every minute

/**
 * Get user information from session or generate guest identifier
 */
async function getUserInfo(request: NextRequest): Promise<UserInfo> {
    try {
        const session = await getServerSession(authOptions);
        
        if (session?.user?.id) {
            // Logged in user - check their plan
            await connectDB();
            
            // Use findOne with email instead of findById since Google OAuth IDs aren't valid ObjectIds
            let user = null;
            try {
                // First try findById for MongoDB ObjectIds
                if (session.user.id.length === 24) {
                    user = await User.findById(session.user.id).lean();
                }
            } catch {
                // If that fails, try finding by email
            }
            
            if (!user && session.user.email) {
                user = await User.findOne({ email: session.user.email }).lean();
            }
            
            return {
                identifier: session.user.id,
                type: "user",
                plan: (user as { plan?: string })?.plan === "pro" ? "pro" : "free",
                userId: session.user.id,
            };
        }
    } catch (error) {
        console.error("Error getting session:", error);
    }
    
    // Guest user
    return {
        identifier: generateGuestIdentifier(request),
        type: "guest",
        plan: "free",
    };
}

/**
 * Main usage check function - enforces limits server-side
 */
export async function checkUsageLimit(request: NextRequest): Promise<UsageCheckResult> {
    try {
        const userInfo = await getUserInfo(request);
        
        // Pro users have unlimited access
        if (userInfo.plan === "pro") {
            return { allowed: true, remaining: -1 }; // -1 indicates unlimited
        }
        
        // Check rate limiting first (brute force protection)
        const rateCheck = checkRateLimit(userInfo.identifier);
        if (!rateCheck.allowed) {
            return {
                allowed: false,
                errorCode: USAGE_ERROR_CODES.RATE_LIMITED,
                message: `Too many requests. Please try again in ${rateCheck.retryAfter} seconds.`,
            };
        }
        
        await connectDB();
        
        const now = new Date();
        const limit = userInfo.type === "guest" ? GUEST_LIMIT : FREE_USER_LIMIT;
        
        // Find existing usage record
        let usageRecord = await UsageLimit.findOne({ identifier: userInfo.identifier });
        
        if (!usageRecord) {
            // Create new record - first task
            usageRecord = await UsageLimit.create({
                identifier: userInfo.identifier,
                type: userInfo.type,
                plan: userInfo.plan,
                count: 1,
                lastReset: now,
            });
            
            return { 
                allowed: true, 
                remaining: limit - 1,
                resetAt: new Date(now.getTime() + ROLLING_WINDOW_MS),
            };
        }
        
        // Check if rolling window has passed (24 hours)
        const timeSinceReset = now.getTime() - usageRecord.lastReset.getTime();
        
        if (timeSinceReset >= ROLLING_WINDOW_MS) {
            // Reset counter - new 24-hour window
            usageRecord.count = 1;
            usageRecord.lastReset = now;
            usageRecord.plan = userInfo.plan; // Update plan in case it changed
            await usageRecord.save();
            
            return { 
                allowed: true, 
                remaining: limit - 1,
                resetAt: new Date(now.getTime() + ROLLING_WINDOW_MS),
            };
        }
        
        // Within rolling window - check limits
        if (usageRecord.count >= limit) {
            const resetAt = new Date(usageRecord.lastReset.getTime() + ROLLING_WINDOW_MS);
            
            if (userInfo.type === "guest") {
                return {
                    allowed: false,
                    errorCode: USAGE_ERROR_CODES.LOGIN_REQUIRED,
                    message: "You have reached 10 free tasks. Please login to continue.",
                    remaining: 0,
                    resetAt,
                };
            } else {
                return {
                    allowed: false,
                    errorCode: USAGE_ERROR_CODES.LIMIT_REACHED,
                    message: "You reached your daily limit of 25 tasks. Upgrade to Pro for unlimited access.",
                    remaining: 0,
                    resetAt,
                };
            }
        }
        
        // Increment counter
        usageRecord.count += 1;
        usageRecord.plan = userInfo.plan; // Update plan in case it changed
        await usageRecord.save();
        
        return { 
            allowed: true, 
            remaining: limit - usageRecord.count,
            resetAt: new Date(usageRecord.lastReset.getTime() + ROLLING_WINDOW_MS),
        };
        
    } catch (error) {
        console.error("Usage limit check error:", error);
        // On error, allow the request but log it (fail-open for UX, but monitor)
        return { allowed: true, remaining: -1 };
    }
}

/**
 * Get current usage status without incrementing
 */
export async function getUsageStatus(request: NextRequest): Promise<{
    type: "guest" | "user";
    plan: "free" | "pro";
    used: number;
    limit: number;
    remaining: number;
    resetAt: Date | null;
}> {
    try {
        const userInfo = await getUserInfo(request);
        
        // Pro users have unlimited access
        if (userInfo.plan === "pro") {
            return {
                type: userInfo.type,
                plan: "pro",
                used: 0,
                limit: -1, // unlimited
                remaining: -1,
                resetAt: null,
            };
        }
        
        await connectDB();
        
        const limit = userInfo.type === "guest" ? GUEST_LIMIT : FREE_USER_LIMIT;
        const usageRecord = await UsageLimit.findOne({ identifier: userInfo.identifier });
        
        if (!usageRecord) {
            return {
                type: userInfo.type,
                plan: userInfo.plan,
                used: 0,
                limit,
                remaining: limit,
                resetAt: null,
            };
        }
        
        const now = new Date();
        const timeSinceReset = now.getTime() - usageRecord.lastReset.getTime();
        
        // If 24 hours have passed, counter would reset
        if (timeSinceReset >= ROLLING_WINDOW_MS) {
            return {
                type: userInfo.type,
                plan: userInfo.plan,
                used: 0,
                limit,
                remaining: limit,
                resetAt: null,
            };
        }
        
        return {
            type: userInfo.type,
            plan: userInfo.plan,
            used: usageRecord.count,
            limit,
            remaining: Math.max(0, limit - usageRecord.count),
            resetAt: new Date(usageRecord.lastReset.getTime() + ROLLING_WINDOW_MS),
        };
        
    } catch (error) {
        console.error("Get usage status error:", error);
        return {
            type: "guest",
            plan: "free",
            used: 0,
            limit: GUEST_LIMIT,
            remaining: GUEST_LIMIT,
            resetAt: null,
        };
    }
}

/**
 * Wrapper function to apply usage limiting to API routes
 * Use this in your route handlers
 */
export async function withUsageLimit<T>(
    request: NextRequest,
    handler: () => Promise<T>
): Promise<T | NextResponse> {
    const result = await checkUsageLimit(request);
    
    if (!result.allowed) {
        return NextResponse.json(
            {
                error: result.message,
                code: result.errorCode,
                resetAt: result.resetAt?.toISOString(),
            },
            { 
                status: result.errorCode === USAGE_ERROR_CODES.RATE_LIMITED ? 429 : 403,
                headers: {
                    "X-Usage-Remaining": "0",
                    "X-Usage-Reset": result.resetAt?.toISOString() || "",
                },
            }
        );
    }
    
    // Execute the actual handler
    const response = await handler();
    
    // If response is a NextResponse, add usage headers
    if (response instanceof NextResponse) {
        response.headers.set("X-Usage-Remaining", String(result.remaining ?? -1));
        if (result.resetAt) {
            response.headers.set("X-Usage-Reset", result.resetAt.toISOString());
        }
    }
    
    return response;
}

/**
 * Higher-order function to wrap entire route handlers
 */
export function createProtectedRoute(
    handler: (request: NextRequest) => Promise<NextResponse>
) {
    return async (request: NextRequest): Promise<NextResponse> => {
        return withUsageLimit(request, () => handler(request)) as Promise<NextResponse>;
    };
}
