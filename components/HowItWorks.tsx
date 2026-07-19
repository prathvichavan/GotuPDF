"use client";

import { useEffect, useRef, useState } from "react";

const steps = [
    {
        number: "01",
        title: "Upload PDF",
        description: "Drag & drop or click to select. Your files stay private and secure.",
        icon: (
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
        ),
    },
    {
        number: "02",
        title: "Process Securely",
        description: "Instant processing in your browser or secure cloud servers.",
        icon: (
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
        ),
    },
    {
        number: "03",
        title: "Download Instantly",
        description: "Get your result in seconds. Files auto-delete for your privacy.",
        icon: (
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
        ),
    },
];

export default function HowItWorks() {
    const [visible, setVisible] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) setVisible(true); },
            { threshold: 0.2 }
        );
        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, []);

    return (
        <section id="how-it-works" className="py-24 relative overflow-hidden scroll-mt-24" ref={ref}>
            {/* Background glow */}
            <div className="absolute inset-0 gradient-bg-section" />

            <div className="relative z-10 w-full px-6 sm:px-8 lg:px-12 xl:px-16">
                <div className="text-center mb-16">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-500 dark:text-violet-300 mb-3">
                        How It Works
                    </p>
                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight">
                        How It{" "}
                        <span className="gradient-text">Works</span>
                    </h2>
                    <p className="text-gray-600 dark:text-slate-400 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
                        Three simple steps to transform your documents
                    </p>
                </div>

                <div className="max-w-5xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 relative">
                        {/* Connecting line (desktop) */}
                        <div className="hidden md:block absolute top-20 left-[18%] right-[18%] h-[2px]">
                            <div
                                className="h-full bg-gradient-to-r from-violet-500/40 via-fuchsia-500/40 to-violet-500/40 rounded-full transition-all duration-1000"
                                style={{ width: visible ? "100%" : "0%", transitionDelay: "0.3s" }}
                            />
                        </div>

                        {steps.map((step, index) => (
                            <div
                                key={index}
                                className="relative text-center group h-full"
                                style={{
                                    opacity: visible ? 1 : 0,
                                    transform: visible ? "translateY(0)" : "translateY(20px)",
                                    transition: `all 0.6s ease-out ${index * 0.2}s`,
                                }}
                            >
                                <div className="glass-card h-full rounded-3xl p-8 flex flex-col items-center">
                                    {/* Step circle */}
                                    <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/15 to-fuchsia-500/15 border border-violet-500/15 mb-6 group-hover:border-violet-500/35 transition-colors">
                                        <div className="text-violet-500 dark:text-violet-300 group-hover:text-violet-400 transition-colors">
                                            {step.icon}
                                        </div>
                                        <div className="absolute -top-2 -right-2 w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-xs font-bold text-white shadow-lg shadow-violet-500/30">
                                            {step.number}
                                        </div>
                                    </div>

                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">{step.title}</h3>
                                    <p className="text-gray-600 dark:text-slate-400 text-sm leading-7 max-w-xs mx-auto">
                                        {step.description}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
