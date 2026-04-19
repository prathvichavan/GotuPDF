"use client";

import { useUsageLimit } from "./UsageLimitProvider";
import { useSession } from "next-auth/react";

interface UsageStatusBadgeProps {
    className?: string;
    showDetails?: boolean;
}

/**
 * A badge component that displays the user's current usage status
 * Shows remaining tasks and provides visual feedback on usage level
 */
export function UsageStatusBadge({ className = "", showDetails = false }: UsageStatusBadgeProps) {
    const { usageStatus, isLoading } = useUsageLimit();
    const { status: sessionStatus } = useSession();

    // Don't show if loading or no usage data
    if (isLoading || !usageStatus) {
        return (
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 animate-pulse ${className}`}>
                <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" />
                <span className="text-xs text-gray-400">...</span>
            </div>
        );
    }

    // Pro users - unlimited
    if (usageStatus.isUnlimited || usageStatus.plan === "pro") {
        return (
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 border border-amber-300 dark:border-amber-700 ${className}`}>
                <svg className="w-3.5 h-3.5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">Pro</span>
            </div>
        );
    }

    const { used, limit, remaining } = usageStatus;
    const usagePercent = limit > 0 ? (used / limit) * 100 : 0;

    // Determine color based on usage level
    let bgColor = "bg-green-100 dark:bg-green-900/30";
    let textColor = "text-green-700 dark:text-green-300";
    let dotColor = "bg-green-500";
    let borderColor = "border-green-300 dark:border-green-700";

    if (usagePercent >= 80) {
        bgColor = "bg-red-100 dark:bg-red-900/30";
        textColor = "text-red-700 dark:text-red-300";
        dotColor = "bg-red-500";
        borderColor = "border-red-300 dark:border-red-700";
    } else if (usagePercent >= 50) {
        bgColor = "bg-amber-100 dark:bg-amber-900/30";
        textColor = "text-amber-700 dark:text-amber-300";
        dotColor = "bg-amber-500";
        borderColor = "border-amber-300 dark:border-amber-700";
    }

    return (
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${bgColor} border ${borderColor} ${className}`}>
            <div className={`w-2 h-2 rounded-full ${dotColor} ${remaining === 0 ? 'animate-pulse' : ''}`} />
            <span className={`text-xs font-medium ${textColor}`}>
                {remaining}/{limit}
                {showDetails && (
                    <span className="text-xs opacity-75 ml-1">
                        {usageStatus.type === "guest" ? "(guest)" : "tasks"}
                    </span>
                )}
            </span>
        </div>
    );
}

/**
 * A more detailed usage display for tool pages
 */
export function UsageStatusCard({ className = "" }: { className?: string }) {
    const { usageStatus, isLoading } = useUsageLimit();

    if (isLoading || !usageStatus) {
        return null;
    }

    // Don't show for pro users
    if (usageStatus.isUnlimited || usageStatus.plan === "pro") {
        return null;
    }

    const { used, limit, remaining, type, resetAt } = usageStatus;
    const usagePercent = limit > 0 ? (used / limit) * 100 : 0;

    // Format reset time
    const formatResetTime = () => {
        if (!resetAt) return null;
        const resetDate = new Date(resetAt);
        const now = new Date();
        const hoursLeft = Math.max(0, Math.ceil((resetDate.getTime() - now.getTime()) / (1000 * 60 * 60)));
        if (hoursLeft <= 1) return "less than 1 hour";
        return `${hoursLeft} hours`;
    };

    const resetTime = formatResetTime();

    return (
        <div className={`bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4 ${className}`}>
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Daily Usage
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                    {type === "guest" ? "Guest" : "Free Plan"}
                </span>
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
                <div
                    className={`h-full transition-all duration-500 ${
                        usagePercent >= 80 
                            ? 'bg-red-500' 
                            : usagePercent >= 50 
                                ? 'bg-amber-500' 
                                : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(100, usagePercent)}%` }}
                />
            </div>

            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>{used} of {limit} tasks used</span>
                {resetTime && remaining === 0 && (
                    <span>Resets in {resetTime}</span>
                )}
            </div>

            {type === "guest" && remaining > 0 && (
                <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                    <a href="/signup" className="hover:underline">Sign up</a> for 25 tasks/day (free)
                </p>
            )}
        </div>
    );
}
