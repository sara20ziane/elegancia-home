import { cropRect, type ImageFrame } from "./image-frame";
import { getSupabase } from "./supabase/client";

/**
 * Product image handling.
 *
 * A photo straight off an Algerian phone is typically 3-5 MB at 4000px, which is
 * a bad thing to upload over mobile data and a worse thing to serve to a buyer
 * on 3G. Everything is therefore decoded, scaled down and re-encoded in the
 * browser before it is sent, which turns a 4 MB photo into roughly 150-300 KB.
 *
 * WebP first with a JPEG fallback: WebP is 25-35% smaller at the same quality
 * and is supported by every browser that can run this app, but the encoding path
 * is version-dependent, so the fallback is not optional.
 */

const MAX_EDGE = 1600;
const QUALITY = 0.82;
const BUCKET = "product-media";

export type UploadOutcome = { url: string | null; error: string | null };

/** Decode a file into a bitmap, whichever route the browser supports. */
async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // Falls through to the <img> path below.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("That file is not a readable image."));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function dimensions(source: ImageBitmap | HTMLImageElement): { w: number; h: number } {
  if ("naturalWidth" in source) {
    return { w: source.naturalWidth, h: source.naturalHeight };
  }
  return { w: source.width, h: source.height };
}

/**
 * Scale so the longest edge is `MAX_EDGE`. Images already smaller are left at
 * their own size rather than upscaled — enlarging a 600px photo only makes the
 * file bigger without adding detail.
 */
async function resizeImage(file: File, frame?: ImageFrame): Promise<Blob> {
  const source = await decode(file);
  const full = dimensions(source);
  if (full.w * full.h > 50_000_000) {
    if ("close" in source) source.close();
    throw new Error("Image dimensions are too large.");
  }
  const { sx, sy, cw: w, ch: h } = cropRect(full.w, full.h, frame);
  const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
  const width = Math.max(1, Math.round(w * scale));
  const height = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot process images.");

  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source as CanvasImageSource, sx, sy, w, h, 0, 0, width, height);
  if ("close" in source) source.close();

  const asWebp = await toBlob(canvas, "image/webp");
  if (asWebp) return asWebp;
  const asJpeg = await toBlob(canvas, "image/jpeg");
  if (asJpeg) return asJpeg;

  throw new Error("This browser cannot encode the image.");
}

function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, QUALITY);
  });
}

function extensionFor(type: string): string {
  if (type === "image/webp") return "webp";
  if (type === "image/png") return "png";
  if (type === "image/avif") return "avif";
  return "jpg";
}

/**
 * Upload one product image and return its public URL.
 *
 * The object path is `products/<productId>/<random>.<ext>`. Randomising the
 * filename means replacing an image never overwrites the old bytes, so a CDN or
 * a browser holding the old URL cannot serve a stale photo — and it removes any
 * need to sanitise a user-supplied filename.
 */
export async function uploadProductImage(
  file: File,
  productId: string,
  frame?: ImageFrame,
): Promise<UploadOutcome> {
  if (
    !["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"].includes(file.type) ||
    file.size > 20 * 1024 * 1024
  ) {
    return { url: null, error: "That file is not an image." };
  }

  let blob: Blob;
  try {
    blob = await resizeImage(file, frame);
  } catch (error) {
    return {
      url: null,
      error: error instanceof Error ? error.message : "Could not read that image.",
    };
  }

  // The bucket caps at 8 MB; resizing makes this almost impossible to hit, but
  // checking here gives a readable message instead of a storage error.
  if (blob.size > 8 * 1024 * 1024) {
    return { url: null, error: "That image is too large even after resizing." };
  }

  const path = `products/${productId}/${crypto.randomUUID()}.${extensionFor(blob.type)}`;

  const { error } = await getSupabase()
    .storage.from(BUCKET)
    .upload(path, blob, { contentType: blob.type, upsert: false });

  if (error) return { url: null, error: error.message };

  const { data } = getSupabase().storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, error: null };
}

/**
 * Best-effort removal of an uploaded object. Called when a variant image row is
 * deleted so storage does not accumulate orphans.
 *
 * Failure is swallowed on purpose: a leftover object costs fractions of a
 * dinar, and blocking the user's delete on a storage hiccup would be worse.
 */
export async function deleteProductImage(publicUrl: string): Promise<void> {
  const marker = `/${BUCKET}/`;
  const index = publicUrl.indexOf(marker);
  if (index === -1) return;
  const path = decodeURIComponent(publicUrl.slice(index + marker.length));
  await getSupabase()
    .storage.from(BUCKET)
    .remove([path])
    .catch(() => undefined);
}
