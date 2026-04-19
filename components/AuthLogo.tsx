import Link from "next/link";
import Image from "next/image";

export default function AuthLogo() {
    return (
        <Link href="/" className="flex items-center justify-center select-none mb-2">
            <Image
                src="/logo.png"
                alt="GotuPDF Logo"
                width={160}
                height={46}
                priority
                className="w-[140px] md:w-[160px] h-auto object-contain dark:invert"
            />
        </Link>
    );
}
