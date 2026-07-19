"use client";

import { useEffect, useRef, useState } from "react";
import { PDF_TOOLS, TOOL_CATEGORIES, UPCOMING_TOOLS } from "@/lib/constants";

const stats = [
    { label: "Active tools", value: PDF_TOOLS.length, suffix: "", prefix: "", display: `${PDF_TOOLS.length}` },
    { label: "Upcoming tools", value: UPCOMING_TOOLS.length, suffix: "", prefix: "", display: `${UPCOMING_TOOLS.length}` },
    {
        label: "Tool categories",
        value: TOOL_CATEGORIES.filter((category) => category.id !== "all").length,
        suffix: "",
        prefix: "",
        display: `${TOOL_CATEGORIES.filter((category) => category.id !== "all").length}`,
    },
];

function AnimatedCounter({ value, suffix, prefix, display, active }: {
    value: number;
    suffix: string;
    prefix: string;
    display: string;
    active: boolean;
}) {
    const [current, setCurrent] = useState(0);
    const [done, setDone] = useState(false);

    useEffect(() => {
        if (!active) return;
        const duration = 2000;
        const steps = 60;
        const increment = value / steps;
        let step = 0;

        const timer = setInterval(() => {
            step++;
            if (step >= steps) {
                setCurrent(value);
                setDone(true);
                clearInterval(timer);
            } else {
                setCurrent(increment * step);
            }
        }, duration / steps);

        return () => clearInterval(timer);
    }, [active, value]);

    if (!active) return <span className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white">0</span>;

    const formatted = done
        ? display
        : `${prefix}${Math.round(current)}${suffix}`;

    return <span className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white">{formatted}</span>;
}

export default function Stats() {
    const [visible, setVisible] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) setVisible(true); },
            { threshold: 0.3 }
        );
        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, []);

    return (
        <section className="py-20 relative overflow-hidden" ref={ref}>
            {/* Background glow */}
            <div className="absolute inset-0 gradient-bg-section" />

            <div className="relative z-10 w-full px-6 sm:px-8 lg:px-12 xl:px-16">
                <div className="max-w-5xl mx-auto">
                    <div className="glass rounded-[2rem] border border-gray-200/70 dark:border-white/5 p-6 sm:p-8 md:p-12 shadow-[0_20px_80px_rgba(124,58,237,0.08)]">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
                            {stats.map((stat, index) => (
                                <div key={index} className="rounded-3xl border border-gray-200/60 dark:border-white/5 bg-white/70 dark:bg-white/5 p-6 text-center shadow-sm backdrop-blur-sm">
                                    <div className="mb-2">
                                        <AnimatedCounter
                                            value={stat.value}
                                            suffix={stat.suffix}
                                            prefix={stat.prefix}
                                            display={stat.display}
                                            active={visible}
                                        />
                                    </div>
                                    <div className="text-gray-600 dark:text-slate-400 text-sm font-medium">{stat.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
