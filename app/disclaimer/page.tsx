
import { Metadata } from "next";
import { SITE_NAME } from "@/lib/constants";

export const metadata: Metadata = {
    title: "Disclaimer | " + SITE_NAME,
    description: "Disclaimer for " + SITE_NAME + ".",
};

export default function DisclaimerPage() {
    return (
        <div className="bg-white dark:bg-white/5 min-h-screen py-12 md:py-20">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <h1 className="text-3xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">Disclaimer</h1>

                <div className="prose prose-lg dark:prose-invert text-gray-600 dark:text-slate-300 max-w-none">
                    <h3>1. General Disclaimer</h3>
                    <p>
                        The information provided by {SITE_NAME} ("we," "us," or "our") on our website is for general informational purposes only. All information on the Site is provided in good faith, however, we make no representation or warranty of any kind, express or implied, regarding the accuracy, adequacy, validity, reliability, availability, or completeness of any information on the Site.
                    </p>

                    <h3>2. No Professional Advice</h3>
                    <p>
                        The tools and information available on this website do not constitute legal, business, or professional advice. The use of our PDF tools is at your own risk. While we strive to maintain high-quality processing standards, automated conversion and editing tools may occasionally produce errors. You should verify the accuracy of any critical documents processed through our service.
                    </p>

                    <h3>3. External Links Disclaimer</h3>
                    <p>
                        The Site may contain (or you may be sent through the Site to) links to other websites or content belonging to or originating from third parties or links to websites and features in banners or other advertising. Such external links are not investigated, monitored, or checked for accuracy, adequacy, validity, reliability, availability, or completeness by us. We do not warrant, endorse, guarantee, or assume responsibility for the accuracy or reliability of any information offered by third-party websites linked through the Site.
                    </p>

                    <h3>4. File Security and Data Loss</h3>
                    <p>
                        You acknowledge that you transmit files to {SITE_NAME} at your own risk. While we employ security measures like SSL encryption and automatic deletion, we cannot guarantee absolute immunity from unauthorized access or data loss. We explicitly disclaim responsibility for any corruption of data, loss of original files, or interception of data during transmission. <strong>Always keep a local backup of your original documents.</strong>
                    </p>

                    <h3>5. "As Is" Basis</h3>
                    <p>
                        Our Service is provided on an "AS IS" and "AS AVAILABLE" basis. We reserve the right to modify or discontinue the service at any time without notice.
                    </p>
                </div>
            </div>
        </div>
    );
}
