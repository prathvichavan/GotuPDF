import { Metadata } from "next";
import PythonJupyterToPDFTool from "@/components/PythonJupyterToPDFTool";
import { SITE_NAME, SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
    title: `Python & Jupyter Notebook to PDF Converter Online Free | ${SITE_NAME}`,
    description: "Convert Python (.py) and Jupyter Notebook (.ipynb) files to professional PDF online for free. Preserves formatting, code highlighting, and outputs. No installation required.",
    keywords: [ "jupyter file to pdf", "ipynb to pdf", "jupyter notebook to pdf converter", "python file to pdf", "convert python script to pdf", "ipynb to pdf online", "jupyter to pdf online free", "python code to pdf", "notebook to pdf converter", "professional jupyter pdf"
    ],
    openGraph: {
        title: "Python & Jupyter Notebook to PDF Converter - Free Online Tool",
        description: "Convert Python and Jupyter Notebook files to professional PDF instantly. Preserves code, markdown, and visualizations.",
        url: `${SITE_URL}/convert-python-jupyter-to-pdf`,
        type: "website",
        images: [
            {
                url: `${SITE_URL}/og-python-jupyter-pdf.png`,
                width: 1200,
                height: 630,
                alt: "Python & Jupyter to PDF Converter"
            }
        ]
    },
    twitter: {
        card: "summary_large_image",
        title: "Python & Jupyter Notebook to PDF Converter",
        description: "Convert .py and .ipynb files to professional PDF online for free.",
    },
    alternates: {
        canonical: `${SITE_URL}/convert-python-jupyter-to-pdf`
    }
};

export default function PythonJupyterToPDFPage() {
    // JSON-LD structured data for SEO
    const structuredData = { "@context": "https://schema.org", "@type": "SoftwareApplication", "name": "Python & Jupyter Notebook to PDF Converter", "applicationCategory": "UtilitiesApplication", "operatingSystem": "Web Browser", "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD"
        }, "description": "Free online tool to convert Python (.py) and Jupyter Notebook (.ipynb) files to professional PDF format. Preserves code formatting, markdown, and outputs.", "featureList": [ "Convert Python files to PDF", "Convert Jupyter Notebooks to PDF", "Preserve code formatting and syntax highlighting", "Include code outputs and visualizations", "Professional typography and layout", "Secure file processing", "No registration required"
        ], "provider": { "@type": "Organization", "name": SITE_NAME, "url": SITE_URL
        }
    };

    const faqStructuredData = { "@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
            { "@type": "Question", "name": "Can I convert IPYNB to PDF for free?", "acceptedAnswer": { "@type": "Answer", "text": "Yes, you can convert Jupyter Notebook files (.ipynb) to professional PDF completely free using our online tool. No registration or payment is required."
                }
            },
            { "@type": "Question", "name": "Does the PDF include code output and visualizations?", "acceptedAnswer": { "@type": "Answer", "text": "Yes, our converter preserves all code, markdown formatting, outputs, charts, graphs, and visualizations from your Jupyter notebooks in the PDF."
                }
            },
            { "@type": "Question", "name": "Can I convert Python scripts to PDF without installing Python?", "acceptedAnswer": { "@type": "Answer", "text": "Yes! Our online tool works entirely in your browser without requiring Python installation. Simply upload your .py file and get a professionally formatted PDF."
                }
            },
            { "@type": "Question", "name": "Are my files stored on the server?", "acceptedAnswer": { "@type": "Answer", "text": "No, your files are processed temporarily and automatically deleted after conversion to protect your privacy and code confidentiality."
                }
            },
            { "@type": "Question", "name": "What file formats are supported?", "acceptedAnswer": { "@type": "Answer", "text": "We support Python files (.py) and Jupyter Notebook files (.ipynb). Both formats are converted to PDF with proper formatting, syntax highlighting, and preservation of all content."
                }
            }
        ]
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
                name: "Python and Jupyter to PDF",
                item: `${SITE_URL}/convert-python-jupyter-to-pdf`,
            },
        ],
    };

    return (
        <>
            {/* Structured Data */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
            />

            <div className="min-h-screen bg-white/5">
                {/* Hero Section */}
                <section className="bg-white/5 border-b border-white/10">
                    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                        <div className="text-center mb-12">
                            <div className="inline-flex items-center gap-2 bg-indigo-500/10 text-indigo-400 px-4 py-2 rounded-full text-sm font-medium mb-6">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                Free • No Registration • Secure
                            </div>

                            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
                                Jupyter Notebook to PDF
                            </h1>
                            <p className="text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
                                Convert Python and Jupyter Notebook files to professional PDF documents.
                                Preserves code, formatting, and outputs.
                            </p>
                        </div>

                        {/* Tool Component */}
                        <PythonJupyterToPDFTool />

                        {/* Features */}
                        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="text-center">
                                <div className="w-12 h-12 bg-emerald-500/100/15 rounded-lg flex items-center justify-center mx-auto mb-3">
                                    <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <h3 className="font-semibold text-white mb-1">Preserves Everything</h3>
                                <p className="text-sm text-slate-400">Code, markdown, images, and outputs</p>
                            </div>

                            <div className="text-center">
                                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                </div>
                                <h3 className="font-semibold text-white mb-1">100% Secure</h3>
                                <p className="text-sm text-slate-400">Files deleted after conversion</p>
                            </div>

                            <div className="text-center">
                                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                                    <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                </div>
                                <h3 className="font-semibold text-white mb-1">Lightning Fast</h3>
                                <p className="text-sm text-slate-400">Instant conversion in your browser</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* SEO Content Section */}
                <section className="py-16 bg-white/5">
                    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                        <article className="prose prose-lg max-w-none">
                            <h2 className="text-2xl font-bold text-white mb-4">
                                What is a Jupyter Notebook (.ipynb)?
                            </h2>
                            <p className="text-slate-400 leading-relaxed mb-6">
                                A Jupyter Notebook is an interactive document format that combines executable Python code with rich text,
                                equations, visualizations, and markdown explanations. The .ipynb file extension stands for "IPython Notebook"
                                and has become the standard format for data science, machine learning, and academic research projects.
                            </p>
                            <p className="text-slate-400 leading-relaxed mb-8">
                                Jupyter Notebooks are widely used by data scientists, researchers, students, and developers because they allow
                                you to write code, see immediate results, and document your thought process all in one place. However, these
                                files require specialized software like Jupyter Lab or Jupyter Notebook to open, which makes sharing them with
                                non-technical audiences challenging.
                            </p>

                            <h2 className="text-2xl font-bold text-white mb-4 mt-12">
                                Why Convert Python or Jupyter Files to PDF?
                            </h2>
                            <p className="text-slate-400 leading-relaxed mb-6">
                                Converting your Python scripts and Jupyter Notebooks to PDF format offers several important advantages:
                            </p>
                            <ul className="space-y-4 text-slate-400 mb-8">
                                <li>
                                    <strong>Universal Accessibility:</strong> PDF files can be opened on any device without requiring Python,
                                    Jupyter, or any coding environment. This makes it easy to share your work with teachers, clients, or colleagues
                                    who may not have technical backgrounds.
                                </li>
                                <li>
                                    <strong>Academic Submissions:</strong> Many educational institutions require assignments to be submitted in PDF
                                    format. Converting your Jupyter notebook to PDF ensures your code, outputs, and explanations are preserved exactly
                                    as intended.
                                </li>
                                <li>
                                    <strong>Professional Documentation:</strong> When creating technical documentation or reports for clients,
                                    PDF format provides a professional, polished appearance that's easy to read and print.
                                </li>
                                <li>
                                    <strong>Code Portfolio:</strong> Developers and data scientists can convert their best projects to PDF for
                                    inclusion in job applications, portfolios, or GitHub repositories as supplementary documentation.
                                </li>
                                <li>
                                    <strong>Preserve Formatting:</strong> PDF conversion maintains your code's syntax highlighting, markdown formatting,
                                    charts, graphs, and images exactly as they appear in the notebook.
                                </li>
                                <li>
                                    <strong>Version Control:</strong> Creating PDF snapshots of your work helps maintain a record of your project
                                    at different stages, useful for presentations and progress reports.
                                </li>
                            </ul>

                            <h2 className="text-3xl font-bold text-white mb-6 mt-12">
                                How to Convert Jupyter Notebook to PDF Online
                            </h2>
                            <p className="text-slate-300 leading-relaxed mb-6">
                                Our online Jupyter to PDF converter makes the conversion process simple and straightforward. Follow these easy steps:
                            </p>
                            <ol className="list-decimal pl-6 space-y-4 text-slate-300 mb-6">
                                <li>
                                    <strong>Upload Your File:</strong> Click the upload button or drag and drop your .ipynb or .py file into the
                                    designated area. Our tool accepts both Jupyter Notebook files and standard Python scripts.
                                </li>
                                <li>
                                    <strong>Automatic Processing:</strong> Once uploaded, our server securely processes your file. For Jupyter notebooks,
                                    we render all code cells, markdown text, and output including plots and visualizations. For Python files, we apply
                                    proper syntax highlighting and formatting.
                                </li>
                                <li>
                                    <strong>Preview (Optional):</strong> Some converters offer a preview of how your PDF will look before downloading.
                                    This helps ensure everything appears correctly.
                                </li>
                                <li>
                                    <strong>Download PDF:</strong> Within seconds, your PDF will be ready. Click the download button to save it to
                                    your device. The file maintains all formatting, code structure, and outputs from your original notebook.
                                </li>
                            </ol>
                            <p className="text-slate-300 leading-relaxed mb-6">
                                The entire process happens in your browser and typically takes just a few seconds, depending on the size and
                                complexity of your notebook. No software installation or command-line tools required.
                            </p>

                            <h2 className="text-3xl font-bold text-white mb-6 mt-12">
                                Features of Python & Jupyter to PDF Converter
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                <div className="bg-purple-500/10 p-6 rounded-lg border border-purple-500/20">
                                    <h3 className="text-xl font-semibold text-white mb-3">🐍 Python File Support</h3>
                                    <p className="text-slate-300">
                                        Convert .py files with proper syntax highlighting and code formatting for clean, readable PDFs.
                                    </p>
                                </div>
                                <div className="bg-indigo-500/10 p-6 rounded-lg border border-indigo-500/20">
                                    <h3 className="text-xl font-semibold text-white mb-3">📓 Jupyter Notebook Support</h3>
                                    <p className="text-slate-300">
                                        Full support for .ipynb files including code, markdown, LaTeX equations, and visualizations.
                                    </p>
                                </div>
                                <div className="bg-emerald-500/10 p-6 rounded-lg border border-emerald-500/20">
                                    <h3 className="text-xl font-semibold text-white mb-3">🔒 Secure Processing</h3>
                                    <p className="text-slate-300">
                                        Files are encrypted during transfer and automatically deleted after conversion to protect your code.
                                    </p>
                                </div>
                                <div className="bg-orange-500/10 p-6 rounded-lg border border-orange-200">
                                    <h3 className="text-xl font-semibold text-white mb-3">⚡ Fast Conversion</h3>
                                    <p className="text-slate-300">
                                        Get your PDF in seconds. Optimized processing ensures quick turnaround even for large notebooks.
                                    </p>
                                </div>
                                <div className="bg-indigo-500/10 p-6 rounded-lg border border-indigo-500/20">
                                    <h3 className="text-xl font-semibold text-white mb-3">📱 Mobile Compatible</h3>
                                    <p className="text-slate-300">
                                        Works seamlessly on desktop, tablet, and mobile devices. Convert files on the go.
                                    </p>
                                </div>
                                <div className="bg-pink-50 p-6 rounded-lg border border-pink-200">
                                    <h3 className="text-xl font-semibold text-white mb-3">💯 100% Free</h3>
                                    <p className="text-slate-300">
                                        No registration, no subscriptions, no hidden fees. All features are completely free to use.
                                    </p>
                                </div>
                            </div>

                            <h2 className="text-3xl font-bold text-white mb-6 mt-12">
                                Common Use Cases
                            </h2>
                            <div className="bg-white/5 p-6 rounded-lg border border-white/10 mb-8">
                                <ul className="space-y-4 text-slate-300">
                                    <li>
                                        <strong>Students:</strong> Submit coding assignments, project reports, and lab work in PDF format as required
                                        by professors and academic institutions.
                                    </li>
                                    <li>
                                        <strong>Data Scientists:</strong> Share analysis results, machine learning experiments, and data visualizations
                                        with stakeholders who don't have Jupyter installed.
                                    </li>
                                    <li>
                                        <strong>Developers:</strong> Document code for technical specifications, API documentation, or project handoffs
                                        in a format that's easy to distribute.
                                    </li>
                                    <li>
                                        <strong>Researchers:</strong> Include computational methods and results in research papers, grant applications,
                                        or supplementary materials.
                                    </li>
                                    <li>
                                        <strong>Educators:</strong> Create teaching materials, coding tutorials, and example notebooks that students
                                        can easily access and print.
                                    </li>
                                </ul>
                            </div>

                            <h2 className="text-3xl font-bold text-white mb-6 mt-12">
                                Privacy & Security
                            </h2>
                            <p className="text-slate-300 leading-relaxed mb-6">
                                We understand that your code and data are valuable. Our Python and Jupyter to PDF converter implements strict security
                                measures to protect your intellectual property:
                            </p>
                            <ul className="list-disc pl-6 space-y-3 text-slate-300 mb-6">
                                <li>All file uploads are encrypted using SSL/TLS protocols during transmission</li>
                                <li>Files are processed in isolated environments and never accessed by humans</li>
                                <li>Converted files are automatically deleted from our servers within one hour</li>
                                <li>We do not store, analyze, or share your code with third parties</li>
                                <li>No tracking cookies or analytics on uploaded content</li>
                            </ul>
                            <p className="text-slate-300 leading-relaxed mb-6">
                                For highly sensitive or proprietary code, we recommend reviewing your organization's security policies before using
                                any online conversion tools.
                            </p>

                            <h2 className="text-3xl font-bold text-white mb-6 mt-12">
                                Frequently Asked Questions (FAQ)
                            </h2>

                            <div className="space-y-6">
                                <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                                    <h3 className="text-xl font-semibold text-white mb-3">
                                        Can I convert IPYNB to PDF for free?
                                    </h3>
                                    <p className="text-slate-300">
                                        Yes, absolutely! Our Jupyter Notebook to PDF converter is completely free to use. There are no limits on the
                                        number of files you can convert, and you don't need to create an account or provide any payment information.
                                    </p>
                                </div>

                                <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                                    <h3 className="text-xl font-semibold text-white mb-3">
                                        Does the PDF include code output and visualizations?
                                    </h3>
                                    <p className="text-slate-300">
                                        Yes, our converter preserves everything in your Jupyter notebook including executed code output, error messages,
                                        data tables, matplotlib plots, seaborn charts, and other visualizations. The PDF maintains the exact order and
                                        formatting of your notebook cells.
                                    </p>
                                </div>

                                <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                                    <h3 className="text-xl font-semibold text-white mb-3">
                                        Can I convert Python scripts to PDF without installing Python?
                                    </h3>
                                    <p className="text-slate-300">
                                        Yes! Our online tool works entirely in your browser and doesn't require Python, Jupyter, or any other software
                                        to be installed on your computer. Simply upload your .py file and get a professionally formatted PDF with
                                        syntax highlighting.
                                    </p>
                                </div>

                                <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                                    <h3 className="text-xl font-semibold text-white mb-3">
                                        Are my files stored on the server?
                                    </h3>
                                    <p className="text-slate-300">
                                        No. Your uploaded files are processed temporarily and automatically deleted after conversion. We do not create
                                        backups, logs, or permanent copies of your code. Your privacy and code confidentiality are our top priorities.
                                    </p>
                                </div>

                                <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                                    <h3 className="text-xl font-semibold text-white mb-3">
                                        What file formats are supported?
                                    </h3>
                                    <p className="text-slate-300">
                                        We currently support two file formats: Python files (.py) and Jupyter Notebook files (.ipynb). Both formats
                                        are converted to PDF with proper formatting, syntax highlighting, and preservation of code structure.
                                    </p>
                                </div>

                                <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                                    <h3 className="text-xl font-semibold text-white mb-3">
                                        What if my notebook has large datasets or many cells?
                                    </h3>
                                    <p className="text-slate-300">
                                        Our tool can handle notebooks with multiple cells and reasonable-sized outputs. However, extremely large
                                        notebooks (over 50MB) may take longer to process. For best results, consider splitting very large notebooks
                                        into smaller sections before conversion.
                                    </p>
                                </div>
                            </div>

                            <div className="mt-12 bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-8">
                                <h3 className="text-2xl font-bold text-white mb-4">
                                    Try Other PDF Tools
                                </h3>
                                <p className="text-slate-300 mb-4">
                                    Explore our complete collection of free PDF tools:
                                </p>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    <a href="/compress-pdf" className="text-indigo-400 hover:underline">Compress PDF</a>
                                    <a href="/merge-pdf" className="text-indigo-400 hover:underline">Merge PDF</a>
                                    <a href="/split-pdf" className="text-indigo-400 hover:underline">Split PDF</a>
                                    <a href="/pdf-to-word" className="text-indigo-400 hover:underline">PDF to Word</a>
                                    <a href="/pdf-to-jpg" className="text-indigo-400 hover:underline">PDF to JPG</a>
                                    <a href="/jpg-to-pdf" className="text-indigo-400 hover:underline">JPG to PDF</a>
                                </div>
                            </div>
                        </article>
                    </div>
                </section>
            </div>
        </>
    );
}
