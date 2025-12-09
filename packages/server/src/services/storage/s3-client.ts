// =====================================================================
// S3 Storage Client
// DigitalOcean Spaces (S3-compatible) utilities
// =====================================================================

// Configuration
const DO_SPACES_ENDPOINT = process.env.DO_SPACES_ENDPOINT || 'nyc3.digitaloceanspaces.com';
const DO_SPACES_BUCKET = process.env.DO_SPACES_BUCKET || 'controlbox-artifacts';
const DO_SPACES_KEY = process.env.DO_SPACES_KEY || '';
const DO_SPACES_SECRET = process.env.DO_SPACES_SECRET || '';
const DO_SPACES_REGION = process.env.DO_SPACES_REGION || 'nyc3';

// URL expiration (15 minutes for uploads, 1 hour for downloads)
const UPLOAD_URL_EXPIRY = 15 * 60; // 900 seconds
const DOWNLOAD_URL_EXPIRY = 60 * 60; // 3600 seconds

/**
 * Check if S3 storage is configured
 */
export function isStorageConfigured(): boolean {
    return Boolean(DO_SPACES_KEY && DO_SPACES_SECRET);
}

/**
 * Get storage configuration
 */
export function getStorageConfig() {
    return {
        endpoint: `https://${DO_SPACES_ENDPOINT}`,
        bucket: DO_SPACES_BUCKET,
        region: DO_SPACES_REGION,
        accessKeyId: DO_SPACES_KEY,
        secretAccessKey: DO_SPACES_SECRET
    };
}

/**
 * Generate a presigned URL for uploading
 * Uses AWS Signature v4 (compatible with DO Spaces)
 */
export async function generatePresignedUploadUrl(
    storagePath: string,
    contentType: string,
    expiresIn: number = UPLOAD_URL_EXPIRY
): Promise<string> {
    if (!isStorageConfigured()) {
        // Return a mock URL for development
        console.warn('S3 storage not configured, returning mock upload URL');
        return `https://${DO_SPACES_BUCKET}.${DO_SPACES_ENDPOINT}/${storagePath}?mock-upload=true`;
    }

    try {
        // Dynamic import to avoid dependency if not used
        const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
        const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

        const config = getStorageConfig();
        const client = new S3Client({
            endpoint: config.endpoint,
            region: config.region,
            credentials: {
                accessKeyId: config.accessKeyId,
                secretAccessKey: config.secretAccessKey
            },
            forcePathStyle: false // Use virtual hosted-style URLs
        });

        const command = new PutObjectCommand({
            Bucket: config.bucket,
            Key: storagePath,
            ContentType: contentType
        });

        const url = await getSignedUrl(client, command, { expiresIn });
        return url;
    } catch (error) {
        console.error('Failed to generate presigned upload URL:', error);
        // Fallback to mock URL
        return `https://${DO_SPACES_BUCKET}.${DO_SPACES_ENDPOINT}/${storagePath}?error=sdk-not-available`;
    }
}

/**
 * Generate a presigned URL for downloading
 */
export async function generatePresignedDownloadUrl(
    storagePath: string,
    expiresIn: number = DOWNLOAD_URL_EXPIRY
): Promise<string> {
    if (!isStorageConfigured()) {
        // Return a mock URL for development
        console.warn('S3 storage not configured, returning mock download URL');
        return `https://${DO_SPACES_BUCKET}.${DO_SPACES_ENDPOINT}/${storagePath}`;
    }

    try {
        const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
        const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

        const config = getStorageConfig();
        const client = new S3Client({
            endpoint: config.endpoint,
            region: config.region,
            credentials: {
                accessKeyId: config.accessKeyId,
                secretAccessKey: config.secretAccessKey
            },
            forcePathStyle: false
        });

        const command = new GetObjectCommand({
            Bucket: config.bucket,
            Key: storagePath
        });

        const url = await getSignedUrl(client, command, { expiresIn });
        return url;
    } catch (error) {
        console.error('Failed to generate presigned download URL:', error);
        return `https://${DO_SPACES_BUCKET}.${DO_SPACES_ENDPOINT}/${storagePath}`;
    }
}

/**
 * Delete an object from storage
 */
export async function deleteObject(storagePath: string): Promise<boolean> {
    if (!isStorageConfigured()) {
        console.warn('S3 storage not configured, skipping delete');
        return true;
    }

    try {
        const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3');

        const config = getStorageConfig();
        const client = new S3Client({
            endpoint: config.endpoint,
            region: config.region,
            credentials: {
                accessKeyId: config.accessKeyId,
                secretAccessKey: config.secretAccessKey
            }
        });

        await client.send(new DeleteObjectCommand({
            Bucket: config.bucket,
            Key: storagePath
        }));

        return true;
    } catch (error) {
        console.error('Failed to delete object:', error);
        return false;
    }
}

/**
 * Get a file's content from storage (for results parsing)
 */
export async function getObjectAsString(storagePath: string): Promise<string | null> {
    if (!isStorageConfigured()) {
        console.warn('S3 storage not configured, cannot fetch file');
        return null;
    }

    try {
        const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');

        const config = getStorageConfig();
        const client = new S3Client({
            endpoint: config.endpoint,
            region: config.region,
            credentials: {
                accessKeyId: config.accessKeyId,
                secretAccessKey: config.secretAccessKey
            }
        });

        const response = await client.send(new GetObjectCommand({
            Bucket: config.bucket,
            Key: storagePath
        }));

        // Convert stream to string
        if (response.Body) {
            const chunks: Buffer[] = [];
            const stream = response.Body as AsyncIterable<Buffer>;
            for await (const chunk of stream) {
                chunks.push(chunk);
            }
            return Buffer.concat(chunks).toString('utf-8');
        }

        return null;
    } catch (error) {
        console.error('Failed to get object:', error);
        return null;
    }
}

/**
 * Check if a file exists in storage
 */
export async function objectExists(storagePath: string): Promise<boolean> {
    if (!isStorageConfigured()) {
        return false;
    }

    try {
        const { S3Client, HeadObjectCommand } = await import('@aws-sdk/client-s3');

        const config = getStorageConfig();
        const client = new S3Client({
            endpoint: config.endpoint,
            region: config.region,
            credentials: {
                accessKeyId: config.accessKeyId,
                secretAccessKey: config.secretAccessKey
            }
        });

        await client.send(new HeadObjectCommand({
            Bucket: config.bucket,
            Key: storagePath
        }));

        return true;
    } catch {
        return false;
    }
}
