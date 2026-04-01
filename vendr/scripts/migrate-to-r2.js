// scripts/migrate-to-r2.js — hardcoded file list from storage.objects query
require('dotenv').config({ path: '.env.migrate' });

const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { createClient } = require('@supabase/supabase-js');
const https = require('https');

const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY;
const R2_SECRET_KEY = process.env.R2_SECRET_KEY;
const R2_BUCKET     = process.env.R2_BUCKET     ?? 'vendr-media';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

// Exact files from storage.objects — bucket_id | name | public_url
const FILES = [
  { bucket: 'avatars',       name: 'avatars/4221751b-8384-46f0-9536-a8130e12d259_1773318036813.jpg' },
  { bucket: 'avatars',       name: 'avatars/5599314c-77a3-43b2-8dd2-915525aa2e16_1773066915827.jpg' },
  { bucket: 'avatars',       name: 'avatars/5599314c-77a3-43b2-8dd2-915525aa2e16_1773152931061.jpg' },
  { bucket: 'avatars',       name: 'avatars/6774ce8a-6469-4e91-887a-bc09eee502c6_1773063389651.jpg' },
  { bucket: 'reels',         name: '5599314c-77a3-43b2-8dd2-915525aa2e16/1773207156486_reel.mp4' },
  { bucket: 'reels',         name: '5599314c-77a3-43b2-8dd2-915525aa2e16/1773207210643_reel.mp4' },
  { bucket: 'reels',         name: '5599314c-77a3-43b2-8dd2-915525aa2e16/1773230714198_reel.mp4' },
  { bucket: 'reels',         name: '5599314c-77a3-43b2-8dd2-915525aa2e16/1773230714198_thumb.jpg' },
  { bucket: 'reels',         name: '6774ce8a-6469-4e91-887a-bc09eee502c6/1773189216261_reel.mp4' },
  { bucket: 'reels',         name: '6774ce8a-6469-4e91-887a-bc09eee502c6/1773190561705_reel.mp4' },
  { bucket: 'reels',         name: '6774ce8a-6469-4e91-887a-bc09eee502c6/1773238713603_reel.mp4' },
  { bucket: 'reels',         name: '6774ce8a-6469-4e91-887a-bc09eee502c6/1773238713603_thumb.jpg' },
  { bucket: 'reels',         name: '6774ce8a-6469-4e91-887a-bc09eee502c6/1773326935049_reel.mp4' },
  { bucket: 'reels',         name: '6774ce8a-6469-4e91-887a-bc09eee502c6/1773326935049_thumb.jpg' },
  { bucket: 'vendor-images', name: '6774ce8a-6469-4e91-887a-bc09eee502c6/banner_1773061399218.jpg' },
  { bucket: 'vendor-images', name: '6da09faa-5662-49c4-b22c-685c6799aede/banner_1773083610291.jpg' },
  { bucket: 'vendor-images', name: '6da09faa-5662-49c4-b22c-685c6799aede/logo_1773083541447.jpg' },
  { bucket: 'vendor-images', name: '6da09faa-5662-49c4-b22c-685c6799aede/product_997d90af-2e53-4954-b299-c3c8744aab9c_1773083453787.jpg' },
  { bucket: 'vendor-images', name: '7dc3e4c4-911c-4a45-a404-081792a23661/logo_1773083735561.jpg' },
];

function getContentType(f) {
  const ext = (f.split('.').pop() ?? '').toLowerCase();
  return { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', mp4: 'video/mp4', mov: 'video/quicktime' }[ext] ?? 'application/octet-stream';
}

function download(url, token) {
  return new Promise((resolve, reject) => {
    const opts = { headers: { Authorization: `Bearer ${token}`, apikey: token } };
    https.get(url, opts, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode)) {
        return download(res.headers.location, token).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        // Read body for error detail
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 100)}`)));
        return;
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  console.log(`🚀 Migrating ${FILES.length} files to R2\n`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const r2 = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY, secretAccessKey: R2_SECRET_KEY },
  });

  let migrated = 0, skipped = 0, failed = 0;
  const urlUpdates = [];
  const failures   = [];

  for (const file of FILES) {
    const r2Key       = `${file.bucket}/${file.name}`;
    const contentType = getContentType(file.name);

    // Skip if already in R2
    try {
      await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: r2Key }));
      console.log(`⏭  Already in R2: ${r2Key}`);
      skipped++; continue;
    } catch {}

    // Two URL strategies: public endpoint, then authenticated endpoint
    const urls = [
      `${SUPABASE_URL}/storage/v1/object/public/${file.bucket}/${file.name}`,
      `${SUPABASE_URL}/storage/v1/object/authenticated/${file.bucket}/${file.name}`,
      `${SUPABASE_URL}/storage/v1/object/${file.bucket}/${file.name}`,
    ];

    let fileBuffer = null;
    let lastError  = null;

    for (const url of urls) {
      try {
        console.log(`⬇  Trying: ${url.replace(SUPABASE_URL, '')}`);
        fileBuffer = await download(url, SUPABASE_KEY);
        break;
      } catch (e) {
        lastError = e.message;
        console.log(`   ✗ ${e.message}`);
      }
    }

    if (!fileBuffer) {
      console.error(`❌ Failed: ${r2Key} — ${lastError}`);
      failures.push({ key: r2Key, error: lastError });
      failed++; continue;
    }

    // Upload to R2
    try {
      await r2.send(new PutObjectCommand({
        Bucket: R2_BUCKET, Key: r2Key,
        Body: fileBuffer, ContentType: contentType,
      }));

      const oldUrl = `${SUPABASE_URL}/storage/v1/object/public/${file.bucket}/${file.name}`;
      const newUrl = `${R2_PUBLIC_URL}/${r2Key}`;
      urlUpdates.push({ ...file, oldUrl, newUrl });
      console.log(`✅ Migrated: ${r2Key}`);
      migrated++;
    } catch (e) {
      console.error(`❌ R2 upload failed: ${r2Key} — ${e.message}`);
      failures.push({ key: r2Key, error: e.message });
      failed++;
    }
  }

  // Update DB URLs
  if (urlUpdates.length > 0) {
    console.log(`\n🔄 Updating ${urlUpdates.length} database URLs...`);
    for (const u of urlUpdates) {
      if (u.bucket === 'avatars') {
        // Avatar stored with prefix — old URL has double avatars in path
        const oldWithPrefix = `${SUPABASE_URL}/storage/v1/object/public/avatars/${u.name}`;
        await supabase.from('profiles').update({ avatar_url: u.newUrl }).eq('avatar_url', oldWithPrefix);
        // Also try without prefix in case some were stored differently
        await supabase.from('profiles').update({ avatar_url: u.newUrl }).eq('avatar_url', u.oldUrl);
      }
      if (u.bucket === 'vendor-images') {
        await supabase.from('vendors').update({ logo_url:   u.newUrl }).eq('logo_url',   u.oldUrl);
        await supabase.from('vendors').update({ banner_url: u.newUrl }).eq('banner_url', u.oldUrl);
        await supabase.from('products').update({ image_url: u.newUrl }).eq('image_url',  u.oldUrl);
      }
      if (u.bucket === 'reels') {
        await supabase.from('reels').update({ video_url:     u.newUrl }).eq('video_url',     u.oldUrl);
        await supabase.from('reels').update({ thumbnail_url: u.newUrl }).eq('thumbnail_url', u.oldUrl);
      }
      console.log(`  ✅ DB: ${u.newUrl}`);
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`✅ Migrated: ${migrated}  ⏭  Skipped: ${skipped}  ❌ Failed: ${failed}`);
  if (failures.length > 0) {
    console.log('\nFailed:');
    failures.forEach(f => console.log(`  - ${f.key}: ${f.error}`));
  }
  console.log('🏁 Done!\n');
}

main().catch(console.error);