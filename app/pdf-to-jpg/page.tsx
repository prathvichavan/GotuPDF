import PDFToImageTool from "@/components/PDFToImageTool";
import { Metadata } from "next";
import { SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
    title: "PDF to JPG - Convert PDF Pages to JPG Images | PDF Master Tools",
    description: "Convert PDF pages to high-quality JPG images online. Free PDF to JPG converter with adjustable quality and resolution settings. Download each page as a separate JPG file.",
    keywords: ["pdf to jpg", "pdf to jpeg", "convert pdf to jpg", "pdf to image", "pdf converter"],
};

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
