import PDFToImageTool from "@/components/PDFToImageTool";
import { Metadata } from "next";
import { SITE_URL } from "@/lib/constants";
import { generateToolMetadata } from "@/lib/metadata";

export const metadata: Metadata = generateToolMetadata("pdf-to-jpg");

export default function PDFToJPGPage() {
    const breadcrumbJsonLd = { "@context": "https://schema.org", "@type": "BreadcrumbList",
        itemListElement: [
            { "@type": "ListItem",
                position: 1,
                name: "Home",
                item: SITE_URL,
            },
            { "@type": "ListItem",
                position: 2,
                name: "PDF to JPG",
                item: `${SITE_URL}/pdf-to-jpg`,
            },
        ],
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
            />
            <PDFToImageTool format="jpg" />
        </>
    );
}
