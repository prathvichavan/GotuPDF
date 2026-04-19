import ProtectPDFTool from "@/components/ProtectPDFTool";
import { Metadata } from "next";
import { SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
    title: "Protect PDF - Add Password Protection | PDF Master Tools",
    description: "Secure your PDF documents with password protection. Add user and owner passwords, control permissions like printing, copying, and editing. Free online PDF protection tool.",
    keywords: ["protect pdf", "password protect pdf", "secure pdf", "encrypt pdf", "pdf security", "pdf permissions"],
};

export default function ProtectPDFPage() {
    const breadcrumbJsonLd = { "@context": "https://schema.org", "@type": "BreadcrumbList",
        itemListElement: [
            { "@type": "ListItem",
                position: 1,
                name: "Home",
                item: SITE_URL,
            },
            { "@type": "ListItem",
                position: 2,
                name: "Protect PDF",
                item: `${SITE_URL}/protect-pdf`,
            },
        ],
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
            />
            <ProtectPDFTool />

            {/* SEO Content Section */}
            <section className="bg-white/5">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <div className="bg-white/5 rounded-2xl p-8 border-2 border-white/10">
                        <h2 className="text-2xl font-bold text-white mb-4">
                            Protect PDF Files with Passwords
                        </h2>
                        <div className="prose max-w-none text-slate-300 space-y-4">
                            <p>
                                Protect PDFs by adding a user password for opening and an owner password to control
                                permissions such as printing, copying, or editing. This helps keep sensitive files
                                secure while maintaining a professional, print‑ready document.
                            </p>

                            <h3 className="text-xl font-semibold text-white mt-6 mb-3">
                                How to Protect a PDF
                            </h3>
                            <ul className="list-disc pl-6 space-y-2">
                                <li>Upload your PDF file</li>
                                <li>Set a user password (required to open the PDF)</li>
                                <li>Optional: set an owner password and choose permissions</li>
                                <li>Click protect and download the secured PDF</li>
                            </ul>

                            <p className="mt-4">
                                Need to remove a password? Use our{" "}
                                <a href="/unlock-pdf" className="text-indigo-400 hover:underline">Unlock PDF</a> tool.
                                You can also{" "}
                                <a href="/merge-pdf" className="text-indigo-400 hover:underline">merge PDF files</a> or{" "}
                                <a href="/compress-pdf" className="text-indigo-400 hover:underline">compress PDFs</a>{" "}
                                after protecting them.
                            </p>
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
}
