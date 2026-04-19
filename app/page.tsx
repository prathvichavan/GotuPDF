import ToolsGrid from "@/components/ToolsGrid";
import HomeSEOContent from "@/components/HomeSEOContent";
import AntigravityBackground from "@/components/AntigravityBackground";
import HowItWorks from "@/components/HowItWorks";
import WhyChooseUs from "@/components/WhyChooseUs";
import Stats from "@/components/Stats";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
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
            <section className="relative py-12 md:py-16 flex items-center overflow-hidden">
                <AntigravityBackground />
                {/* Gradient overlays */}
                <div className="absolute inset-0 gradient-bg-hero" />
                <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white dark:from-[#0a0e1a] to-transparent" />

                <div className="relative z-10 w-full px-6 sm:px-8 lg:px-12 xl:px-16">
                    <div className="max-w-4xl w-full mx-auto text-center flex flex-col items-center">
                        {/* Headline */}
                        <h1 className="text-4xl md:text-6xl font-extrabold text-gray-900 dark:text-white mb-6 leading-tight tracking-tight">
                            The Smartest Way to Work with{" "}
                            <span className="gradient-text">PDFs</span>
                        </h1>
                        <p className="mt-6 text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto leading-relaxed">
                            Built to simplify the way you handle documents, GotuPDF combines intelligent automation with powerful editing, conversion, and security tools.
                            <br className="hidden sm:block" />
                            Work faster, stay precise, and manage PDFs without complexity.
                        </p>

                        {/* Scroll indicator */}
                        <div className="animate-bounce mt-10">
                            <svg className="w-6 h-6 mx-auto text-gray-400 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                            Choose from 25+ tools to merge, split, convert, compress, and more.
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
            {/* <HomeSEOContent /> */}
        </div>
    );
}
