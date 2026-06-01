const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { randomUUID } = require('crypto');
const path = require('path');

// Works with Cloudflare R2 (S3-compatible) and standard AWS S3.
// Set R2_ENDPOINT for R2; omit for AWS.
function createClient() {
  if (!process.env.R2_ACCESS_KEY_ID) return null;
  return new S3Client({
    region: process.env.R2_REGION || 'auto',
    endpoint: process.env.R2_ENDPOINT,        // e.g. https://<account-id>.r2.cloudflarestorage.com
    credentials: {
      accessKeyId:     process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

const client = createClient();
const BUCKET = process.env.R2_BUCKET || 'school-saas';
const CDN_BASE = process.env.R2_CDN_BASE || '';   // e.g. https://cdn.yourdomain.com
const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

/**
 * Upload a buffer to storage and return the public URL.
 * @param {Buffer} buffer
 * @param {string} folder  e.g. 'logos', 'signatures', 'portfolios'
 * @param {string} mimeType
 * @param {string} [originalName]
 * @returns {Promise<string>} Public URL
 */
async function uploadFile(buffer, folder, mimeType, originalName) {
  if (!client) throw new Error('File storage not configured');
  const fallbackExt = originalName ? path.extname(originalName).toLowerCase() : '';
  const ext = EXT_BY_MIME[mimeType] || fallbackExt;
  const key = `${folder}/${randomUUID()}${ext}`;
  await client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
  }));
  return CDN_BASE ? `${CDN_BASE}/${key}` : key;
}

/**
 * Delete a file from storage by its URL or key.
 */
async function deleteFile(urlOrKey) {
  if (!client) return;
  const key = CDN_BASE && urlOrKey.startsWith(CDN_BASE)
    ? urlOrKey.slice(CDN_BASE.length + 1)
    : urlOrKey;
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

module.exports = { uploadFile, deleteFile, isConfigured: () => !!client };
