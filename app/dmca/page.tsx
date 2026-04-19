
import { Metadata } from "next";
import { SITE_NAME } from "@/lib/constants";

export const metadata: Metadata = {
    title: "DMCA Policy | " + SITE_NAME,
    description: "DMCA Copyright Information for " + SITE_NAME + ".",
};

export default function DMCAPage() {
    return (
        <div className="bg-white dark:bg-white/5 min-h-screen py-12 md:py-20">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <h1 className="text-3xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">DMCA Policy</h1>

                <div className="prose prose-lg dark:prose-invert text-gray-600 dark:text-slate-300 max-w-none">
                    <p>
                        {SITE_NAME} respects the intellectual property rights of others. We comply with the Digital Millennium Copyright Act (DMCA) and other applicable copyright laws.
                    </p>

                    <h3>1. Copyright Infringement Notification</h3>
                    <p>
                        If you believe that your copyrighted work has been copied in a way that constitutes copyright infringement and is accessible via the Service, please notify our copyright agent as set forth in the DMCA. For your complaint to be valid under the DMCA, you must provide the following information in writing:
                    </p>
                    <ul>
                        <li>An electronic or physical signature of a person authorized to act on behalf of the copyright owner.</li>
                        <li>Identification of the copyrighted work that you claim has been infringed.</li>
                        <li>Identification of the material that is claimed to be infringing and where it is located on the Service.</li>
                        <li>Information reasonably sufficient to permit {SITE_NAME} to contact you, such as your address, telephone number, and, e-mail address.</li>
                        <li>A statement that you have a good faith belief that use of the material in the manner complained of is not authorized by the copyright owner, its agent, or law.</li>
                        <li>A statement, made under penalty of perjury, that the above information is accurate, and that you are the copyright owner or are authorized to act on behalf of the owner.</li>
                    </ul>

                    <h3>2. Counter-Notice</h3>
                    <p>
                        If you believe that your material was removed or disabled by mistake or misidentification, you may file a counter-notice with us.
                    </p>

                    <h3>3. Repeat Infringers</h3>
                    <p>
                        It is our policy in appropriate circumstances to disable and/or terminate the accounts of users who are repeat infringers.
                    </p>

                    <h3>4. Contact Information</h3>
                    <p>
                        Please send all DMCA notices to our designated Copyright Agent at:
                    </p>
                    <p>
                        <strong>Email:</strong> krishanmohankumar9311@gmail.com<br />
                        <strong>Subject:</strong> DMCA Takedown Request
                    </p>
                </div>
            </div>
        </div>
    );
}
