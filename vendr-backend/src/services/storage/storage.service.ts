import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../../config/env';

console.log('[Storage] R2_ACCOUNT_ID:', env.R2_ACCOUNT_ID);
console.log('[Storage] R2_ACCESS_KEY:', env.R2_ACCESS_KEY);
console.log('[Storage] R2_BUCKET:', env.R2_BUCKET);
// Cloudflare R2 uses S3-compatible API
// Note: R2 expects region='us-east-1' regardless of actual location
const s3Client = new S3Client({
  region: 'us-east-1',
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY,
    secretAccessKey: env.R2_SECRET_KEY,
  },
  forcePathStyle: true,
  requestChecksumCalculation: 'WHEN_REQUIRED',  // ← stops CRC32 being injected
  responseChecksumValidation: 'WHEN_REQUIRED',  // ← stops checksum validation on response
});

export interface SignUploadRequest {
  key: string;        // Path within bucket (e.g., "avatars/user-id_123.jpg")
  contentType: string; // MIME type (e.g., "image/jpeg")
}

export interface SignUploadResponse {
  uploadUrl: string;   // Pre-signed PUT URL
  publicUrl: string;   // Full public URL after upload
}

/**
 * Generate a pre-signed URL for uploading a file to R2
 * The URL is valid for 1 hour (3600 seconds)
 */
export async function signUploadUrl(params: SignUploadRequest): Promise<SignUploadResponse> {
  const { key, contentType } = params;

  console.log(`[Storage] Sign request: key="${key}", contentType="${contentType}"`);
  console.log(`[Storage] Config: bucket="${env.R2_BUCKET}", publicUrl="${env.R2_PUBLIC_URL}"`);

  // Build the command - this defines what operation we're authorizing
  const command = new PutObjectCommand({
    Bucket: env.R2_BUCKET,
    Key: key,
    ContentType: contentType,
  });

  // Generate signed URL valid for 1 hour
  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

  console.log(`[Storage] Generated signed URL (expires in 1h): ${uploadUrl}`);

  // Construct the public URL
  // R2 public URLs are path-style: {R2_PUBLIC_URL}/{key}
  const publicUrl = `${env.R2_PUBLIC_URL}/${key}`;

  return {
    uploadUrl,
    publicUrl,
  };
}
