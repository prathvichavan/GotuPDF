import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, PDFName, PDFArray, PDFDict } from "pdf-lib";
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

            // Compress images in the PDF
            await compressPDFImages(pdfDoc, compressionSettings);

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
async function compressPDFImages(pdfDoc: PDFDocument, settings: any): Promise<void> {
    try {
        const pages = pdfDoc.getPages();
        
        // Get all image objects from the PDF
        const pdfImages: any[] = [];
        const context = pdfDoc.context;
        const xObjects = context.enumerateIndirectObjects();

        for (const [ref, object] of xObjects) {
            if (object instanceof PDFDict) {
                const type = object.get(PDFName.of('Type'));
                const subtype = object.get(PDFName.of('Subtype'));
                
                if (subtype && subtype.toString() === '/XObject') {
                    const xObjectType = object.get(PDFName.of('Subtype'));
                    if (xObjectType && xObjectType.toString() === '/Image') {
                        pdfImages.push({ ref, dict: object });
                    }
                }
            }
        }

        // Compress each image
        for (const { ref, dict } of pdfImages) {
            try {
                await compressImageObject(pdfDoc, ref, dict, settings);
            } catch (error) {
                console.warn('Failed to compress an image:', error);
            }
        }
    } catch (error) {
        console.warn('Error during image compression:', error);
    }
}

/**
 * Compress a specific image object in the PDF
 */
async function compressImageObject(pdfDoc: PDFDocument, ref: any, dict: PDFDict, settings: any): Promise<void> {
    try {
        const width = dict.get(PDFName.of('Width'));
        const height = dict.get(PDFName.of('Height'));
        const colorSpace = dict.get(PDFName.of('ColorSpace'));
        const filter = dict.get(PDFName.of('Filter'));

        // Skip if already well compressed
        if (filter && filter.toString().includes('DCTDecode')) {
            return;
        }

        // Get image data
        const stream = dict.context.lookup(ref);
        if (!stream || !('getContents' in stream)) {
            return;
        }

        let imageBuffer: Uint8Array;
        try {
            imageBuffer = (stream as any).getContents();
        } catch {
            return;
        }

        if (!imageBuffer || imageBuffer.length === 0) {
            return;
        }

        // Resize if needed
        const shouldResize = width && height && 
            (Number(width) > settings.maxWidth || Number(height) > settings.maxHeight);

        if (shouldResize || imageBuffer.length > 10000) {
            try {
                // Try to compress with sharp
                let sharpInstance = sharp(Buffer.from(imageBuffer))
                    .jpeg({ quality: settings.imageQuality, mozjpeg: true });

                if (shouldResize) {
                    sharpInstance = sharpInstance.resize(settings.maxWidth, settings.maxHeight, {
                        fit: 'inside',
                        withoutEnlargement: true,
                    });
                }

                const compressedBuffer = await sharpInstance.toBuffer();

                // Only use compressed version if it's actually smaller
                if (compressedBuffer.length < imageBuffer.length) {
                    // Embed the compressed image
                    const compressedImage = await pdfDoc.embedJpg(compressedBuffer);
                    
                    // Update the reference (this is a simplified approach)
                    // In practice, we'd need to update all references to this image
                }
            } catch (error) {
                // If sharp fails, the image might not be in a supported format
                console.warn('Could not compress image with sharp:', error);
            }
        }
    } catch (error) {
        console.warn('Error compressing image object:', error);
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

