
import { Metadata } from "next";
import { SITE_NAME } from "@/lib/constants";

export const metadata: Metadata = {
    title: "Refund Policy | " + SITE_NAME,
    description: "Refund Policy for " + SITE_NAME + ".",
};

export default function RefundPolicyPage() {
    return (
        <div className="bg-white dark:bg-white/5 min-h-screen py-12 md:py-20">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <h1 className="text-3xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">Refund Policy</h1>

                <div className="prose prose-lg dark:prose-invert text-gray-600 dark:text-slate-300 max-w-none">
                    <h3>1. Free Service</h3>
                    <p>
                        {SITE_NAME} currently offers its PDF tools and services completely free of charge. We do not charge for access, processing, or downloading of files.
                    </p>

                    <h3>2. No Refunds Applicable</h3>
                    <p>
                        Since there are no payments, subscriptions, or fees involved in using our current services, there is no Refund Policy applicable for monetary transactions. Users are free to use the tools as often as they like without financial obligation.
                    </p>

                    <h3>3. Future Changes</h3>
                    <p>
                        Should we introduce paid premium features or subscriptions in the future, we will update this policy to explicitly outline the refund terms, including cooling-off periods and conditions for refunds, in accordance with applicable consumer protection laws.
                    </p>

                    <h3>4. Contact Us</h3>
                    <p>
                        If you have any questions regarding our service model, please contact us at <a href="/contact-us">/contact-us</a>.
                    </p>
                </div>
            </div>
        </div>
    );
}
