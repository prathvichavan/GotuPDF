"use client";

import { useState } from "react";
import Link from "next/link";
import { PDF_TOOLS, TOOL_CATEGORIES, type ToolCategory } from "@/lib/constants";

// Memoize icon generation to prevent re-renders
const ICON_MAP: Record<string, React.JSX.Element> = {
        merge: (
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
        ),
        split: (
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
        ),
        compress: (
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
        ),
        convert: (
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
        ),
        image: (
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
        ),
        lock: (
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
        ),
        unlock: (
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
            </svg>
        ),
        rotate: (
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
        ),
        edit: (
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
        ),
};

const getToolIcon = (iconType: string) => {
    return ICON_MAP[iconType] || ICON_MAP.convert;
};

export default function ToolsGrid() {
    const [activeCategory, setActiveCategory] = useState<ToolCategory>("all");

    const filteredTools = activeCategory === "all"
        ? PDF_TOOLS
        : PDF_TOOLS.filter((tool) => tool.category === activeCategory);

    return (
        <div>
            {/* Category Filter Tabs */}
            <div className="flex flex-wrap gap-2.5 mb-8" suppressHydrationWarning>
                {TOOL_CATEGORIES.map((cat) => (
                    <button
                        key={cat.id}
                        onClick={() => setActiveCategory(cat.id)}
                        suppressHydrationWarning
                        className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 ${
                            activeCategory === cat.id
                            ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white border-transparent shadow-lg shadow-violet-500/25"
                            : "glass border-gray-200/80 dark:border-white/10 text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:border-violet-500/30"
                        }`}
                    >
                        {cat.label}
                    </button>
                ))}
            </div>

            {/* Tools Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 items-stretch">
                {filteredTools.map((tool) => {
                    return (
                    <Link
                        key={tool.id}
                        href={tool.path}
                        className="group relative glass-card rounded-3xl p-6 hover:border-violet-500/30 transition-all duration-300 hover:-translate-y-1 cursor-pointer h-full flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
                    >
                        {/* Top accent line */}
                        <div
                            className="absolute top-0 left-4 right-4 h-[2px] rounded-b-full opacity-40 group-hover:opacity-80 transition-opacity"
                            style={{ background: `linear-gradient(90deg, transparent, ${tool.color}, transparent)` }}
                        />

                        {/* Icon */}
                        <div
                            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300 group-hover:scale-110"
                            style={{
                                backgroundColor: `${tool.color}15`,
                                boxShadow: `0 0 0 1px ${tool.color}20`,
                            }}
                        >
                            <div style={{ color: tool.color }}>{getToolIcon(tool.icon)}</div>
                        </div>

                        {/* Content */}
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1.5 group-hover:text-violet-600 dark:group-hover:text-violet-300 transition-colors">
                            {tool.name}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed mb-5 flex-1">{tool.description}</p>

                        {/* CTA */}
                        <div className="mt-auto flex items-center text-sm font-medium text-violet-600 dark:text-violet-300 group-hover:text-violet-500 transition-colors">
                            <span className="group-hover:translate-x-1 transition-transform">Use Tool</span>
                            <svg className="w-4 h-4 ml-1.5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                            </svg>
                        </div>
                    </Link>
                    );
                })}
            </div>
        </div>
    );
}
