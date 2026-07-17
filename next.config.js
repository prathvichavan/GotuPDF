/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";

// Content Security Policy
const contentSecurityPolicy = [
  "default-src 'self'",

  // Scripts (AdSense + Google Analytics)
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com",

  // Frames
  "frame-src 'self' https://googleads.g.doubleclick.net https://tpc.googlesyndication.com",

  // Images
  "img-src 'self' data: https:",

  // Styles
  "style-src 'self' 'unsafe-inline'",

  // Fonts
  "font-src 'self' data:",

  // Connections (Analytics + AdSense)
  "connect-src 'self' https://www.googletagmanager.com https://www.google-analytics.com https://region1.google-analytics.com https://ep1.adtrafficquality.google https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net",

  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
].join("; ");

const nextConfig = {
  serverExternalPackages: ["pdfkit", "pdfjs-dist"],

  webpack: (config, { isServer }) => {
    config.resolve.alias.canvas = false;
    config.resolve.alias.encoding = false;

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

  typescript: {
    ignoreBuildErrors: true,
  },

  output: "standalone",

  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
        pathname: "/**",
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