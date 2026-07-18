export const SITE_NAME = "GotuPDF";
export const AUTHOR_NAME = "GotuPDF Team";
export const CONTACT_EMAIL = "mr.prathvirajchavan@gmail.com";
export const SITE_DESCRIPTION = "Professional PDF Tools - Convert, Merge, Split, Compress PDFs Online for Free";
export const SITE_URL = "https://gotupdf.vercel.app";
export const SITE_KEYWORDS = "pdf tools, convert pdf, merge pdf, split pdf, compress pdf, pdf to word, word to pdf, pdf converter";

export const BRAND_COLORS = {
    primary: "#2563EB",
    secondary: "#1E3A8A",
    background: "#F9FAFB",
    text: "#111827",
    accent: "#3B82F6",
    success: "#10B981",
    error: "#EF4444",
    warning: "#F59E0B",
};

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
export const ALLOWED_FILE_TYPES = {
    pdf: ["application/pdf"],
    word: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword"],
    excel: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel"],
    powerpoint: ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/vnd.ms-powerpoint"],
    image: ["image/jpeg", "image/jpg", "image/png"],
};

export type ToolCategory = "all" | "convert" | "edit" | "security" | "optimize";
export type ToolStatus = "active" | "upcoming";

export interface PdfTool {
    id: string;
    name: string;
    description: string;
    icon: string;
    path: string;
    color: string;
    category: ToolCategory;
    status: ToolStatus;
}

export const TOOL_CATEGORIES: { id: ToolCategory; label: string }[] = [
    { id: "all", label: "All" },
    { id: "convert", label: "Convert" },
    { id: "edit", label: "Edit" },
    { id: "security", label: "Security" },
    { id: "optimize", label: "Optimize" },
];

export const ALL_PDF_TOOLS: PdfTool[] = [
    {
        id: "merge-pdf",
        name: "Merge PDF",
        description: "Combine multiple PDF files into one document",
        icon: "merge",
        path: "/merge-pdf",
        color: "#2563EB",
        category: "edit" as ToolCategory,
        status: "active",
    },
    {
        id: "split-pdf",
        name: "Split PDF",
        description: "Extract pages from your PDF file",
        icon: "split",
        path: "/split-pdf",
        color: "#7C3AED",
        category: "edit" as ToolCategory,
        status: "active",
    },
    {
        id: "compress-pdf",
        name: "Compress PDF",
        description: "Reduce PDF file size without losing quality",
        icon: "compress",
        path: "/compress-pdf",
        color: "#DC2626",
        category: "optimize" as ToolCategory,
        status: "active",
    },
    {
        id: "pdf-to-word",
        name: "PDF to Word",
        description: "Convert PDF documents to editable Word files",
        icon: "convert",
        path: "/pdf-to-word",
        color: "#2563EB",
        category: "convert" as ToolCategory,
        status: "active",
    },
    {
        id: "pdf-to-jpg",
        name: "PDF to JPG",
        description: "Convert PDF pages to JPG images",
        icon: "image",
        path: "/pdf-to-jpg",
        color: "#cc7648ff",
        category: "convert" as ToolCategory,
        status: "active",
    },
    {
        id: "jpg-to-pdf",
        name: "JPG to PDF",
        description: "Convert JPG images to PDF documents",
        icon: "image",
        path: "/jpg-to-pdf",
        color: "#0891B2",
        category: "convert" as ToolCategory,
        status: "active",
    },
    {
        id: "pdf-to-png",
        name: "PDF to PNG",
        description: "Convert PDF pages to PNG images",
        icon: "image",
        path: "/pdf-to-png",
        color: "#7C3AED",
        category: "convert" as ToolCategory,
        status: "active",
    },
    {
        id: "png-to-pdf",
        name: "PNG to PDF",
        description: "Convert PNG images to PDF documents",
        icon: "image",
        path: "/png-to-pdf",
        color: "#DB2777",
        category: "convert" as ToolCategory,
        status: "active",
    },
    {
        id: "excel-to-pdf",
        name: "Excel to PDF",
        description: "Convert Excel spreadsheets to PDF",
        icon: "convert",
        path: "/excel-to-pdf",
        color: "#DC2626",
        category: "convert" as ToolCategory,
        status: "active",
    },
    {
        id: "pdf-to-ppt",
        name: "PDF to PPT",
        description: "Convert PDF to PowerPoint presentation",
        icon: "convert",
        path: "/pdf-to-ppt",
        color: "#EA580C",
        category: "convert" as ToolCategory,
        status: "upcoming",
    },
    {
        id: "protect-pdf",
        name: "Protect PDF (Under Maintenance)",
        description: "Add password protection to your PDF",
        icon: "lock",
        path: "/protect-pdf",
        color: "#DC2626",
        category: "security" as ToolCategory,
        status: "upcoming",
    },
    {
        id: "unlock-pdf",
        name: "Unlock PDF",
        description: "Remove password from protected PDF",
        icon: "unlock",
        path: "/unlock-pdf",
        color: "#059669",
        category: "security" as ToolCategory,
        status: "upcoming",
    },
    {
        id: "python-jupyter-to-pdf",
        name: "Python & Jupyter to PDF",
        description: "Convert Python and Jupyter Notebook files to PDF",
        icon: "convert",
        path: "/convert-python-jupyter-to-pdf",
        color: "#8B5CF6",
        category: "convert" as ToolCategory,
        status: "active",
    },
    {
        id: "remove-pages",
        name: "Remove Pages",
        description: "Delete specific pages from your PDF document",
        icon: "split",
        path: "/remove-pages",
        color: "#EF4444",
        category: "edit" as ToolCategory,
        status: "active",
    },
    {
        id: "extract-pages",
        name: "Extract Pages",
        description: "Extract selected pages into a new PDF",
        icon: "split",
        path: "/extract-pages",
        color: "#3B82F6",
        category: "edit" as ToolCategory,
        status: "active",
    },
    {
        id: "repair-pdf",
        name: "Repair PDF",
        description: "Fix corrupted or damaged PDF files",
        icon: "compress",
        path: "/repair-pdf",
        color: "#10B981",
        category: "optimize" as ToolCategory,
        status: "active",
    },
    {
        id: "html-to-pdf",
        name: "HTML to PDF",
        description: "Convert HTML content to PDF documents",
        icon: "convert",
        path: "/html-to-pdf",
        color: "#F97316",
        category: "convert" as ToolCategory,
        status: "active",
    },
    {
        id: "add-page-numbers",
        name: "Add Page Numbers",
        description: "Insert page numbers into your PDF",
        icon: "edit",
        path: "/add-page-numbers",
        color: "#8B5CF6",
        category: "edit" as ToolCategory,
        status: "active",
    },
    {
        id: "add-watermark",
        name: "Add Watermark",
        description: "Add text watermarks to your PDF pages",
        icon: "edit",
        path: "/add-watermark",
        color: "#0EA5E9",
        category: "edit" as ToolCategory,
        status: "active",
    },
    {
        id: "crop-pdf",
        name: "Crop PDF",
        description: "Crop and trim PDF page margins",
        icon: "edit",
        path: "/crop-pdf",
        color: "#D946EF",
        category: "edit" as ToolCategory,
        status: "active",
    },
    {
        id: "sign-pdf",
        name: "Sign PDF",
        description: "Add your signature to PDF documents",
        icon: "edit",
        path: "/sign-pdf",
        color: "#14B8A6",
        category: "security" as ToolCategory,
        status: "active",
    },
    {
        id: "redact-pdf",
        name: "Redact PDF",
        description: "Permanently black out sensitive PDF content",
        icon: "lock",
        path: "/redact-pdf",
        color: "#1E293B",
        category: "security" as ToolCategory,
        status: "active",
    },
    {
        id: "compare-pdf",
        name: "Compare PDF",
        description: "Compare two PDF files and find differences",
        icon: "merge",
        path: "/compare-pdf",
        color: "#A855F7",
        category: "edit" as ToolCategory,
        status: "upcoming",
    },
    {
        id: "translate-pdf",
        name: "Translate PDF",
        description: "Translate PDF documents to another language",
        icon: "convert",
        path: "/translate-pdf",
        color: "#EC4899",
        category: "convert" as ToolCategory,
        status: "upcoming",
    },
    {
        id: "ocr-pdf",
        name: "OCR PDF",
        description: "Extract text from scanned PDFs using OCR",
        icon: "convert",
        path: "/ocr-pdf",
        color: "#6366F1",
        category: "optimize" as ToolCategory,
        status: "upcoming",
    },
];

export const PDF_TOOLS = ALL_PDF_TOOLS.filter((tool) => tool.status === "active");
export const UPCOMING_TOOLS = ALL_PDF_TOOLS.filter((tool) => tool.status === "upcoming");
