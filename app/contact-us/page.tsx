import { Metadata } from "next";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import ContactForm from "@/components/ContactForm";

export const metadata: Metadata = {
    title: `Contact Us | ${SITE_NAME}`,
    description: "Get in touch with the GotuPDF team for questions, feedback, or support.",
    alternates: {
        canonical: `${SITE_URL}/contact-us`,
    },
};

export default function ContactUsPage() {
    const breadcrumbJsonLd = { "@context": "https://schema.org", "@type": "BreadcrumbList",
        itemListElement: [
            { "@type": "ListItem",
                position: 1,
                name: "Home",
                item: SITE_URL,
            },
            { "@type": "ListItem",
                position: 2,
                name: "Contact",
                item: `${SITE_URL}/contact-us`,
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
                <div className="text-center mb-12">
                    <h1 className="text-3xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">Contact GotuPDF</h1>
                    <p className="text-xl text-gray-500 dark:text-slate-400">
                        If you have any questions, suggestions, or feedback, feel free to contact us.
                        We value user feedback and aim to improve our services continuously.
                    </p>
                </div>

                <div className="max-w-2xl mx-auto">
                    <ContactForm />
                </div>
            </div>
        </div>
    );
}
