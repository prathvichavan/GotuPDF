"use client";

import { usePathname } from "next/navigation";
import { PDF_TOOLS } from "@/lib/constants";
import ToolSections from "@/components/ToolSections";

export default function RouteChrome({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const normalizedPath = pathname.replace(/\/$/, "") || "/";
    const activeTool = PDF_TOOLS.find((tool) => tool.path === normalizedPath);

    return (
        <>
            {children}
            {activeTool && <ToolSections tool={activeTool} />}
        </>
    );
}