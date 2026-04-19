"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useRef, useEffect, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import { SITE_NAME } from "@/lib/constants";
import { useTheme } from "@/components/ThemeProvider";

/* -------------------------------------------
   Mega-menu data - 7 category columns
   ------------------------------------------- */

interface MegaTool {
    name: string;
    href: string;
    color: string;
    icon: React.ReactNode;
    soon?: boolean;
}

interface MegaCategory {
    title: string;
    tools: MegaTool[];
}

const ic = (d: string) => (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
);

const MEGA_CATEGORIES: MegaCategory[] = [
    {
        title: "Organize PDF",
        tools: [
            { name: "Merge PDF", href: "/merge-pdf", color: "#4361EE", icon: ic("M12 4v16m8-8H4") },
            { name: "Split PDF", href: "/split-pdf", color: "#7C3AED", icon: ic("M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01") },
            { name: "Reorder PDF", href: "/reorder-pdf", color: "#F59E0B", icon: ic("M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4") },
            { name: "Rotate PDF", href: "/rotate-pdf", color: "#7C3AED", icon: ic("M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15") },
            { name: "Remove Pages", href: "/remove-pages", color: "#EF4444", icon: ic("M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16") },
            { name: "Extract Pages", href: "/extract-pages", color: "#3B82F6", icon: ic("M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2") },
        ],
    },
    {
        title: "Optimize PDF",
        tools: [
            { name: "Compress PDF", href: "/compress-pdf", color: "#DC2626", icon: ic("M19 14l-7 7m0 0l-7-7m7 7V3") },
            { name: "Repair PDF", href: "/repair-pdf", color: "#10B981", icon: ic("M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z") },
            { name: "OCR PDF", href: "/ocr-pdf", color: "#6366F1", icon: ic("M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z") },
        ],
    },
    {
        title: "Convert to PDF",
        tools: [
            { name: "Word to PDF", href: "/word-to-pdf", color: "#2563EB", icon: ic("M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z") },
            { name: "Excel to PDF", href: "/excel-to-pdf", color: "#059669", icon: ic("M3 10h18M3 14h18M9 4v16") },
            { name: "JPG to PDF", href: "/jpg-to-pdf", color: "#0891B2", icon: ic("M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z") },
            { name: "PNG to PDF", href: "/png-to-pdf", color: "#DB2777", icon: ic("M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z") },
            { name: "HTML to PDF", href: "/html-to-pdf", color: "#F97316", icon: ic("M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4") },
        ],
    },
    {
        title: "Convert from PDF",
        tools: [
            { name: "PDF to Word", href: "/pdf-to-word", color: "#2563EB", icon: ic("M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z") },
            { name: "PDF to Excel", href: "/pdf-to-excel", color: "#059669", icon: ic("M3 10h18M3 14h18M9 4v16") },
            { name: "PDF to PPT", href: "/pdf-to-ppt", color: "#EA580C", icon: ic("M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z") },
            { name: "PDF to JPG", href: "/pdf-to-jpg", color: "#cc7648", icon: ic("M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z") },
            { name: "PDF to PNG", href: "/pdf-to-png", color: "#7C3AED", icon: ic("M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z") },
        ],
    },
    {
        title: "Edit PDF",
        tools: [
            { name: "Edit PDF", href: "/edit-pdf", color: "#10B981", icon: ic("M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z") },
            { name: "Add Page Numbers", href: "/add-page-numbers", color: "#8B5CF6", icon: ic("M7 20l4-16m2 16l4-16M6 9h14M4 15h14") },
            { name: "Add Watermark", href: "/add-watermark", color: "#0EA5E9", icon: ic("M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01") },
            { name: "Crop PDF", href: "/crop-pdf", color: "#D946EF", icon: ic("M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4") },
        ],
    },
    {
        title: "PDF Security",
        tools: [
            { name: "Protect PDF", href: "/protect-pdf", color: "#DC2626", icon: ic("M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z") },
            { name: "Unlock PDF", href: "/unlock-pdf", color: "#059669", icon: ic("M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z") },
            { name: "Sign PDF", href: "/sign-pdf", color: "#14B8A6", icon: ic("M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z") },
            { name: "Redact PDF", href: "/redact-pdf", color: "#1E293B", icon: ic("M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21") },
        ],
    },
    {
        title: "PDF Intelligence",
        tools: [
            { name: "Jupyter to PDF", href: "/convert-python-jupyter-to-pdf", color: "#8B5CF6", icon: ic("M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4") },
            { name: "Compare PDF", href: "/compare-pdf", color: "#A855F7", icon: ic("M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2") },
            { name: "Translate PDF", href: "/translate-pdf", color: "#EC4899", icon: ic("M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129") },
        ],
    },
];

/* Convert-PDF sub-dropdown items */
const CONVERT_ITEMS = [
    { name: "PDF to Word", href: "/pdf-to-word", color: "#2563EB" },
    { name: "PDF to Excel", href: "/pdf-to-excel", color: "#059669" },
    { name: "PDF to PPT", href: "/pdf-to-ppt", color: "#EA580C" },
    { name: "PDF to JPG", href: "/pdf-to-jpg", color: "#cc7648" },
    { name: "PDF to PNG", href: "/pdf-to-png", color: "#7C3AED" },
    { name: "Word to PDF", href: "/word-to-pdf", color: "#2563EB" },
    { name: "Excel to PDF", href: "/excel-to-pdf", color: "#059669" },
    { name: "JPG to PDF", href: "/jpg-to-pdf", color: "#0891B2" },
    { name: "PNG to PDF", href: "/png-to-pdf", color: "#DB2777" },
];

/* ----------- Component ----------- */

export default function Header() {
    const { data: session, status } = useSession();
    const { theme, toggleTheme } = useTheme();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [megaOpen, setMegaOpen] = useState(false);
    const [convertOpen, setConvertOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [mobileSection, setMobileSection] = useState<string | null>(null);
    const [themeAnimating, setThemeAnimating] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);

    const megaTimeout = useRef<NodeJS.Timeout | null>(null);
    const convertTimeout = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 10);
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => {
            window.removeEventListener("scroll", onScroll);
            if (megaTimeout.current) clearTimeout(megaTimeout.current);
            if (convertTimeout.current) clearTimeout(convertTimeout.current);
        };
    }, []);

    /* Lock body scroll when mobile menu open */
    useEffect(() => {
        if (mobileOpen) document.body.style.overflow = "hidden";
        else document.body.style.overflow = "";
        return () => { document.body.style.overflow = ""; };
    }, [mobileOpen]);

    const openMega = useCallback(() => {
        if (megaTimeout.current) clearTimeout(megaTimeout.current);
        setConvertOpen(false);
        megaTimeout.current = setTimeout(() => setMegaOpen(true), 120);
    }, []);

    const closeMega = useCallback(() => {
        if (megaTimeout.current) clearTimeout(megaTimeout.current);
        megaTimeout.current = setTimeout(() => setMegaOpen(false), 250);
    }, []);

    const openConvert = useCallback(() => {
        if (convertTimeout.current) clearTimeout(convertTimeout.current);
        setMegaOpen(false);
        convertTimeout.current = setTimeout(() => setConvertOpen(true), 120);
    }, []);

    const closeConvert = useCallback(() => {
        if (convertTimeout.current) clearTimeout(convertTimeout.current);
        convertTimeout.current = setTimeout(() => setConvertOpen(false), 250);
    }, []);

    const handleToggleTheme = () => {
        document.documentElement.classList.add("theme-transition");
        setThemeAnimating(true);
        toggleTheme();
        setTimeout(() => {
            document.documentElement.classList.remove("theme-transition");
            setThemeAnimating(false);
        }, 350);
    };

    /* Logo */
    const Logo = ({ className = "" }: { className?: string }) => (
        <Link href="/" className={`flex items-center select-none ${className}`} onClick={() => setMobileOpen(false)}>
            <Image
                src="/logo.png"
                alt="GotuPDF Logo"
                width={140}
                height={40}
                priority
                className="w-[110px] md:w-[140px] h-auto object-contain dark:invert"
            />
        </Link>
    );

    const navLink = "relative px-3 py-2 text-[13px] font-semibold uppercase tracking-wide text-gray-600 dark:text-slate-200 hover:text-gray-900 dark:hover:text-white transition-colors";

    return (
        <>
            <header
                suppressHydrationWarning
                className={`sticky top-0 z-[100] transition-all duration-300 ${
                    scrolled
                        ? "bg-white/95 dark:bg-[#1a1f2e]/95 backdrop-blur-xl shadow-lg shadow-black/5 dark:shadow-black/20 border-b border-gray-200 dark:border-white/5"
                        : "bg-white dark:bg-[#1a1f2e] border-b border-gray-200 dark:border-white/5"
                }`}
            >
                <div className="w-full mx-auto px-4 sm:px-6 lg:px-10 xl:px-16">
                    <div className="flex items-center justify-between h-16">
                        {/* Logo */}
                        <Logo />

                        {/* Desktop Nav */}
                        <nav className="hidden lg:flex items-center gap-1" suppressHydrationWarning>
                            <Link href="/merge-pdf" className={navLink} suppressHydrationWarning>
                                Merge PDF
                            </Link>
                            <Link href="/split-pdf" className={navLink} suppressHydrationWarning>
                                Split PDF
                            </Link>
                            <Link href="/compress-pdf" className={navLink} suppressHydrationWarning>
                                Compress PDF
                            </Link>

                            {/* Convert PDF dropdown */}
                            <div
                                className="relative"
                                onMouseEnter={openConvert}
                                onMouseLeave={closeConvert}
                            >
                                <button className={`${navLink} flex items-center gap-1`} suppressHydrationWarning>
                                    Convert PDF
                                    <svg className={`w-3.5 h-3.5 transition-transform ${mounted && convertOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                {convertOpen && (
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 rounded-xl bg-white dark:bg-[#1e2538] border border-gray-200 dark:border-white/10 shadow-2xl shadow-black/10 dark:shadow-black/40 py-2 z-[110]">
                                        {CONVERT_ITEMS.map((item) => (
                                            <Link
                                                key={item.href + item.name}
                                                href={item.href}
                                                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white transition-colors"
                                            >
                                                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                                                {item.name}
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* All PDF Tools - mega dropdown trigger */}
                            <div
                                className="relative"
                                onMouseEnter={openMega}
                                onMouseLeave={closeMega}
                            >
                                <button className={`${navLink} flex items-center gap-1 !text-red-500 dark:!text-red-400 hover:!text-red-600 dark:hover:!text-red-300`} suppressHydrationWarning>
                                    All PDF Tools
                                    <svg className={`w-3.5 h-3.5 transition-transform ${mounted && megaOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>
                            </div>
                        </nav>

                        {/* Right side */}
                        <div className="hidden lg:flex items-center gap-2">
                            <Link href="/about-us" className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                                About
                            </Link>
                            <Link href="/blog" className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                                Blog
                            </Link>

                            <span className="w-px h-5 bg-gray-200 dark:bg-white/10" />

                            {/* Home button */}
                            <Link
                                href="/"
                                className="p-2 rounded-lg text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white transition-all duration-200 hover:scale-105"
                                aria-label="Home"
                                title="Home"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                                </svg>
                            </Link>

                            {/* Theme toggle */}
                            <button
                                onClick={handleToggleTheme}
                                className="relative p-2 rounded-full text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-amber-500 dark:hover:text-amber-400 transition-all duration-200 hover:scale-105"
                                aria-label="Switch Theme"
                                title="Switch Theme"
                                suppressHydrationWarning
                            >
                                {/* Sun icon (shown in dark mode → click to go light) */}
                                <svg
                                    className={`w-5 h-5 absolute inset-0 m-auto transition-all duration-300 ${
                                        theme === "dark" ? "opacity-100 rotate-0 scale-100" : "opacity-0 rotate-90 scale-0"
                                    } ${themeAnimating ? "animate-spin" : ""}`}
                                    fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"
                                    style={{ animationDuration: "350ms" }}
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                                </svg>
                                {/* Moon icon (shown in light mode → click to go dark) */}
                                <svg
                                    className={`w-5 h-5 transition-all duration-300 ${
                                        theme === "light" ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-0"
                                    } ${themeAnimating ? "animate-spin" : ""}`}
                                    fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"
                                    style={{ animationDuration: "350ms" }}
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                                </svg>
                            </button>

                            <span className="w-px h-5 bg-gray-200 dark:bg-white/10" />

                            {!mounted || status === "loading" ? (
                                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-white/10 animate-pulse" />
                            ) : session ? (
                                <div className="relative">
                                    <button
                                        onClick={() => setUserMenuOpen(!userMenuOpen)}
                                        className="flex items-center gap-2 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                                    >
                                        {session.user?.image ? (
                                            <Image
                                                src={session.user.image}
                                                alt={session.user.name || "User"}
                                                width={32}
                                                height={32}
                                                className="rounded-full"
                                            />
                                        ) : (
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center text-white text-sm font-semibold">
                                                {session.user?.name?.charAt(0).toUpperCase() || "U"}
                                            </div>
                                        )}
                                    </button>
                                    {userMenuOpen && (
                                        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#1a1f2e] rounded-xl shadow-xl border border-gray-200 dark:border-white/10 py-2 z-50">
                                            <div className="px-4 py-2 border-b border-gray-200 dark:border-white/10">
                                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{session.user?.name}</p>
                                                <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{session.user?.email}</p>
                                            </div>
                                            <Link
                                                href="/dashboard"
                                                className="block px-4 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-white/5"
                                                onClick={() => setUserMenuOpen(false)}
                                            >
                                                Dashboard
                                            </Link>
                                            <button
                                                onClick={() => { setUserMenuOpen(false); signOut({ callbackUrl: "/" }); }}
                                                className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-gray-100 dark:hover:bg-white/5"
                                            >
                                                Sign Out
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <>
                                    <Link href="/login" className="text-sm font-medium text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white transition-colors px-3 py-1.5">
                                        Login
                                    </Link>
                                    <Link href="/signup" className="text-sm font-semibold text-white bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 px-5 py-2 rounded-full shadow-lg shadow-red-500/20 transition-all hover:shadow-red-500/30">
                                        Sign Up
                                    </Link>
                                </>
                            )}

                            {/* Grid / more icon */}
                            <button
                                className="p-2 rounded-lg text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white transition-colors"
                                onClick={openMega}
                                aria-label="All tools"
                                suppressHydrationWarning
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                </svg>
                            </button>
                        </div>

                        {/* Mobile right: theme + burger */}
                        <div className="flex items-center gap-1 lg:hidden">
                            {/* Mobile theme toggle */}
                            <button
                                onClick={handleToggleTheme}
                                className="relative p-2 rounded-full text-gray-500 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-all"
                                aria-label="Switch Theme"
                                suppressHydrationWarning
                            >
                                <svg
                                    className={`w-5 h-5 absolute inset-0 m-auto transition-all duration-300 ${
                                        theme === "dark" ? "opacity-100 rotate-0 scale-100" : "opacity-0 rotate-90 scale-0"
                                    }`}
                                    fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                                </svg>
                                <svg
                                    className={`w-5 h-5 transition-all duration-300 ${
                                        theme === "light" ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-0"
                                    }`}
                                    fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                                </svg>
                            </button>

                            {/* Mobile burger */}
                            <button
                                className="p-2 rounded-lg text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                                onClick={() => setMobileOpen(!mobileOpen)}
                                aria-label="Toggle menu"
                            >
                                {mobileOpen ? (
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                ) : (
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* MEGA DROPDOWN */}
                {megaOpen && (
                    <div
                        className="absolute left-0 right-0 top-full z-[110] bg-white dark:bg-[#141825] border-t border-gray-200 dark:border-white/5 shadow-2xl shadow-black/10 dark:shadow-black/50"
                        onMouseEnter={openMega}
                        onMouseLeave={closeMega}
                    >
                        <div className="w-full mx-auto px-6 sm:px-8 lg:px-10 xl:px-16 py-8">
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-8">
                                {MEGA_CATEGORIES.map((cat) => (
                                    <div key={cat.title}>
                                        <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500 mb-4 pb-2 border-b border-gray-100 dark:border-white/5">
                                            {cat.title}
                                        </h4>
                                        <ul className="space-y-1">
                                            {cat.tools.map((tool) => (
                                                <li key={tool.name}>
                                                    <Link
                                                        href={tool.href}
                                                        className={`group flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-colors ${
                                                            tool.soon
                                                                ? "text-gray-400 dark:text-slate-600 cursor-default"
                                                                : "text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white"
                                                        }`}
                                                        onClick={tool.soon ? (e: React.MouseEvent) => e.preventDefault() : undefined}
                                                    >
                                                        <span style={{ color: tool.color }} className="opacity-80 group-hover:opacity-100 transition-opacity">
                                                            {tool.icon}
                                                        </span>
                                                        <span>{tool.name}</span>
                                                        {tool.soon && (
                                                            <span className="ml-auto text-[10px] font-medium text-gray-400 dark:text-slate-600 bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded">
                                                                Soon
                                                            </span>
                                                        )}
                                                    </Link>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>

                            {/* Bottom bar in mega */}
                            <div className="mt-8 pt-5 border-t border-gray-100 dark:border-white/5 flex flex-wrap items-center justify-between gap-4">
                                <p className="text-xs text-gray-400 dark:text-slate-500">
                                    <span className="font-semibold text-gray-500 dark:text-slate-400">{SITE_NAME}</span> {"\u2014"} Free online PDF tools, no sign-up required.
                                </p>
                                <div className="flex gap-3">
                                    <Link href="/faq" className="text-xs text-gray-400 dark:text-slate-500 hover:text-gray-900 dark:hover:text-white transition-colors">FAQ</Link>
                                    <Link href="/contact-us" className="text-xs text-gray-400 dark:text-slate-500 hover:text-gray-900 dark:hover:text-white transition-colors">Contact</Link>
                                    <Link href="/about-us" className="text-xs text-gray-400 dark:text-slate-500 hover:text-gray-900 dark:hover:text-white transition-colors">About Us</Link>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </header>

            {/* MOBILE DRAWER */}
            {mobileOpen && (
                <>
                    {/* Backdrop */}
                    <div className="fixed inset-0 z-[90] bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />

                    {/* Drawer */}
                    <div className="fixed inset-y-0 right-0 z-[95] w-full max-w-sm bg-white dark:bg-[#141825] shadow-2xl overflow-y-auto">
                        {/* Drawer header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/5">
                            <Logo />
                            <button
                                className="p-2 rounded-lg text-gray-400 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                                onClick={() => setMobileOpen(false)}
                                aria-label="Close menu"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Quick links */}
                        <div className="px-4 py-3 space-y-0.5">
                            {/* Home link */}
                            <Link
                                href="/"
                                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                                onClick={() => setMobileOpen(false)}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                                </svg>
                                Home
                            </Link>
                            {[
                                { href: "/merge-pdf", label: "Merge PDF" },
                                { href: "/split-pdf", label: "Split PDF" },
                                { href: "/compress-pdf", label: "Compress PDF" },
                            ].map((l) => (
                                <Link
                                    key={l.href}
                                    href={l.href}
                                    className="block px-3 py-2.5 rounded-lg text-sm font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                                    onClick={() => setMobileOpen(false)}
                                >
                                    {l.label}
                                </Link>
                            ))}
                        </div>

                        {/* Accordion categories */}
                        <div className="px-4 pb-4">
                            {MEGA_CATEGORIES.map((cat) => (
                                <div key={cat.title} className="border-t border-gray-100 dark:border-white/5">
                                    <button
                                        className="w-full flex items-center justify-between px-3 py-3 text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300 transition-colors"
                                        onClick={() => setMobileSection(mobileSection === cat.title ? null : cat.title)}
                                    >
                                        {cat.title}
                                        <svg className={`w-4 h-4 transition-transform ${mobileSection === cat.title ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>
                                    {mobileSection === cat.title && (
                                        <div className="pb-2 space-y-0.5">
                                            {cat.tools.map((tool) => (
                                                <Link
                                                    key={tool.name}
                                                    href={tool.href}
                                                    className={`flex items-center gap-2.5 px-5 py-2 rounded-lg text-sm transition-colors ${
                                                        tool.soon
                                                            ? "text-gray-400 dark:text-slate-600 cursor-default"
                                                            : "text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white"
                                                    }`}
                                                    onClick={(e) => {
                                                        if (tool.soon) e.preventDefault();
                                                        else setMobileOpen(false);
                                                    }}
                                                >
                                                    <span style={{ color: tool.color }}>{tool.icon}</span>
                                                    <span>{tool.name}</span>
                                                    {tool.soon && (
                                                        <span className="ml-auto text-[10px] text-gray-400 dark:text-slate-600 bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded">Soon</span>
                                                    )}
                                                </Link>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Footer links */}
                        <div className="px-4 pb-6 space-y-2 border-t border-gray-100 dark:border-white/5 pt-4">
                            <Link href="/about-us" className="block px-3 py-2 rounded-lg text-sm text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5 transition-colors" onClick={() => setMobileOpen(false)}>About</Link>
                            <Link href="/blog" className="block px-3 py-2 rounded-lg text-sm text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5 transition-colors" onClick={() => setMobileOpen(false)}>Blog</Link>
                            <Link href="/faq" className="block px-3 py-2 rounded-lg text-sm text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5 transition-colors" onClick={() => setMobileOpen(false)}>FAQ</Link>
                            <Link href="/contact-us" className="block px-3 py-2 rounded-lg text-sm text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5 transition-colors" onClick={() => setMobileOpen(false)}>Contact</Link>

                            <div className="flex gap-2 pt-2">
                                {session ? (
                                    <>
                                        <Link href="/dashboard" className="flex-1 text-center text-sm font-medium text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-white/10 rounded-full py-2.5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors" onClick={() => setMobileOpen(false)}>
                                            Dashboard
                                        </Link>
                                        <button 
                                            onClick={() => { setMobileOpen(false); signOut({ callbackUrl: "/" }); }}
                                            className="flex-1 text-center text-sm font-semibold text-white bg-gradient-to-r from-red-500 to-rose-600 rounded-full py-2.5 shadow-lg shadow-red-500/20"
                                        >
                                            Sign Out
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <Link href="/login" className="flex-1 text-center text-sm font-medium text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-white/10 rounded-full py-2.5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors" onClick={() => setMobileOpen(false)}>
                                            Login
                                        </Link>
                                        <Link href="/signup" className="flex-1 text-center text-sm font-semibold text-white bg-gradient-to-r from-red-500 to-rose-600 rounded-full py-2.5 shadow-lg shadow-red-500/20" onClick={() => setMobileOpen(false)}>
                                            Sign Up
                                        </Link>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </>
    );
}
