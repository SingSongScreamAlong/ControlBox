// =====================================================================
// S3-Compatible Storage Service
// Pre-signed URL generation for DigitalOcean Spaces
// =====================================================================

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Configuration from environment
const config = {
    endpoint: process.env.DO_SPACES_ENDPOINT || 'https://nyc3.digitaloceanspaces.com',
    region: process.env.DO_SPACES_REGION || 'nyc3',
    bucket: process.env.DO_SPACES_BUCKET || 'controlbox-evidence',
    accessKeyId: process.env.DO_SPACES_KEY || '',
    secretAccessKey: process.env.DO_SPACES_SECRET || '',
    maxFileSizeMB: parseInt(process.env.EVIDENCE_MAX_SIZE_MB || '100'),
};

// Allowed MIME types for video uploads
const ALLOWED_MIME_TYPES = [
    'video/mp4',
    'video/webm',
    'video/quicktime',  // .mov
    'video/x-msvideo',  // .avi
];

/**
 * Storage service for video evidence files
 */
export class StorageService {
    private client: S3Client;

    constructor() {
        this.client = new S3Client({
            endpoint: config.endpoint,
            region: config.region,
            credentials: {
                accessKeyId: config.accessKeyId,
                secretAccessKey: config.secretAccessKey,
            },
            forcePathStyle: false, // DO Spaces uses virtual-hosted style
        });
    }

    /**
     * Check if storage is configured
     */
    isConfigured(): boolean {
        return !!(config.accessKeyId && config.secretAccessKey && config.bucket);
    }

    /**
     * Validate file for upload
     */
    validateFile(mimeType: string, sizeBytes: number): { valid: boolean; error?: string } {
        if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
            return {
                valid: false,
                error: `Invalid file type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`
            };
        }

        const maxBytes = config.maxFileSizeMB * 1024 * 1024;
        if (sizeBytes > maxBytes) {
            return {
                valid: false,
                error: `File too large. Maximum: ${config.maxFileSizeMB}MB`
            };
        }

        return { valid: true };
    }

    /**
     * Generate a pre-signed URL for uploading
     */
    async getUploadUrl(
        fileKey: string,
        mimeType: string,
        expiresInSeconds: number = 3600
    ): Promise<{ url: string; expiresAt: Date }> {
        const command = new PutObjectCommand({
            Bucket: config.bucket,
            Key: fileKey,
            ContentType: mimeType,
        });

        const url = await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
        const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

        return { url, expiresAt };
    }

    /**
     * Generate a pre-signed URL for downloading/viewing
     */
    async getDownloadUrl(
        fileKey: string,
        expiresInSeconds: number = 3600
    ): Promise<{ url: string; expiresAt: Date }> {
        const command = new GetObjectCommand({
            Bucket: config.bucket,
            Key: fileKey,
        });

        const url = await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
        const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

        return { url, expiresAt };
    }

    /**
     * Delete a file from storage
     */
    async deleteFile(fileKey: string): Promise<void> {
        const command = new DeleteObjectCommand({
            Bucket: config.bucket,
            Key: fileKey,
        });

        await this.client.send(command);
    }

    /**
     * Generate a unique file key for evidence
     */
    generateFileKey(
        leagueId: string,
        evidenceId: string,
        fileName: string
    ): string {
        // Sanitize filename
        const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const extension = sanitized.split('.').pop() || 'mp4';

        // Structure: leagues/{leagueId}/evidence/{evidenceId}/{timestamp}.{ext}
        const timestamp = Date.now();
        return `leagues/${leagueId}/evidence/${evidenceId}/${timestamp}.${extension}`;
    }

    /**
     * Generate thumbnail file key
     */
    generateThumbnailKey(fileKey: string): string {
        // Replace extension with .jpg
        return fileKey.replace(/\.[^.]+$/, '_thumb.jpg');
    }

    /**
     * Get configuration info (for debugging)
     */
    getConfigInfo(): { endpoint: string; bucket: string; maxSizeMB: number; configured: boolean } {
        return {
            endpoint: config.endpoint,
            bucket: config.bucket,
            maxSizeMB: config.maxFileSizeMB,
            configured: this.isConfigured(),
        };
    }
}

// Export singleton instance
export const storageService = new StorageService();

// =====================================================================
// Malware Scan Hook (Scaffold)
// =====================================================================

/**
 * Placeholder for malware scanning integration
 * In production, integrate with ClamAV, VirusTotal API, or similar
 */
export async function scanForMalware(fileKey: string): Promise<{
    scanned: boolean;
    clean: boolean;
    scanService?: string;
    details?: string;
}> {
    // TODO: Implement actual malware scanning
    // For now, return a placeholder indicating scan was skipped
    console.log(`[MALWARE SCAN] Scan requested for ${fileKey} - not implemented`);

    return {
        scanned: false,
        clean: true, // Assume clean if not scanned
        scanService: 'none',
        details: 'Malware scanning not yet implemented - file accepted without scan',
    };
}
