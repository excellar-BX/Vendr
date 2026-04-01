// lib/storage.ts
// ── Cloudflare R2 storage abstraction ────────────────────────────────────────
// All media uploads (avatars, vendor images, reels) go to R2.
// chat-images stays on Supabase (private, lower volume).
// Switch R2_ENABLED to false to fall back to Supabase Storage for everything.

import { supabase } from './supabase';

const R2_ENABLED       = true;
const R2_ACCOUNT_ID    = process.env.EXPO_PUBLIC_CF_ACCOUNT_ID    ?? '';
const R2_ACCESS_KEY    = process.env.EXPO_PUBLIC_CF_ACCESS_KEY    ?? '';
const R2_SECRET_KEY    = process.env.EXPO_PUBLIC_CF_SECRET_KEY    ?? '';
const R2_BUCKET        = process.env.EXPO_PUBLIC_CF_BUCKET        ?? 'vendr-media';
const R2_PUBLIC_URL    = process.env.EXPO_PUBLIC_CF_PUBLIC_URL    ?? ''; // https://pub-XXXX.r2.dev

// Buckets that should go to R2 vs stay on Supabase
const R2_BUCKETS = ['vendor-images', 'avatars', 'reels'];

export type StorageBucket = 'vendor-images' | 'avatars' | 'reels' | 'chat-images';

// ── Upload a file (uri) to the correct storage backend ───────────────────────
export async function uploadFile(params: {
  bucket:      StorageBucket;
  path:        string;          // e.g. 'user-id/avatar.jpg'
  uri:         string;          // local file URI
  contentType: string;          // e.g. 'image/jpeg'
}): Promise<string> {
  const { bucket, path, uri, contentType } = params;

  if (R2_ENABLED && R2_BUCKETS.includes(bucket)) {
    return uploadToR2({ bucket, path, uri, contentType });
  }
  return uploadToSupabase({ bucket, path, uri, contentType });
}

// ── Get public URL for a stored file ─────────────────────────────────────────
export function getPublicUrl(bucket: StorageBucket, path: string): string {
  if (R2_ENABLED && R2_BUCKETS.includes(bucket)) {
    return `${R2_PUBLIC_URL}/${bucket}/${path}`;
  }
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

// ── R2 upload via S3-compatible API ──────────────────────────────────────────
async function uploadToR2(params: {
  bucket:      string;
  path:        string;
  uri:         string;
  contentType: string;
}): Promise<string> {
  const { bucket, path, uri, contentType } = params;

  // R2 S3-compatible endpoint
  const endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const key      = `${bucket}/${path}`;
  const url      = `${endpoint}/${R2_BUCKET}/${key}`;

  // Sign the request using AWS Signature V4
  const now        = new Date();
  const dateStamp  = now.toISOString().slice(0, 10).replace(/-/g, '');
  const amzDate    = now.toISOString().replace(/[:-]/g, '').slice(0, 15) + 'Z';
  const region     = 'auto';
  const service    = 's3';

  // We use XHR with pre-signed approach — simpler for React Native
  // Instead of full V4 signing in RN, we use a Supabase Edge Function as a signing proxy
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');

  // Call our signing Edge Function to get a pre-signed URL
  const signRes = await fetch(
    'https://mbdojwirmtknzpwccthb.supabase.co/functions/v1/r2-sign',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ key, contentType }),
    }
  );

  if (!signRes.ok) throw new Error('Could not get upload URL');
  const { uploadUrl, publicUrl } = await signRes.json();

  // Upload directly to R2 using the pre-signed URL — XHR pattern
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.onload = () => {
      if (xhr.status === 200) resolve();
      else reject(new Error(`R2 upload failed (${xhr.status}): ${xhr.responseText}`));
    };
    xhr.onerror = () => reject(new Error('Network error during R2 upload'));
    xhr.send({ uri, type: contentType, name: path.split('/').pop() } as any);
  });

  return publicUrl;
}

// ── Supabase Storage upload (fallback + chat-images) ─────────────────────────
async function uploadToSupabase(params: {
  bucket:      string;
  path:        string;
  uri:         string;
  contentType: string;
}): Promise<string> {
  const { bucket, path, uri, contentType } = params;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');

  const publicUrl = await new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://mbdojwirmtknzpwccthb.supabase.co/storage/v1/object/${bucket}/${path}`);
    xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
    xhr.setRequestHeader('x-upsert', 'true');
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.onload = () => {
      if (xhr.status === 200) {
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        resolve(data.publicUrl);
      } else {
        reject(new Error(`Upload failed (${xhr.status}): ${xhr.responseText}`));
      }
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send({ uri, type: contentType, name: path.split('/').pop() } as any);
  });

  return publicUrl;
}