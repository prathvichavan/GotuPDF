import { Metadata } from "next";
import PDFToWordTool from "@/components/PDFToWordTool";
import { generateToolMetadata } from "@/lib/metadata";
import { SITE_URL } from "@/lib/constants";

export const metadata: Metadata = generateToolMetadata("pdf-to-word");

export default function PDFtoWordPage() {
    const breadcrumbJsonLd = { "@context": "https://schema.org", "@type": "BreadcrumbList",
        itemListElement: [
            { "@type": "ListItem",
                position: 1,
                name: "Home",
                item: SITE_URL,
            },
            { "@type": "ListItem",
                position: 2,
                name: "PDF to Word (Coming Soon)",
                item: `${SITE_URL}/pdf-to-word`,
            },
        ],
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
            />
            <div className="bg-amber-50 dark:bg-amber-500/5 border-b-2 border-amber-200 dark:border-amber-500/30">
                <div className="max-w-6xl mx-auto px-4 py-3 text-center">
                    <p className="text-amber-800 dark:text-amber-300 font-semibold">
                        🚀 PDF to Word conversion is coming soon! Check back later for the enterprise-grade feature.
                    </p>
                </div>
            </div>
            <PDFToWordTool />
        </>
    );
}
