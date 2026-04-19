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
                name: "PDF to Word",
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
            <PDFToWordTool />
        </>
    );
}
