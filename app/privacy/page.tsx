import { Metadata } from 'next';
import Link from 'next/link';
import { SITE_NAME, SITE_URL, CONTACT_EMAIL } from '@/lib/constants';

export const metadata: Metadata = {
    title: `Privacy Policy – ${SITE_NAME}`,
    description: `Learn how ${SITE_NAME} protects your privacy and files while using our online PDF tools. Compliant with GDPR, CCPA, DPDP (India), and Google AdSense policies.`,
    openGraph: {
        title: `Privacy Policy – ${SITE_NAME}`,
        description: `Learn how ${SITE_NAME} protects your privacy and files while using our online PDF tools.`,
    },
};

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-white dark:bg-white/5 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Privacy Policy</h1>
                    <p className="text-lg text-gray-500 dark:text-slate-400">
                        <strong>Effective Date:</strong> January 1, 2024
                    </p>
                    <p className="text-lg text-gray-500 dark:text-slate-400 mt-2">
                        <strong>Last Updated:</strong> January 1, 2026
                    </p>
                </div>

                {/* Introduction */}
                <div className="prose prose-lg max-w-none">
                    <p className="text-gray-600 dark:text-slate-300 leading-relaxed mb-6">
                        This Privacy Policy applies to the website <strong>{SITE_URL}</strong>, operated by{' '}
                        <strong>GotuPDF</strong>.
                    </p>
                    <p className="text-gray-600 dark:text-slate-300 leading-relaxed mb-8">
                        We respect your privacy and are committed to protecting personally identifiable information you may
                        provide us through the Website. We have adopted this Privacy Policy to explain what information may be
                        collected on our Website, how we use this information, and under what circumstances we may disclose
                        the information to third parties.
                    </p>

                    {/* Section 1 */}
                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">1. Information We Collect</h2>

                        <h3 className="text-xl font-semibold text-gray-700 dark:text-slate-200 mb-3">1.1 Personal Information</h3>
                        <p className="text-gray-600 dark:text-slate-300 leading-relaxed mb-4">
                            We do not require user registration to use our PDF tools. We do not collect personal identifiers
                            such as your name, address, or phone number unless voluntarily provided via contact forms.
                        </p>

                        <h3 className="text-xl font-semibold text-gray-700 dark:text-slate-200 mb-3">1.2 Usage & Analytics Data</h3>
                        <p className="text-gray-600 dark:text-slate-300 leading-relaxed mb-4">
                            We automatically collect certain information when you visit, use, or navigate the Website. This
                            information may include IP address, browser type, operating system, device type, referring URLs,
                            and pages visited. This data is used for security, analytics, and performance monitoring purposes.
                            Log data is automatically deleted within 30 days.
                        </p>

                        <h3 className="text-xl font-semibold text-gray-700 dark:text-slate-200 mb-3">1.3 User Files (PDFs and Documents)</h3>
                        <p className="text-gray-600 dark:text-slate-300 leading-relaxed mb-3">
                            When you use our PDF conversion, merging, or editing tools, you upload files to our servers.
                            <strong> We hold user privacy paramount regarding these files:</strong>
                        </p>
                        <ul className="list-disc pl-6 text-gray-600 dark:text-slate-300 space-y-2 mb-4">
                            <li><strong>Processing:</strong> Uploaded PDF files are processed only for the requested operation.</li>
                            <li><strong>Storage:</strong> Files are processed only for the requested operation. We do not permanently store uploaded files. Files are removed immediately after processing or after the requested operation is completed.</li>
                            <li><strong>Encryption:</strong> Files are transferred using SSL/TLS encryption.</li>
                            <li><strong>Privacy:</strong> We do not read, analyze, or access the content of your files.</li>
                        </ul>
                    </section>

                    {/* Section 2 */}
                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">2. Cookies & Tracking Technologies</h2>
                        <p className="text-gray-600 dark:text-slate-300 leading-relaxed mb-4">
                            We use cookies and similar tracking technologies (like web beacons and pixels) to personalize content,
                            provide social features, analyze traffic, and serve ads.
                        </p>
                        <p className="text-gray-600 dark:text-slate-300 leading-relaxed mb-4">
                            Users can manage or disable cookies via browser settings. Cookie usage follows consent-based policy.
                            For more details, please see our{' '}
                            <Link href="/cookie-policy" className="text-indigo-400 hover:text-indigo-300 underline">
                                Cookie Policy
                            </Link>.
                        </p>
                    </section>

                    {/* Section 3 */}
                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">3. Google AdSense & Third-Party Advertising</h2>
                        <p className="text-gray-600 dark:text-slate-300 leading-relaxed mb-4">
                            We use Google AdSense to display advertisements. Google and its partners use cookies, including the
                            DoubleClick cookie, to serve ads based on your prior visits to our website or other websites on the Internet.
                        </p>
                        <ul className="list-disc pl-6 text-gray-600 dark:text-slate-300 space-y-2 mb-4">
                            <li>Google's use of advertising cookies enables it and its partners to serve ads to users based on their visits to our sites and/or other sites on the Internet.</li>
                            <li>Users may opt out of personalized advertising by visiting{' '}
                                <a
                                    href="https://www.google.com/settings/ads"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-indigo-400 hover:text-indigo-300 underline"
                                >
                                    Google Ads Settings
                                </a>.
                            </li>
                        </ul>
                        <p className="text-gray-600 dark:text-slate-300 leading-relaxed mb-4">
                            Third-party vendors, including Google, use cookies to serve ads based on a user's prior visits.
                            We have no control over the content of the advertisements or the data collected by these third-party advertisers.
                        </p>
                    </section>

                    {/* Section 4 */}
                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">4. Children's Information</h2>
                        <p className="text-gray-600 dark:text-slate-300 leading-relaxed mb-4">
                            We do not knowingly collect data from children under 13 years of age. If we become aware that we have
                            collected personal information from children without verification of parental consent, we take steps to
                            permanently remove that information from our servers.
                        </p>
                    </section>

                    {/* Section 5 */}
                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">5. GDPR Data Protection Rights</h2>
                        <p className="text-gray-600 dark:text-slate-300 leading-relaxed mb-4">
                            We would like to make sure you are fully aware of all of your data protection rights. Every user is
                            entitled to the following:
                        </p>
                        <ul className="list-disc pl-6 text-gray-600 dark:text-slate-300 space-y-2 mb-4">
                            <li><strong>The right to access:</strong> You have the right to request copies of your personal data.</li>
                            <li><strong>The right to rectification:</strong> You have the right to request that we correct any information you believe is inaccurate or incomplete.</li>
                            <li><strong>The right to erasure:</strong> You have the right to request that we erase your personal data, under certain conditions.</li>
                            <li><strong>The right to restrict processing:</strong> You have the right to request that we restrict the processing of your personal data, under certain conditions.</li>
                            <li><strong>The right to data portability:</strong> You have the right to request that we transfer the data that we have collected to another organization, or directly to you, under certain conditions.</li>
                        </ul>
                        <p className="text-gray-600 dark:text-slate-300 leading-relaxed mb-4">We process data based on:</p>
                        <ul className="list-disc pl-6 text-gray-600 dark:text-slate-300 space-y-2 mb-4">
                            <li>(a) User consent</li>
                            <li>(b) Legal obligations</li>
                            <li>(c) Legitimate interest</li>
                            <li>(d) Contractual necessity</li>
                        </ul>
                    </section>

                    {/* Section 6 */}
                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">6. CCPA Privacy Rights (California)</h2>
                        <p className="text-gray-600 dark:text-slate-300 leading-relaxed mb-4">
                            Under the California Consumer Privacy Act (CCPA), California consumers have the right to:
                        </p>
                        <ul className="list-disc pl-6 text-gray-600 dark:text-slate-300 space-y-2 mb-4">
                            <li>Request disclosure of the categories and specific pieces of personal data that we have collected about you.</li>
                            <li>Request deletion of any personal data about you that we have collected.</li>
                            <li>Request that we do not sell your personal data (Note: We do not sell personal data).</li>
                            <li>Opt-out of the sale of personal data.</li>
                        </ul>
                    </section>

                    {/* Section 7 */}
                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">7. DPDP (India) Compliance</h2>
                        <p className="text-gray-600 dark:text-slate-300 leading-relaxed mb-4">
                            We comply with the Digital Personal Data Protection Act (DPDP), 2023 of India. Users in India have
                            rights to access, correction, and deletion of their personal data. We process data lawfully and
                            transparently, ensuring data minimization and purpose limitation.
                        </p>
                    </section>

                    {/* Section 8 */}
                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">8. Data Security</h2>
                        <p className="text-gray-600 dark:text-slate-300 leading-relaxed mb-4">
                            The security of your data is important to us. We use industry-standard security practices to protect
                            your information. However, no method of transmission over the Internet or method of electronic storage
                            is 100% secure. While we strive to use commercially acceptable means to protect your personal data,
                            we cannot guarantee its absolute security.
                        </p>
                        <p className="text-gray-600 dark:text-slate-300 leading-relaxed mb-4">
                            For more details, please refer to our{' '}
                            <Link href="/security-policy" className="text-indigo-400 hover:text-indigo-300 underline">
                                Security Policy
                            </Link>.
                        </p>
                    </section>

                    {/* Section 9 */}
                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">9. Changes to This Privacy Policy</h2>
                        <p className="text-gray-600 dark:text-slate-300 leading-relaxed mb-4">
                            We may update this Privacy Policy from time to time. We will notify you of any changes by posting
                            the new Privacy Policy on this page with an updated "Last Updated" date. You are advised to review
                            this Privacy Policy periodically for any changes. Changes to this Privacy Policy are effective when
                            they are posted on this page.
                        </p>
                    </section>

                    {/* Section 10 */}
                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">10. Contact Information</h2>
                        <div className="bg-white dark:bg-white/5 p-6 rounded-lg border border-gray-200 dark:border-white/10">
                            <p className="text-gray-600 dark:text-slate-300 mb-2">
                                If you have any questions about this Privacy Policy, please contact us:
                            </p>
                            <p className="text-gray-600 dark:text-slate-300 mb-2">
                                <strong>Email:</strong>{' '}
                                <a href={`mailto:${CONTACT_EMAIL}`} className="text-indigo-400 hover:text-indigo-300">
                                    {CONTACT_EMAIL}
                                </a>
                            </p>
                            <p className="text-gray-600 dark:text-slate-300 mb-2">
                                <strong>Location:</strong> India
                            </p>
                            <p className="text-gray-600 dark:text-slate-300">
                                <strong>Contact Page:</strong>{' '}
                                <Link href="/contact-us" className="text-indigo-400 hover:text-indigo-300 underline">
                                    /contact-us
                                </Link>
                            </p>
                        </div>
                    </section>

                    {/* Back to Home */}
                    <div className="mt-12 pt-8 border-t border-gray-200 dark:border-white/10">
                        <Link
                            href="/"
                            className="inline-flex items-center text-indigo-400 hover:text-indigo-300 font-medium"
                        >
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            Back to Home
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
