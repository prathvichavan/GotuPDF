import { Metadata } from 'next';
import { SITE_NAME, SITE_URL } from '@/lib/constants';

export const metadata: Metadata = {
    title: `Blog - PDF Guides, Tutorials & Document Tips | ${SITE_NAME}`,
    description: 'Expert guides, tutorials, and tips on PDF management, document security, file conversion, and productivity tools.',
    alternates: {
        canonical: `${SITE_URL}/blog`,
    },
};

export default function BlogLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
