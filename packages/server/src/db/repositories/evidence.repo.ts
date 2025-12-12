// =====================================================================
// Evidence Repository
// CRUD operations for video/replay evidence
// =====================================================================

import { v4 as uuid } from 'uuid';
import { query, queryOne } from '../client.js';
import type {
    EvidenceAsset,
    EvidenceKeyMoment,
    EvidenceType,
    EvidenceVisibility,
    EvidenceSource,
    EvidenceAssessment,
    EvidenceAuditAction,
    EvidenceAuditEntry,
    ListEvidenceParams,
    EvidenceUpdateRequest,
} from '@controlbox/common';

export class EvidenceRepository {
    // =========================================================================
    // Evidence Asset CRUD
    // =========================================================================

    async findById(id: string): Promise<EvidenceAsset | null> {
        const row = await queryOne<Record<string, unknown>>(
            `SELECT ea.*,
                eu.storage_provider, eu.file_key, eu.mime_type, eu.size_bytes, 
                eu.duration_seconds, eu.thumbnail_key, eu.upload_status,
                eeu.url as external_url, eeu.provider_hint, eeu.embed_url,
                err.sim, err.event_id, err.subsession_id, err.lap, err.corner,
                err.timecode_hint, err.offset_seconds_before, err.offset_seconds_after,
                err.camera_hint, err.viewing_notes
             FROM evidence_assets ea
             LEFT JOIN evidence_uploads eu ON ea.id = eu.evidence_id
             LEFT JOIN evidence_external_urls eeu ON ea.id = eeu.evidence_id
             LEFT JOIN evidence_replay_refs err ON ea.id = err.evidence_id
             WHERE ea.id = $1`,
            [id]
        );

        if (!row) return null;
        return this.mapRow(row);
    }

    async findByIncidentId(incidentId: string, visibility?: EvidenceVisibility): Promise<EvidenceAsset[]> {
        let sql = `
            SELECT ea.*,
                eu.storage_provider, eu.file_key, eu.mime_type, eu.size_bytes,
                eu.duration_seconds, eu.thumbnail_key, eu.upload_status,
                eeu.url as external_url, eeu.provider_hint, eeu.embed_url,
                err.sim, err.event_id, err.subsession_id, err.lap, err.corner,
                err.timecode_hint, err.offset_seconds_before, err.offset_seconds_after,
                err.camera_hint, err.viewing_notes
             FROM evidence_assets ea
             LEFT JOIN evidence_uploads eu ON ea.id = eu.evidence_id
             LEFT JOIN evidence_external_urls eeu ON ea.id = eeu.evidence_id
             LEFT JOIN evidence_replay_refs err ON ea.id = err.evidence_id
             INNER JOIN evidence_links el ON ea.id = el.evidence_id
             WHERE el.incident_id = $1`;

        const params: unknown[] = [incidentId];

        if (visibility) {
            sql += ` AND ea.visibility = $2`;
            params.push(visibility);
        }

        sql += ` ORDER BY ea.created_at DESC`;

        const rows = await query<Record<string, unknown>>(sql, params);
        return rows.map(r => this.mapRow(r));
    }

    async findByCaseId(caseId: string): Promise<EvidenceAsset[]> {
        const rows = await query<Record<string, unknown>>(
            `SELECT ea.*,
                eu.storage_provider, eu.file_key, eu.mime_type, eu.size_bytes,
                eu.duration_seconds, eu.thumbnail_key, eu.upload_status,
                eeu.url as external_url, eeu.provider_hint, eeu.embed_url,
                err.sim, err.event_id, err.subsession_id, err.lap, err.corner,
                err.timecode_hint, err.offset_seconds_before, err.offset_seconds_after,
                err.camera_hint, err.viewing_notes
             FROM evidence_assets ea
             LEFT JOIN evidence_uploads eu ON ea.id = eu.evidence_id
             LEFT JOIN evidence_external_urls eeu ON ea.id = eeu.evidence_id
             LEFT JOIN evidence_replay_refs err ON ea.id = err.evidence_id
             INNER JOIN evidence_links el ON ea.id = el.evidence_id
             WHERE el.case_id = $1
             ORDER BY ea.created_at DESC`,
            [caseId]
        );
        return rows.map(r => this.mapRow(r));
    }

    async findByProtestId(protestId: string): Promise<EvidenceAsset[]> {
        const rows = await query<Record<string, unknown>>(
            `SELECT ea.*,
                eu.storage_provider, eu.file_key, eu.mime_type, eu.size_bytes,
                eu.duration_seconds, eu.thumbnail_key, eu.upload_status,
                eeu.url as external_url, eeu.provider_hint, eeu.embed_url,
                err.sim, err.event_id, err.subsession_id, err.lap, err.corner,
                err.timecode_hint, err.offset_seconds_before, err.offset_seconds_after,
                err.camera_hint, err.viewing_notes
             FROM evidence_assets ea
             LEFT JOIN evidence_uploads eu ON ea.id = eu.evidence_id
             LEFT JOIN evidence_external_urls eeu ON ea.id = eeu.evidence_id
             LEFT JOIN evidence_replay_refs err ON ea.id = err.evidence_id
             INNER JOIN evidence_links el ON ea.id = el.evidence_id
             WHERE el.protest_id = $1
             ORDER BY ea.created_at DESC`,
            [protestId]
        );
        return rows.map(r => this.mapRow(r));
    }

    async findAll(params: ListEvidenceParams = {}): Promise<EvidenceAsset[]> {
        const conditions: string[] = [];
        const values: unknown[] = [];
        let paramIndex = 1;

        if (params.type) {
            conditions.push(`ea.type = $${paramIndex++}`);
            values.push(params.type);
        }
        if (params.source) {
            conditions.push(`ea.source = $${paramIndex++}`);
            values.push(params.source);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const limit = params.pageSize || 20;
        const offset = ((params.page || 1) - 1) * limit;

        const rows = await query<Record<string, unknown>>(
            `SELECT ea.*,
                eu.storage_provider, eu.file_key, eu.mime_type, eu.size_bytes,
                eu.duration_seconds, eu.thumbnail_key, eu.upload_status,
                eeu.url as external_url, eeu.provider_hint, eeu.embed_url,
                err.sim, err.event_id, err.subsession_id, err.lap, err.corner,
                err.timecode_hint, err.offset_seconds_before, err.offset_seconds_after,
                err.camera_hint, err.viewing_notes
             FROM evidence_assets ea
             LEFT JOIN evidence_uploads eu ON ea.id = eu.evidence_id
             LEFT JOIN evidence_external_urls eeu ON ea.id = eeu.evidence_id
             LEFT JOIN evidence_replay_refs err ON ea.id = err.evidence_id
             ${whereClause}
             ORDER BY ea.created_at DESC
             LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
            [...values, limit, offset]
        );

        return rows.map(r => this.mapRow(r));
    }

    // =========================================================================
    // Create Evidence
    // =========================================================================

    async createUploadEvidence(data: {
        leagueId: string;
        userId: string;
        userName: string;
        title: string;
        source: EvidenceSource;
        visibility: EvidenceVisibility;
        fileKey: string;
        mimeType: string;
        sizeBytes: number;
    }): Promise<EvidenceAsset> {
        const id = uuid();
        const now = new Date();

        // Create asset
        await query(
            `INSERT INTO evidence_assets (id, type, owner_league_id, uploaded_by_user_id, uploaded_by_name, title, source, visibility, created_at, updated_at)
             VALUES ($1, 'UPLOAD', $2, $3, $4, $5, $6, $7, $8, $9)`,
            [id, data.leagueId, data.userId, data.userName, data.title, data.source, data.visibility, now, now]
        );

        // Create upload record
        await query(
            `INSERT INTO evidence_uploads (evidence_id, storage_provider, file_key, mime_type, size_bytes, upload_status)
             VALUES ($1, 'DO_SPACES', $2, $3, $4, 'pending')`,
            [id, data.fileKey, data.mimeType, data.sizeBytes]
        );

        // Audit log
        await this.logAudit(id, 'UPLOADED', data.userId, data.userName, {
            title: data.title,
            fileKey: data.fileKey,
            sizeBytes: data.sizeBytes
        });

        return this.findById(id) as Promise<EvidenceAsset>;
    }

    async createExternalUrlEvidence(data: {
        leagueId: string;
        userId: string;
        userName: string;
        title: string;
        notes?: string;
        source: EvidenceSource;
        visibility: EvidenceVisibility;
        url: string;
        providerHint: 'youtube' | 'streamable' | 'drive' | 'other';
    }): Promise<EvidenceAsset> {
        const id = uuid();
        const now = new Date();

        // Create asset
        await query(
            `INSERT INTO evidence_assets (id, type, owner_league_id, uploaded_by_user_id, uploaded_by_name, title, notes, source, visibility, created_at, updated_at)
             VALUES ($1, 'EXTERNAL_URL', $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [id, data.leagueId, data.userId, data.userName, data.title, data.notes, data.source, data.visibility, now, now]
        );

        // Detect embed URL
        const embedUrl = this.getEmbedUrl(data.url, data.providerHint);

        // Create external URL record
        await query(
            `INSERT INTO evidence_external_urls (evidence_id, url, provider_hint, embed_url)
             VALUES ($1, $2, $3, $4)`,
            [id, data.url, data.providerHint, embedUrl]
        );

        // Audit log
        await this.logAudit(id, 'EXTERNAL_ADDED', data.userId, data.userName, {
            title: data.title,
            url: data.url,
            providerHint: data.providerHint
        });

        return this.findById(id) as Promise<EvidenceAsset>;
    }

    async createReplayRefEvidence(data: {
        leagueId: string;
        userId: string;
        userName: string;
        title: string;
        notes?: string;
        visibility: EvidenceVisibility;
        eventId: string;
        subsessionId?: string;
        lap: number;
        corner?: string;
        timecodeHint?: string;
        offsetSecondsBefore: number;
        offsetSecondsAfter: number;
        cameraHint?: string;
    }): Promise<EvidenceAsset> {
        const id = uuid();
        const now = new Date();

        // Create asset
        await query(
            `INSERT INTO evidence_assets (id, type, owner_league_id, uploaded_by_user_id, uploaded_by_name, title, notes, source, visibility, created_at, updated_at)
             VALUES ($1, 'IRACING_REPLAY_REF', $2, $3, $4, $5, $6, 'primary', $7, $8, $9)`,
            [id, data.leagueId, data.userId, data.userName, data.title, data.notes, data.visibility, now, now]
        );

        // Create replay ref record
        await query(
            `INSERT INTO evidence_replay_refs (evidence_id, sim, event_id, subsession_id, lap, corner, timecode_hint, offset_seconds_before, offset_seconds_after, camera_hint)
             VALUES ($1, 'iracing', $2, $3, $4, $5, $6, $7, $8, $9)`,
            [id, data.eventId, data.subsessionId, data.lap, data.corner, data.timecodeHint, data.offsetSecondsBefore, data.offsetSecondsAfter, data.cameraHint]
        );

        // Audit log
        await this.logAudit(id, 'REPLAY_REF_ADDED', data.userId, data.userName, {
            title: data.title,
            eventId: data.eventId,
            lap: data.lap
        });

        return this.findById(id) as Promise<EvidenceAsset>;
    }

    // =========================================================================
    // Update Evidence
    // =========================================================================

    async update(id: string, data: EvidenceUpdateRequest, userId: string, userName: string): Promise<EvidenceAsset | null> {
        const sets: string[] = ['updated_at = NOW()'];
        const values: unknown[] = [];
        let paramIndex = 1;

        if (data.title !== undefined) {
            sets.push(`title = $${paramIndex++}`);
            values.push(data.title);
        }
        if (data.notes !== undefined) {
            sets.push(`notes = $${paramIndex++}`);
            values.push(data.notes);
        }
        if (data.source !== undefined) {
            sets.push(`source = $${paramIndex++}`);
            values.push(data.source);
        }
        if (data.visibility !== undefined) {
            sets.push(`visibility = $${paramIndex++}`);
            values.push(data.visibility);

            await this.logAudit(id, 'VISIBILITY_CHANGED', userId, userName, { visibility: data.visibility });
        }
        if (data.assessment !== undefined) {
            sets.push(`assessment = $${paramIndex++}`);
            values.push(data.assessment);

            await this.logAudit(id, 'ASSESSMENT_CHANGED', userId, userName, {
                assessment: data.assessment,
                assessmentNotes: data.assessmentNotes
            });
        }
        if (data.assessmentNotes !== undefined) {
            sets.push(`assessment_notes = $${paramIndex++}`);
            values.push(data.assessmentNotes);
        }

        values.push(id);

        await query(
            `UPDATE evidence_assets SET ${sets.join(', ')} WHERE id = $${paramIndex}`,
            values
        );

        return this.findById(id);
    }

    async completeUpload(evidenceId: string, durationSeconds?: number): Promise<void> {
        await query(
            `UPDATE evidence_uploads SET upload_status = 'completed', duration_seconds = $2 WHERE evidence_id = $1`,
            [evidenceId, durationSeconds]
        );
    }

    // =========================================================================
    // Delete Evidence
    // =========================================================================

    async delete(id: string, userId: string, userName: string): Promise<boolean> {
        // Log before delete
        await this.logAudit(id, 'DELETED', userId, userName, {});

        const result = await query(
            `DELETE FROM evidence_assets WHERE id = $1`,
            [id]
        );

        return (result as unknown[]).length > 0;
    }

    // =========================================================================
    // Link/Unlink Evidence
    // =========================================================================

    async linkToIncident(evidenceId: string, incidentId: string, userId: string): Promise<void> {
        await query(
            `INSERT INTO evidence_links (evidence_id, incident_id, linked_by_user_id)
             VALUES ($1, $2, $3)
             ON CONFLICT DO NOTHING`,
            [evidenceId, incidentId, userId]
        );

        await this.logAudit(evidenceId, 'LINKED', userId, undefined, { incidentId });
    }

    async linkToCase(evidenceId: string, caseId: string, userId: string): Promise<void> {
        await query(
            `INSERT INTO evidence_links (evidence_id, case_id, linked_by_user_id)
             VALUES ($1, $2, $3)
             ON CONFLICT DO NOTHING`,
            [evidenceId, caseId, userId]
        );

        await this.logAudit(evidenceId, 'LINKED', userId, undefined, { caseId });
    }

    async linkToProtest(evidenceId: string, protestId: string, userId: string): Promise<void> {
        await query(
            `INSERT INTO evidence_links (evidence_id, protest_id, linked_by_user_id)
             VALUES ($1, $2, $3)
             ON CONFLICT DO NOTHING`,
            [evidenceId, protestId, userId]
        );

        await this.logAudit(evidenceId, 'LINKED', userId, undefined, { protestId });
    }

    async unlinkFromIncident(evidenceId: string, incidentId: string, userId: string): Promise<void> {
        await query(
            `DELETE FROM evidence_links WHERE evidence_id = $1 AND incident_id = $2`,
            [evidenceId, incidentId]
        );

        await this.logAudit(evidenceId, 'UNLINKED', userId, undefined, { incidentId });
    }

    async unlinkFromCase(evidenceId: string, caseId: string, userId: string): Promise<void> {
        await query(
            `DELETE FROM evidence_links WHERE evidence_id = $1 AND case_id = $2`,
            [evidenceId, caseId]
        );

        await this.logAudit(evidenceId, 'UNLINKED', userId, undefined, { caseId });
    }

    async unlinkFromProtest(evidenceId: string, protestId: string, userId: string): Promise<void> {
        await query(
            `DELETE FROM evidence_links WHERE evidence_id = $1 AND protest_id = $2`,
            [evidenceId, protestId]
        );

        await this.logAudit(evidenceId, 'UNLINKED', userId, undefined, { protestId });
    }

    async getLinkedEntityIds(evidenceId: string): Promise<{ incidentIds: string[]; caseIds: string[]; protestIds: string[] }> {
        const rows = await query<Record<string, unknown>>(
            `SELECT incident_id, case_id, protest_id FROM evidence_links WHERE evidence_id = $1`,
            [evidenceId]
        );

        return {
            incidentIds: rows.filter(r => r.incident_id).map(r => r.incident_id as string),
            caseIds: rows.filter(r => r.case_id).map(r => r.case_id as string),
            protestIds: rows.filter(r => r.protest_id).map(r => r.protest_id as string),
        };
    }

    // =========================================================================
    // Audit Log
    // =========================================================================

    async logAudit(
        evidenceId: string,
        action: EvidenceAuditAction,
        userId: string,
        userName?: string,
        details: Record<string, unknown> = {}
    ): Promise<void> {
        await query(
            `INSERT INTO evidence_audit_log (evidence_id, action, performed_by_user_id, performed_by_name, details)
             VALUES ($1, $2, $3, $4, $5)`,
            [evidenceId, action, userId, userName, JSON.stringify(details)]
        );
    }

    async getAuditLog(evidenceId: string): Promise<EvidenceAuditEntry[]> {
        const rows = await query<Record<string, unknown>>(
            `SELECT * FROM evidence_audit_log WHERE evidence_id = $1 ORDER BY timestamp DESC`,
            [evidenceId]
        );

        return rows.map(r => ({
            id: r.id as string,
            evidenceId: r.evidence_id as string,
            action: r.action as EvidenceAuditAction,
            performedByUserId: r.performed_by_user_id as string,
            performedByName: r.performed_by_name as string | undefined,
            details: r.details as Record<string, unknown>,
            timestamp: new Date(r.timestamp as string),
        }));
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private mapRow(row: Record<string, unknown>): EvidenceAsset {
        const asset: EvidenceAsset = {
            id: row.id as string,
            type: row.type as EvidenceType,
            ownerLeagueId: row.owner_league_id as string,
            uploadedByUserId: row.uploaded_by_user_id as string,
            uploadedByName: row.uploaded_by_name as string | undefined,
            title: row.title as string,
            notes: row.notes as string | undefined,
            source: row.source as EvidenceSource,
            visibility: row.visibility as EvidenceVisibility,
            assessment: row.assessment as EvidenceAssessment,
            assessmentNotes: row.assessment_notes as string | undefined,
            keyMoments: (row.key_moments as EvidenceKeyMoment[]) || [],
            incidentIds: [],
            caseIds: [],
            protestIds: [],
            createdAt: new Date(row.created_at as string),
            updatedAt: new Date(row.updated_at as string),
        };

        // Add upload details if present
        if (row.file_key) {
            asset.upload = {
                storageProvider: row.storage_provider as 'DO_SPACES' | 'S3' | 'LOCAL',
                fileKey: row.file_key as string,
                mimeType: row.mime_type as string,
                sizeBytes: parseInt(row.size_bytes as string) || 0,
                durationSeconds: row.duration_seconds ? parseFloat(row.duration_seconds as string) : undefined,
                thumbnailKey: row.thumbnail_key as string | undefined,
            };
        }

        // Add external URL details if present
        if (row.external_url) {
            asset.externalUrl = {
                url: row.external_url as string,
                providerHint: row.provider_hint as 'youtube' | 'streamable' | 'drive' | 'other',
                embedUrl: row.embed_url as string | undefined,
            };
        }

        // Add replay ref details if present
        if (row.event_id && row.sim) {
            asset.replayRef = {
                sim: row.sim as 'iracing',
                eventId: row.event_id as string,
                subsessionId: row.subsession_id as string | undefined,
                lap: parseInt(row.lap as string) || 0,
                corner: row.corner as string | undefined,
                timecodeHint: row.timecode_hint as string | undefined,
                offsetSecondsBefore: parseInt(row.offset_seconds_before as string) || 10,
                offsetSecondsAfter: parseInt(row.offset_seconds_after as string) || 10,
                cameraHint: row.camera_hint as string | undefined,
                viewingNotes: row.viewing_notes as string | undefined,
            };
        }

        return asset;
    }

    private getEmbedUrl(url: string, provider: string): string | undefined {
        if (provider === 'youtube') {
            // Extract video ID and create embed URL
            const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s]+)/);
            if (match) {
                return `https://www.youtube.com/embed/${match[1]}`;
            }
        }
        if (provider === 'streamable') {
            const match = url.match(/streamable\.com\/([a-zA-Z0-9]+)/);
            if (match) {
                return `https://streamable.com/e/${match[1]}`;
            }
        }
        return undefined;
    }
}
