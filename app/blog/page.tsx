'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { BLOG_POSTS } from '@/lib/blog-data';
import { SITE_NAME, SITE_URL } from '@/lib/constants';
import { formatDateUTC } from '@/lib/date';

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS & HELPERS
   ═══════════════════════════════════════════════════════════════ */

const categories = ['All', 'Guides', 'Tutorials', 'Security', 'Reviews', 'Comparisons'];

const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
    Guides: { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-700' },
    Security: { bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-700 dark:text-red-300', border: 'border-red-200 dark:border-red-700' },
    Tutorials: { bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-700' },
    Reviews: { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-700' },
    Comparisons: { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-700' },
};

const getCategoryStyle = (category: string) => categoryColors[category] || categoryColors.Guides;

const quickTools = [
    { name: 'Merge PDF', href: '/merge-pdf', icon: '📑' },
    { name: 'Compress PDF', href: '/compress-pdf', icon: '📦' },
    { name: 'PDF to Word', href: '/pdf-to-word', icon: '📝' },
    { name: 'Split PDF', href: '/split-pdf', icon: '✂️' },
];

/* ═══════════════════════════════════════════════════════════════
   BLOG PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export default function BlogPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [postsToShow, setPostsToShow] = useState(9);
    const [isLoading, setIsLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [subscribed, setSubscribed] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);

    // Schema.org structured data
    const breadcrumbJsonLd = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/blog` },
        ],
    };

    // Sort posts by date (newest first)
    const sortedPosts = useMemo(() =>
        [...BLOG_POSTS].sort((a, b) =>
            new Date(b.date).getTime() - new Date(a.date).getTime()
        ), []
    );

    // Filter posts
    const filteredPosts = useMemo(() => {
        let posts = sortedPosts;
        if (selectedCategory !== 'All') {
            posts = posts.filter(post => post.category === selectedCategory);
        }
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            posts = posts.filter(post =>
                post.title.toLowerCase().includes(query) ||
                post.excerpt.toLowerCase().includes(query) ||
                post.category.toLowerCase().includes(query)
            );
        }
        return posts;
    }, [sortedPosts, searchQuery, selectedCategory]);

    // Featured posts (first 3)
    const featuredPosts = sortedPosts.slice(0, 3);

    // Trending posts (random selection for variety)
    const trendingPosts = useMemo(() => {
        const shuffled = [...sortedPosts].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, 4);
    }, [sortedPosts]);

    // Editor's picks (category diversity)
    const editorPicks = useMemo(() => {
        const picks: typeof sortedPosts = [];
        const usedCategories = new Set<string>();
        for (const post of sortedPosts) {
            if (!usedCategories.has(post.category) && picks.length < 3) {
                picks.push(post);
                usedCategories.add(post.category);
            }
        }
        return picks;
    }, [sortedPosts]);

    // Category counts
    const categoryCounts = useMemo(() => {
        const counts: Record<string, number> = { All: BLOG_POSTS.length };
        categories.slice(1).forEach(cat => {
            counts[cat] = BLOG_POSTS.filter(p => p.category === cat).length;
        });
        return counts;
    }, []);

    // Reset on filter change
    useEffect(() => {
        setPostsToShow(9);
    }, [searchQuery, selectedCategory]);

    // Load more with animation
    const loadMore = () => {
        setIsLoading(true);
        setTimeout(() => {
            setPostsToShow(prev => prev + 6);
            setIsLoading(false);
        }, 300);
    };

    // Newsletter submit
    const handleSubscribe = (e: React.FormEvent) => {
        e.preventDefault();
        if (email) {
            setSubscribed(true);
            setEmail('');
        }
    };

    const displayPosts = filteredPosts.slice(0, postsToShow);
    const popularPosts = sortedPosts.slice(0, 5);

    return (
        <div className="bg-white dark:bg-slate-900 min-h-screen transition-colors duration-300 ease-in-out">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
            />

            {/* ═══════════════════════════════════════════════════════════
                SECTION 1: HERO WITH FEATURED ARTICLES
                ═══════════════════════════════════════════════════════════ */}
            <section className="relative overflow-hidden transition-colors duration-300 ease-in-out">
                {/* Gradient Background - Soft SaaS for light, Bold for dark */}
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 dark:from-indigo-700 dark:via-purple-800 dark:to-pink-700" />
                {/* White overlay for light mode softness */}
                <div className="absolute inset-0 bg-white/40 backdrop-blur-sm dark:bg-transparent" />
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-30 dark:opacity-50" />

                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24 lg:py-28">
                    {/* Hero Header */}
                    <div className="text-center mb-10 sm:mb-12">
                        <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-600/10 dark:bg-white/10 backdrop-blur-sm rounded-full text-indigo-700 dark:text-white/90 text-sm font-medium mb-4 transition-colors duration-300">
                            <span className="w-2 h-2 bg-emerald-500 dark:bg-emerald-400 rounded-full animate-pulse" />
                            PDF Knowledge Hub
                        </span>
                        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 dark:text-white mb-4 tracking-tight transition-colors duration-300">
                            {SITE_NAME} <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-amber-200 dark:to-yellow-400">Blog</span>
                        </h1>
                        <p className="text-lg sm:text-xl text-gray-600 dark:text-white/80 max-w-2xl mx-auto leading-relaxed transition-colors duration-300">
                            Expert guides, tutorials, and insights on PDF management, document security, and productivity.
                        </p>
                        <Link
                            href="/"
                            className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-indigo-600 dark:bg-white text-white dark:text-indigo-600 font-semibold rounded-xl shadow-lg hover:bg-indigo-700 dark:hover:bg-gray-100 hover:shadow-xl hover:scale-105 transition-all duration-300"
                        >
                            Try GotuPDF Free
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                        </Link>
                    </div>

                    {/* Featured Articles Grid */}
                    {featuredPosts.length >= 3 && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
                            {/* Main Featured Article */}
                            <div className="lg:col-span-2 lg:row-span-2">
                                <Link href={`/blog/${featuredPosts[0].slug}`} className="group block h-full">
                                    <article className="relative h-full min-h-[300px] sm:min-h-[400px] rounded-2xl overflow-hidden bg-white dark:bg-gradient-to-br dark:from-indigo-700 dark:via-purple-800 dark:to-pink-700 border border-gray-200 dark:border-transparent shadow-xl dark:shadow-2xl transition-all duration-300 ease-in-out">
                                        {/* Gradient top bar for light mode */}
                                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 dark:hidden" />
                                        {/* Dark overlay for dark mode only */}
                                        <div className="absolute inset-0 bg-transparent dark:bg-gradient-to-t dark:from-black/60 dark:via-black/30 dark:to-transparent" />
                                        <div className="absolute top-4 left-4">
                                            <span className="inline-flex items-center px-3 py-1 text-xs font-bold rounded-full bg-indigo-100 text-indigo-700 dark:bg-white/20 dark:text-white backdrop-blur-sm border border-indigo-200 dark:border-white/20 transition-all duration-300">
                                                {featuredPosts[0].category}
                                            </span>
                                        </div>
                                        <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
                                            <span className="inline-block px-3 py-1 bg-yellow-100 text-yellow-700 dark:bg-indigo-500 dark:text-white text-xs font-semibold rounded-full mb-3 transition-all duration-300">
                                                ⭐ Featured
                                            </span>
                                            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-3 group-hover:text-indigo-600 dark:group-hover:text-indigo-200 transition-colors duration-300 leading-tight line-clamp-2">
                                                {featuredPosts[0].title}
                                            </h2>
                                            <p className="text-gray-600 dark:text-white/70 text-sm sm:text-base line-clamp-2 mb-4 max-w-2xl transition-colors duration-300">
                                                {featuredPosts[0].excerpt}
                                            </p>
                                            <div className="flex items-center gap-3 text-gray-500 dark:text-white/60 text-sm transition-colors duration-300">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-xs">
                                                    {featuredPosts[0].author.charAt(0)}
                                                </div>
                                                <span>{featuredPosts[0].author}</span>
                                                <span>•</span>
                                                <time dateTime={featuredPosts[0].date}>{formatDateUTC(featuredPosts[0].date, "short")}</time>
                                                <span>•</span>
                                                <span>{featuredPosts[0].readTime}</span>
                                            </div>
                                        </div>
                                    </article>
                                </Link>
                            </div>

                            {/* Side Featured Articles */}
                            {featuredPosts.slice(1, 3).map((post, idx) => (
                                <div key={post.slug}>
                                    <Link href={`/blog/${post.slug}`} className="group block h-full">
                                        <article className="relative h-full min-h-[180px] sm:min-h-[190px] rounded-2xl overflow-hidden bg-white dark:bg-gradient-to-br dark:from-indigo-700 dark:via-purple-800 dark:to-pink-700 border border-gray-200 dark:border-transparent shadow-xl hover:shadow-2xl transition-all duration-300 ease-in-out">
                                            {/* Gradient top bar for light mode */}
                                            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 dark:hidden" />
                                            {/* Dark overlay for dark mode only */}
                                            <div className="absolute inset-0 bg-transparent dark:bg-gradient-to-t dark:from-black/60 dark:via-black/30 dark:to-transparent" />
                                            <div className="absolute top-3 left-3">
                                                <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-bold rounded-full bg-indigo-100 text-indigo-700 dark:bg-white/20 dark:text-white backdrop-blur-sm border border-indigo-200 dark:border-white/20 transition-all duration-300">
                                                    {post.category}
                                                </span>
                                            </div>
                                            <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
                                                <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-200 transition-colors duration-300 line-clamp-2 mb-2">
                                                    {post.title}
                                                </h3>
                                                <div className="flex items-center gap-2 text-gray-500 dark:text-white/60 text-xs transition-colors duration-300">
                                                    <time dateTime={post.date}>{formatDateUTC(post.date, "short")}</time>
                                                    <span>•</span>
                                                    <span>{post.readTime}</span>
                                                </div>
                                            </div>
                                        </article>
                                    </Link>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════
                SECTION 2: CATEGORY FILTER TABS
                ═══════════════════════════════════════════════════════════ */}
            <section className="sticky top-0 z-40 bg-white dark:bg-slate-900 backdrop-blur-xl border-b border-gray-200 dark:border-slate-700 shadow-sm transition-colors duration-300 ease-in-out">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                        {/* Category Pills */}
                        <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                            {categories.map((category) => (
                                <button
                                    key={category}
                                    onClick={() => setSelectedCategory(category)}
                                    className={`relative px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ease-in-out ${
                                        selectedCategory === category
                                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25 scale-105'
                                            : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                                    }`}
                                >
                                    {category}
                                    <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full transition-colors duration-300 ${
                                        selectedCategory === category
                                            ? 'bg-white/20 text-white'
                                            : 'bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-gray-400'
                                    }`}>
                                        {categoryCounts[category]}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* Search Bar */}
                        <div className="relative flex-1 max-w-md">
                            <svg
                                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"
                                fill="none" stroke="currentColor" viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Search articles..."
                                className="w-full pl-10 pr-4 py-2.5 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors duration-300 ease-in-out"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════
                SECTION 3: TRENDING NOW
                ═══════════════════════════════════════════════════════════ */}
            {selectedCategory === 'All' && !searchQuery && (
                <section className="py-10 sm:py-12 bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 transition-colors duration-300 ease-in-out">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex items-center gap-3 mb-6">
                            <span className="text-2xl">🔥</span>
                            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 transition-colors duration-300">Trending Now</h2>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {trendingPosts.map((post) => (
                                <Link key={post.slug} href={`/blog/${post.slug}`} className="group">
                                    <article className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-slate-700 shadow-md dark:shadow-lg hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-lg transition-all duration-300 ease-in-out">
                                        <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full mb-2 ${getCategoryStyle(post.category).bg} ${getCategoryStyle(post.category).text}`}>
                                            {post.category}
                                        </span>
                                        <h3 className="font-bold text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors duration-300 line-clamp-2 mb-2">
                                            {post.title}
                                        </h3>
                                        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 transition-colors duration-300">
                                            <span>{post.readTime}</span>
                                            <span>•</span>
                                            <time dateTime={post.date}>{formatDateUTC(post.date, "short")}</time>
                                        </div>
                                    </article>
                                </Link>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* ═══════════════════════════════════════════════════════════
                MAIN CONTENT AREA
                ═══════════════════════════════════════════════════════════ */}
            <div ref={contentRef} className="bg-white dark:bg-slate-900 transition-colors duration-300 ease-in-out">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 lg:gap-12">
                    
                    {/* ═══════════════════════════════════════════════════════
                        SECTION 4: MAGAZINE STYLE BLOG GRID
                        ═══════════════════════════════════════════════════════ */}
                    <main className="lg:col-span-3">
                        {/* Results Header */}
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 transition-colors duration-300">
                                {selectedCategory === 'All' ? 'Latest Articles' : selectedCategory}
                                <span className="ml-2 text-sm font-normal text-gray-600 dark:text-gray-400 transition-colors duration-300">
                                    ({filteredPosts.length} {filteredPosts.length === 1 ? 'article' : 'articles'})
                                </span>
                            </h2>
                        </div>

                        {/* No Results */}
                        {displayPosts.length === 0 ? (
                            <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-md dark:shadow-lg transition-colors duration-300 ease-in-out">
                                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center transition-colors duration-300">
                                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 transition-colors duration-300">No articles found</h3>
                                <p className="text-gray-600 dark:text-gray-400 mb-4 transition-colors duration-300">
                                    {searchQuery ? `No results for "${searchQuery}"` : `No articles in ${selectedCategory}`}
                                </p>
                                <button
                                    onClick={() => { setSearchQuery(''); setSelectedCategory('All'); }}
                                    className="px-5 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                                >
                                    Clear filters
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* 3-Column Grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {displayPosts.map((post, index) => (
                                        <React.Fragment key={post.slug}>
                                            <article className="group bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-md dark:shadow-lg overflow-hidden hover:shadow-xl hover:border-indigo-300 dark:hover:border-indigo-600 transition-all duration-300 ease-in-out transform hover:-translate-y-1">
                                                {/* Image */}
                                                <Link href={`/blog/${post.slug}`} className="block relative overflow-hidden aspect-[16/10]">
                                                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700" />
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <span className="text-white/30 text-6xl font-black">
                                                            {post.category.charAt(0)}
                                                        </span>
                                                    </div>
                                                    <div className="absolute top-3 left-3">
                                                        <span className={`inline-flex items-center px-2.5 py-1 text-xs font-bold rounded-full bg-white/90 dark:bg-slate-900/90 ${getCategoryStyle(post.category).text} shadow-sm`}>
                                                            {post.category}
                                                        </span>
                                                    </div>
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                                                </Link>

                                                {/* Content */}
                                                <div className="p-5">
                                                    <Link href={`/blog/${post.slug}`}>
                                                        <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors duration-300 line-clamp-2 mb-2 leading-tight">
                                                            {post.title}
                                                        </h3>
                                                    </Link>
                                                    <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-2 mb-4 transition-colors duration-300">
                                                        {post.excerpt}
                                                    </p>
                                                    <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 transition-colors duration-300">
                                                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-[10px]">
                                                            {post.author.charAt(0)}
                                                        </div>
                                                        <span className="font-medium text-gray-700 dark:text-gray-300 transition-colors duration-300">{post.author}</span>
                                                        <span>•</span>
                                                        <time dateTime={post.date}>{formatDateUTC(post.date, "short")}</time>
                                                    </div>
                                                </div>
                                            </article>

                                            {/* Editor's Picks after 3rd card */}
                                            {index === 2 && selectedCategory === 'All' && !searchQuery && (
                                                <div className="sm:col-span-2 lg:col-span-3 py-6">
                                                    <div className="bg-gray-50 dark:from-slate-800 dark:via-slate-800 dark:to-slate-800 dark:bg-slate-800 rounded-2xl p-6 border border-gray-200 dark:border-slate-700 transition-colors duration-300 ease-in-out">
                                                        <div className="flex items-center gap-2 mb-4">
                                                            <span className="text-xl">⭐</span>
                                                            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 transition-colors duration-300">Editor&apos;s Picks</h3>
                                                        </div>
                                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                            {editorPicks.map((pick) => (
                                                                <Link key={pick.slug} href={`/blog/${pick.slug}`} className="group flex items-start gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 ease-in-out">
                                                                    <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${getCategoryStyle(pick.category).bg}`}>
                                                                        <span className={`font-bold text-sm ${getCategoryStyle(pick.category).text}`}>
                                                                            {pick.category.charAt(0)}
                                                                        </span>
                                                                    </div>
                                                                    <div>
                                                                        <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors duration-300 line-clamp-2">
                                                                            {pick.title}
                                                                        </h4>
                                                                        <span className="text-xs text-gray-600 dark:text-gray-400 transition-colors duration-300">{pick.readTime}</span>
                                                                    </div>
                                                                </Link>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </div>

                                {/* Load More */}
                                {displayPosts.length < filteredPosts.length && (
                                    <div className="mt-10 text-center">
                                        <button
                                            onClick={loadMore}
                                            disabled={isLoading}
                                            className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:scale-105 transition-all duration-300 disabled:opacity-50"
                                        >
                                            {isLoading ? (
                                                <>
                                                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                    </svg>
                                                    Loading...
                                                </>
                                            ) : (
                                                <>
                                                    Load More Articles
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </>
                                            )}
                                        </button>
                                        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 transition-colors duration-300">
                                            Showing {displayPosts.length} of {filteredPosts.length} articles
                                        </p>
                                    </div>
                                )}
                            </>
                        )}
                    </main>

                    {/* ═══════════════════════════════════════════════════════
                        SECTION 5: ENHANCED SIDEBAR
                        ═══════════════════════════════════════════════════════ */}
                    <aside className="lg:col-span-1">
                        <div className="sticky top-24 space-y-6">
                            
                            {/* Newsletter Box */}
                            <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl p-6 text-white shadow-xl">
                                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mb-4">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-bold mb-2">Stay Updated</h3>
                                <p className="text-white/80 text-sm mb-4">
                                    Get the latest PDF tips and guides delivered to your inbox.
                                </p>
                                {subscribed ? (
                                    <div className="flex items-center gap-2 text-emerald-200">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        Thanks for subscribing!
                                    </div>
                                ) : (
                                    <form onSubmit={handleSubscribe} className="space-y-3">
                                        <input
                                            type="email"
                                            placeholder="Your email address"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full px-4 py-2.5 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
                                            required
                                        />
                                        <button
                                            type="submit"
                                            className="w-full px-4 py-2.5 bg-white text-indigo-600 font-semibold rounded-lg hover:bg-white/90 transition-colors"
                                        >
                                            Subscribe
                                        </button>
                                    </form>
                                )}
                            </div>

                            {/* Quick Tools */}
                            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-gray-200 dark:border-slate-700 shadow-md dark:shadow-lg transition-colors duration-300 ease-in-out">
                                <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2 transition-colors duration-300">
                                    <span className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 transition-colors duration-300">
                                        🛠️
                                    </span>
                                    Quick Tools
                                </h3>
                                <div className="grid grid-cols-2 gap-2">
                                    {quickTools.map((tool) => (
                                        <Link
                                            key={tool.href}
                                            href={tool.href}
                                            className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 dark:bg-slate-900 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors duration-300 ease-in-out"
                                        >
                                            <span>{tool.icon}</span>
                                            {tool.name}
                                        </Link>
                                    ))}
                                </div>
                            </div>

                            {/* Popular Posts */}
                            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-gray-200 dark:border-slate-700 shadow-md dark:shadow-lg transition-colors duration-300 ease-in-out">
                                <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2 transition-colors duration-300">
                                    <span className="text-lg">📈</span>
                                    Most Read
                                </h3>
                                <ul className="space-y-4">
                                    {popularPosts.map((post, index) => (
                                        <li key={post.slug}>
                                            <Link href={`/blog/${post.slug}`} className="group flex gap-3">
                                                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center text-xs font-bold">
                                                    {index + 1}
                                                </span>
                                                <div>
                                                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors duration-300 line-clamp-2">
                                                        {post.title}
                                                    </h4>
                                                    <span className="text-xs text-gray-600 dark:text-gray-400 transition-colors duration-300">{post.readTime}</span>
                                                </div>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* CTA Banner */}
                            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white shadow-xl">
                                <h3 className="text-lg font-bold mb-2">Ready to try GotuPDF?</h3>
                                <p className="text-white/80 text-sm mb-4">
                                    Free online PDF tools with no signup required.
                                </p>
                                <Link
                                    href="/"
                                    className="inline-flex items-center gap-2 w-full justify-center px-4 py-2.5 bg-white text-emerald-600 font-semibold rounded-lg hover:bg-white/90 transition-colors"
                                >
                                    Get Started Free
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                    </svg>
                                </Link>
                            </div>

                            {/* Categories */}
                            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-gray-200 dark:border-slate-700 shadow-md dark:shadow-lg transition-colors duration-300 ease-in-out">
                                <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-4 transition-colors duration-300">Categories</h3>
                                <ul className="space-y-2">
                                    {categories.slice(1).map((category) => (
                                        <li key={category}>
                                            <button
                                                onClick={() => setSelectedCategory(category)}
                                                className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm transition-colors duration-300 ease-in-out ${
                                                    selectedCategory === category
                                                        ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                                                        : 'hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300'
                                                }`}
                                            >
                                                <span className="font-medium">{category}</span>
                                                <span className={`px-2 py-0.5 text-xs rounded-full transition-colors duration-300 ${
                                                    selectedCategory === category
                                                        ? 'bg-indigo-100 dark:bg-indigo-800 text-indigo-600 dark:text-indigo-300'
                                                        : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400'
                                                }`}>
                                                    {categoryCounts[category]}
                                                </span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </aside>
                </div>
            </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════
                SECTION 6: ABOUT SECTION
                ═══════════════════════════════════════════════════════════ */}
            <section className="bg-gray-50 dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 transition-colors duration-300 ease-in-out">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4 transition-colors duration-300">About {SITE_NAME}</h2>
                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-6 transition-colors duration-300">
                        {SITE_NAME} is a free online platform dedicated to making PDF management simple, secure, and accessible to everyone.
                        Our blog provides expert guidance on document handling, security best practices, and productivity tips.
                    </p>
                    <div className="flex flex-wrap gap-4 text-sm">
                        {[
                            { href: '/privacy', label: 'Privacy Policy' },
                            { href: '/about-us', label: 'About Us' },
                            { href: '/contact-us', label: 'Contact' },
                            { href: '/disclaimer', label: 'Disclaimer' },
                        ].map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                            >
                                {link.label}
                            </Link>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
}
