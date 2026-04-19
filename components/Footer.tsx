"use client";

import Link from "next/link";
import Image from "next/image";
import { SITE_NAME } from "@/lib/constants";
import { useState, useEffect } from "react";

export default function Footer() {
    const [currentYear, setCurrentYear] = useState(2026);
    const [email, setEmail] = useState("");

    useEffect(() => {
        setCurrentYear(new Date().getFullYear());
    }, []);

    const handleNewsletterSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setEmail("");
    };

    return (
        <footer className="relative border-t border-gray-200 dark:border-white/5 mt-0">
            {/* Background */}
            <div className="absolute inset-0 bg-gray-100 dark:bg-[#070b14]" />

            <div className="relative z-10 w-full mx-auto px-6 sm:px-8 lg:px-12 xl:px-16 pt-16 pb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 mb-12">
                    {/* Brand */}
                    <div className="lg:col-span-2">
                        <Link href="/" className="inline-block mb-4">
                            <Image
                                src="/logo.png"
                                alt="GotuPDF Logo"
                                width={120}
                                height={35}
                                className="w-[100px] md:w-[120px] h-auto object-contain dark:invert"
                            />
                        </Link>
                        <p className="text-sm text-gray-500 dark:text-slate-500 leading-relaxed mb-6 max-w-sm">
                            Professional PDF tools for all your document needs. Convert, merge, split, and compress PDFs online for free.
                        </p>
                        {/* Newsletter */}
                        <form onSubmit={handleNewsletterSubmit} className="flex gap-2 max-w-sm" suppressHydrationWarning>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Enter your email"
                                className="flex-1 px-4 py-2.5 rounded-lg glass border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
                                suppressHydrationWarning
                            />
                            <button
                                type="submit"
                                className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-medium hover:shadow-lg hover:shadow-indigo-500/25 transition-all"
                                suppressHydrationWarning
                            >
                                Subscribe
                            </button>
                        </form>
                    </div>

                    {/* Popular Tools */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">Popular Tools</h3>
                        <ul className="space-y-2.5">
                            <li><Link href="/merge-pdf" className="text-sm text-gray-500 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Merge PDF</Link></li>
                            <li><Link href="/split-pdf" className="text-sm text-gray-500 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Split PDF</Link></li>
                            <li><Link href="/compress-pdf" className="text-sm text-gray-500 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Compress PDF</Link></li>
                            <li><Link href="/pdf-to-word" className="text-sm text-gray-500 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">PDF to Word</Link></li>
                            <li><Link href="/protect-pdf" className="text-sm text-gray-500 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Protect PDF</Link></li>
                        </ul>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">Quick Links</h3>
                        <ul className="space-y-2.5">
                            <li><Link href="/#tools" className="text-sm text-gray-500 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Tools</Link></li>
                            <li><Link href="/about-us" className="text-sm text-gray-500 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">About Us</Link></li>
                            <li><Link href="/blog" className="text-sm text-gray-500 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Blog</Link></li>
                            <li><Link href="/faq" className="text-sm text-gray-500 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">FAQ</Link></li>
                            <li><Link href="/contact-us" className="text-sm text-gray-500 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Contact</Link></li>
                            <li><Link href="/ultimate-guide" className="text-sm text-gray-500 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Ultimate PDF Guide</Link></li>
                        </ul>
                    </div>

                    {/* Legal */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">Legal</h3>
                        <ul className="space-y-2.5">
                            <li><Link href="/privacy" className="text-sm text-gray-500 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Privacy Policy</Link></li>
                            <li><Link href="/terms" className="text-sm text-gray-500 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Terms & Conditions</Link></li>
                            <li><Link href="/disclaimer" className="text-sm text-gray-500 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Disclaimer</Link></li>
                            <li><Link href="/cookie-policy" className="text-sm text-gray-500 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Cookie Policy</Link></li>
                            <li><Link href="/refund-policy" className="text-sm text-gray-500 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Refund Policy</Link></li>
                            <li><Link href="/security-policy" className="text-sm text-gray-500 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Security Policy</Link></li>
                            <li><Link href="/dmca" className="text-sm text-gray-500 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">DMCA</Link></li>
                        </ul>
                    </div>
                </div>

                {/* Bottom bar */}
                <div className="border-t border-gray-200 dark:border-white/5 pt-8">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <p className="text-sm text-gray-500 dark:text-slate-600">
                            &copy; {currentYear} {SITE_NAME}. All rights reserved.
                        </p>
                        <a
                            href="https://www.linkedin.com/in/prathvirajchavan/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-400 dark:text-slate-600 hover:text-blue-500 dark:hover:text-blue-400 transition-colors duration-200 cursor-pointer"
                            aria-label="LinkedIn"
                        >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                            </svg>
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
