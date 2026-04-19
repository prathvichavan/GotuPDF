import { Metadata } from "next";
import ReorderPDFTool from "@/components/ReorderPDFTool";
import { generateToolMetadata } from "@/lib/metadata";
import { SITE_URL } from "@/lib/constants";

export const metadata: Metadata = generateToolMetadata("reorder-pdf");

export default function ReorderPDFPage() {
    const breadcrumbJsonLd = { "@context": "https://schema.org", "@type": "BreadcrumbList",
        itemListElement: [
            { "@type": "ListItem",
                position: 1,
                name: "Home",
                item: SITE_URL,
            },
            { "@type": "ListItem",
                position: 2,
                name: "Reorder PDF",
                item: `${SITE_URL}/reorder-pdf`,
            },
        ],
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
            />
            <ReorderPDFTool />

            {/* SEO Content Section */}
            <section className="bg-white/5">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <div className="bg-white/5 rounded-2xl p-8 border-2 border-white/10">
                        <h2 className="text-2xl font-bold text-white mb-4">
                            Reorder PDF Pages Online
                        </h2>
                        <div className="prose max-w-none text-slate-300 space-y-4">
                            <p>
                                Reorder PDF pages to change the sequence of your document. Drag pages into a new
                                order, then download the updated PDF with the correct layout and flow.
                            </p>

                            <h3 className="text-xl font-semibold text-white mt-6 mb-3">
                                How to Reorder a PDF
                            </h3>
                            <ul className="list-disc pl-6 space-y-2">
                                <li>Upload your PDF file</li>
                                <li>Drag pages to arrange the new order</li>
                                <li>Click apply and download the reordered PDF</li>
                            </ul>

                            <p className="mt-4">
                                Need to rotate pages first? Try{" "}
                                <a href="/rotate-pdf" className="text-indigo-400 hover:underline">Rotate PDF</a>. You can
                                also{" "}
                                <a href="/split-pdf" className="text-indigo-400 hover:underline">split PDFs</a> or{" "}
                                <a href="/merge-pdf" className="text-indigo-400 hover:underline">merge documents</a>{" "}
                                after reordering.
                            </p>
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
}
