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
            <section className="relative overflow-hidden py-16 md:py-20 lg:py-24">
                <AntigravityBackground />
                <div className="absolute inset-0 gradient-bg-hero" />
                <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-white to-transparent dark:from-[#0a0e1a]" />

                <div className="relative z-10 w-full px-6 sm:px-8 lg:px-12 xl:px-16">
                    <div className="mx-auto max-w-7xl">
                        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
                            <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
                                <p className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-violet-500 dark:text-violet-300">
                                    Premium PDF Workspace
                                </p>
                                <h1 className="max-w-3xl text-4xl font-extrabold leading-[1.02] tracking-tight text-gray-900 dark:text-white md:text-6xl lg:text-7xl">
                                    The smartest way to work with <span className="gradient-text">PDFs</span>
                                </h1>
                                <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-600 dark:text-gray-400 md:text-xl">
                                    GotuPDF combines conversion, editing, compression, and security tools in a clean SaaS interface that feels faster, clearer, and easier to trust on any device.
                                </p>

                                <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                                    <a href="#tools" className="btn-primary rounded-2xl px-6 py-3.5 text-center font-semibold text-white shadow-lg shadow-violet-500/25">
                                        Explore Tools
                                    </a>
                                    <a href="/merge-pdf" className="glass rounded-2xl border border-gray-200/80 px-6 py-3.5 text-center font-semibold text-gray-900 hover:border-violet-500/30 dark:border-white/10 dark:text-white">
                                        Start with Merge PDF
                                    </a>
                                </div>

                                <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm text-gray-600 dark:text-slate-400 lg:justify-start">
                                    <span className="rounded-full border border-gray-200/80 bg-white/70 px-4 py-2 dark:border-white/10 dark:bg-white/5">{PDF_TOOLS.length} active tools</span>
                                    <span className="rounded-full border border-gray-200/80 bg-white/70 px-4 py-2 dark:border-white/10 dark:bg-white/5">Secure file handling</span>
                                    <span className="rounded-full border border-gray-200/80 bg-white/70 px-4 py-2 dark:border-white/10 dark:bg-white/5">Mobile-friendly workflow</span>
                                </div>
                            </div>

                            <div className="glass-card rounded-[2rem] p-6 shadow-[0_20px_80px_rgba(124,58,237,0.08)] sm:p-8">
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    {[
                                        { label: "Quick conversions", value: "PDF to Word, JPG, PNG" },
                                        { label: "Editing tools", value: "Merge, split, reorder, crop" },
                                        { label: "Security tools", value: "Protect, unlock, redact" },
                                        { label: "Cleanup tools", value: "Compress and repair" },
                                    ].map((item) => (
                                        <div key={item.label} className="rounded-3xl border border-gray-200/70 bg-white/75 p-4 dark:border-white/5 dark:bg-white/5">
                                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-500 dark:text-violet-300 mb-2">{item.label}</p>
                                            <p className="text-sm leading-6 text-gray-700 dark:text-slate-300">{item.value}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-6 rounded-3xl border border-violet-500/15 bg-violet-500/10 p-4 text-sm leading-7 text-gray-600 dark:text-slate-300">
                                    A focused interface for users who want reliable document workflows without the clutter of a heavyweight desktop suite.
                                </div>
                            </div>
                        </div>

                        <div className="mt-10 text-center lg:text-left">
                            <svg className="mx-auto h-6 w-6 text-gray-400 dark:text-slate-600 lg:mx-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                            </svg>
                        </div>
                    </div>
                </div>
            </section>

            {/* ===== TOOLS SECTION ===== */}
            <section id="tools" className="relative py-20">
                <div className="absolute inset-0 gradient-bg-section" />
                <div className="relative z-10 w-full px-6 sm:px-8 lg:px-12 xl:px-16">
                    <div className="mb-10 max-w-3xl">
                        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-violet-500 dark:text-violet-300">Tools</p>
                        <h2 className="mb-3 text-2xl font-bold text-gray-900 dark:text-white md:text-3xl">
                            PDF Tools for{" "}
                            <span className="gradient-text">Every Task</span>
                        </h2>
                        <p className="text-gray-600 dark:text-slate-400">
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
