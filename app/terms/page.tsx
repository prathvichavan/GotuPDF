import { Metadata } from 'next';
import Link from 'next/link';
import { SITE_NAME, SITE_URL, CONTACT_EMAIL } from '@/lib/constants';

export const metadata: Metadata = {
    title: `Terms & Conditions – ${SITE_NAME}`,
    description: `Official Terms of Service for using ${SITE_NAME} online PDF tools. Understanding your rights and responsibilities when using our free PDF services.`,
    openGraph: {
        title: `Terms & Conditions – ${SITE_NAME}`,
        description: `Official Terms of Service for using ${SITE_NAME} online PDF tools.`,
    },
};

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-white dark:bg-white/5 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Terms and Conditions</h1>
                    <p className="text-lg text-gray-500 dark:text-slate-400">
                        <strong>Last Updated:</strong> January 1, 2026
                    </p>
                </div>

                {/* Introduction */}
                <div className="prose prose-lg max-w-none">
                    <p className="text-gray-600 dark:text-slate-300 leading-relaxed mb-6">
                        By using GotuPDF, you agree to use our services responsibly and legally. Users are 
                        responsible for the content they upload and process using our tools. We do not claim ownership 
                        of uploaded files and do not permanently store documents.
                    </p>
                    <p className="text-gray-600 dark:text-slate-300 leading-relaxed mb-8">
                        We reserve the right to modify or discontinue services at any time without prior notice.
                    </p>

                    {/* Section 1 */}
                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">1. Eligibility</h2>
                        <p className="text-gray-600 dark:text-slate-300 leading-relaxed">
                            You must be at least 13 years old to use this Service. By using our Service, you represent and
                            warrant that you meet this age requirement.
                        </p>
                    </section>

                    {/* Section 2 */}
                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">2. Use of Service</h2>
                        <p className="text-gray-600 dark:text-slate-300 leading-relaxed mb-4">
                            GotuPDF provides online PDF tools including merge, split, compress, convert, and edit tools.
                            You agree to use these services only for lawful purposes.
                        </p>
                        <p className="text-gray-600 dark:text-slate-300 leading-relaxed mb-3">You agree NOT to:</p>
                        <ul className="list-disc pl-6 text-gray-600 dark:text-slate-300 space-y-2 mb-4">
                            <li>Upload illegal, abusive, copyrighted, or harmful content</li>
                            <li>Upload viruses, malware, or malicious scripts</li>
                            <li>Abuse, overload, scrape, or disrupt our servers</li>
                            <li>Attempt unauthorized access to our systems or networks</li>
                            <li>Use the Service for any commercial purpose without our prior written consent</li>
                        </ul>
                    </section>

                    {/* Section 3 */}
                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">3. User Files & Content</h2>
                        <p className="text-gray-600 dark:text-slate-300 leading-relaxed mb-3">
                            <strong>You retain ownership of your files.</strong>
                        </p>
                        <p className="text-gray-600 dark:text-slate-300 leading-relaxed mb-3">
                            By uploading, you grant GotuPDF a limited temporary license to process your files only to
                            provide the service. This license is worldwide, non-exclusive, and royalty-free, and it terminates
                            immediately upon deletion of your content from our servers.
                        </p>
                        <p className="text-gray-600 dark:text-slate-300 leading-relaxed mb-3">
                            <strong>All uploaded files are automatically deleted within 1 hour.</strong>
                        </p>
                        <p className="text-gray-600 dark:text-slate-300 leading-relaxed">
                            We do not claim ownership of your content. We do not read, analyze, or access the content of your files.
                        </p>
                    </section>

                    {/* Section 4 */}
                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">4. Intellectual Property</h2>
                        <p className="text-gray-600 dark:text-slate-300 leading-relaxed mb-4">
                            All website content, branding, software, and designs are the exclusive property of GotuPDF
                            and its licensors. The Service is protected by copyright, trademark, and other laws of India and
                            foreign countries.
                        </p>
                        <p className="text-gray-600 dark:text-slate-300 leading-relaxed">
                            Our trademarks and trade dress may not be used in connection with any product or service without
                            the prior written consent of GotuPDF.
                        </p>
                    </section>

                    {/* Section 5 */}
                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">5. Disclaimer</h2>
                        <p className="text-gray-600 dark:text-slate-300 leading-relaxed mb-3">
                            The Service is provided "as is" without warranties of any kind, whether express or implied,
                            including but not limited to implied warranties of merchantability, fitness for a particular
                            purpose, non-infringement, or course of performance.
                        </p>
                        <p className="text-gray-600 dark:text-slate-300 leading-relaxed">
                            <strong>Always keep your own backup of original files.</strong> We are not responsible for any
                            loss of data or corruption of files processed through our Service.
                        </p>
                    </section>

                    {/* Section 6 */}
                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">6. Limitation of Liability</h2>
                        <p className="text-gray-600 dark:text-slate-300 leading-relaxed mb-4">
                            GotuPDF shall not be liable for any loss of data, profit, or business interruption. In no
                            event shall GotuPDF, nor its directors, employees, partners, agents, suppliers, or affiliates,
                            be liable for any indirect, incidental, special, consequential, or punitive damages.
                        </p>
                        <p className="text-gray-600 dark:text-slate-300 leading-relaxed mb-3">
                            <strong>Specifically, we are not responsible for:</strong>
                        </p>
                        <ul className="list-disc pl-6 text-gray-600 dark:text-slate-300 space-y-2 mb-4">
                            <li>Any loss of data or corruption of files processed through our Service</li>
                            <li>Any errors or inaccuracies in the conversion results</li>
                            <li>Unauthorized access, use, or alteration of your transmissions or content</li>
                            <li>Any conduct or content of any third party on the Service</li>
                        </ul>
                    </section>

                    {/* Section 7 */}
                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">7. Availability of Service</h2>
                        <p className="text-gray-600 dark:text-slate-300 leading-relaxed">
                            We may change, suspend, or discontinue any part of the Service at any time without notice. We
                            reserve the right to modify, suspend, or discontinue the Service, partially or fully, at any time
                            without prior notice. We shall not be liable to you or any third party for any modification,
                            suspension, or discontinuance of the Service.
                        </p>
                    </section>

                    {/* Section 8 */}
                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">8. Termination</h2>
                        <p className="text-gray-600 dark:text-slate-300 leading-relaxed">
                            We reserve the right to suspend or permanently block users who violate these Terms. We may
                            terminate or suspend your access immediately, without prior notice or liability, for any reason
                            whatsoever, including without limitation if you breach the Terms.
                        </p>
                    </section>

                    {/* Section 9 */}
                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">9. Pricing & Refunds</h2>
                        <p className="text-gray-600 dark:text-slate-300 leading-relaxed mb-3">
                            Currently, GotuPDF is offered free of charge.
                        </p>
                        <p className="text-gray-600 dark:text-slate-300 leading-relaxed">
                            If paid plans are introduced, refund policies will be published separately. Any pricing changes
                            will be communicated in advance.
                        </p>
                    </section>

                    {/* Section 10 */}
                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">10. Governing Law</h2>
                        <p className="text-gray-600 dark:text-slate-300 leading-relaxed">
                            These Terms are governed by the laws of India, without regard to its conflict of law provisions.
                            Any disputes arising from these Terms or the Service shall be subject to the exclusive jurisdiction
                            of the courts of India.
                        </p>
                    </section>

                    {/* Section 11 */}
                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">11. Changes to Terms</h2>
                        <p className="text-gray-600 dark:text-slate-300 leading-relaxed">
                            We may update these Terms at any time. We will notify you of any changes by posting the new Terms
                            on this page with an updated "Last Updated" date. Continued use means acceptance. By continuing to
                            access or use our Service after those revisions become effective, you agree to be bound by the
                            revised terms.
                        </p>
                    </section>

                    {/* Section 12 */}
                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">12. Contact Information</h2>
                        <div className="bg-white dark:bg-white/5 p-6 rounded-lg border border-gray-200 dark:border-white/10">
                            <p className="text-gray-600 dark:text-slate-300 mb-2">
                                If you have any questions about these Terms, please contact us:
                            </p>
                            <p className="text-gray-600 dark:text-slate-300 mb-2">
                                <strong>Support Email:</strong>{' '}
                                <a href={`mailto:${CONTACT_EMAIL}`} className="text-indigo-400 hover:text-indigo-300">
                                    {CONTACT_EMAIL}
                                </a>
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
