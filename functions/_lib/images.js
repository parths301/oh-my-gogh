// Image uploads to R2. The type is decided from the file's magic bytes, never from the
// client's Content-Type or file name. Only JPEG, PNG and WebP are accepted (no SVG, no GIF).
import { ApiError } from './http.js';
import { randomId } from './crypto.js';

export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export function sniffImage(bytes) {
  const b = bytes;
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (
    b.length >= 8 &&
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) return 'image/png';
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) return 'image/webp';
  return null;
}

/** Read the single "file" part of a multipart upload, enforcing size and type. */
export async function readUpload(request, maxBytes) {
  const type = (request.headers.get('Content-Type') || '').toLowerCase();
  if (!type.startsWith('multipart/form-data')) throw new ApiError(415, 'unsupported_media_type', 'Upload the image as a form file.');
  const declared = Number(request.headers.get('Content-Length') || 0);
  if (declared > maxBytes + 64 * 1024) throw new ApiError(413, 'too_large', `Image is too large. The limit is ${Math.floor(maxBytes / 1048576)} MB.`);
  let form;
  try {
    form = await request.formData();
  } catch {
    throw new ApiError(400, 'bad_upload', 'Could not read the upload.');
  }
  const file = form.get('file');
  if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') throw new ApiError(400, 'bad_upload', 'Choose an image file.');
  if (file.size === 0) throw new ApiError(400, 'bad_upload', 'That file is empty.');
  if (file.size > maxBytes) throw new ApiError(413, 'too_large', `Image is too large. The limit is ${Math.floor(maxBytes / 1048576)} MB.`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentType = sniffImage(bytes);
  if (!contentType) throw new ApiError(415, 'bad_image_type', 'Only JPEG, PNG or WebP images are accepted.');
  return { bytes, contentType };
}

export function newImageKey(prefix, ownerId, contentType) {
  return `${prefix}/${ownerId}/${randomId(20)}.${EXT[contentType]}`;
}

export async function putImage(bucket, key, bytes, contentType) {
  await bucket.put(key, bytes, { httpMetadata: { contentType, cacheControl: 'public, max-age=31536000, immutable' } });
}

export async function deleteImages(bucket, keys) {
  const list = keys.filter(Boolean);
  if (!list.length) return;
  try {
    await bucket.delete(list);
  } catch (err) {
    console.error('r2 delete failed', err && err.message);
  }
}
