"use client";

import Link from "next/link";
import { useUsageLimit } from "./UsageLimitProvider";
import { useEffect } from "react";

/**
 * Login Required Modal
 * Displayed when guest users exceed their daily limit (10 tasks)
 * This modal CANNOT be dismissed - user must login to continue
 */
export function LoginRequiredModal() {
    const { showLoginModal, error } = useUsageLimit();

    // Prevent scrolling when modal is open
    useEffect(() => {
        if (showLoginModal) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }
        return () => {
            document.body.style.overflow = "unset";
        };
    }, [showLoginModal]);

    if (!showLoginModal) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            {/* Blur backdrop - NO click to close */}
            <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-md"
                aria-hidden="true"
            />
            
            {/* Modal content */}
            <div className="relative z-10 w-full max-w-md mx-4 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 text-center animate-in zoom-in-95 duration-300">
                {/* Icon */}
                <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mb-6">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                </div>

                {/* Title */}
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                    Free Limit Reached
                </h2>

                {/* Message */}
                <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
                    {error || "You've used 10 free tasks in the last 24 hours. Login to continue using GotuPDF with 25 tasks per day."}
                </p>

                {/* Benefits of logging in */}
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 mb-6 text-left">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                        Benefits of creating an account:
                    </p>
                    <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                        <li className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            25 tasks per day (2.5x more)
                        </li>
                        <li className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Save your conversion history
                        </li>
                        <li className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Access Pro features
                        </li>
                    </ul>
                </div>

                {/* Action buttons - NO close button */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <Link
                        href="/login"
                        className="flex-1 inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                        </svg>
                        Login
                    </Link>
                    <Link
                        href="/signup"
                        className="flex-1 inline-flex items-center justify-center px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white font-semibold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200"
                    >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                        Sign Up
                    </Link>
                </div>

                {/* No close option text */}
                <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                    Login is required to continue using GotuPDF
                </p>
            </div>
        </div>
    );
}

/**
 * Upgrade Required Modal
 * Displayed when logged-in free users exceed their daily limit (25 tasks)
 * This modal CAN be dismissed, but user cannot perform more tasks
 */
export function UpgradeRequiredModal() {
    const { showUpgradeModal, error, closeModals, usageStatus } = useUsageLimit();

    // Prevent scrolling when modal is open
    useEffect(() => {
        if (showUpgradeModal) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }
        return () => {
            document.body.style.overflow = "unset";
        };
    }, [showUpgradeModal]);

    if (!showUpgradeModal) return null;

    // Calculate time until reset
    const getResetTimeText = () => {
        if (!usageStatus?.resetAt) return "24 hours";
        const resetDate = new Date(usageStatus.resetAt);
        const now = new Date();
        const hoursLeft = Math.max(0, Math.ceil((resetDate.getTime() - now.getTime()) / (1000 * 60 * 60)));
        if (hoursLeft <= 1) return "less than 1 hour";
        return `${hoursLeft} hours`;
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            {/* Blur backdrop */}
            <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-md"
                onClick={closeModals}
                aria-hidden="true"
            />
            
            {/* Modal content */}
            <div className="relative z-10 w-full max-w-md mx-4 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 text-center animate-in zoom-in-95 duration-300">
                {/* Close button */}
                <button
                    onClick={closeModals}
                    className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    aria-label="Close"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                {/* Icon */}
                <div className="mx-auto w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center mb-6">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                </div>

                {/* Title */}
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                    Daily Limit Reached
                </h2>

                {/* Message */}
                <p className="text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">
                    {error || "You've used all 25 of your daily tasks. Upgrade to Pro for unlimited access."}
                </p>

                {/* Reset timer */}
                <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                        <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Your limit resets in <span className="font-semibold">{getResetTimeText()}</span>
                    </p>
                </div>

                {/* Pro benefits */}
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl p-4 mb-6 text-left border border-amber-200 dark:border-amber-800">
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-2 flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        Pro Benefits:
                    </p>
                    <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
                        <li className="flex items-center gap-2">
                            <span className="text-green-500">✓</span> Unlimited daily tasks
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="text-green-500">✓</span> Priority processing
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="text-green-500">✓</span> No watermarks
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="text-green-500">✓</span> Premium support
                        </li>
                    </ul>
                </div>

                {/* Action buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <Link
                        href="/pricing"
                        className="flex-1 inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold rounded-xl hover:from-amber-600 hover:to-orange-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                        <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        Upgrade to Pro
                    </Link>
                    <button
                        onClick={closeModals}
                        className="flex-1 inline-flex items-center justify-center px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white font-semibold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200"
                    >
                        Wait for Reset
                    </button>
                </div>
            </div>
        </div>
    );
}

/**
 * Combined component that renders both modals
 * Use this in your layout
 */
export function UsageLimitModals() {
    return (
        <>
            <LoginRequiredModal />
            <UpgradeRequiredModal />
        </>
    );
}
