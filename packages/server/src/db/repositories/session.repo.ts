// =====================================================================
// Session Repository
// =====================================================================

import { v4 as uuid } from 'uuid';
import { query, queryOne } from '../client.js';
import type { Session, SessionDriver, ListSessionsParams, CreateSessionRequest, UpdateSessionRequest } from '@controlbox/common';

export class SessionRepository {
    async findAll(params: ListSessionsParams = {}): Promise<Session[]> {
        const conditions: string[] = [];
        const values: unknown[] = [];
        let paramIndex = 1;

        if (params.status) {
            conditions.push(`status = $${paramIndex++}`);
            values.push(params.status);
        }
        if (params.simType) {
            conditions.push(`sim_type = $${paramIndex++}`);
            values.push(params.simType);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const limit = params.pageSize || 20;
        const offset = ((params.page || 1) - 1) * limit;

        const rows = await query<Record<string, unknown>>(
            `SELECT s.*,
                (SELECT COUNT(*) FROM session_drivers WHERE session_id = s.id) as driver_count,
                (SELECT COUNT(*) FROM incidents WHERE session_id = s.id) as incident_count,
                (SELECT COUNT(*) FROM penalties WHERE session_id = s.id) as penalty_count
             FROM sessions s ${whereClause} ORDER BY s.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
            [...values, limit, offset]
        );

        return rows.map(this.mapRow);
    }

    async count(params: ListSessionsParams = {}): Promise<number> {
        const conditions: string[] = [];
        const values: unknown[] = [];
        let paramIndex = 1;

        if (params.status) {
            conditions.push(`status = $${paramIndex++}`);
            values.push(params.status);
        }
        if (params.simType) {
            conditions.push(`sim_type = $${paramIndex++}`);
            values.push(params.simType);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const result = await queryOne<{ count: string }>(
            `SELECT COUNT(*) as count FROM sessions ${whereClause}`,
            values
        );

        return parseInt(result?.count || '0', 10);
    }

    async findById(id: string): Promise<Session | null> {
        const row = await queryOne<Record<string, unknown>>(
            `SELECT s.*,
                (SELECT COUNT(*) FROM session_drivers WHERE session_id = s.id) as driver_count,
                (SELECT COUNT(*) FROM incidents WHERE session_id = s.id) as incident_count,
                (SELECT COUNT(*) FROM penalties WHERE session_id = s.id) as penalty_count
             FROM sessions s WHERE s.id = $1`,
            [id]
        );

        return row ? this.mapRow(row) : null;
    }

    async create(data: CreateSessionRequest): Promise<Session> {
        const id = uuid();
        const now = new Date();

        await query(
            `INSERT INTO sessions (id, external_id, sim_type, track_name, track_config, session_type, metadata, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [id, data.externalId, data.simType, data.trackName, data.trackConfig, data.sessionType, JSON.stringify(data.metadata || {}), now, now]
        );

        return this.findById(id) as Promise<Session>;
    }

    async update(id: string, data: UpdateSessionRequest): Promise<Session | null> {
        const sets: string[] = ['updated_at = NOW()'];
        const values: unknown[] = [];
        let paramIndex = 1;

        if (data.status !== undefined) {
            sets.push(`status = $${paramIndex++}`);
            values.push(data.status);
        }
        if (data.endedAt !== undefined) {
            sets.push(`ended_at = $${paramIndex++}`);
            values.push(data.endedAt);
        }
        if (data.metadata !== undefined) {
            sets.push(`metadata = $${paramIndex++}`);
            values.push(JSON.stringify(data.metadata));
        }

        values.push(id);

        await query(
            `UPDATE sessions SET ${sets.join(', ')} WHERE id = $${paramIndex}`,
            values
        );

        return this.findById(id);
    }

    async getDrivers(sessionId: string): Promise<SessionDriver[]> {
        const rows = await query<Record<string, unknown>>(
            'SELECT * FROM session_drivers WHERE session_id = $1 ORDER BY joined_at',
            [sessionId]
        );

        return rows.map(this.mapDriverRow);
    }

    private mapRow(row: Record<string, unknown>): Session {
        return {
            id: row.id as string,
            externalId: row.external_id as string | undefined,
            simType: row.sim_type as 'iracing' | 'acc' | 'rf2',
            trackName: row.track_name as string,
            trackConfig: row.track_config as string | undefined,
            sessionType: row.session_type as 'practice' | 'qualifying' | 'race' | 'warmup',
            status: row.status as 'pending' | 'active' | 'paused' | 'finished' | 'abandoned',
            startedAt: row.started_at ? new Date(row.started_at as string) : undefined,
            endedAt: row.ended_at ? new Date(row.ended_at as string) : undefined,
            driverCount: parseInt(row.driver_count as string) || 0,
            incidentCount: parseInt(row.incident_count as string) || 0,
            penaltyCount: parseInt(row.penalty_count as string) || 0,
            metadata: (row.metadata as Record<string, unknown>) || {},
            createdAt: new Date(row.created_at as string),
            updatedAt: new Date(row.updated_at as string),
        };
    }

    private mapDriverRow(row: Record<string, unknown>): SessionDriver {
        return {
            id: row.id as string,
            sessionId: row.session_id as string,
            driverId: row.driver_id as string,
            driverName: row.driver_name as string,
            carNumber: row.car_number as string,
            carName: row.car_name as string,
            teamName: row.team_name as string | undefined,
            irating: row.irating as number | undefined,
            safetyRating: row.safety_rating ? parseFloat(row.safety_rating as string) : undefined,
            joinedAt: new Date(row.joined_at as string),
            leftAt: row.left_at ? new Date(row.left_at as string) : undefined,
            isActive: !row.left_at,
        };
    }
}
