// lib/storage.ts
// ── Cloudflare R2 storage abstraction ────────────────────────────────────────
// All media uploads (avatars, vendor images, reels) go to Cloudflare R2.
// R2 signing is handled by the Vendr backend API at /api/storage/sign

import { apiFetch } from "./api";
import { File } from 'expo-file-system/next';

const R2_PUBLIC_URL = process.env.EXPO_PUBLIC_CF_PUBLIC_URL ?? '';

export type StorageBucket = 'vendor-images' | 'avatars' | 'reels' | 'chat-images';

// ── Upload a file (uri) to R2 ────────────────────────────────────────────────
export async function uploadFile(params: {
  bucket: StorageBucket;
  path: string;        // e.g. 'user-id/avatar.jpg'
  uri: string;         // local file URI
  contentType: string; // e.g. 'image/jpeg'
}): Promise<string> {
  const { bucket, path, uri, contentType } = params;
  return uploadToR2({ bucket, path, uri, contentType });
}

// ── Get public URL for a stored file ─────────────────────────────────────────
export function getPublicUrl(bucket: StorageBucket, path: string): string {
  return `${R2_PUBLIC_URL}/${bucket}/${path}`;
}

// ── R2 upload via pre-signed URL from backend ───────────────────────────────
async function uploadToR2(params: {
  bucket: string;
  path: string;
  uri: string;
  contentType: string;
}): Promise<string> {
  const { bucket, path, uri, contentType } = params;

  // Get pre-signed URL from backend (uses apiFetch with auth)
  const { data } = await apiFetch('/storage/sign', {
    method: 'POST',
    body: JSON.stringify({ key: `${bucket}/${path}`, contentType }),
  });

  const { uploadUrl, publicUrl } = data;

  // Read file bytes using new expo-file-system/next API
  const bytes = await new File(uri).bytes();

  // ⚠️ Use plain fetch — NOT apiFetch
  // apiFetch injects Authorization header which breaks R2 signature validation
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    body: bytes,
    headers: {
      'Content-Type': contentType,
    },
  });

  const responseText = await response.text();
  console.log('[R2] Status:', response.status);
  console.log('[R2] Body:', responseText);

  if (!response.ok) {
    throw new Error(`R2 upload failed (${response.status}): ${responseText}`);
  }

  return publicUrl;
}