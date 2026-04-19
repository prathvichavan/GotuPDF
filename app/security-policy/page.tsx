
import { Metadata } from "next";
import { SITE_NAME } from "@/lib/constants";

export const metadata: Metadata = {
    title: "Security Policy | " + SITE_NAME,
    description: "Security Policy for " + SITE_NAME + ".",
};

export default function SecurityPolicyPage() {
    return (
        <div className="bg-white dark:bg-white/5 min-h-screen py-12 md:py-20">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <h1 className="text-3xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">Security Policy</h1>

                <div className="prose prose-lg dark:prose-invert text-gray-600 dark:text-slate-300 max-w-none">
                    <p>
                        At {SITE_NAME}, we understand that security is critical when handling your PDF documents. We have built our architecture with security as a top priority.
                    </p>

                    <h3>1. Data Transmission Encyrption</h3>
                    <p>
                        All communication between your device and our servers is encrypted using 256-bit SSL (Secure Socket Layer) encryption. This is the same standard used by banks and e-commerce websites. This typically ensures that data cannot be intercepted or read by third parties during transmission.
                    </p>

                    <h3>2. File Handling and Storage</h3>
                    <ul>
                        <li><strong>Isolation:</strong> Each file processing task is handled in an isolated environment.</li>
                        <li><strong>Temporary Storage:</strong> Files are stored only for the duration required to process them and allow you to download the result.</li>
                        <li><strong>Automatic Deletion:</strong> We employ a strict data retention policy. All uploaded and processed files are automatically and permanently deleted from our servers <strong>1 hour</strong> after processing. We do not maintain backups of user files.</li>
                    </ul>

                    <h3>3. Server Security</h3>
                    <p>
                        Our servers are hosted in secure data centers with physical security measures, firewalls, and regular security patches. We strictly limit access to our production environment to authorized personnel only.
                    </p>

                    <h3>4. No User Data Mining</h3>
                    <p>
                        We do not mine, read, or sell the content of your documents. Your files are processed programmatically without human intervention.
                    </p>

                    <h3>5. Reporting Vulnerabilities</h3>
                    <p>
                        If you believe you have found a security vulnerability in our service, please report it to us immediately via our <a href="/contact-us">Contact Page</a>. We appreciate the community's help in keeping {SITE_NAME} secure.
                    </p>
                </div>
            </div>
        </div>
    );
}
