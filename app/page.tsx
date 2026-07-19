import ToolsGrid from "@/components/ToolsGrid";
import AntigravityBackground from "@/components/AntigravityBackground";
import HowItWorks from "@/components/HowItWorks";
import Stats from "@/components/Stats";
import HomeSEOContent from "@/components/HomeSEOContent";
import { PDF_TOOLS, SITE_URL } from "@/lib/constants";
import { generateHomeMetadata } from "@/lib/metadata";
import type { Metadata } from "next";

export const metadata: Metadata = generateHomeMetadata();

export default function Home() {
    const breadcrumbJsonLd = { "@context": "https://schema.org", "@type": "BreadcrumbList",
        itemListElement: [
            { "@type": "ListItem",
                position: 1,
                name: "Home",
                item: SITE_URL,
            },
        ],
    };

    return (
        <div className="relative z-10 w-full">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
            />

            {/* ===== HERO SECTION ===== */}
            <section className="relative py-16 md:py-20 flex items-center overflow-hidden">
                <AntigravityBackground />
                {/* Gradient overlays */}
                <div className="absolute inset-0 gradient-bg-hero" />
                <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white dark:from-[#0a0e1a] to-transparent" />

                <div className="relative z-10 w-full px-6 sm:px-8 lg:px-12 xl:px-16">
                    <div className="max-w-6xl w-full mx-auto">
                        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-10 items-center">
                            <div className="text-center lg:text-left flex flex-col items-center lg:items-start">
                                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-500 dark:text-violet-300 mb-4">
                                    Premium PDF Workspace
                                </p>
                                <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-gray-900 dark:text-white mb-6 leading-[1.05] tracking-tight max-w-3xl">
                                    The smartest way to work with <span className="gradient-text">PDFs</span>
                                </h1>
                                <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-2xl leading-relaxed">
                                    GotuPDF combines conversion, editing, compression, and security tools in a clean SaaS layout designed for faster document work on desktop and mobile.
                                </p>

                                <div className="mt-8 flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                                    <a href="#tools" className="btn-primary rounded-2xl px-6 py-3.5 text-center text-white font-semibold">
                                        Explore Tools
                                    </a>
                                    <a href="/merge-pdf" className="glass rounded-2xl px-6 py-3.5 text-center font-semibold text-gray-900 dark:text-white border border-gray-200/80 dark:border-white/10 hover:border-violet-500/30">
                                        Start with Merge PDF
                                    </a>
                                </div>

                                <div className="mt-8 flex flex-wrap justify-center lg:justify-start gap-3 text-sm text-gray-600 dark:text-slate-400">
                                    <span className="px-4 py-2 rounded-full bg-white/70 dark:bg-white/5 border border-gray-200/80 dark:border-white/10">{PDF_TOOLS.length} active tools</span>
                                    <span className="px-4 py-2 rounded-full bg-white/70 dark:bg-white/5 border border-gray-200/80 dark:border-white/10">Secure file handling</span>
                                    <span className="px-4 py-2 rounded-full bg-white/70 dark:bg-white/5 border border-gray-200/80 dark:border-white/10">Mobile-friendly workflow</span>
                                </div>
                            </div>

                            <div className="glass-card rounded-[2rem] p-6 sm:p-8 shadow-[0_20px_80px_rgba(124,58,237,0.08)]">
                                <div className="grid grid-cols-2 gap-4">
                                    {[
                                        { label: "Quick conversions", value: "PDF to Word, JPG, PNG" },
                                        { label: "Editing tools", value: "Merge, split, reorder, crop" },
                                        { label: "Security tools", value: "Protect, unlock, redact" },
                                        { label: "Cleanup tools", value: "Compress and repair" },
                                    ].map((item) => (
                                        <div key={item.label} className="rounded-3xl border border-gray-200/70 dark:border-white/5 bg-white/70 dark:bg-white/5 p-4">
                                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-500 dark:text-violet-300 mb-2">{item.label}</p>
                                            <p className="text-sm leading-6 text-gray-700 dark:text-slate-300">{item.value}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-6 rounded-3xl bg-violet-500/10 border border-violet-500/15 p-4 text-sm leading-7 text-gray-600 dark:text-slate-300">
                                    A focused interface for users who want reliable document workflows without the clutter of a heavyweight desktop suite.
                                </div>
                            </div>
                        </div>

                        <div className="mt-10 animate-bounce text-center lg:text-left">
                            <svg className="w-6 h-6 mx-auto lg:mx-0 text-gray-400 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                            </svg>
                        </div>
                    </div>
                </div>
            </section>

            {/* ===== TOOLS SECTION ===== */}
            <section id="tools" className="py-20 relative">
                <div className="absolute inset-0 gradient-bg-section" />
                <div className="relative z-10 w-full px-6 sm:px-8 lg:px-12 xl:px-16">
                    <div className="mb-10">
                        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-3">
                            PDF Tools for{" "}
                            <span className="gradient-text">Every Task</span>
                        </h2>
                        <p className="text-gray-500 dark:text-slate-400">
                            Choose from {PDF_TOOLS.length} tools to merge, split, convert, compress, and more.
                        </p>
                    </div>
                    <ToolsGrid />
                </div>
            </section>

            {/* ===== HOW IT WORKS ===== */}
            <HowItWorks />

            {/* ===== WHY CHOOSE US (HIDDEN) ===== */}
            {/* <WhyChooseUs /> */}

            {/* ===== STATS ===== */}
            <Stats />

            {/* ===== USE CASES (HIDDEN) ===== */}
            {/*
            <section className="py-20 relative">
                <div className="relative z-10 w-full px-6 sm:px-8 lg:px-12 xl:px-16">
                    <div className="text-center mb-12">
                        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-3">
                            How People Use{" "}
                            <span className="gradient-text">{SITE_NAME}</span>
                        </h2>
                        <p className="text-gray-500 dark:text-slate-400">Real workflows from real users</p>
                    </div>
                    <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                        {[
                            { emoji: "\u{1F4C4}", title: "Students", desc: "Converting assignments to PDF before submitting to professors and online portals" },
                            { emoji: "\u{1F9FE}", title: "Shop Owners", desc: "Merging multiple bills and invoices into a single PDF for record-keeping" },
                            { emoji: "\u{1F4BC}", title: "Office Workers", desc: "Compressing large PDF files to share via email without hitting size limits" },
                            { emoji: "\u{1F3EB}", title: "Teachers", desc: "Preparing study materials and handouts by converting Word documents to PDF" },
                        ].map((item, index) => (
                            <div key={index} className="glass-card rounded-2xl p-6 text-center group hover:border-indigo-500/20 transition-all">
                                <div className="text-4xl mb-4">{item.emoji}</div>
                                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{item.title}</h3>
                                <p className="text-sm text-gray-500 dark:text-slate-400 leading-relaxed">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
            */}

            {/* ===== ABOUT (HIDDEN) ===== */}
            {/*
            <section className="py-20 relative">
                <div className="absolute inset-0 gradient-bg-section" />
                <div className="relative z-10 w-full px-6 sm:px-8 lg:px-12 xl:px-16">
                    <div className="max-w-4xl mx-auto">
                        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-6">
                            About <span className="gradient-text">{SITE_NAME}</span>
                        </h2>
                        <div className="space-y-4 text-gray-500 dark:text-slate-400 leading-relaxed">
                            <p>
                                {SITE_NAME} is a free online platform for quick PDF tools that helps you work with PDF files without installing any software.
                                We built this tool because we understand that not everyone wants to download programs or pay for subscriptions
                                just to merge a few files or convert a document.
                            </p>
                            <p>
                                Our tools are used by students preparing assignments, office workers managing documents, shop owners organizing
                                invoices, and teachers creating study materials. We keep things simple because PDF tasks should not be complicated.
                            </p>
                            <p>
                                We care about your privacy. Files uploaded to our servers are processed and then automatically deleted.
                                We do not collect personal information, and you can use all our tools without creating an account.
                            </p>
                        </div>
                    </div>
                </div>
            </section>
            */}

            {/* ===== SEO CONTENT (HIDDEN) ===== */}
            <HomeSEOContent />
        </div>
    );
}
