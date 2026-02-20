import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { s3, S3_BUCKET } from '../config/storage';

/**
 * Upload a buffer to S3 and return the public URL.
 */
export async function uploadBufferToS3(
  buffer: Buffer,
  key: string,
  contentType: string,
): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ACL: 'public-read',
    }),
  );

  // In dev (LocalStack), S3_ENDPOINT is set; in prod it's blank → use AWS URL format
  const endpoint = process.env.S3_ENDPOINT || `https://${S3_BUCKET}.s3.amazonaws.com`;
  return `${endpoint}/${S3_BUCKET}/${key}`;
}

/**
 * Delete an object from S3 by key.
 */
export async function deleteFromS3(key: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    }),
  );
}

/**
 * Build a consistent S3 key for a dissection model SVG.
 * Pattern: models/{slug}/{organSystem}/model-{version}.svg
 */
export function buildModelS3Key(
  animalSlug: string,
  organSystem: string,
  version: string,
): string {
  const safeSlug = animalSlug.toLowerCase().replace(/\s+/g, '-');
  const safeSystem = organSystem.toLowerCase().replace(/\s+/g, '-');
  return `models/${safeSlug}/${safeSystem}/model-${version}.svg`;
}

/**
 * Build a consistent S3 key for a thumbnail image.
 * Pattern: thumbnails/{entityType}/{entityId}.{ext}
 */
export function buildThumbnailS3Key(
  entityType: string,
  entityId: string,
  ext: string,
): string {
  return `thumbnails/${entityType}/${entityId}.${ext}`;
}
