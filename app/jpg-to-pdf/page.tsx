import { Metadata } from "next";
import ToolPage from "@/components/ToolPage";
import { generateToolMetadata } from "@/lib/metadata";
import { ALLOWED_FILE_TYPES, SITE_URL } from "@/lib/constants";

export const metadata: Metadata = generateToolMetadata("jpg-to-pdf");

export default function JPGtoPDFPage() {
    const breadcrumbJsonLd = { "@context": "https://schema.org", "@type": "BreadcrumbList",
        itemListElement: [
            { "@type": "ListItem",
                position: 1,
                name: "Home",
                item: SITE_URL,
            },
            { "@type": "ListItem",
                position: 2,
                name: "JPG to PDF",
                item: `${SITE_URL}/jpg-to-pdf`,
            },
        ],
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
            />
            <ToolPage
                toolId="jpg-to-pdf"
                toolName="JPG to PDF"
                toolDescription="Convert JPG images to PDF documents"
                acceptedFileTypes={{ image: ALLOWED_FILE_TYPES.image }}
                apiEndpoint="/api/jpg-to-pdf"
                outputFileName="converted.pdf"
                instructions={[ "Upload one or more JPG images", "Drag images to arrange the order", "Images will be combined into a single PDF", "Click 'Process Files' to convert", "Download your PDF document",
                ]}
            />
        </>
    );
}
