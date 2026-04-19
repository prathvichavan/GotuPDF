/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";

// Minimal CSP that allows Google AdSense while keeping defaults tight.
// Note: We keep 'unsafe-inline' to avoid breaking existing inline scripts
// (JSON-LD and consent logic). If you want a stricter CSP, we can add nonces.
const contentSecurityPolicy = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com",
    "frame-src 'self' https://googleads.g.doubleclick.net https://tpc.googlesyndication.com",
    "img-src 'self' data: https:",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "connect-src 'self' https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
].join("; ");

const nextConfig = {
    serverExternalPackages: ["pdfkit", "pdfjs-dist"],
    // Webpack configuration (Turbopack disabled by using --webpack flag)
    webpack: (config, { isServer }) => {
        // Disable problematic modules for client-side
        config.resolve.alias.canvas = false;
        config.resolve.alias.encoding = false;

        // Exclude Node.js modules from client-side bundle
        if (!isServer) {
            config.resolve.fallback = {
                ...config.resolve.fallback,
                fs: false,
                path: false,
                crypto: false,
                stream: false,
                util: false,
                buffer: false,
                zlib: false,
                os: false,
                child_process: false,
            };
        }

        return config;
    },

    // TypeScript configuration
    typescript: {
        ignoreBuildErrors: true,
    },

    // Vercel optimizations
    output: 'standalone',

    images: {
        formats: ['image/avif', 'image/webp'],
        minimumCacheTTL: 60,
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'lh3.googleusercontent.com',
                pathname: '/**',
            },
            {
                protocol: 'https',
                hostname: '*.googleusercontent.com',
                pathname: '/**',
            },
        ],
    },

    compress: true,
    productionBrowserSourceMaps: false,

    async headers() {
        if (!isProd) return [];
        return [
            {
                source: "/(.*)",
                headers: [
                    {
                        key: "Content-Security-Policy",
                        value: contentSecurityPolicy,
                    },
                ],
            },
        ];
    },
};

module.exports = nextConfig;
