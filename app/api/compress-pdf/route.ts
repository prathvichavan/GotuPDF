import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, PDFName, PDFDict, PDFRef, PDFRawStream } from "pdf-lib";
import { decodePDFRawStream } from "pdf-lib/cjs/core";
import { inflateSync } from "node:zlib";
import sharp from 'sharp';
import { withUsageLimit } from "@/lib/usageLimiter";

export async function POST(request: NextRequest) {
    return withUsageLimit(request, async () => {
        try {
            const formData = await request.formData();
            const file = formData.get("file0") as File;
            const compressionLevel = formData.get("compressionLevel") as string || "medium";

            if (!file) {
                return NextResponse.json(
                    { error: "Please upload a PDF file" },
                    { status: 400 }
                );
            }

            const originalSize = file.size;
            const arrayBuffer = await file.arrayBuffer();
            const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });

            // Get compression settings based on level
            const compressionSettings = getCompressionSettings(compressionLevel);

            // Compress images in the PDF by re-encoding image streams when possible.
            const compressedImages = await compressPDFImages(pdfDoc, compressionSettings);

            // Remove unnecessary data
            if (compressionSettings.stripMetadata) {
                removeMetadata(pdfDoc);
            }

            // Save with optimized settings
            const compressedPdfBytes = await pdfDoc.save({
                useObjectStreams: compressionSettings.level !== 'low',
                addDefaultPage: false,
                objectsPerTick: 50,
            });

            const compressedSize = compressedPdfBytes.length;
            const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);

            // Validate the output PDF
            if (compressedSize === 0 || compressedPdfBytes.length < 100) {
                throw new Error("Generated PDF is invalid or empty");
            }

            // Verify PDF can be loaded back
            try {
                await PDFDocument.load(compressedPdfBytes);
            } catch (validationError) {
                throw new Error("Generated PDF is corrupted and cannot be validated");
            }

            // Return the compressed PDF with metadata
            const response = new NextResponse(Buffer.from(compressedPdfBytes), {
                status: 200,
                headers: {
                    "Content-Type": "application/pdf",
                    "Content-Disposition": `attachment; filename=${getFileNameWithoutExtension(file.name)}_compressed.pdf`,
                    "X-Original-Size": originalSize.toString(),
                    "X-Compressed-Size": compressedSize.toString(),
                    "X-Compression-Ratio": `${compressionRatio}%`,
                    "X-Compression-Method": compressedImages > 0 ? "image-reencode" : "structure-only",
                    "X-Compressed-Images": compressedImages.toString(),
                },
            });

            return response;

        } catch (error) {
            console.error("Error compressing PDF:", error);
            return NextResponse.json(
                { error: `Failed to compress PDF: ${error instanceof Error ? error.message : 'Unknown error'}` },
                { status: 500 }
            );
        }
    });
}

/**
 * Get compression settings based on level
 */
function getCompressionSettings(level: string) {
    switch (level) {
        case "low":
            return {
                level: 'low',
                imageQuality: 85,
                maxWidth: 2000,
                maxHeight: 2000,
                convertToGrayscale: false,
                stripMetadata: false,
            };
        case "high":
            return {
                level: 'high',
                imageQuality: 50,
                maxWidth: 1200,
                maxHeight: 1200,
                convertToGrayscale: false,
                stripMetadata: true,
            };
        default: // medium
            return {
                level: 'medium',
                imageQuality: 70,
                maxWidth: 1600,
                maxHeight: 1600,
                convertToGrayscale: false,
                stripMetadata: true,
            };
    }
}

/**
 * Compress images within a PDF document
 */
async function compressPDFImages(pdfDoc: PDFDocument, settings: any): Promise<number> {
    try {
        // Find image XObjects referenced by page resources.
        const pdfImages: Array<{ ref: PDFRef; stream: PDFRawStream }> = [];

        for (const page of pdfDoc.getPages()) {
            const pageNode = (page as any).node;
            const resources = typeof pageNode.Resources === "function"
                ? pageNode.Resources()
                : pageNode.lookup?.(PDFName.of('Resources'), PDFDict);

            if (!(resources instanceof PDFDict)) continue;

            const xObjectDict = resources.lookupMaybe(PDFName.of('XObject'), PDFDict);
            if (!xObjectDict) continue;

            for (const [, value] of xObjectDict.entries()) {
                if (value instanceof PDFRef) {
                    const resolved = pdfDoc.context.lookupMaybe(value, PDFRawStream);
                    if (resolved) {
                        const subtype = resolved.dict.get(PDFName.of('Subtype'));
                        if (subtype && subtype.toString() === '/Image') {
                            pdfImages.push({ ref: value, stream: resolved });
                        }
                    }
                } else if (value instanceof PDFRawStream) {
                    const subtype = value.dict.get(PDFName.of('Subtype'));
                    if (subtype && subtype.toString() === '/Image') {
                        const ref = pdfDoc.context.getObjectRef(value);
                        if (ref) {
                            pdfImages.push({ ref, stream: value });
                        }
                    }
                }
            }
        }

        let compressedCount = 0;

        // Compress each image
        for (const { ref, stream } of pdfImages) {
            try {
                const compressed = await compressImageObject(pdfDoc, ref, stream, settings);
                if (compressed) compressedCount++;
            } catch (error) {
                console.warn('Failed to compress an image:', error);
            }
        }

        return compressedCount;
    } catch (error) {
        console.warn('Error during image compression:', error);
    }

    return 0;
}

/**
 * Compress a specific image object in the PDF
 */
async function compressImageObject(pdfDoc: PDFDocument, ref: any, stream: PDFRawStream, settings: any): Promise<boolean> {
    try {
        const dict = stream.dict;
        const width = dict.get(PDFName.of('Width'));
        const height = dict.get(PDFName.of('Height'));
        const filter = dict.get(PDFName.of('Filter'));
        const colorSpace = dict.get(PDFName.of('ColorSpace'));

        // Skip if already well compressed
        if (filter && (filter.toString().includes('DCTDecode') || filter.toString().includes('JPXDecode'))) {
            return false;
        }

        if (!width || !height) {
            return false;
        }

        const decodedStream = decodePDFRawStream(stream).decode();
        const imageBuffer = Buffer.from(decodedStream);
        const inflatedBuffer = inflatePDFImageBuffer(imageBuffer);

        console.log("compress-pdf image stream", {
            ref: ref.toString(),
            decodedLength: imageBuffer.length,
            inflatedLength: inflatedBuffer?.length ?? null,
            head: Array.from(imageBuffer.slice(0, 16)).map((value) => value.toString(16).padStart(2, "0")).join(" "),
        });

        if (!imageBuffer || imageBuffer.length === 0) {
            return false;
        }

        // Resize if needed
        const shouldResize = Number(width) > settings.maxWidth || Number(height) > settings.maxHeight;

        if (shouldResize || imageBuffer.length > 10000) {
            try {
                const compressedBuffer = await compressWithSharp(imageBuffer, {
                    width: Number(width),
                    height: Number(height),
                    quality: settings.imageQuality,
                    shouldResize,
                    maxWidth: settings.maxWidth,
                    maxHeight: settings.maxHeight,
                    colorSpace,
                    inflatedBuffer,
                });

                // Only use compressed version if it's actually smaller
                if (compressedBuffer.length < imageBuffer.length) {
                    const newDict = dict.clone(pdfDoc.context);
                    newDict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
                    newDict.delete(PDFName.of('DecodeParms'));
                    newDict.delete(PDFName.of('SMask'));
                    newDict.delete(PDFName.of('Mask'));
                    if (newDict.has(PDFName.of('ColorSpace'))) {
                        newDict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceRGB'));
                    }
                    newDict.set(PDFName.of('BitsPerComponent'), pdfDoc.context.obj(8));

                    const compressedStream = PDFRawStream.of(newDict, compressedBuffer);
                    pdfDoc.context.assign(ref, compressedStream);
                    return true;
                }
            } catch (error) {
                // If sharp fails, the image might not be in a supported format
                console.warn('Could not compress image with sharp:', error);
            }
        }
    } catch (error) {
        console.warn('Error compressing image object:', error);
    }

    return false;
}

function getImageChannelCount(colorSpace: any): number | null {
    if (!colorSpace) {
        return null;
    }

    const colorSpaceName = colorSpace.toString();

    if (colorSpaceName === '/DeviceRGB') {
        return 3;
    }

    if (colorSpaceName === '/DeviceGray') {
        return 1;
    }

    if (colorSpaceName === '/DeviceCMYK') {
        return 4;
    }

    return null;
}

async function compressWithSharp(
    buffer: Buffer,
    options: {
        width: number;
        height: number;
        quality: number;
        shouldResize: boolean;
        maxWidth: number;
        maxHeight: number;
        colorSpace: any;
        inflatedBuffer: Buffer | null;
    }
): Promise<Buffer> {
    const resizeOptions = options.shouldResize
        ? { fit: 'inside' as const, withoutEnlargement: true }
        : null;

    try {
        let pipeline = sharp(buffer).jpeg({ quality: options.quality, mozjpeg: true });
        if (resizeOptions) {
            pipeline = pipeline.resize(options.maxWidth, options.maxHeight, resizeOptions);
        }
        return await pipeline.toBuffer();
    } catch (directError) {
        const channels = getImageChannelCount(options.colorSpace);
        if (!channels) {
            throw directError;
        }

        const rawInput = options.inflatedBuffer ?? buffer;

        let pipeline = sharp(rawInput, {
            raw: {
                width: options.width,
                height: options.height,
                channels,
            },
        }).jpeg({ quality: options.quality, mozjpeg: true });

        if (resizeOptions) {
            pipeline = pipeline.resize(options.maxWidth, options.maxHeight, resizeOptions);
        }

        try {
            return await pipeline.toBuffer();
        } catch (rawError) {
            if (rawInput !== buffer) {
                let fallbackPipeline = sharp(rawInput, {
                    raw: {
                        width: options.width,
                        height: options.height,
                        channels,
                    },
                }).jpeg({ quality: options.quality, mozjpeg: true });

                if (resizeOptions) {
                    fallbackPipeline = fallbackPipeline.resize(options.maxWidth, options.maxHeight, resizeOptions);
                }

                return await fallbackPipeline.toBuffer();
            }

            throw rawError;
        }
    }
}

function inflatePDFImageBuffer(buffer: Buffer): Buffer | null {
    if (buffer.length < 2) {
        return null;
    }

    const firstByte = buffer[0];
    const secondByte = buffer[1];
    const looksCompressed = firstByte === 0x78 && (secondByte === 0x01 || secondByte === 0x9c || secondByte === 0xda);

    if (!looksCompressed) {
        return null;
    }

    try {
        return inflateSync(buffer);
    } catch {
        return null;
    }
}

/**
 * Remove metadata from PDF to reduce size
 */
function removeMetadata(pdfDoc: PDFDocument): void {
    try {
        pdfDoc.setTitle('');
        pdfDoc.setAuthor('');
        pdfDoc.setSubject('');
        pdfDoc.setKeywords([]);
        pdfDoc.setProducer('');
        pdfDoc.setCreator('');
    } catch (error) {
        console.warn('Could not remove metadata:', error);
    }
}

/**
 * Get filename without extension
 */
function getFileNameWithoutExtension(filename: string): string {
    return filename.replace(/\.[^/.]+$/, "");
}

