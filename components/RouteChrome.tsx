"use client";

import { usePathname } from "next/navigation";
import { ALL_PDF_TOOLS } from "@/lib/constants";
import ToolContentSections from "@/components/ToolContentSections";

export default function RouteChrome({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const normalizedPath = pathname.replace(/\/$/, "") || "/";
    const activeTool = ALL_PDF_TOOLS.find((tool) => tool.path === normalizedPath);

    return (
        <>
            {children}
            {activeTool && (
                <ToolContentSections
                    toolId={activeTool.id}
                    toolName={activeTool.name}
                    toolDescription={activeTool.description}
                />
            )}
        </>
    );
}