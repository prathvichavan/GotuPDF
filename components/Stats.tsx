"use client";

import { useEffect, useRef, useState } from "react";

const stats = [
    { label: "Files Processed", value: 1000000, suffix: "+", prefix: "", display: "1M+" },
    { label: "Happy Users", value: 500000, suffix: "+", prefix: "", display: "500K+" },
    { label: "Server Uptime", value: 99.9, suffix: "%", prefix: "", display: "99.9%" },
    { label: "User Rating", value: 4.9, suffix: "/5", prefix: "★ ", display: "★ 4.9/5" },
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
        : value >= 1000000
            ? `${prefix}${(current / 1000000).toFixed(current >= 900000 ? 0 : 1)}M${suffix}`
            : value >= 1000
                ? `${prefix}${(current / 1000).toFixed(current >= 450000 ? 0 : 0)}K${suffix}`
                : value < 100
                    ? `${prefix}${current.toFixed(1)}${suffix}`
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
                    <div className="glass rounded-3xl border border-gray-200 dark:border-white/5 p-8 md:p-12">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4">
                            {stats.map((stat, index) => (
                                <div key={index} className="text-center">
                                    <div className="mb-2">
                                        <AnimatedCounter
                                            value={stat.value}
                                            suffix={stat.suffix}
                                            prefix={stat.prefix}
                                            display={stat.display}
                                            active={visible}
                                        />
                                    </div>
                                    <div className="text-gray-500 dark:text-slate-400 text-sm font-medium">{stat.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
