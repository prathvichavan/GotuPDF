"use client";

import { useCallback } from "react";
import { useUsageLimit } from "./UsageLimitProvider";

interface UsageLimitResponse {
    error?: string;
    code?: "LOGIN_REQUIRED" | "LIMIT_REACHED" | "RATE_LIMITED";
    resetAt?: string;
}

/**
 * Custom hook for making API calls with usage limit handling
 * Automatically shows login/upgrade modals when limits are reached
 */
export function useUsageLimitedFetch() {
    const { handleApiError, refreshUsage } = useUsageLimit();

    /**
     * Wrapper around fetch that handles usage limit errors
     * Returns the response if successful, throws if error
     */
    const fetchWithUsageLimit = useCallback(async (
        url: string,
        options?: RequestInit
    ): Promise<Response> => {
        const response = await fetch(url, {
            ...options,
            credentials: "include",
        });

        // Check for usage limit errors (403 status)
        if (response.status === 403 || response.status === 429) {
            try {
                const data: UsageLimitResponse = await response.clone().json();
                
                if (data.code === "LOGIN_REQUIRED" || data.code === "LIMIT_REACHED") {
                    handleApiError(data);
                    throw new UsageLimitError(data.code, data.error || "Usage limit reached");
                }
                
                if (data.code === "RATE_LIMITED") {
                    throw new UsageLimitError(data.code, data.error || "Too many requests");
                }
            } catch (parseError) {
                if (parseError instanceof UsageLimitError) {
                    throw parseError;
                }
                // If JSON parsing fails, continue with normal error handling
            }
        }

        // Refresh usage stats after successful API call
        if (response.ok) {
            // Don't await - run in background
            refreshUsage().catch(() => {});
        }

        return response;
    }, [handleApiError, refreshUsage]);

    /**
     * Submit form data to a PDF tool endpoint with usage limit handling
     */
    const submitPdfTool = useCallback(async (
        endpoint: string,
        formData: FormData,
        options?: Omit<RequestInit, "method" | "body">
    ): Promise<Response> => {
        return fetchWithUsageLimit(endpoint, {
            method: "POST",
            body: formData,
            ...options,
        });
    }, [fetchWithUsageLimit]);

    return {
        fetchWithUsageLimit,
        submitPdfTool,
    };
}

/**
 * Custom error class for usage limit errors
 */
export class UsageLimitError extends Error {
    code: "LOGIN_REQUIRED" | "LIMIT_REACHED" | "RATE_LIMITED";

    constructor(code: "LOGIN_REQUIRED" | "LIMIT_REACHED" | "RATE_LIMITED", message: string) {
        super(message);
        this.name = "UsageLimitError";
        this.code = code;
    }
}

/**
 * Type guard to check if an error is a UsageLimitError
 */
export function isUsageLimitError(error: unknown): error is UsageLimitError {
    return error instanceof UsageLimitError;
}
