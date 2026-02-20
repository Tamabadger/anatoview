import { S3Client } from '@aws-sdk/client-s3';

/**
 * S3 client configured for LocalStack in development, real AWS in production.
 * The same AWS SDK works for both — only the endpoint changes.
 */
export const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.S3_ENDPOINT,           // LocalStack in dev, real AWS in prod
  forcePathStyle: true,                        // Required for LocalStack
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
  },
});

export const S3_BUCKET = process.env.S3_BUCKET || 'anatoview-assets';
