"use client";

import { usePathname } from "next/navigation";

export default function RouteChrome({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <>
            {children}
        </>
    );
}