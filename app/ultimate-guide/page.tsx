import HomeSEOContent from "@/components/HomeSEOContent";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: `The Ultimate Guide to Online PDF Management | ${SITE_NAME}`,
    description: "Learn everything about PDF management - from merging and splitting to compression and security. Expert tips and best practices for working with PDFs online.",
    alternates: {
        canonical: `${SITE_URL}/ultimate-guide`,
    },
    openGraph: {
        title: `The Ultimate Guide to Online PDF Management | ${SITE_NAME}`,
        description: "Learn everything about PDF management - from merging and splitting to compression and security. Expert tips and best practices for working with PDFs online.",
        url: `${SITE_URL}/ultimate-guide`,
        siteName: SITE_NAME,
        type: "article",
    },
};

export default function UltimateGuidePage() {
    const breadcrumbJsonLd = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: "Ultimate PDF Guide", item: `${SITE_URL}/ultimate-guide` },
        ],
    };

    return (
        <div className="relative z-10 w-full bg-white dark:bg-slate-900 min-h-screen">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
            />
            <HomeSEOContent />
        </div>
    );
}
