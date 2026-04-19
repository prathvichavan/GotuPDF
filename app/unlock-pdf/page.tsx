import UnlockPDFTool from "@/components/UnlockPDFTool";
import { Metadata } from "next";
import { SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
    title: "Unlock PDF - Remove Password Protection | PDF Master Tools",
    description: "Unlock password-protected PDFs online. Remove encryption securely with the correct password. Free PDF unlocker tool.",
    keywords: ["unlock pdf", "remove pdf password", "decrypt pdf", "pdf unlocker", "password remover"],
};

export default function UnlockPDFPage() {
    const breadcrumbJsonLd = { "@context": "https://schema.org", "@type": "BreadcrumbList",
        itemListElement: [
            { "@type": "ListItem",
                position: 1,
                name: "Home",
                item: SITE_URL,
            },
            { "@type": "ListItem",
                position: 2,
                name: "Unlock PDF",
                item: `${SITE_URL}/unlock-pdf`,
            },
        ],
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
            />
            <UnlockPDFTool />

            {/* SEO Content Section */}
            <section className="bg-white/5">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <div className="bg-white/5 rounded-2xl p-8 border-2 border-white/10">
                        <h2 className="text-2xl font-bold text-white mb-4">
                            Unlock Password‑Protected PDFs
                        </h2>
                        <div className="prose max-w-none text-slate-300 space-y-4">
                            <p>
                                Unlock PDF removes password protection so you can access and edit files you own or
                                have permission to open. Enter the correct password and download the unlocked PDF in
                                seconds.
                            </p>

                            <h3 className="text-xl font-semibold text-white mt-6 mb-3">
                                How to Unlock a PDF
                            </h3>
                            <ul className="list-disc pl-6 space-y-2">
                                <li>Upload your password‑protected PDF</li>
                                <li>Enter the correct password</li>
                                <li>Click unlock and download the file</li>
                            </ul>

                            <p className="mt-4">
                                After unlocking, you can{" "}
                                <a href="/edit-pdf" className="text-indigo-400 hover:underline">edit PDF text</a>,{" "}
                                <a href="/merge-pdf" className="text-indigo-400 hover:underline">merge PDFs</a>, or{" "}
                                <a href="/compress-pdf" className="text-indigo-400 hover:underline">compress files</a>.
                            </p>
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
}
