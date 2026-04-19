import { Metadata } from "next";
import RotatePDFTool from "@/components/RotatePDFTool";
import { generateToolMetadata } from "@/lib/metadata";
import { SITE_URL } from "@/lib/constants";

export const metadata: Metadata = generateToolMetadata("rotate-pdf");

export default function RotatePDFPage() {
    const breadcrumbJsonLd = { "@context": "https://schema.org", "@type": "BreadcrumbList",
        itemListElement: [
            { "@type": "ListItem",
                position: 1,
                name: "Home",
                item: SITE_URL,
            },
            { "@type": "ListItem",
                position: 2,
                name: "Rotate PDF",
                item: `${SITE_URL}/rotate-pdf`,
            },
        ],
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
            />
            <RotatePDFTool />

            {/* SEO Content Section */}
            <section className="bg-white/5">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <div className="bg-white/5 rounded-2xl p-8 border-2 border-white/10">
                        <h2 className="text-2xl font-bold text-white mb-4">
                            Rotate PDF Pages Online
                        </h2>
                        <div className="prose max-w-none text-slate-300 space-y-4">
                            <p>
                                Rotate PDF pages to fix orientation issues, flip scanned documents, or adjust page
                                layouts for presentations. Choose a direction and apply rotation to all pages or
                                specific ranges.
                            </p>

                            <h3 className="text-xl font-semibold text-white mt-6 mb-3">
                                How to Rotate a PDF
                            </h3>
                            <ul className="list-disc pl-6 space-y-2">
                                <li>Upload your PDF file</li>
                                <li>Select the rotation direction</li>
                                <li>Apply rotation to all pages or a range</li>
                                <li>Download the rotated PDF</li>
                            </ul>

                            <p className="mt-4">
                                You can also{" "}
                                <a href="/reorder-pdf" className="text-indigo-400 hover:underline">reorder pages</a>,{" "}
                                <a href="/merge-pdf" className="text-indigo-400 hover:underline">merge PDFs</a>, or{" "}
                                <a href="/compress-pdf" className="text-indigo-400 hover:underline">compress files</a>{" "}
                                after rotation.
                            </p>
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
}
