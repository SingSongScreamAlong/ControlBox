// =====================================================================
// Incident Repository
// =====================================================================

import { v4 as uuid } from 'uuid';
import { query, queryOne } from '../client.js';
import type { IncidentEvent, ListIncidentsParams, UpdateIncidentRequest } from '@controlbox/common';

export class IncidentRepository {
    async findAll(params: ListIncidentsParams = {}): Promise<IncidentEvent[]> {
        const conditions: string[] = [];
        const values: unknown[] = [];
        let paramIndex = 1;

        if (params.sessionId) {
            conditions.push(`session_id = $${paramIndex++}`);
            values.push(params.sessionId);
        }
        if (params.type) {
            conditions.push(`incident_type = $${paramIndex++}`);
            values.push(params.type);
        }
        if (params.severity) {
            conditions.push(`severity = $${paramIndex++}`);
            values.push(params.severity);
        }
        if (params.status) {
            conditions.push(`status = $${paramIndex++}`);
            values.push(params.status);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const limit = params.pageSize || 20;
        const offset = ((params.page || 1) - 1) * limit;

        const rows = await query<Record<string, unknown>>(
            `SELECT * FROM incidents ${whereClause} ORDER BY session_time_ms DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
            [...values, limit, offset]
        );

        return rows.map(this.mapRow);
    }

    async count(params: ListIncidentsParams = {}): Promise<number> {
        const conditions: string[] = [];
        const values: unknown[] = [];
        let paramIndex = 1;

        if (params.sessionId) {
            conditions.push(`session_id = $${paramIndex++}`);
            values.push(params.sessionId);
        }
        if (params.type) {
            conditions.push(`incident_type = $${paramIndex++}`);
            values.push(params.type);
        }
        if (params.status) {
            conditions.push(`status = $${paramIndex++}`);
            values.push(params.status);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const result = await queryOne<{ count: string }>(
            `SELECT COUNT(*) as count FROM incidents ${whereClause}`,
            values
        );

        return parseInt(result?.count || '0', 10);
    }

    async findById(id: string): Promise<IncidentEvent | null> {
        const row = await queryOne<Record<string, unknown>>(
            'SELECT * FROM incidents WHERE id = $1',
            [id]
        );

        return row ? this.mapRow(row) : null;
    }

    async create(data: Partial<IncidentEvent>): Promise<IncidentEvent> {
        const id = uuid();
        const now = new Date();

        await query(
            `INSERT INTO incidents (id, session_id, incident_type, contact_type, severity, severity_score, lap_number, session_time_ms, track_position, corner_name, involved_drivers, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
            [
                id, data.sessionId, data.type, data.contactType, data.severity, data.severityScore,
                data.lapNumber, data.sessionTimeMs, data.trackPosition, data.cornerName,
                JSON.stringify(data.involvedDrivers || []), 'pending', now, now
            ]
        );

        return this.findById(id) as Promise<IncidentEvent>;
    }

    async update(id: string, data: UpdateIncidentRequest): Promise<IncidentEvent | null> {
        const sets: string[] = ['updated_at = NOW()'];
        const values: unknown[] = [];
        let paramIndex = 1;

        if (data.status !== undefined) {
            sets.push(`status = $${paramIndex++}`);
            values.push(data.status);
        }
        if (data.stewardNotes !== undefined) {
            sets.push(`steward_notes = $${paramIndex++}`);
            values.push(data.stewardNotes);
        }
        if (data.reviewedBy !== undefined) {
            sets.push(`reviewed_by = $${paramIndex++}`);
            sets.push(`reviewed_at = NOW()`);
            values.push(data.reviewedBy);
        }

        values.push(id);

        await query(
            `UPDATE incidents SET ${sets.join(', ')} WHERE id = $${paramIndex}`,
            values
        );

        return this.findById(id);
    }

    private mapRow(row: Record<string, unknown>): IncidentEvent {
        return {
            id: row.id as string,
            sessionId: row.session_id as string,
            type: row.incident_type as IncidentEvent['type'],
            contactType: row.contact_type as IncidentEvent['contactType'],
            severity: row.severity as IncidentEvent['severity'],
            severityScore: parseFloat(row.severity_score as string || '0'),
            lapNumber: row.lap_number as number,
            sessionTimeMs: parseInt(row.session_time_ms as string || '0', 10),
            trackPosition: parseFloat(row.track_position as string || '0'),
            cornerName: row.corner_name as string | undefined,
            involvedDrivers: (row.involved_drivers as IncidentEvent['involvedDrivers']) || [],
            aiAnalysis: row.ai_recommendation ? {
                recommendation: row.ai_recommendation as IncidentEvent['aiAnalysis'] extends { recommendation: infer R } ? R : never,
                confidence: parseFloat(row.ai_confidence as string || '0'),
                reasoning: row.ai_reasoning as string,
                faultAttribution: (row.fault_attribution as Record<string, number>) || {},
                patterns: [],
                modelId: 'unknown',
                analyzedAt: new Date(),
            } : undefined,
            status: row.status as IncidentEvent['status'],
            reviewedBy: row.reviewed_by as string | undefined,
            reviewedAt: row.reviewed_at ? new Date(row.reviewed_at as string) : undefined,
            stewardNotes: row.steward_notes as string | undefined,
            replayTimestampMs: row.replay_timestamp_ms ? parseInt(row.replay_timestamp_ms as string, 10) : undefined,
            createdAt: new Date(row.created_at as string),
            updatedAt: new Date(row.updated_at as string),
        };
    }
}
