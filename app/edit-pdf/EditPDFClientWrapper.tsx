"use client";

import dynamic from "next/dynamic";

function EditorSkeleton() {
    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-gray-400">Loading In-Place PDF Editor...</p>
            </div>
        </div>
    );
}

// New In-Place PDF Editor with true text layer editing
const InPlacePDFEditor = dynamic(
    () => import("@/components/InPlacePDFEditor"),
    { ssr: false, loading: () => <EditorSkeleton /> }
);

export default function EditPDFClientWrapper() {
    return <InPlacePDFEditor />;
}
