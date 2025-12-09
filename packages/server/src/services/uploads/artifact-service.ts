// =====================================================================
// Artifact Service
// File upload handling for event artifacts (replays, results)
// =====================================================================

import { pool } from '../../db/client.js';
import type { EventArtifact, ArtifactType } from '@controlbox/common';
import {
    generatePresignedUploadUrl as s3UploadUrl,
    generatePresignedDownloadUrl as s3DownloadUrl,
    deleteObject as s3Delete
} from '../storage/s3-client.js';

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

interface ArtifactRow {
    id: string;
    event_id: string;
    type: string;
    filename: string;
    storage_path: string;
    file_size_bytes: number | null;
    mime_type: string | null;
    uploaded_by: string;
    processed_at: Date | null;
    processing_error: string | null;
    metadata: Record<string, unknown> | null;
    created_at: Date;
    updated_at: Date | null;
}

function mapRowToArtifact(row: ArtifactRow): EventArtifact {
    return {
        id: row.id,
        eventId: row.event_id,
        type: row.type as ArtifactType,
        filename: row.filename,
        storagePath: row.storage_path,
        fileSizeBytes: row.file_size_bytes ?? undefined,
        mimeType: row.mime_type ?? undefined,
        uploadedBy: row.uploaded_by,
        processedAt: row.processed_at ?? undefined,
        processingError: row.processing_error ?? undefined,
        metadata: row.metadata ?? undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at ?? undefined
    };
}

export interface UploadResult {
    artifact: EventArtifact;
    uploadUrl: string;
}

export class ArtifactService {
    /**
     * Generate a presigned upload URL and create artifact record
     */
    async initiateUpload(
        eventId: string,
        type: ArtifactType,
        filename: string,
        mimeType: string,
        fileSizeBytes: number,
        uploadedBy: string
    ): Promise<UploadResult> {
        if (fileSizeBytes > MAX_FILE_SIZE) {
            throw new Error(`File size exceeds maximum allowed (${MAX_FILE_SIZE / 1024 / 1024}MB)`);
        }

        // Get event to build storage path
        const eventResult = await pool.query(
            `SELECT league_id, season_id FROM events WHERE id = $1`,
            [eventId]
        );

        if (eventResult.rows.length === 0) {
            throw new Error('Event not found');
        }

        const { league_id, season_id } = eventResult.rows[0];

        // Build storage path: /{league_id}/{season_id}/{event_id}/{type}/{filename}
        const storagePath = `${league_id}/${season_id}/${eventId}/${type}/${filename}`;

        // Create artifact record
        const result = await pool.query<ArtifactRow>(
            `INSERT INTO event_artifacts (event_id, type, filename, storage_path, file_size_bytes, mime_type, uploaded_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [eventId, type, filename, storagePath, fileSizeBytes, mimeType, uploadedBy]
        );

        const artifact = mapRowToArtifact(result.rows[0]);

        // Generate presigned upload URL using S3 client
        const uploadUrl = await s3UploadUrl(storagePath, mimeType);

        return { artifact, uploadUrl };
    }

    /**
     * Generate presigned URL for downloading
     */
    async generateDownloadUrl(storagePath: string): Promise<string> {
        return s3DownloadUrl(storagePath);
    }

    /**
     * Mark artifact upload as complete
     */
    async markUploadComplete(artifactId: string): Promise<EventArtifact | null> {
        const result = await pool.query<ArtifactRow>(
            `UPDATE event_artifacts SET updated_at = NOW() WHERE id = $1 RETURNING *`,
            [artifactId]
        );

        return result.rows.length > 0 ? mapRowToArtifact(result.rows[0]) : null;
    }

    /**
     * Get artifacts for an event
     */
    async getByEvent(eventId: string): Promise<EventArtifact[]> {
        const result = await pool.query<ArtifactRow>(
            `SELECT * FROM event_artifacts WHERE event_id = $1 ORDER BY created_at DESC`,
            [eventId]
        );

        return result.rows.map(mapRowToArtifact);
    }

    /**
     * Get artifact by ID
     */
    async getById(artifactId: string): Promise<EventArtifact | null> {
        const result = await pool.query<ArtifactRow>(
            `SELECT * FROM event_artifacts WHERE id = $1`,
            [artifactId]
        );

        return result.rows.length > 0 ? mapRowToArtifact(result.rows[0]) : null;
    }

    /**
     * Get results artifact for an event (for report generation)
     */
    async getResultsArtifact(eventId: string): Promise<EventArtifact | null> {
        const result = await pool.query<ArtifactRow>(
            `SELECT * FROM event_artifacts WHERE event_id = $1 AND type = 'results' ORDER BY created_at DESC LIMIT 1`,
            [eventId]
        );

        return result.rows.length > 0 ? mapRowToArtifact(result.rows[0]) : null;
    }

    /**
     * Mark artifact as processed
     */
    async markProcessed(artifactId: string, error?: string): Promise<void> {
        await pool.query(
            `UPDATE event_artifacts SET processed_at = NOW(), processing_error = $2 WHERE id = $1`,
            [artifactId, error ?? null]
        );
    }

    /**
     * Update artifact metadata
     */
    async updateMetadata(artifactId: string, metadata: Record<string, unknown>): Promise<void> {
        await pool.query(
            `UPDATE event_artifacts SET metadata = $2 WHERE id = $1`,
            [artifactId, JSON.stringify(metadata)]
        );
    }

    /**
     * Delete an artifact
     */
    async delete(artifactId: string): Promise<boolean> {
        // Get artifact to find storage path
        const artifact = await this.getById(artifactId);
        if (artifact) {
            // Delete from object storage
            await s3Delete(artifact.storagePath);
        }

        const result = await pool.query(
            `DELETE FROM event_artifacts WHERE id = $1`,
            [artifactId]
        );

        return (result.rowCount ?? 0) > 0;
    }

    /**
     * Check if event has both required artifacts
     */
    async hasRequiredArtifacts(eventId: string): Promise<{ hasReplay: boolean; hasResults: boolean }> {
        const result = await pool.query(
            `SELECT type FROM event_artifacts WHERE event_id = $1`,
            [eventId]
        );

        const types = result.rows.map(r => r.type);
        return {
            hasReplay: types.includes('replay'),
            hasResults: types.includes('results')
        };
    }
}

// Singleton instance
let artifactService: ArtifactService | null = null;

export function getArtifactService(): ArtifactService {
    if (!artifactService) {
        artifactService = new ArtifactService();
    }
    return artifactService;
}
