"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { useSession } from "next-auth/react";

interface UsageStatus {
    type: "guest" | "user";
    plan: "free" | "pro";
    used: number;
    limit: number;
    remaining: number;
    resetAt: string | null;
    isUnlimited: boolean;
}

interface UsageLimitContextType {
    usageStatus: UsageStatus | null;
    isLoading: boolean;
    showLoginModal: boolean;
    showUpgradeModal: boolean;
    error: string | null;
    refreshUsage: () => Promise<void>;
    handleApiError: (error: unknown) => boolean; // Returns true if error was handled
    closeModals: () => void;
}

const defaultUsageStatus: UsageStatus = {
    type: "guest",
    plan: "free",
    used: 0,
    limit: 10,
    remaining: 10,
    resetAt: null,
    isUnlimited: false,
};

const UsageLimitContext = createContext<UsageLimitContextType>({
    usageStatus: null,
    isLoading: true,
    showLoginModal: false,
    showUpgradeModal: false,
    error: null,
    refreshUsage: async () => {},
    handleApiError: () => false,
    closeModals: () => {},
});

export function UsageLimitProvider({ children }: { children: ReactNode }) {
    const { data: session, status } = useSession();
    const [usageStatus, setUsageStatus] = useState<UsageStatus | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refreshUsage = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await fetch("/api/usage", {
                method: "GET",
                credentials: "include",
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    setUsageStatus(data.data);
                }
            }
        } catch (err) {
            console.error("Failed to fetch usage status:", err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Refresh usage status when session changes
    useEffect(() => {
        if (status !== "loading") {
            refreshUsage();
        }
    }, [status, refreshUsage]);

    const handleApiError = useCallback((error: unknown): boolean => {
        // Check if this is a Response object or error with code
        if (error instanceof Response) {
            return false; // Let the caller handle Response errors
        }

        // Check for error object with code property
        const errorObj = error as { code?: string; message?: string };
        
        if (errorObj?.code === "LOGIN_REQUIRED") {
            setShowLoginModal(true);
            setError(errorObj.message || "You have reached 10 free tasks. Please login to continue.");
            return true;
        }

        if (errorObj?.code === "LIMIT_REACHED") {
            setShowUpgradeModal(true);
            setError(errorObj.message || "You reached your daily limit. Upgrade to Pro.");
            return true;
        }

        return false;
    }, []);

    const closeModals = useCallback(() => {
        // Only allow closing upgrade modal
        // Login modal cannot be closed - must login
        setShowUpgradeModal(false);
        setError(null);
    }, []);

    return (
        <UsageLimitContext.Provider
            value={{
                usageStatus,
                isLoading,
                showLoginModal,
                showUpgradeModal,
                error,
                refreshUsage,
                handleApiError,
                closeModals,
            }}
        >
            {children}
        </UsageLimitContext.Provider>
    );
}

export function useUsageLimit() {
    const context = useContext(UsageLimitContext);
    if (!context) {
        throw new Error("useUsageLimit must be used within a UsageLimitProvider");
    }
    return context;
}
