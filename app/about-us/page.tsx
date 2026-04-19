
import { Metadata } from "next";
import { SITE_NAME, SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
    title: "About Us | " + SITE_NAME,
    description: "Learn about the team, mission, and product focus behind GotuPDF.",
    alternates: {
        canonical: `${SITE_URL}/about-us`,
    },
};

export default function AboutUsPage() {
    const breadcrumbJsonLd = { "@context": "https://schema.org", "@type": "BreadcrumbList",
        itemListElement: [
            { "@type": "ListItem",
                position: 1,
                name: "Home",
                item: SITE_URL,
            },
            { "@type": "ListItem",
                position: 2,
                name: "About Us",
                item: `${SITE_URL}/about-us`,
            },
        ],
    };

    return (
        <div className="bg-white dark:bg-white/5 min-h-screen py-12 md:py-20">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
            />
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <h1 className="text-3xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">About GotuPDF</h1>

                <div className="prose prose-lg dark:prose-invert text-gray-600 dark:text-slate-300 max-w-none space-y-6">
                    <p className="text-lg leading-relaxed">
                        GotuPDF was created with one simple goal: to make working with PDF documents easy, fast, and accessible for everyone. We understand that not everyone has access to expensive software or technical knowledge, yet many people need simple tools to manage their documents in daily life.
                    </p>

                    <p className="text-lg leading-relaxed">
                        Our platform provides a collection of online PDF tools that help users compress, merge, split, and convert PDF files directly from their browser. Whether you are a student submitting assignments, a professional sharing reports, or a developer managing documentation, GotuPDF is designed to support your workflow without unnecessary complexity.
                    </p>

                    <p className="text-lg leading-relaxed">
                        We focus on simplicity and usability. Every tool on our website is built to be straightforward, so users can complete their tasks in just a few clicks. There is no requirement to download software or create an account. This makes our platform convenient for quick and efficient document handling.
                    </p>

                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-8 mb-4">Our Purpose</h2>
                    <p className="text-lg leading-relaxed">
                        The purpose of GotuPDF is to provide reliable and practical document solutions for everyday use. We aim to reduce the time and effort people spend managing PDF files by offering tools that work directly online. Our services are designed to be helpful, lightweight, and accessible across all devices, including desktops, tablets, and mobile phones.
                    </p>

                    <p className="text-lg leading-relaxed">
                        We continuously improve our tools based on user needs and feedback. Our goal is to create a platform that users can trust for their document-related tasks.
                    </p>

                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-8 mb-4">Privacy and User Safety</h2>
                    <p className="text-lg leading-relaxed">
                        User privacy is very important to us. Files uploaded to GotuPDF are processed securely and are not stored permanently on our servers. Uploaded documents are automatically removed after processing to protect user data and confidentiality.
                    </p>

                    <p className="text-lg leading-relaxed">
                        We do not analyze, share, or misuse user files. Our platform is designed to respect user privacy while providing reliable functionality.
                    </p>

                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-8 mb-4">Who Can Use GotuPDF</h2>
                    <p className="text-lg leading-relaxed">GotuPDF is suitable for:</p>
                    <ul className="list-disc pl-6 space-y-2">
                        <li>Students working on assignments and projects</li>
                        <li>Teachers and educators preparing documents</li>
                        <li>Professionals handling reports and official files</li>
                        <li>Developers and researchers working with technical documents</li>
                        <li>Anyone who needs quick PDF solutions without complexity</li>
                    </ul>

                    <p className="text-lg leading-relaxed">
                        Our tools are built for users from different backgrounds, regardless of technical experience.
                    </p>

                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-8 mb-4">Our Commitment</h2>
                    <p className="text-lg leading-relaxed">
                        We are committed to maintaining a clean, easy-to-use, and informative website. Our content is written to help users understand what each tool does and how to use it effectively. We avoid misleading claims and focus on transparency and usefulness.
                    </p>

                    <p className="text-lg leading-relaxed">
                        GotuPDF is continuously evolving, and we plan to add more features and improvements to better serve our users in the future.
                    </p>

                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-8 mb-4">Contact and Feedback</h2>
                    <p className="text-lg leading-relaxed">
                        We value feedback from our users. Suggestions and improvement ideas help us grow and improve our platform. If you have any questions or feedback, you can reach us through our <a href="/contact-us" className="text-indigo-400 hover:underline">Contact page</a>.
                    </p>
                </div>
            </div>
        </div>
    );
}
