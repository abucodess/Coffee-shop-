/**
 * Supabase Storage helper for product images.
 *
 * Uploads compressed WebP blobs to the `product-images` public bucket
 * with unique UUID-based filenames.
 */

import { supabase, isSupabaseConfigured } from "./supabase";

const BUCKET = "product-images";

/**
 * Upload a compressed WebP blob to Supabase Storage.
 *
 * @returns The public URL for the uploaded image, or null on failure.
 */
export async function uploadProductImage(blob: Blob): Promise<string> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured");
  }

  const fileName = `${crypto.randomUUID()}.webp`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, blob, {
      contentType: "image/webp",
      cacheControl: "31536000", // 1 year — images are immutable (new upload = new UUID)
      upsert: false,
    });

  if (uploadError) {
    console.error("Product image upload failed:", uploadError);
    throw new Error("Unable to upload the image. Please try again.");
  }

  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(fileName);

  if (!urlData?.publicUrl) {
    throw new Error("Unable to upload the image. Please try again.");
  }

  return urlData.publicUrl;
}
