"use client";

import Link from "next/link";
import { ALL_PDF_TOOLS, type PdfTool } from "@/lib/constants";

const benefitCards = [
    {
        title: "Secure",
        description: "Built for sensitive documents with a privacy-first workflow and clear file handling.",
        icon: (
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
        ),
    },
    {
        title: "Fast",
        description: "Optimized for quick browser workflows, so small edits and larger jobs both feel responsive.",
        icon: (
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
        ),
    },
    {
        title: "Free",
        description: "A straightforward web experience that avoids subscriptions, setup friction, and hidden steps.",
        icon: (
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
    },
    {
        title: "Privacy First",
        description: "Designed to keep the interface transparent about your file workflow from upload to download.",
        icon: (
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M3 7a9 9 0 0118 0v5a9 9 0 11-18 0V7z" />
            </svg>
        ),
    },
    {
        title: "Works Everywhere",
        description: "Responsive layouts keep the workflow comfortable on desktop, tablet, and mobile screens.",
        icon: (
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9.75 17H7a2 2 0 01-2-2V7a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.75m-4.5 0v2.25m0 0h4.5M12 19.25h0" />
            </svg>
        ),
    },
];

const howToCards = [
    { step: "01", title: "Upload files", description: "Add your PDF or image files using the existing upload flow on the page." },
    { step: "02", title: "Review options", description: "Check the page-specific controls, order, or settings before you process." },
    { step: "03", title: "Process safely", description: "Run the tool and let the current backend workflow handle the actual document work." },
    { step: "04", title: "Download results", description: "Save the finished file and continue with the next document task if needed." },
];

function getTool(toolId: string): PdfTool | undefined {
    return ALL_PDF_TOOLS.find((tool) => tool.id === toolId);
}

function buildFaqItems(toolName: string, toolDescription: string, category?: PdfTool["category"]) {
    const subject = toolName.toLowerCase();
    const categoryFaqs = {
        convert: [
            { question: `Will ${subject} keep my document layout?`, answer: `This tool is designed to keep the original structure as intact as possible while converting content into the requested output format. ${toolDescription}` },
            { question: `What kinds of files work best with ${subject}?`, answer: "Clean source files with readable text, consistent formatting, and standard fonts usually produce the best results. Scans should be sharp enough for accurate text recognition when applicable." },
            { question: `Can I use ${subject} on mobile?`, answer: "Yes. The page layout is responsive, so you can upload and process files from modern mobile browsers as well as desktop devices." },
        ],
        edit: [
            { question: `What can I do with ${subject}?`, answer: `You can use this tool to reorganize, refine, or prepare documents for sharing while keeping the workflow inside the browser. ${toolDescription}` },
            { question: `Will my source file be overwritten?`, answer: "No. The workflow is built around producing a new output file, so your original upload remains separate from the result." },
            { question: `Is it suitable for large documents?`, answer: "Yes. The interface is tuned for practical PDF jobs, including documents with many pages or multiple input files." },
        ],
        security: [
            { question: `Why should I use ${subject}?`, answer: `Use it when you need to protect, redact, sign, unlock, or otherwise secure a document without changing your core workflow. ${toolDescription}` },
            { question: "Is the workflow privacy friendly?", answer: "The UI emphasizes a private document workflow, clear upload feedback, and a simple path from source file to download." },
            { question: "Can I use it for sensitive documents?", answer: "Yes, as long as the document use case matches the tool and your organization allows browser-based processing for that file type." },
        ],
        optimize: [
            { question: `When should I use ${subject}?`, answer: `Use it when you want to improve file quality, reduce size, repair structure, or prepare a cleaner document for sharing. ${toolDescription}` },
            { question: "Will the result still look professional?", answer: "The workflow is built to preserve a readable, polished result while improving the specific document problem you are solving." },
            { question: "Is there a recommended file size?", answer: "Smaller and well-structured source files are easiest to process, but the upload area still supports practical day-to-day PDF jobs." },
        ],
    } as const;

    return [
        { question: `What does ${toolName} do?`, answer: toolDescription },
        ...(categoryFaqs[category || "edit"] || categoryFaqs.edit),
        { question: `What is the best practice when using ${subject}?`, answer: "Start with the cleanest source file you have, check the order or settings before processing, and keep the original file available as a backup." },
    ];
}

export default function ToolContentSections({ toolId, toolName, toolDescription }: { toolId: string; toolName: string; toolDescription: string }) {
    const tool = getTool(toolId);
    const relatedTools = (tool
        ? ALL_PDF_TOOLS.filter((candidate) => candidate.status === "active" && candidate.id !== toolId && candidate.category === tool.category)
        : ALL_PDF_TOOLS.filter((candidate) => candidate.status === "active" && candidate.id !== toolId)
    ).slice(0, 4);

    const faqItems = buildFaqItems(toolName, toolDescription, tool?.category);

    const schema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqItems.map((faq) => ({
            "@type": "Question",
            name: faq.question,
            acceptedAnswer: {
                "@type": "Answer",
                text: faq.answer,
            },
        })),
    };

    return (
        <section className="relative overflow-hidden border-t border-gray-200/70 bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.06),transparent_45%)] dark:border-white/5">
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />

            <div className="relative z-10 mx-auto max-w-7xl px-6 py-16 sm:px-8 lg:px-12 xl:px-16">
                <div className="mx-auto max-w-4xl text-center">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-500 dark:text-violet-300">Premium PDF workflow</p>
                    <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-900 dark:text-white md:text-4xl">
                        {toolName} built for fast, clear document work
                    </h2>
                    <p className="mt-4 text-base leading-8 text-gray-600 dark:text-slate-400 md:text-lg">
                        {toolDescription} This page keeps the actual tool behavior intact while giving you a cleaner, more guided experience around the workflow.
                    </p>
                </div>

                <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
                    {benefitCards.map((card) => (
                        <div key={card.title} className="group h-full rounded-[1.75rem] border border-gray-200/70 bg-white/80 p-5 shadow-[0_20px_80px_rgba(124,58,237,0.06)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-violet-500/30 dark:border-white/5 dark:bg-white/5">
                            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600 transition-colors group-hover:bg-violet-500/15 dark:text-violet-300">
                                {card.icon}
                            </div>
                            <h3 className="mt-4 text-base font-semibold text-gray-900 dark:text-white">{card.title}</h3>
                            <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-slate-400">{card.description}</p>
                        </div>
                    ))}
                </div>

                <div className="mt-16 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
                    <div className="rounded-[2rem] border border-gray-200/70 bg-white/85 p-7 shadow-[0_20px_80px_rgba(124,58,237,0.08)] backdrop-blur-sm dark:border-white/5 dark:bg-white/5">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-500 dark:text-violet-300">How to use</p>
                        <h3 className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">A simple four-step flow</h3>
                        <div className="mt-6 space-y-4">
                            {howToCards.map((step) => (
                                <div key={step.step} className="flex gap-4 rounded-2xl border border-gray-200/70 bg-gray-50/80 p-4 dark:border-white/5 dark:bg-white/5">
                                    <div className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-sm font-bold text-white shadow-lg shadow-violet-500/25">
                                        {step.step}
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{step.title}</h4>
                                        <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-slate-400">{step.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-[2rem] border border-gray-200/70 bg-white/85 p-7 shadow-[0_20px_80px_rgba(124,58,237,0.08)] backdrop-blur-sm dark:border-white/5 dark:bg-white/5">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-500 dark:text-violet-300">Tool explanation</p>
                        <h3 className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">Why this workflow feels better</h3>
                        <div className="mt-5 space-y-4 text-sm leading-7 text-gray-600 dark:text-slate-400 md:text-base">
                            <p>
                                {toolName} is designed for people who need to finish document work quickly without learning a complicated desktop suite. The upload flow stays familiar, the controls stay visible, and the result is easy to review before you download it.
                            </p>
                            <p>
                                In practical use, that means less time switching between tools and more time finishing the job. If you are preparing files for a client, organizing paperwork for school, or cleaning up a document before sharing it with a team, the page keeps the focus on the task rather than the interface.
                            </p>
                            <p>
                                The best results usually come from a tidy source file: readable text, sensible page order, and clear file names. For scanned documents, a sharper scan helps any recognition or conversion step. For multi-file tasks, it also helps to arrange the files before processing so the output matches the order you want.
                            </p>
                            <p>
                                Another advantage is consistency. The same core browser experience can support common day-to-day tasks like merging files, splitting pages, converting formats, compressing large PDFs, and securing confidential documents. That reduces friction across the website and gives the product a more polished SaaS feel.
                            </p>
                        </div>

                        <div className="mt-6 rounded-2xl border border-violet-500/15 bg-violet-500/10 p-4 text-sm leading-7 text-gray-600 dark:text-slate-300">
                            Tip: keep your original file handy, use the preview or reorder controls when available, and choose the most direct workflow for the job.
                        </div>
                    </div>
                </div>

                <div className="mt-16">
                    <div className="max-w-4xl">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-500 dark:text-violet-300">FAQs</p>
                        <h3 className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">Common questions about {toolName}</h3>
                    </div>

                    <div className="mt-6 grid gap-4 lg:grid-cols-2">
                        {faqItems.map((faq) => (
                            <details key={faq.question} className="group rounded-[1.5rem] border border-gray-200/70 bg-white/80 p-5 shadow-sm backdrop-blur-sm open:border-violet-500/25 dark:border-white/5 dark:bg-white/5">
                                <summary className="cursor-pointer list-none text-base font-semibold text-gray-900 outline-none transition-colors group-open:text-violet-600 dark:text-white dark:group-open:text-violet-300">
                                    {faq.question}
                                </summary>
                                <p className="mt-3 text-sm leading-7 text-gray-600 dark:text-slate-400">{faq.answer}</p>
                            </details>
                        ))}
                    </div>
                </div>

                <div className="mt-16">
                    <div className="flex items-end justify-between gap-4">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-500 dark:text-violet-300">Related PDF tools</p>
                            <h3 className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">Move to the next step</h3>
                        </div>
                        <Link href="/#tools" className="hidden text-sm font-medium text-violet-600 transition-colors hover:text-violet-500 sm:inline-flex dark:text-violet-300 dark:hover:text-violet-200">
                            View all tools
                        </Link>
                    </div>

                    <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {relatedTools.map((related) => (
                            <Link
                                key={related.id}
                                href={related.path}
                                className="group rounded-[1.5rem] border border-gray-200/70 bg-white/80 p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-violet-500/30 hover:shadow-[0_20px_60px_rgba(124,58,237,0.12)] dark:border-white/5 dark:bg-white/5"
                            >
                                <div className="text-sm font-semibold text-gray-900 transition-colors group-hover:text-violet-600 dark:text-white dark:group-hover:text-violet-300">
                                    {related.name}
                                </div>
                                <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-slate-400">{related.description}</p>
                                <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-violet-600 dark:text-violet-300">
                                    Open tool
                                    <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                    </svg>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}