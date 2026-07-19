
import React from "react";
import { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME, SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
    title: `Frequently Asked Questions (FAQ) | ${SITE_NAME}`,
    description: 'Find answers to common questions about GotuPDF, including security, file limits, and how to use our free PDF tools.',
    openGraph: {
        title: `Frequently Asked Questions (FAQ) | ${SITE_NAME}`,
        description: 'Find answers to common questions about GotuPDF, including security, file limits, and how to use our free PDF tools.',
        url: `${SITE_URL}/faq`,
        siteName: SITE_NAME,
        type: 'website',
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
        card: 'summary_large_image',
        title: `Frequently Asked Questions (FAQ) | ${SITE_NAME}`,
        description: 'Find answers to common questions about GotuPDF, including security, file limits, and how to use our free PDF tools.',
        images: [`${SITE_URL}/logo.png`],
    },
    alternates: {
        canonical: `${SITE_URL}/faq`,
    },
};

export default function FAQPage() {
    const breadcrumbJsonLd = { "@context": "https://schema.org", "@type": "BreadcrumbList",
        itemListElement: [
            { "@type": "ListItem",
                position: 1,
                name: "Home",
                item: SITE_URL,
            },
            { "@type": "ListItem",
                position: 2,
                name: "FAQ",
                item: `${SITE_URL}/faq`,
            },
        ],
    };

    const faqs = [
        {
            question: "Is GotuPDF really free?",
            answer: "Yes, GotuPDF is completely free to use. You do not need to register, create an account, or pay for any subscription to use our basic tools."
        },
        {
            question: "Are my files safe?",
            answer: "Absolutely. We prioritize your privacy and security. All files uploaded to our servers are processed automatically and are permanently deleted shortly after processing. We do not read, store, or share your document contents."
        },
        {
            question: "Is there a limit on file size?",
            answer: "Currently, we support files up to 50MB for most tools. This ensures fast processing times and optimal performance for all users."
        },
        {
            question: "Can I use GotuPDF on my phone?",
            answer: "Yes! Our website is fully responsive and works great on smartphones, tablets, and desktop computers. You can manage your documents on the go."
        },
        {
            question: "How do I merge multiple PDFs?",
            answer: "To merge files, go to the 'Merge PDF' tool, upload your PDF files, arrange them in the order you want, and click 'Merge PDF'. Your single combined file will be ready for download instantly."
        },
        {
            question: "Do you support OCR (Optical Character Recognition)?",
            answer: "We are constantly working on improving our tools. While basic text extraction works for standard PDFs, we are working on adding advanced OCR capabilities for scanned documents in the near future."
        },
        {
            question: "What happens if my internet connection disconnects during upload?",
            answer: "If the connection drops, the upload will likely fail. You will need to refresh the page and try uploading your file again once your connection is stable."
        },
        {
            question: "Can I convert protected PDFs?",
            answer: "If you know the password, you can use our 'Unlock PDF' tool to remove security. However, we cannot process files if you do not have the legal right or the password to access them."
        }
    ];

    return (
        <div className="relative min-h-screen py-16 overflow-hidden">
            <div className="absolute inset-0 gradient-bg-section" />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
            />
            <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-16">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-500 dark:text-violet-300 mb-3">
                        Support
                    </p>
                    <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white sm:text-5xl tracking-tight">
                        Frequently Asked Questions
                    </h1>
                    <p className="mt-4 text-lg sm:text-xl text-gray-600 dark:text-slate-400 leading-relaxed">
                        Have questions? We're here to help.
                    </p>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                    {faqs.map((faq, index) => (
                        <div key={index} className="glass-card rounded-3xl p-7 transition-all duration-300 hover:-translate-y-1">
                            <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-tight">
                                {faq.question}
                            </h3>
                            <p className="text-gray-600 dark:text-slate-400 leading-7">
                                {faq.answer}
                            </p>
                        </div>
                    ))}
                </div>

                <div className="mt-16 text-center glass-card rounded-[2rem] p-8 border-violet-500/15">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">
                        Still have questions?
                    </h3>
                    <p className="text-gray-600 dark:text-slate-400 mb-6">
                        We're happy to answer any other questions you might have.
                    </p>
                    <Link
                        href="/contact-us"
                        className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-2xl text-white bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:shadow-lg hover:shadow-violet-500/25 transition-all"
                    >
                        Contact Support
                    </Link>
                </div>
            </div>
        </div>
    );
}
