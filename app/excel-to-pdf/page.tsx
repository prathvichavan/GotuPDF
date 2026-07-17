import { Metadata } from "next";
import ExcelToPDFTool from "@/components/ExcelToPDFTool";
import { SITE_NAME, SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
    title: `Excel & CSV to PDF Converter Online Free | ${SITE_NAME}`,
    description: "Convert Excel spreadsheets (.xls, .xlsx) and CSV files to PDF online for free. Preserves tables, formatting, and data. No signup required.",
    keywords: [ "excel to pdf", "csv to pdf", "xlsx to pdf", "xls to pdf converter", "spreadsheet to pdf", "convert excel to pdf online", "excel to pdf free", "xlsx to pdf converter", "csv converter", "excel file to pdf"
    ],
    openGraph: {
        title: "Excel & CSV to PDF Converter - Free Online Tool",
        description: "Convert Excel spreadsheets and CSV files to PDF instantly. Preserves tables and formatting.",
        url: `${SITE_URL}/excel-to-pdf`,
        type: "website",
    },
    twitter: {
        card: "summary_large_image",
        title: "Excel & CSV to PDF Converter",
        description: "Convert .xls, .xlsx and .csv files to PDF online for free.",
    },
    alternates: {
        canonical: `${SITE_URL}/excel-to-pdf`
    }
};

export default function ExcelToPDFPage() {
    const structuredData = { "@context": "https://schema.org", "@type": "SoftwareApplication", "name": "Excel & CSV to PDF Converter", "applicationCategory": "UtilitiesApplication", "operatingSystem": "Web Browser", "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD"
        }, "description": "Free online tool to convert Excel spreadsheets (.xls, .xlsx) and CSV files to PDF format. Preserves tables, formatting, and data.", "featureList": [ "Convert Excel to PDF", "Convert CSV to PDF", "Support for .xls, .xlsx and .csv files", "Preserve table formatting", "Maintain cell alignment", "No registration required"
        ], "provider": { "@type": "Organization", "name": SITE_NAME, "url": SITE_URL
        }
    };

    const breadcrumbJsonLd = { "@context": "https://schema.org", "@type": "BreadcrumbList",
        itemListElement: [
            { "@type": "ListItem",
                position: 1,
                name: "Home",
                item: SITE_URL,
            },
            { "@type": "ListItem",
                position: 2,
                name: "Excel & CSV to PDF",
                item: `${SITE_URL}/excel-to-pdf`,
            },
        ],
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
            />

            <ExcelToPDFTool />

            {/* Content Section */}
            <section className="py-16 bg-white/5">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <article className="prose prose-lg max-w-none">
                        <h2 className="text-2xl font-bold text-white mb-4">
                            Why Convert Excel to PDF?
                        </h2>
                        <p className="text-slate-400 leading-relaxed mb-6">
                            Converting Excel spreadsheets to PDF makes your data easier to share and ensures it looks the same on any device. Whether you're sending financial reports, data tables, or project timelines, PDF format prevents accidental edits and maintains your formatting.
                        </p>

                        <h2 className="text-2xl font-bold text-white mb-4 mt-12">
                            Common Use Cases
                        </h2>
                        <ul className="space-y-4 text-slate-400 mb-8">
                            <li>
                                <strong>Business Reports:</strong> Share financial statements, sales data, or inventory reports with stakeholders who don't need to edit the data.
                            </li>
                            <li>
                                <strong>Academic Submissions:</strong> Submit data analysis, research findings, or project reports in a format that can't be accidentally modified.
                            </li>
                            <li>
                                <strong>Client Presentations:</strong> Send pricing tables, project timelines, or budget breakdowns in a professional, read-only format.
                            </li>
                            <li>
                                <strong>Record Keeping:</strong> Archive important spreadsheets in PDF format for long-term storage and easy retrieval.
                            </li>
                        </ul>

                        <h2 className="text-2xl font-bold text-white mb-4 mt-12">
                            Frequently Asked Questions
                        </h2>

                        <div className="space-y-6">
                            <div>
                                <h3 className="font-semibold text-white mb-2">Does this work with multiple sheets?</h3>
                                <p className="text-slate-400">
                                    Yes, each sheet in your Excel file will be converted to a separate page in the PDF, maintaining the structure of your workbook.
                                </p>
                            </div>

                            <div>
                                <h3 className="font-semibold text-white mb-2">Will formulas be preserved?</h3>
                                <p className="text-slate-400">
                                    The PDF will show the calculated values from your formulas, but the formulas themselves won't be editable since PDF is a read-only format.
                                </p>
                            </div>

                            <div>
                                <h3 className="font-semibold text-white mb-2">What happens to my files after conversion?</h3>
                                <p className="text-slate-400">
                                    Your files are processed securely and automatically deleted from our servers immediately after conversion. We don't store or access your data.
                                </p>
                            </div>
                        </div>
                    </article>
                </div>
            </section>
        </>
    );
}
