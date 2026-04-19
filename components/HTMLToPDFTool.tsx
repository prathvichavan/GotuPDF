"use client";

import { useState } from "react";
import { buildDownloadName } from "@/lib/fileName";

export default function HTMLToPDFTool() {
    const [htmlContent, setHtmlContent] = useState("");
    const [pageSize, setPageSize] = useState("A4");
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
    const [downloadBaseName, setDownloadBaseName] = useState("converted");
    const [error, setError] = useState<string | null>(null);

    const handleProcess = async () => {
        if (!htmlContent.trim()) {
            setError("Please enter some HTML content");
            return;
        }
        setIsProcessing(true);
        setProgress(10);
        setError(null);
        try {
            const formData = new FormData();
            formData.append("html", htmlContent);
            formData.append("pageSize", pageSize);
            setProgress(30);
            const res = await fetch("/api/html-to-pdf", { method: "POST", body: formData });
            setProgress(70);
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Conversion failed");
            }
            const blob = await res.blob();
            setDownloadUrl(URL.createObjectURL(blob));
            setProgress(100);
        } catch (e: any) {
            setError(e.message || "An error occurred");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDownload = () => {
        if (!downloadUrl) return;
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = buildDownloadName(downloadBaseName, ".pdf", "output.pdf");
        a.click();
    };

    const handleReset = () => {
        if (downloadUrl) URL.revokeObjectURL(downloadUrl);
        setDownloadUrl(null);
        setError(null);
        setProgress(0);
        setHtmlContent("");
    };

    const sampleHTML = `<h1>Hello World</h1>
<p>This is a sample HTML document converted to PDF by GotuPDF.</p>
<h2>Features</h2>
<ul>
  <li>Clean text conversion</li>
  <li>Heading support</li>
  <li>Paragraph formatting</li>
</ul>
<p>Try pasting your own HTML content above!</p>`;

    return (
        <div className="min-h-screen p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-12">
                    <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">HTML to PDF</h1>
                    <p className="text-gray-500 dark:text-slate-400 text-lg">
                        Convert HTML content to a downloadable PDF document
                    </p>
                </div>

                {error && (
                    <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-500 font-medium">{error}</div>
                )}

                {!downloadUrl && (
                    <>
                        <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 p-6 mb-8">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-bold text-gray-700 dark:text-slate-200">HTML Content</h2>
                                <div className="flex gap-2">
                                    <button onClick={() => setHtmlContent(sampleHTML)}
                                        className="px-3 py-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-500/20 transition-colors text-sm font-medium border border-blue-300 dark:border-blue-500/30">
                                        Load Sample
                                    </button>
                                    <button onClick={() => setHtmlContent("")}
                                        className="px-3 py-1.5 bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-slate-300 rounded-lg hover:bg-gray-300 dark:hover:bg-white/15 transition-colors text-sm font-medium">
                                        Clear
                                    </button>
                                </div>
                            </div>

                            <textarea
                                value={htmlContent}
                                onChange={(e) => setHtmlContent(e.target.value)}
                                placeholder="Paste your HTML content here..."
                                className="w-full h-64 px-4 py-3 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-gray-700 dark:text-slate-300 font-mono text-sm resize-y focus:outline-none focus:border-blue-500"
                            />

                            <div className="flex items-center gap-4 mt-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-600 dark:text-slate-300 mb-1">Page Size</label>
                                    <select value={pageSize} onChange={(e) => setPageSize(e.target.value)}
                                        className="px-4 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-gray-600 dark:text-slate-300 focus:outline-none focus:border-blue-500">
                                        <option value="A4">A4</option>
                                        <option value="Letter">Letter</option>
                                        <option value="Legal">Legal</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-600 dark:text-slate-300 mb-1">File name</label>
                                    <input type="text" value={downloadBaseName} onChange={(e) => setDownloadBaseName(e.target.value)}
                                        className="px-4 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-gray-600 dark:text-slate-300 focus:outline-none focus:border-blue-500" />
                                </div>
                            </div>
                        </div>

                        {isProcessing && (
                            <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 p-8 mb-8">
                                <div className="text-center mb-4"><div className="text-xl font-semibold text-gray-600 dark:text-slate-300">Converting HTML to PDF...</div></div>
                                <div className="w-full bg-gray-200 dark:bg-white/15 rounded-full h-4 overflow-hidden">
                                    <div className="bg-gradient-to-r from-blue-500 to-cyan-500 h-full transition-all duration-300 rounded-full" style={{ width: `${progress}%` }} />
                                </div>
                            </div>
                        )}

                        {!isProcessing && htmlContent.trim() && (
                            <button onClick={handleProcess}
                                className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-xl font-bold py-6 rounded-2xl hover:from-blue-600 hover:to-cyan-600 transition-all shadow-xl shadow-black/10 dark:shadow-black/30 hover:shadow-2xl transform hover:scale-105">
                                🔄 Convert to PDF
                            </button>
                        )}
                    </>
                )}

                {downloadUrl && (
                    <div className="bg-gray-100 dark:bg-white/5 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 p-8 text-center">
                        <div className="w-20 h-20 bg-emerald-500/15 rounded-full flex items-center justify-center mx-auto mb-6"><span className="text-4xl">✅</span></div>
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">PDF Created!</h3>
                        <p className="text-gray-500 dark:text-slate-400 mb-6">Your HTML has been converted to PDF.</p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <button onClick={handleDownload} className="px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg">📥 Download PDF</button>
                            <button onClick={handleReset} className="px-8 py-4 bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-slate-300 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-white/15 transition-all">Convert More HTML</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
