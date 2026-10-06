/**
 * Browser-side image validation, compression, and WebP conversion.
 * Uses Canvas API — zero external dependencies.
 */

const ACCEPTED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const MAX_DIMENSION = 1000; // px
const WEBP_QUALITY = 0.8;

export interface CompressedImage {
  /** Compressed WebP blob ready for upload */
  blob: Blob;
  /** Object URL for preview (caller must revoke when done) */
  previewUrl: string;
  /** Width after resize */
  width: number;
  /** Height after resize */
  height: number;
}

export class ImageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageValidationError";
  }
}

/**
 * Validate, resize, and compress an image file to WebP.
 *
 * Flow:
 * 1. Validate MIME type
 * 2. Validate file size (≤ 2 MB)
 * 3. Decode into an Image element
 * 4. Calculate target dimensions (max 1000×1000, never upscale)
 * 5. Draw to an off-screen canvas
 * 6. Export as WebP at ~80% quality
 * 7. Return the blob + preview URL
 */
export async function compressProductImage(
  file: File,
): Promise<CompressedImage> {
  // 1. Validate type
  if (!ACCEPTED_TYPES.has(file.type)) {
    throw new ImageValidationError(
      "Please upload a JPG, PNG, or WebP image.",
    );
  }

  // 2. Validate size
  if (file.size > MAX_FILE_SIZE) {
    throw new ImageValidationError("Image must be smaller than 2 MB.");
  }

  // 3. Decode image
  const img = await loadImage(file);

  // 4. Calculate target dimensions (preserve aspect ratio, never upscale)
  let { naturalWidth: w, naturalHeight: h } = img;
  if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
    const scale = Math.min(MAX_DIMENSION / w, MAX_DIMENSION / h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  // 5. Draw to canvas
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new ImageValidationError(
      "Unable to process this image. Please try another image.",
    );
  }
  ctx.drawImage(img, 0, 0, w, h);

  // 6. Export as WebP
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", WEBP_QUALITY),
  );

  if (!blob) {
    throw new ImageValidationError(
      "Unable to process this image. Please try another image.",
    );
  }

  // 7. Create preview URL
  const previewUrl = URL.createObjectURL(blob);

  return { blob, previewUrl, width: w, height: h };
}

/** Helper: load a File into an HTMLImageElement */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(
        new ImageValidationError(
          "Unable to process this image. Please try another image.",
        ),
      );
    };
    img.src = url;
  });
}
