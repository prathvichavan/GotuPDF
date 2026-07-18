"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

export default function DashboardPage() {
    const router = useRouter();
    const { data: session, status } = useSession();

    useEffect(() => {
        if (status === "unauthenticated") {
            router.replace("/login");
        }
    }, [status, router]);

    if (status === "loading") {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!session) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#0d1117] py-12 px-4">
            <div className="max-w-4xl mx-auto">

                {/* Welcome Card */}
                <div className="bg-white dark:bg-[#161b22] rounded-2xl shadow-lg border border-gray-200 dark:border-white/10 p-8 mb-8">
                    <div className="flex items-center gap-6">
                        {session.user?.image ? (
                            <Image
                                src={session.user.image}
                                alt={session.user.name || "User"}
                                width={80}
                                height={80}
                                className="rounded-full"
                            />
                        ) : (
                            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center text-white text-3xl font-bold">
                                {session.user?.name?.charAt(0).toUpperCase() || "U"}
                            </div>
                        )}

                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                                Welcome back, {session.user?.name?.split(" ")[0] || "User"}!
                            </h1>

                            <p className="text-gray-500 dark:text-slate-400 mt-1">
                                {session.user?.email}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Quick Actions */}
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                    Quick Actions
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                                        <QuickActionCard
                        title="Merge PDF"
                        description="Combine multiple PDFs into one"
                        href="/merge-pdf"
                        icon={
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                        }
                        color="bg-blue-500"
                    />

                    <QuickActionCard
                        title="Compress PDF"
                        description="Reduce PDF file size"
                        href="/compress-pdf"
                        icon={
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                            </svg>
                        }
                        color="bg-red-500"
                    />

                    <QuickActionCard
                        title="PDF to Word"
                        description="Convert PDF to editable Word"
                        href="/pdf-to-word"
                        icon={
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        }
                        color="bg-indigo-500"
                    />

                    <QuickActionCard
                        title="Split PDF"
                        description="Extract pages from PDF"
                        href="/split-pdf"
                        icon={
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01" />
                            </svg>
                        }
                        color="bg-purple-500"
                    />

                    <QuickActionCard
                        title="Excel to PDF"
                        description="Convert spreadsheets to PDF"
                        href="/excel-to-pdf"
                        icon={
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M9 4v16" />
                            </svg>
                        }
                        color="bg-emerald-500"
                    />

                    <QuickActionCard
                        title="All Tools"
                        description="Browse all PDF tools"
                        href="/#tools"
                        icon={
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                            </svg>
                        }
                        color="bg-gray-500"
                    />
                </div>

                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                    Account Details
                </h2>

                <div className="bg-white dark:bg-[#161b22] rounded-2xl shadow-lg border border-gray-200 dark:border-white/10 p-6">
                    <div className="space-y-4">

                        <div className="flex justify-between items-center py-3 border-b border-gray-100 dark:border-white/5">
                            <span className="text-gray-500 dark:text-slate-400">
                                Name
                            </span>

                            <span className="text-gray-900 dark:text-white font-medium">
                                {session.user?.name || "Not set"}
                            </span>
                        </div>

                        <div className="flex justify-between items-center py-3 border-b border-gray-100 dark:border-white/5">
                            <span className="text-gray-500 dark:text-slate-400">
                                Email
                            </span>

                            <span className="text-gray-900 dark:text-white font-medium">
                                {session.user?.email || "Not set"}
                            </span>
                        </div>

                        <div className="flex justify-between items-center py-3">
                            <span className="text-gray-500 dark:text-slate-400">
                                Plan
                            </span>

                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                                Free
                            </span>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
function QuickActionCard({
    title,
    description,
    href,
    icon,
    color,
}: {
    title: string;
    description: string;
    href: string;
    icon: React.ReactNode;
    color: string;
}) {
    return (
        <Link
            href={href}
            className="block bg-white dark:bg-[#161b22] rounded-xl shadow border border-gray-200 dark:border-white/10 p-5 hover:shadow-lg hover:border-gray-300 dark:hover:border-white/20 transition-all group"
        >
            <div
                className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform`}
            >
                {icon}
            </div>

            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                {title}
            </h3>

            <p className="text-sm text-gray-500 dark:text-slate-400">
                {description}
            </p>
        </Link>
    );
}