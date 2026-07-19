import Link from "next/link";
import { PDF_TOOLS, type PdfTool } from "@/lib/constants";

const BENEFITS = [
    {
        title: "Secure",
        description: "Your documents are handled through a focused workflow with minimal surface area and no unnecessary steps.",
        icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
        ),
    },
    {
        title: "Fast",
        description: "A lightweight interface keeps users moving from upload to download without unnecessary distraction.",
        icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
        ),
    },
    {
        title: "Free",
        description: "Core document tasks stay easy to access so the product feels simple and trustworthy from the first visit.",
        icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
        ),
    },
    {
        title: "Privacy First",
        description: "The experience is designed around document handling, clear expectations, and minimal friction for users.",
        icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 11c2.21 0 4-1.79 4-4V5a4 4 0 10-8 0v2c0 2.21 1.79 4 4 4zm-7 2a2 2 0 012-2h10a2 2 0 012 2v4a5 5 0 01-5 5H10a5 5 0 01-5-5v-4z" />
            </svg>
        ),
    },
    {
        title: "Works Everywhere",
        description: "The UI adapts cleanly to desktop, tablet, and mobile so document tasks stay accessible anywhere.",
        icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v9a2 2 0 002 2z" />
            </svg>
        ),
    },
];

const FEATURE_ITEMS = [
    "Drag-and-drop upload flow",
    "Responsive card-based layout",
    "Clear progress and feedback states",
    "Download-first completion flow",
    "Keyboard-friendly interactions",
    "Readable content hierarchy",
];

const getToolCategoryLabel = (tool: PdfTool) => {
    switch (tool.category) {
        case "convert":
            return "conversion workflow";
        case "edit":
            return "document editing workflow";
        case "security":
            return "document protection workflow";
        case "optimize":
            return "document optimization workflow";
        default:
            return "document workflow";
    }
};

const getHowToUseSteps = (tool: PdfTool) => [
    `Upload or drop your ${tool.name.toLowerCase()} source file(s).`,
    `Review the file list or settings so the result matches your intended output.`,
    `Start the ${getToolCategoryLabel(tool)} and wait for the status state to complete.`,
    "Download the finished file and keep working without changing your setup.",
];

const getToolContent = (tool: PdfTool) => {
    const baseName = tool.name;
    const categoryName = getToolCategoryLabel(tool);

    if (tool.category === "convert") {
        return [
            `${baseName} is built for people who need a straightforward way to move between document formats without learning a new desktop application. The page focuses on a clear sequence: upload, process, and download. That makes the conversion flow easier to trust, because the user always knows what is happening and what happens next.`,
            `For day-to-day work, that matters. Students want to turn reference material into something they can annotate. Teams want to hand off files that open consistently across devices. Solo operators want to keep the process quick when they are converting several files in a row. A focused ${categoryName} removes the friction that usually gets in the way of those tasks.`,
            `Best results come from starting with a clean source file, checking the file order if multiple inputs are allowed, and picking the correct destination format before you process anything. If you are moving from PDF into an editable format, it also helps to keep the original version nearby so you can compare the output and make small adjustments if needed.`,
            `The advantage of a browser-based converter is that it lets you stay inside one workflow. You can review the file, run the conversion, download the output, and move on without extra installs or switching tools. That combination of clarity, speed, and reduced context switching is what makes the experience feel premium instead of complicated.`,
        ];
    }

    if (tool.category === "edit") {
        return [
            `${baseName} is designed to make document changes feel deliberate rather than risky. Editing a PDF is often less about adding features and more about preserving the structure that already exists. That means the interface should stay calm, readable, and precise while still giving you enough control to complete the task confidently.`,
            `People use edit-oriented PDF tools for everything from document cleanup and page organization to small corrections that would be annoying in a different app. A polished ${categoryName} helps by keeping the upload state, file order, and action controls in one place so the user does not have to hunt for the next step.`,
            `The best way to use this kind of tool is to work from the outcome you want, not just from the file you uploaded. Decide whether you need to add, remove, reorder, or annotate before you process the document. That habit makes the result more predictable and reduces the chance of doing multiple passes over the same file.`,
            `A strong editing experience is also about trust. Clear labels, consistent spacing, and immediate feedback help people understand where their files are and what the application will do with them. That makes the tool feel closer to a premium desktop product while staying easy to use in a browser.`,
        ];
    }

    if (tool.category === "security") {
        return [
            `${baseName} focuses on protecting sensitive information while keeping the workflow approachable. Security tools work best when the interface is simple and direct, because users usually arrive with a clear goal: lock something down, remove access, or prepare a document for controlled sharing.`,
            `In practice, people use these tools for contracts, internal reports, archived records, and other documents that should not be left open without intention. A clean ${categoryName} reduces the feeling of uncertainty and makes the steps feel obvious, from upload to completion.`,
            `A good habit is to double-check the source file before processing and verify that you are working with the version you actually want to secure. If a file contains multiple sections or supporting pages, it is also worth reviewing the order so the final document remains easy to navigate after the security step is complete.`,
            `The main benefit of keeping the experience inside the browser is that it avoids extra installs while still presenting a focused, privacy-aware interaction. That makes the page feel more like a dependable workspace and less like a generic utility form.`,
        ];
    }

    return [
        `${baseName} helps reduce time spent on repetitive document tasks by turning a practical job into a simple browser flow. Optimization features are most valuable when the interface is easy to scan, because the user is usually trying to solve a problem quickly rather than explore every setting.`,
        `That is why the layout should present the key actions first, then move into supporting details such as benefits, tips, and common questions. A polished ${categoryName} does exactly that by keeping the important controls visible and the explanatory content well organized below the fold.`,
        `Good results come from understanding the source file before processing it. Large scans, complex layouts, or image-heavy files often need slightly different handling than simple documents, so it pays to read the short guidance, confirm the selected file, and run the tool once with the most appropriate settings.`,
        `When optimization is done well, the document is easier to share, easier to store, and less frustrating to open later. That practical gain is what turns a basic utility into a product experience that feels genuinely useful instead of merely functional.`,
    ];
};

const getFaqs = (tool: PdfTool) => {
    const base = tool.name;

    const faqSets: Record<string, Array<{ question: string; answer: string }>> = {
        convert: [
            { question: `What file types work best with ${base}?`, answer: `The tool works best with clean source files that match the format expected by ${base.toLowerCase()}. If your document includes many images or unusual layout elements, review the output carefully after download.` },
            { question: "Can I convert multiple files at once?", answer: "If the page supports batch input, you can upload more than one file and process them together. The interface will show the selected files so you can confirm the order before starting." },
            { question: "Will formatting stay intact?", answer: "The goal is to preserve the original structure as closely as possible. Results are strongest when the source file uses standard fonts, clean spacing, and simple page layouts." },
            { question: "Do I need to install anything?", answer: "No. The workflow runs in the browser, so you can upload, process, and download files without installing desktop software." },
            { question: "Is this suitable for work documents?", answer: "Yes. The layout and flow are designed for everyday document tasks such as sharing, archiving, and preparing files for review." },
            { question: "What should I do if the output needs minor cleanup?", answer: "Use the downloaded file as a starting point and compare it with the original source. That makes it easier to spot layout changes or missing elements." },
        ],
        edit: [
            { question: `How do I get the best result from ${base}?`, answer: "Start with a clean source file and use one change at a time when possible. That makes it easier to verify the result and avoid unnecessary rework." },
            { question: "Can I organize several pages in one session?", answer: "Yes, the page is designed to support structured document work, including reordering, trimming, and other page-level adjustments depending on the tool." },
            { question: "Will my document stay readable after editing?", answer: "The goal of the interface is to keep the workflow precise and clear so the edited file remains easy to review and use afterward." },
            { question: "What if my file has many pages?", answer: "For large documents, it helps to break the task into smaller decisions and confirm the selected pages before processing." },
            { question: "Can I use the tool on mobile?", answer: "Yes. The layout is responsive, so the editing workflow stays usable on smaller screens as well as desktop displays." },
            { question: "Should I keep a backup copy?", answer: "Yes. Keeping the original source file is a good practice whenever you are making changes that affect page order or content." },
        ],
        security: [
            { question: `When should I use ${base}?`, answer: "Use it when you want to secure a document, remove access, or prepare sensitive files for controlled sharing. The tool is best suited for intentional document protection tasks." },
            { question: "Will the original file structure stay intact?", answer: "The workflow is designed to keep the file understandable and usable after processing, while focusing on the security-related change you requested." },
            { question: "Can I work with business documents?", answer: "Yes. Security-oriented PDF tasks are common for contracts, internal reports, and archived records that need controlled handling." },
            { question: "Should I check the file before uploading?", answer: "Absolutely. Confirm that you are using the right version before processing so you do not secure or modify the wrong document." },
            { question: "Is the interface mobile-friendly?", answer: "Yes. The page is responsive and keeps the key controls visible on tablet and mobile screens." },
            { question: "What if I need a different security action later?", answer: "You can return to the related PDF security tools from the related tools section and continue from there." },
        ],
        optimize: [
            { question: `What makes ${base} useful?`, answer: "It helps you solve routine document problems faster by presenting the right controls clearly and reducing unnecessary steps in the workflow." },
            { question: "Should I use the tool on every large file?", answer: "Use it when the file size, quality, or document condition makes sharing or storage harder than it should be." },
            { question: "Will I lose important content?", answer: "The goal is to keep the result useful while improving the specific document property you asked to optimize." },
            { question: "Can I use this on scanned documents?", answer: "Yes, as long as the source file matches the expected format for the tool. For scans, verify the output after processing." },
            { question: "Is this responsive on smaller devices?", answer: "Yes. The responsive layout keeps the file controls and supporting content easy to use on mobile and tablet screens." },
            { question: "What is a good best practice before processing?", answer: "Review the source file, make sure the pages are in the right order, and confirm you are uploading the version you actually want to optimize." },
        ],
    };

    return faqSets[tool.category] || faqSets.optimize;
};

const getRelatedTools = (tool: PdfTool) => {
    const sameCategory = PDF_TOOLS.filter((item) => item.id !== tool.id && item.category === tool.category);
    const otherTools = PDF_TOOLS.filter((item) => item.id !== tool.id && item.category !== tool.category);
    return [...sameCategory, ...otherTools].slice(0, 6);
};

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
    return (
        <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-500 dark:text-violet-300 mb-3">
                {eyebrow}
            </p>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-white tracking-tight">
                {title}
            </h2>
            <p className="mt-4 text-base sm:text-lg text-gray-600 dark:text-slate-400 leading-relaxed">
                {description}
            </p>
        </div>
    );
}

export default function ToolSections({ tool }: { tool: PdfTool }) {
    const howToUse = getHowToUseSteps(tool);
    const contentParagraphs = getToolContent(tool);
    const faqs = getFaqs(tool);
    const relatedTools = getRelatedTools(tool);

    const faqSchema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map((faq) => ({
            "@type": "Question",
            name: faq.question,
            acceptedAnswer: {
                "@type": "Answer",
                text: faq.answer,
            },
        })),
    };

    return (
        <div className="border-t border-gray-200/70 dark:border-white/5 bg-[var(--bg-secondary)]/90">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
            />

            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 md:py-20 space-y-16">
                <section id="how-to-use" className="scroll-mt-28">
                    <SectionHeading
                        eyebrow="How To Use"
                        title={`A clean ${tool.name} workflow`}
                        description={`Follow these steps to move from file upload to finished output with a polished, predictable experience.`}
                    />

                    <div className="mt-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        {howToUse.map((step, index) => (
                            <div key={step} className="glass-card h-full rounded-3xl p-6 flex flex-col gap-4">
                                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-300 border border-violet-500/15">
                                    <span className="text-sm font-semibold">0{index + 1}</span>
                                </div>
                                <p className="text-sm sm:text-base leading-relaxed text-gray-700 dark:text-slate-300">
                                    {step}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>

                <section id="benefits" className="scroll-mt-28">
                    <SectionHeading
                        eyebrow="Benefits"
                        title="Why the workflow feels better"
                        description="The product should feel simple, trustworthy, and fast enough that users can focus on the document rather than the interface."
                    />

                    <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
                        {BENEFITS.map((benefit) => (
                            <div key={benefit.title} className="glass-card h-full rounded-3xl p-5 flex flex-col gap-4">
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-300 border border-violet-500/15">
                                    {benefit.icon}
                                </div>
                                <h3 className="text-base font-semibold text-gray-900 dark:text-white">{benefit.title}</h3>
                                <p className="text-sm leading-relaxed text-gray-600 dark:text-slate-400">{benefit.description}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <section id="tool-explanation" className="scroll-mt-28">
                    <SectionHeading
                        eyebrow="Tool Explanation"
                        title={`What ${tool.name} helps you do`}
                        description={`A strong explanation section should help visitors understand the purpose of the tool, the value it provides, and how to use it responsibly.`}
                    />

                    <div className="mt-8 grid gap-6 lg:grid-cols-[1.35fr_0.95fr]">
                        <div className="glass-card rounded-3xl p-6 sm:p-8 space-y-5">
                            {contentParagraphs.map((paragraph) => (
                                <p key={paragraph.slice(0, 32)} className="text-base sm:text-lg leading-8 text-gray-600 dark:text-slate-300">
                                    {paragraph}
                                </p>
                            ))}
                        </div>

                        <aside className="space-y-4">
                            <div className="glass-card rounded-3xl p-6 sm:p-7">
                                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-500 dark:text-violet-300 mb-3">
                                    Features
                                </p>
                                <ul className="space-y-3">
                                    {FEATURE_ITEMS.map((feature) => (
                                        <li key={feature} className="flex items-start gap-3 text-sm sm:text-base text-gray-600 dark:text-slate-300">
                                            <span className="mt-1 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-300">•</span>
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="glass-card rounded-3xl p-6 sm:p-7">
                                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-500 dark:text-violet-300 mb-3">
                                    Tips
                                </p>
                                <p className="text-sm sm:text-base leading-7 text-gray-600 dark:text-slate-300">
                                    Keep your source file organized, choose the correct file order before processing, and review the result right after download. Small checks at the start make the final output easier to trust.
                                </p>
                            </div>
                        </aside>
                    </div>
                </section>

                <section id="faqs" className="scroll-mt-28">
                    <SectionHeading
                        eyebrow="FAQs"
                        title={`Frequently asked questions about ${tool.name}`}
                        description="Clear answers help visitors understand the workflow, expected results, and best practices before they start processing files."
                    />

                    <div className="mt-8 grid gap-4 md:grid-cols-2">
                        {faqs.map((faq) => (
                            <div key={faq.question} className="glass-card rounded-3xl p-6">
                                <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
                                    {faq.question}
                                </h3>
                                <p className="text-sm sm:text-base leading-7 text-gray-600 dark:text-slate-300">
                                    {faq.answer}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>

                <section id="related-tools" className="scroll-mt-28">
                    <SectionHeading
                        eyebrow="Related PDF Tools"
                        title="Continue with the next step in your workflow"
                        description="Helpful cross-links keep the experience connected and make it easier to move into the next document task without restarting your search."
                    />

                    <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                        {relatedTools.map((relatedTool) => (
                            <Link
                                key={relatedTool.id}
                                href={relatedTool.path}
                                className="glass-card group rounded-3xl p-5 flex h-full flex-col justify-between gap-4 transition-all duration-300 hover:-translate-y-1 hover:border-violet-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"
                            >
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400 dark:text-slate-500 mb-2">
                                        Related Tool
                                    </p>
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-300 transition-colors">
                                        {relatedTool.name}
                                    </h3>
                                    <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-slate-400">
                                        {relatedTool.description}
                                    </p>
                                </div>
                                <span className="inline-flex items-center text-sm font-medium text-violet-600 dark:text-violet-300">
                                    Open tool
                                    <svg className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                    </svg>
                                </span>
                            </Link>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
}