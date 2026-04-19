
import { Metadata } from "next";
import { SITE_NAME } from "@/lib/constants";

export const metadata: Metadata = {
    title: "Cookie Policy | " + SITE_NAME,
    description: "Cookie Policy for " + SITE_NAME + ".",
};

export default function CookiePolicyPage() {
    return (
        <div className="bg-white dark:bg-white/5 min-h-screen py-12 md:py-20">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <h1 className="text-3xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">Cookie Policy</h1>
                <p className="text-gray-500 dark:text-slate-400 mb-8"><strong>Last Updated:</strong> January 1, 2024</p>

                <div className="prose prose-lg dark:prose-invert text-gray-600 dark:text-slate-300 max-w-none">
                    <p>
                        This Cookie Policy explains what cookies are, how {SITE_NAME} uses cookies and similar technologies, and what your choices are regarding these technologies.
                    </p>

                    <h3>1. What are Cookies?</h3>
                    <p>
                        Cookies are small text files that are stored on your computer or mobile device when you visit a website. They are widely used to make websites work, or work more efficiently, as well as to provide reporting information to the site owners.
                    </p>

                    <h3>2. How We Use Cookies</h3>
                    <p>
                        We use cookies for several reasons:
                    </p>
                    <ul>
                        <li><strong>Essential Cookies:</strong> These are necessary for the website to function (e.g., maintaining your session while you process multiple files).</li>
                        <li><strong>Analytics Cookies:</strong> We use these to understand how visitors interact with our website, helping us improve our tools and user experience.</li>
                        <li><strong>Advertising Cookies:</strong> These cookies are used to make advertising messages more relevant to you. They perform functions like preventing the same ad from continuously reappearing, ensuring that ads are properly displayed for advertisers, and in some cases selecting advertisements that are based on your interests.</li>
                    </ul>

                    <h3>3. Google AdSense</h3>
                    <p>
                        We use Google AdSense to serve ads. Google may use advertising cookies to enable it and its partners to serve ads to you based on your visit to {SITE_NAME} and/or other sites on the Internet.
                    </p>
                    <ul>
                        <li>You may opt out of personalized advertising by visiting <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer">Google Ads Settings</a>.</li>
                    </ul>

                    <h3>4. Your Choices</h3>
                    <p>
                        You have the right to decide whether to accept or reject cookies. You can set or amend your web browser controls to accept or refuse cookies. If you choose to reject cookies, you may still use our website though your access to some functionality and areas of our website may be restricted.
                    </p>
                </div>
            </div>
        </div>
    );
}
