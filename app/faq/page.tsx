
import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { SITE_NAME, SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
    title: `Frequently Asked Questions (FAQ) | ${SITE_NAME}`,
    description: 'Find answers to common questions about GotuPDF, including security, file limits, and how to use our free PDF tools.',
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
        <div className="bg-white dark:bg-white/5 min-h-screen py-16">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
            />
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-16">
                    <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white sm:text-5xl">
                        Frequently Asked Questions
                    </h1>
                    <p className="mt-4 text-xl text-gray-500 dark:text-slate-400">
                        Have questions? We're here to help.
                    </p>
                </div>

                <div className="space-y-8">
                    {faqs.map((faq, index) => (
                        <div key={index} className="bg-white dark:bg-white/5 rounded-2xl shadow-sm border border-gray-200 dark:border-white/5 p-8 transition-shadow hover:shadow-md">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                                {faq.question}
                            </h3>
                            <p className="text-gray-500 dark:text-slate-400 leading-relaxed">
                                {faq.answer}
                            </p>
                        </div>
                    ))}
                </div>

                <div className="mt-16 text-center bg-indigo-500/10 rounded-2xl p-8 border border-indigo-500/15">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                        Still have questions?
                    </h3>
                    <p className="text-gray-500 dark:text-slate-400 mb-6">
                        We're happy to answer any other questions you might have.
                    </p>
                    <Link
                        href="/contact-us"
                        className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
                        style={{ color: '#ffffff' }}
                    >
                        Contact Support
                    </Link>
                </div>
            </div>
        </div>
    );
}
