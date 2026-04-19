import { NextRequest, NextResponse } from "next/server";
import { getUsageStatus } from "@/lib/usageLimiter";

/**
 * GET /api/usage
 * Returns current usage status for the requesting user/guest
 * This endpoint does NOT increment the counter
 */
export async function GET(request: NextRequest) {
    try {
        const status = await getUsageStatus(request);
        
        return NextResponse.json({
            success: true,
            data: {
                type: status.type,
                plan: status.plan,
                used: status.used,
                limit: status.limit,
                remaining: status.remaining,
                resetAt: status.resetAt?.toISOString() || null,
                isUnlimited: status.plan === "pro",
            },
        }, {
            headers: {
                "Cache-Control": "no-store, no-cache, must-revalidate",
                "X-Usage-Remaining": String(status.remaining),
                "X-Usage-Limit": String(status.limit),
            },
        });
    } catch (error) {
        console.error("Error fetching usage status:", error);
        return NextResponse.json(
            { success: false, error: "Failed to fetch usage status" },
            { status: 500 }
        );
    }
}
