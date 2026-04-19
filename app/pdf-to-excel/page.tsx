'use client';

import { useState } from 'react';
import DragDropUpload from '@/components/DragDropUpload';
import { SITE_URL } from '@/lib/constants';
import { buildDownloadName, splitFileName } from '@/lib/fileName';

interface ConversionResult {
  success: boolean;
  fileName?: string;
  rowsExtracted?: number;
  tablesFound?: number;
  processingTime?: number;
  error?: string;
}

export default function PDFToExcelPage() {
  const breadcrumbJsonLd = { "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem",
        position: 1,
        name: "Home",
        item: SITE_URL,
      },
      { "@type": "ListItem",
        position: 2,
        name: "PDF to Excel",
        item: `${SITE_URL}/pdf-to-excel`,
      },
    ],
  };

  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState<string>('');
  const [downloadBaseName, setDownloadBaseName] = useState<string>('');
  const [downloadExtension, setDownloadExtension] = useState<string>('');

  const MAX_FILE_SIZE_MB = 20;
  const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024;

  const validateFile = (selectedFile: File): string | null => {
    if (selectedFile.type !== 'application/pdf') {
      return 'Please upload a PDF file';
    }
    if (selectedFile.size > MAX_FILE_SIZE) {
      return `File size must be less than ${MAX_FILE_SIZE_MB}MB (your file: ${(selectedFile.size / 1024 / 1024).toFixed(2)}MB)`;
    }
    return null;
  };

  const handleFileSelect = (selectedFiles: File[]) => {
    const selectedFile = selectedFiles[0];
    if (!selectedFile) return;

    if (downloadUrl) {
      window.URL.revokeObjectURL(downloadUrl);
    }
    const validationError = validateFile(selectedFile);
    if (validationError) {
      setError(validationError);
      setFile(null);
      setResult(null);
      return;
    }

    setError(null);
    setFile(selectedFile);
    setResult(null);
    setDownloadUrl(null);
    setDownloadName('');
    setDownloadBaseName('');
    setDownloadExtension('');
  };

  const resetState = () => {
    if (downloadUrl) {
      window.URL.revokeObjectURL(downloadUrl);
    }
    setFile(null);
    setError(null);
    setResult(null);
    setProgress(0);
    setDownloadUrl(null);
    setDownloadName('');
    setDownloadBaseName('');
    setDownloadExtension('');
  };

  const handleConvert = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setIsLoading(true);
    setProgress(0);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) return 90;
          return prev + Math.random() * 15;
        });
      }, 300);

      const response = await fetch('/api/pdf-to-excel', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Conversion failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const defaultName = `GotuPDF-${Date.now()}.xlsx`;
      const parts = splitFileName(defaultName);
      setDownloadUrl(url);
      setDownloadName(defaultName);
      setDownloadBaseName(parts.base || 'GotuPDF');
      setDownloadExtension(parts.ext || '.xlsx');

      // Get conversion details from response headers
      const tablesFound = response.headers.get('x-tables-found');
      const rowsExtracted = response.headers.get('x-rows-extracted');
      const processingTime = response.headers.get('x-processing-time');

      setResult({
        success: true,
        fileName: defaultName,
        tablesFound: tablesFound ? parseInt(tablesFound) : undefined,
        rowsExtracted: rowsExtracted ? parseInt(rowsExtracted) : undefined,
        processingTime: processingTime ? parseFloat(processingTime) : undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during conversion');
      setProgress(0);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!downloadUrl) return;
    const finalName = buildDownloadName(downloadBaseName, downloadExtension, downloadName || 'converted.xlsx');
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = finalName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br p-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent mb-4">
            📊 PDF to Excel Converter
          </h1>
          <p className="text-slate-400 text-lg">
            Convert PDF tables to editable Excel files instantly. Extract data from any PDF and download as .xlsx
          </p>
        </div>

        {/* Upload Area */}
        {!file && (
          <div className="bg-white/5 rounded-2xl shadow-xl p-8 mb-8">
            <DragDropUpload
              onFileSelect={handleFileSelect}
              accept=".pdf"
              multiple={false}
              maxSize={MAX_FILE_SIZE_MB}
              icon="📄"
              title="Click to select a PDF file"
              subtitle="or drag and drop here"
              borderColor="border-indigo-300"
              hoverColor="border-indigo-500 bg-indigo-500/10"
            />
          </div>
        )}

        {!file && (
          <div className="mt-8 bg-indigo-500/10 rounded-2xl p-8 border-2 border-indigo-500/20">
            <h3 className="text-xl font-bold text-indigo-200 mb-4">
              📖 How to use:
            </h3>
            <ol className="space-y-2 text-indigo-300">
              <li>1. Upload a PDF file</li>
              <li>2. Click "Convert to Excel"</li>
              <li>3. Download your .xlsx file</li>
            </ol>
          </div>
        )}

        {/* File Info */}
        {file && (
          <div className="bg-white/5 rounded-2xl shadow-xl p-6 mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-4xl">📄</div>
                <div>
                  <div className="font-semibold text-slate-200">{file.name}</div>
                  <div className="text-sm text-slate-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB • Max {MAX_FILE_SIZE_MB}MB
                  </div>
                </div>
              </div>
              <button
                onClick={resetState}
                disabled={isLoading}
                className="px-4 py-2 bg-red-500/100 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border-2 border-red-500/20 rounded-2xl p-6 mb-8">
            <h4 className="text-red-300 font-semibold mb-2">⚠️ Error</h4>
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Success Message */}
        {result?.success && (
          <div className="bg-emerald-500/10 border-2 border-emerald-500/20 rounded-2xl p-6 mb-8">
            <h4 className="text-green-900 font-semibold mb-2">✅ Conversion successful!</h4>
            <p className="text-emerald-400 text-sm">
              {result.tablesFound && `${result.tablesFound} table(s) found`}
              {result.tablesFound && result.rowsExtracted && ' • '}
              {result.rowsExtracted && `${result.rowsExtracted} row(s) extracted`}
              {(result.tablesFound || result.rowsExtracted) && result.processingTime && ' • '}
              {result.processingTime && `Processed in ${result.processingTime.toFixed(2)}s`}
            </p>
          </div>
        )}

        {downloadUrl && !isLoading && (
          <div className="bg-white/5 rounded-2xl shadow-xl p-8 mb-8 border border-emerald-500/15">
            <h3 className="text-xl font-bold text-slate-200 mb-4 text-center">
              Ready to Download
            </h3>
            <div className="max-w-md mx-auto mb-6 text-left">
              <label className="block text-sm font-semibold text-slate-300 mb-2">File name</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={downloadBaseName}
                  onChange={(event) => setDownloadBaseName(event.target.value)}
                  className="flex-1 px-4 py-3 border border-white/10 rounded-lg focus:border-indigo-500 focus:outline-none text-slate-300"
                  placeholder="Enter file name"
                />
                {downloadExtension && (
                  <span className="px-3 py-2 bg-white/10 rounded-lg text-sm text-slate-400">
                    {downloadExtension}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={handleDownload}
                className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-600 transition-all shadow-lg hover:shadow-xl"
              >
                Download Excel
              </button>
              <button
                onClick={resetState}
                className="px-8 py-4 bg-white/10 text-slate-300 rounded-xl font-semibold hover:bg-white/15 transition-all"
              >
                Convert Another File
              </button>
            </div>
          </div>
        )}

        {/* Progress */}
        {isLoading && (
          <div className="bg-white/5 rounded-2xl shadow-xl p-8 mb-8">
            <div className="mb-4 text-center">
              <div className="text-xl font-semibold text-slate-300 mb-2">
                Converting to Excel...
              </div>
              <div className="text-4xl font-bold text-indigo-600">
                {Math.round(progress)}%
              </div>
            </div>
            <div className="w-full bg-white/15 rounded-full h-4 overflow-hidden">
              <div
                className="bg-gradient-to-r from-indigo-500 to-blue-500 h-full transition-all duration-300 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Convert Button */}
        {file && !isLoading && !downloadUrl && (
          <button
            onClick={handleConvert}
            className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white text-xl font-bold py-6 rounded-2xl hover:from-indigo-700 hover:to-purple-600 transition-all shadow-xl hover:shadow-2xl transform hover:scale-105"
          >
            📊 Convert to Excel
          </button>
        )}

        {/* Features */}
        <div className="mt-12 bg-indigo-500/10 rounded-2xl p-8 border-2 border-indigo-500/20">
          <h3 className="text-xl font-bold text-indigo-200 mb-4">
            💡 Features:
          </h3>
          <ul className="space-y-2 text-indigo-300">
            <li>• Extract tables from PDF</li>
            <li>• Multi-page support</li>
            <li>• Editable Excel format</li>
            <li>• Instant download</li>
            <li>• No registration required</li>
            <li>• 100% Secure</li>
          </ul>
        </div>

        {/* SEO Description */}
        <div className="mt-12 bg-white/5 rounded-2xl p-8 border-2 border-white/10">
          <h2 className="text-2xl font-bold text-white mb-4">
            About PDF to Excel Conversion
          </h2>
          <p className="text-slate-400 mb-4">
            Our PDF to Excel converter tool allows you to extract data and tables from PDF documents and convert them into editable Excel spreadsheets. Perfect for data analysis, reporting, and business workflows.
          </p>
          <p className="text-slate-400">
            Simply upload your PDF file, and our advanced algorithm will automatically detect and extract all tables, preserving the structure and formatting. Download the result as an .xlsx file ready for use in Microsoft Excel, Google Sheets, or any spreadsheet application.
          </p>
        </div>
      </div>
    </div>
  );
}
