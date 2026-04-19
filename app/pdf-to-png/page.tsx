import PDFToImageTool from "@/components/PDFToImageTool";
import { Metadata } from "next";
import { SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
    title: "PDF to PNG - Convert PDF Pages to PNG Images | PDF Master Tools",
    description: "Convert PDF pages to high-quality PNG images online. Free PDF to PNG converter with adjustable resolution settings. Download each page as a separate PNG file.",
    keywords: ["pdf to png", "convert pdf to png", "pdf to image", "pdf converter", "png converter"],
};

export default function PDFToPNGPage() {
    const breadcrumbJsonLd = { "@context": "https://schema.org", "@type": "BreadcrumbList",
        itemListElement: [
            { "@type": "ListItem",
                position: 1,
                name: "Home",
                item: SITE_URL,
            },
            { "@type": "ListItem",
                position: 2,
                name: "PDF to PNG",
                item: `${SITE_URL}/pdf-to-png`,
            },
        ],
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
            />
            <PDFToImageTool format="png" />
        </>
    );
}
