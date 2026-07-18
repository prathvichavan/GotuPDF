import type { Metadata } from "next";
import { SITE_NAME, SITE_URL, UPCOMING_TOOLS } from "@/lib/constants";

const ICONS: Record<string, JSX.Element> = {
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
    merge: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
    ),
};

export const metadata: Metadata = {
    title: "Upcoming PDF Features | GotuPDF",
    description:
        "Explore upcoming PDF tools currently under development including Word to PDF, OCR PDF, Compare PDF, Translate PDF and more.",
    keywords: ["upcoming pdf features", "coming soon pdf tools", "word to pdf", "ocr pdf", "compare pdf", "translate pdf"],
    openGraph: {
        title: "Upcoming PDF Features | GotuPDF",
        description:
            "Explore upcoming PDF tools currently under development including Word to PDF, OCR PDF, Compare PDF, Translate PDF and more.",
        url: `${SITE_URL}/upcoming-features`,
        siteName: SITE_NAME,
        type: "website",
        images: [
            {
                url: `${SITE_URL}/logo.png`,
                width: 1200,
                height: 630,
                alt: `${SITE_NAME} Logo`,
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: "Upcoming PDF Features | GotuPDF",
        description:
            "Explore upcoming PDF tools currently under development including Word to PDF, OCR PDF, Compare PDF, Translate PDF and more.",
        images: [`${SITE_URL}/logo.png`],
    },
    alternates: {
        canonical: `${SITE_URL}/upcoming-features`,
    },
};

export default function UpcomingFeaturesPage() {
    const breadcrumbJsonLd = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
            {
                "@type": "ListItem",
                position: 1,
                name: "Home",
                item: SITE_URL,
            },
            {
                "@type": "ListItem",
                position: 2,
                name: "Upcoming Features",
                item: `${SITE_URL}/upcoming-features`,
            },
        ],
    };

    return (
        <div className="relative z-10 w-full">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
            />

            <section className="relative py-16 md:py-20 overflow-hidden">
                <div className="absolute inset-0 gradient-bg-hero" />
                <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white dark:from-[#0a0e1a] to-transparent" />

                <div className="relative z-10 w-full px-6 sm:px-8 lg:px-12 xl:px-16">
                    <div className="max-w-4xl mx-auto text-center">
                        <p className="inline-flex items-center px-4 py-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-sm font-semibold mb-5">
                            Coming Soon
                        </p>
                        <h1 className="text-4xl md:text-6xl font-extrabold text-gray-900 dark:text-white mb-5 leading-tight tracking-tight">
                            🚀 Upcoming Features
                        </h1>
                        <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 leading-relaxed max-w-3xl mx-auto">
                            These PDF tools are currently under development and will be available in future updates. We are actively working to bring these features soon.
                        </p>
                    </div>
                </div>
            </section>

            <section className="py-10 md:py-16 relative">
                <div className="absolute inset-0 gradient-bg-section" />
                <div className="relative z-10 w-full px-6 sm:px-8 lg:px-12 xl:px-16">
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                        {UPCOMING_TOOLS.map((tool) => (
                            <article
                                key={tool.name}
                                className="group relative glass-card rounded-2xl p-6 border border-gray-200 dark:border-white/10 hover:border-amber-500/30 transition-all duration-300"
                            >
                                <div
                                    className="absolute top-0 left-4 right-4 h-[2px] rounded-b-full opacity-50 group-hover:opacity-90 transition-opacity"
                                    style={{ background: `linear-gradient(90deg, transparent, ${tool.color}, transparent)` }}
                                />

                                <div className="flex items-start justify-between gap-3 mb-5">
                                    <div
                                        className="w-14 h-14 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                                        style={{
                                            backgroundColor: `${tool.color}18`,
                                            boxShadow: `0 0 0 1px ${tool.color}24`,
                                            color: tool.color,
                                        }}
                                    >
                                        {ICONS[tool.icon] || ICONS.convert}
                                    </div>
                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-[0.16em] bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/20">
                                        Coming Soon
                                    </span>
                                </div>

                                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                                    {tool.name}
                                </h2>
                                <p className="text-sm text-gray-500 dark:text-slate-400 leading-relaxed mb-6 min-h-[3rem]">
                                    {tool.description}
                                </p>

                                <button
                                    type="button"
                                    disabled
                                    className="w-full inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-slate-500 border border-gray-200 dark:border-white/10 cursor-not-allowed"
                                >
                                    Coming Soon
                                </button>
                            </article>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
}
