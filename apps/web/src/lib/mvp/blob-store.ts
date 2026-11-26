import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SAFE_KEY_REGEX = /^[a-zA-Z0-9_-]{8,128}$/;

function getBlobsDir(): string {
  return process.env.LYGA_MVP_DIR
    ? path.join(process.env.LYGA_MVP_DIR, 'blobs')
    : path.resolve(process.cwd(), '..', '..', '.lyga-dev-data', 'blobs');
}

function getR2Config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    return null;
  }
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

function getR2Client() {
  const cfg = getR2Config();
  if (!cfg) return null;
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });
  return { client, bucket: cfg.bucket };
}

export function assertSafeBlobKey(blobKey: string): void {
  if (!SAFE_KEY_REGEX.test(blobKey)) {
    throw new Error('Invalid blob key.');
  }
}

export function isCloudBlobMode(): boolean {
  return getR2Config() !== null;
}

export async function createUploadUrl(blobKey: string): Promise<{ url: string; mode: 'r2' | 'local' }> {
  assertSafeBlobKey(blobKey);
  const r2 = getR2Client();
  if (r2) {
    const cmd = new PutObjectCommand({
      Bucket: r2.bucket,
      Key: blobKey,
      ContentType: 'application/octet-stream',
    });
    const url = await getSignedUrl(r2.client, cmd, { expiresIn: 900 });
    return { url, mode: 'r2' };
  }

  return { url: `/api/mvp/blobs/${blobKey}`, mode: 'local' };
}

export async function createDownloadUrl(blobKey: string): Promise<{ url: string; mode: 'r2' | 'local' }> {
  assertSafeBlobKey(blobKey);
  const r2 = getR2Client();
  if (r2) {
    const cmd = new GetObjectCommand({
      Bucket: r2.bucket,
      Key: blobKey,
    });
    const url = await getSignedUrl(r2.client, cmd, { expiresIn: 900 });
    return { url, mode: 'r2' };
  }

  return { url: `/api/mvp/blobs/${blobKey}`, mode: 'local' };
}

export async function saveLocalBlob(blobKey: string, data: Uint8Array): Promise<void> {
  assertSafeBlobKey(blobKey);
  const dir = getBlobsDir();
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, blobKey), data, { flag: 'wx' });
}

export async function readLocalBlob(blobKey: string): Promise<Buffer | null> {
  assertSafeBlobKey(blobKey);
  try {
    return await readFile(path.join(getBlobsDir(), blobKey));
  } catch {
    return null;
  }
}

export async function deleteBlob(blobKey: string): Promise<void> {
  assertSafeBlobKey(blobKey);
  const r2 = getR2Client();
  if (r2) {
    await r2.client.send(new DeleteObjectCommand({ Bucket: r2.bucket, Key: blobKey }));
    return;
  }
  await rm(path.join(getBlobsDir(), blobKey), { force: true });
}
