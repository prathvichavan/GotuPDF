export interface FileNameParts {
    base: string;
    ext: string;
}

export function splitFileName(name: string): FileNameParts {
    const trimmed = (name || "").trim();
    if (!trimmed) {
        return { base: "", ext: "" };
    }
    const lastDot = trimmed.lastIndexOf(".");
    if (lastDot > 0 && lastDot < trimmed.length - 1) {
        return { base: trimmed.slice(0, lastDot), ext: trimmed.slice(lastDot) };
    }
    return { base: trimmed, ext: "" };
}

export function sanitizeFileNamePart(part: string): string {
    return (part || "").replace(/[\\/:*?"<>|]+/g, "_").trim();
}

export function buildDownloadName(base: string, extension: string, fallbackName: string): string {
    const fallback = splitFileName(fallbackName);
    const safeBase = sanitizeFileNamePart(base || fallback.base || "download");
    const rawExt = extension || fallback.ext;
    if (!rawExt) {
        return safeBase;
    }
    const safeExt = rawExt.startsWith(".") ? rawExt : `.${rawExt}`;
    return `${safeBase}${safeExt}`;
}
