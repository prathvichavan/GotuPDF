import OCRPDFTool from "@/components/OCRPDFTool";
import { generateToolMetadata } from "@/lib/metadata";
import { SITE_URL } from "@/lib/constants";
import type { Metadata } from "next";

export const metadata: Metadata = generateToolMetadata("ocr-pdf");

export default function OCRPDFPage() {
    const breadcrumbJsonLd = { "@context": "https://schema.org", "@type": "BreadcrumbList",
        itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: "OCR PDF", item: `${SITE_URL}/ocr-pdf` },
        ],
    };

    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
            <OCRPDFTool />
        </>
    );
}
