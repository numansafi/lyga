import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListPartsCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import { mkdir, open, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SAFE_KEY_REGEX = /^[a-zA-Z0-9_-]{8,128}$/;
const SAFE_UPLOAD_ID_REGEX = /^[a-zA-Z0-9._~-]{8,256}$/;

function assertSafeUploadId(uploadId: string): void {
  if (!SAFE_UPLOAD_ID_REGEX.test(uploadId) || uploadId.includes('..')) {
    throw new Error('Invalid upload ID.');
  }
}

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

export interface UploadedPartInfo {
  partNumber: number;
  size: number;
  eTag?: string;
}

export async function createMultipartUpload(
  blobKey: string
): Promise<{ uploadId: string; mode: 'r2' | 'local' }> {
  assertSafeBlobKey(blobKey);
  const r2 = getR2Client();
  if (r2) {
    const res = await r2.client.send(
      new CreateMultipartUploadCommand({
        Bucket: r2.bucket,
        Key: blobKey,
        ContentType: 'application/octet-stream',
      })
    );
    if (!res.UploadId) {
      throw new Error('R2 did not return an UploadId.');
    }
    return { uploadId: res.UploadId, mode: 'r2' };
  }

  const uploadId = randomUUID();
  const partsDir = path.join(getBlobsDir(), '.parts', uploadId);
  await mkdir(partsDir, { recursive: true });
  return { uploadId, mode: 'local' };
}

export async function createMultipartPartUrls(
  blobKey: string,
  uploadId: string,
  partNumbers: number[]
): Promise<{ urls: Array<{ partNumber: number; url: string }>; mode: 'r2' | 'local' }> {
  assertSafeBlobKey(blobKey);
  assertSafeUploadId(uploadId);

  for (const partNumber of partNumbers) {
    if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10000) {
      throw new Error(`Invalid part number: ${partNumber}`);
    }
  }

  const r2 = getR2Client();
  if (r2) {
    const urls = await Promise.all(
      partNumbers.map(async (partNumber) => {
        const cmd = new UploadPartCommand({
          Bucket: r2.bucket,
          Key: blobKey,
          UploadId: uploadId,
          PartNumber: partNumber,
        });
        const url = await getSignedUrl(r2.client, cmd, { expiresIn: 900 });
        return { partNumber, url };
      })
    );
    return { urls, mode: 'r2' };
  }

  return {
    urls: partNumbers.map((partNumber) => ({
      partNumber,
      url: `/api/mvp/blobs/${blobKey}/part?uploadId=${encodeURIComponent(uploadId)}&partNumber=${partNumber}`,
    })),
    mode: 'local',
  };
}

export async function saveLocalMultipartPart(
  uploadId: string,
  partNumber: number,
  data: Uint8Array
): Promise<void> {
  assertSafeUploadId(uploadId);
  if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10000) {
    throw new Error(`Invalid part number: ${partNumber}`);
  }
  const partsDir = path.join(getBlobsDir(), '.parts', uploadId);
  await mkdir(partsDir, { recursive: true });
  await writeFile(path.join(partsDir, `part-${partNumber}`), data);
}

export async function listUploadedParts(
  blobKey: string,
  uploadId: string
): Promise<UploadedPartInfo[]> {
  assertSafeBlobKey(blobKey);
  assertSafeUploadId(uploadId);

  const r2 = getR2Client();
  if (r2) {
    const parts: UploadedPartInfo[] = [];
    let partNumberMarker: string | undefined;

    for (;;) {
      const res = await r2.client.send(
        new ListPartsCommand({
          Bucket: r2.bucket,
          Key: blobKey,
          UploadId: uploadId,
          PartNumberMarker: partNumberMarker,
        })
      );

      for (const p of res.Parts ?? []) {
        if (typeof p.PartNumber === 'number') {
          parts.push({
            partNumber: p.PartNumber,
            size: p.Size ?? 0,
            eTag: p.ETag,
          });
        }
      }

      if (!res.IsTruncated || !res.NextPartNumberMarker) {
        break;
      }
      partNumberMarker = String(res.NextPartNumberMarker);
    }

    parts.sort((a, b) => a.partNumber - b.partNumber);
    return parts;
  }

  const partsDir = path.join(getBlobsDir(), '.parts', uploadId);
  try {
    const entries = await readdir(partsDir);
    const parts: UploadedPartInfo[] = [];
    for (const entry of entries) {
      const match = /^part-(\d+)$/.exec(entry);
      if (!match) continue;
      const partNumber = Number(match[1]);
      const st = await stat(path.join(partsDir, entry));
      parts.push({ partNumber, size: st.size });
    }
    parts.sort((a, b) => a.partNumber - b.partNumber);
    return parts;
  } catch {
    return [];
  }
}

export async function completeMultipartUpload(
  blobKey: string,
  uploadId: string,
  expectedParts?: number
): Promise<{ sizeBytes: number }> {
  assertSafeBlobKey(blobKey);
  assertSafeUploadId(uploadId);

  const parts = await listUploadedParts(blobKey, uploadId);
  if (parts.length === 0) {
    throw new Error('No parts uploaded.');
  }
  if (expectedParts !== undefined && parts.length !== expectedParts) {
    throw new Error(`Expected ${expectedParts} parts, found ${parts.length}.`);
  }

  for (let i = 0; i < parts.length; i++) {
    if (parts[i].partNumber !== i + 1) {
      throw new Error(`Missing part ${i + 1}.`);
    }
  }

  const r2 = getR2Client();
  if (r2) {
    await r2.client.send(
      new CompleteMultipartUploadCommand({
        Bucket: r2.bucket,
        Key: blobKey,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts.map((p) => ({
            PartNumber: p.partNumber,
            ETag: p.eTag,
          })),
        },
      })
    );

    const head = await r2.client.send(
      new HeadObjectCommand({
        Bucket: r2.bucket,
        Key: blobKey,
      })
    );

    return { sizeBytes: head.ContentLength ?? 0 };
  }

  const dir = getBlobsDir();
  await mkdir(dir, { recursive: true });
  const targetPath = path.join(dir, blobKey);
  const partsDir = path.join(dir, '.parts', uploadId);

  const fh = await open(targetPath, 'wx');
  try {
    for (const p of parts) {
      const chunk = await readFile(path.join(partsDir, `part-${p.partNumber}`));
      await fh.write(chunk);
    }
  } finally {
    await fh.close();
  }

  const st = await stat(targetPath);
  await rm(partsDir, { recursive: true, force: true });
  return { sizeBytes: st.size };
}

export async function abortMultipartUpload(blobKey: string, uploadId: string): Promise<void> {
  assertSafeBlobKey(blobKey);
  assertSafeUploadId(uploadId);

  const r2 = getR2Client();
  if (r2) {
    await r2.client.send(
      new AbortMultipartUploadCommand({
        Bucket: r2.bucket,
        Key: blobKey,
        UploadId: uploadId,
      })
    );
    return;
  }

  await rm(path.join(getBlobsDir(), '.parts', uploadId), { recursive: true, force: true });
}

export async function readLocalBlobRange(
  blobKey: string,
  start: number,
  endInclusive?: number
): Promise<{ chunk: Buffer; totalSize: number; start: number; end: number } | null> {
  assertSafeBlobKey(blobKey);
  const filePath = path.join(getBlobsDir(), blobKey);

  try {
    const fh = await open(filePath, 'r');
    try {
      const st = await fh.stat();
      const totalSize = st.size;
      if (totalSize === 0) {
        return { chunk: Buffer.alloc(0), totalSize: 0, start: 0, end: 0 };
      }

      const clampedStart = Math.max(0, Math.min(start, totalSize - 1));
      const clampedEnd =
        endInclusive !== undefined
          ? Math.max(clampedStart, Math.min(endInclusive, totalSize - 1))
          : totalSize - 1;
      const length = clampedEnd - clampedStart + 1;
      const buffer = Buffer.allocUnsafe(length);
      const { bytesRead } = await fh.read(buffer, 0, length, clampedStart);

      return {
        chunk: buffer.subarray(0, bytesRead),
        totalSize,
        start: clampedStart,
        end: clampedStart + bytesRead - 1,
      };
    } finally {
      await fh.close();
    }
  } catch {
    return null;
  }
}
