
import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BLOG_POSTS } from '@/lib/blog-data';
import { SITE_NAME, SITE_URL } from '@/lib/constants';
import { formatDateUTC } from '@/lib/date';

interface Props {
    params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    const post = BLOG_POSTS.find((p) => p.slug === slug);

    if (!post) {
        return {
            title: 'Post Not Found',
        };
    }

    return {
        title: `${post.title} | ${SITE_NAME}`,
        description: post.excerpt,
        alternates: {
            canonical: `${SITE_URL}/blog/${post.slug}`,
        },
        openGraph: {
            title: post.title,
            description: post.excerpt,
            type: 'article',
            publishedTime: post.date,
            authors: [post.author],
            url: `${SITE_URL}/blog/${post.slug}`,
            images: [
                {
                    url: post.image,
                    width: 1200,
                    height: 630,
                    alt: post.title,
                },
            ],
        },
    };
}

export async function generateStaticParams() {
    return BLOG_POSTS.map((post) => ({
        slug: post.slug,
    }));
}

export default async function BlogPostPage({ params }: Props) {
    const { slug } = await params;
    const post = BLOG_POSTS.find((p) => p.slug === slug);

    if (!post) {
        notFound();
    }

    // Get related posts from the same category
    const relatedPosts = BLOG_POSTS
        .filter(p => p.category === post.category && p.slug !== post.slug)
        .slice(0, 3);

    // Article Schema (JSON-LD)
    const jsonLd = { "@context": "https://schema.org", "@type": "Article",
        headline: post.title,
        description: post.excerpt,
        image: post.image,
        author: { "@type": "Person",
            name: post.author,
        },
        publisher: { "@type": "Organization",
            name: SITE_NAME,
            logo: { "@type": "ImageObject",
                url: `${SITE_URL}/logo.png`,
            },
        },
        datePublished: post.date,
        dateModified: post.date,
        mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}/blog/${post.slug}`,
        },
    };

    const breadcrumbJsonLd = { "@context": "https://schema.org", "@type": "BreadcrumbList",
        itemListElement: [
            { "@type": "ListItem",
                position: 1,
                name: "Home",
                item: SITE_URL,
            },
            { "@type": "ListItem",
                position: 2,
                name: "Blog",
                item: `${SITE_URL}/blog`,
            },
            { "@type": "ListItem",
                position: 3,
                name: post.title,
                item: `${SITE_URL}/blog/${post.slug}`,
            },
        ],
    };

    return (
        <div className="bg-white dark:bg-slate-900 min-h-screen transition-colors duration-300 ease-in-out">
            {/* JSON-LD Script */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
            />

            {/* Article Container */}
            <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* Breadcrumb */}
                <nav className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-8 transition-colors duration-300" aria-label="Breadcrumb">
                    <Link href="/" className="hover:text-gray-700 dark:hover:text-gray-200 transition-colors duration-300">Home</Link>
                    <svg className="w-4 h-4 mx-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                    <Link href="/blog" className="hover:text-gray-700 dark:hover:text-gray-200 transition-colors duration-300">Blog</Link>
                    <svg className="w-4 h-4 mx-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="text-gray-900 dark:text-gray-100 transition-colors duration-300">{post.category}</span>
                </nav>

                {/* Article Header */}
                <header className="mb-12">
                    {/* Category Badge */}
                    <div className="mb-4">
                        <Link
                            href={`/blog?category=${post.category.toLowerCase()}`}
                            className="inline-block bg-indigo-600 text-white text-sm font-semibold px-4 py-1.5 rounded-full hover:bg-indigo-700 transition-colors shadow-sm"
                        >
                            {post.category}
                        </Link>
                    </div>

                    {/* Title */}
                    <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-gray-100 mb-6 leading-tight transition-colors duration-300">
                        {post.title}
                    </h1>

                    {/* Meta Information */}
                    <div className="flex flex-wrap items-center gap-4 text-gray-600 dark:text-gray-400 pb-6 border-b border-gray-200 dark:border-slate-700 transition-colors duration-300">
                        <div className="flex items-center">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-lg mr-3 text-white">
                                {post.author.charAt(0)}
                            </div>
                            <div>
                                <p className="font-semibold text-gray-900 dark:text-gray-100 transition-colors duration-300">{post.author}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400 transition-colors duration-300">PDF Tools Specialist</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center">
                                <svg className="w-4 h-4 mr-1.5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <time dateTime={post.date} suppressHydrationWarning>
                                    {formatDateUTC(post.date, "long")}
                                </time>
                            </div>
                            <span>•</span>
                            <div className="flex items-center">
                                <svg className="w-4 h-4 mr-1.5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span>{post.readTime}</span>
                            </div>
                        </div>
                    </div>

                    {/* Last Updated */}
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-4 transition-colors duration-300">
                        Last updated: <span suppressHydrationWarning>{formatDateUTC(post.date, "long")}</span>
                    </p>
                </header>

                {/* Article Content */}
                <div
                    className="prose prose-lg max-w-none prose-headings:font-bold prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-h2:text-3xl prose-h2:mt-12 prose-h2:mb-6 prose-h3:text-2xl prose-h3:mt-8 prose-h3:mb-4 prose-h4:text-xl prose-h4:mt-6 prose-h4:mb-3 prose-p:text-gray-600 dark:prose-p:text-gray-400 prose-p:leading-relaxed prose-p:mb-6 prose-a:text-gray-600 dark:prose-a:text-gray-400 prose-a:no-underline hover:prose-a:underline prose-strong:text-gray-900 dark:prose-strong:text-gray-100 prose-strong:font-semibold prose-ul:my-6 prose-ul:space-y-2 prose-ol:my-6 prose-ol:space-y-2 prose-li:text-gray-600 dark:prose-li:text-gray-400 prose-code:text-gray-700 dark:prose-code:text-gray-300 prose-code:bg-gray-100 dark:prose-code:bg-slate-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-blockquote:border-l-4 prose-blockquote:border-gray-500 prose-blockquote:pl-6 prose-blockquote:italic prose-blockquote:text-gray-600 dark:prose-blockquote:text-gray-400 transition-colors duration-300"
                    dangerouslySetInnerHTML={{ __html: post.content }}
                />

                {/* Author Bio */}
                <div className="mt-12 p-6 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-sm transition-colors duration-300 ease-in-out">
                    <div className="flex items-start gap-4">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-2xl flex-shrink-0 text-white">
                            {post.author.charAt(0)}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2 transition-colors duration-300">About {post.author}</h3>
                            <p className="text-gray-600 dark:text-gray-400 leading-relaxed transition-colors duration-300">
                                {post.author} is a PDF tools specialist at {SITE_NAME}, dedicated to helping users work more
                                efficiently with digital documents. With expertise in document management, security, and productivity,
                                they provide practical insights and tutorials for everyday PDF tasks.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Share Section */}
                <div className="mt-12 pt-8 border-t border-gray-200 dark:border-slate-700 transition-colors duration-300">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 transition-colors duration-300">Share this article</h3>
                    <div className="flex flex-wrap gap-3">
                        <a
                            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(`${SITE_URL}/blog/${post.slug}`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-700 dark:hover:bg-gray-100 transition-colors duration-300"
                        >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                            </svg>
                            Share on X
                        </a>
                        <a
                            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${SITE_URL}/blog/${post.slug}`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 bg-[#1877F2] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#166FE5] transition-colors duration-300"
                        >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                            </svg>
                            Share on Facebook
                        </a>
                        <a
                            href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`${SITE_URL}/blog/${post.slug}`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 bg-[#0A66C2] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#004182] transition-colors duration-300"
                        >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                            </svg>
                            Share on LinkedIn
                        </a>
                    </div>
                </div>
            </article>

            {/* Related Articles */}
            {relatedPosts.length > 0 && (
                <section className="bg-gray-50 dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 py-12 transition-colors duration-300 ease-in-out">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-8 transition-colors duration-300">Related Articles</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {relatedPosts.map((relatedPost) => (
                                <article key={relatedPost.slug} className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm hover:shadow-lg transition-all duration-300 ease-in-out overflow-hidden">
                                    <div className="h-40 bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700 flex items-center justify-center">
                                        <span className="text-5xl font-black text-white/30">{relatedPost.category.charAt(0)}</span>
                                    </div>
                                    <div className="p-6">
                                        <Link href={`/blog/${relatedPost.slug}`} className="block group">
                                            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors duration-300 mb-2 line-clamp-2">
                                                {relatedPost.title}
                                            </h3>
                                        </Link>
                                        <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-2 mb-4 transition-colors duration-300">{relatedPost.excerpt}</p>
                                        <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 transition-colors duration-300">
                                            <time dateTime={relatedPost.date} suppressHydrationWarning>
                                                {formatDateUTC(relatedPost.date, "short")}
                                            </time>
                                            <span className="mx-2">•</span>
                                            <span>{relatedPost.readTime}</span>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* About GotuPDF Section */}
            <section className="bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700 py-12 transition-colors duration-300 ease-in-out">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4 transition-colors duration-300">About {SITE_NAME}</h2>
                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-6 transition-colors duration-300">
                        {SITE_NAME} is a free online platform that provides professional PDF tools for everyone.
                        We believe document management should be simple, secure, and accessible. Our mission is to
                        help individuals and businesses work more efficiently with digital documents through intuitive
                        tools and educational content.
                    </p>
                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-6 transition-colors duration-300">
                        All our tools are completely free to use, require no registration, and prioritize your privacy
                        and security. Files are processed securely and automatically deleted after processing.
                    </p>
                    <div className="flex flex-wrap gap-4 text-sm">
                        <Link href="/privacy" className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium transition-colors duration-300">
                            Privacy Policy
                        </Link>
                        <span className="text-gray-400 dark:text-gray-600">|</span>
                        <Link href="/about-us" className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium transition-colors duration-300">
                            About Us
                        </Link>
                        <span className="text-gray-400 dark:text-gray-600">|</span>
                        <Link href="/contact-us" className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium transition-colors duration-300">
                            Contact
                        </Link>
                        <span className="text-gray-400 dark:text-gray-600">|</span>
                        <Link href="/disclaimer" className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium transition-colors duration-300">
                            Disclaimer
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    );
}
