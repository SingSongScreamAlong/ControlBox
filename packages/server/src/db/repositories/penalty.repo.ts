// =====================================================================
// Penalty Repository
// =====================================================================

import { v4 as uuid } from 'uuid';
import { query, queryOne } from '../client.js';
import type { Penalty, ListPenaltiesParams, CreatePenaltyRequest, UpdatePenaltyRequest, ApprovePenaltyRequest } from '@controlbox/common';

export class PenaltyRepository {
    async findAll(params: ListPenaltiesParams = {}): Promise<Penalty[]> {
        const conditions: string[] = [];
        const values: unknown[] = [];
        let paramIndex = 1;

        if (params.sessionId) {
            conditions.push(`session_id = $${paramIndex++}`);
            values.push(params.sessionId);
        }
        if (params.status) {
            conditions.push(`status = $${paramIndex++}`);
            values.push(params.status);
        }
        if (params.driverId) {
            conditions.push(`driver_id = $${paramIndex++}`);
            values.push(params.driverId);
        }
        if (params.type) {
            conditions.push(`penalty_type = $${paramIndex++}`);
            values.push(params.type);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const limit = params.pageSize || 20;
        const offset = ((params.page || 1) - 1) * limit;

        const rows = await query<Record<string, unknown>>(
            `SELECT * FROM penalties ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
            [...values, limit, offset]
        );

        return rows.map(this.mapRow);
    }

    async count(params: ListPenaltiesParams = {}): Promise<number> {
        const conditions: string[] = [];
        const values: unknown[] = [];
        let paramIndex = 1;

        if (params.sessionId) {
            conditions.push(`session_id = $${paramIndex++}`);
            values.push(params.sessionId);
        }
        if (params.status) {
            conditions.push(`status = $${paramIndex++}`);
            values.push(params.status);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const result = await queryOne<{ count: string }>(
            `SELECT COUNT(*) as count FROM penalties ${whereClause}`,
            values
        );

        return parseInt(result?.count || '0', 10);
    }

    async findById(id: string): Promise<Penalty | null> {
        const row = await queryOne<Record<string, unknown>>(
            'SELECT * FROM penalties WHERE id = $1',
            [id]
        );

        return row ? this.mapRow(row) : null;
    }

    async create(data: CreatePenaltyRequest): Promise<Penalty> {
        const id = uuid();
        const now = new Date();

        await query(
            `INSERT INTO penalties (id, session_id, incident_id, driver_id, driver_name, car_number, penalty_type, penalty_value, rule_reference, rationale, points, status, proposed_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'proposed', 'system', $12, $13)`,
            [
                id, data.sessionId, data.incidentId, data.driverId, data.driverName, data.carNumber,
                data.type, data.value, data.ruleReference, data.rationale, data.points, now, now
            ]
        );

        return this.findById(id) as Promise<Penalty>;
    }

    async update(id: string, data: UpdatePenaltyRequest): Promise<Penalty | null> {
        const sets: string[] = ['updated_at = NOW()'];
        const values: unknown[] = [];
        let paramIndex = 1;

        if (data.status !== undefined) {
            sets.push(`status = $${paramIndex++}`);
            values.push(data.status);
        }
        if (data.rationale !== undefined) {
            sets.push(`rationale = $${paramIndex++}`);
            values.push(data.rationale);
        }
        if (data.type !== undefined) {
            sets.push(`penalty_type = $${paramIndex++}`);
            values.push(data.type);
        }
        if (data.value !== undefined) {
            sets.push(`penalty_value = $${paramIndex++}`);
            values.push(data.value);
        }
        if (data.points !== undefined) {
            sets.push(`points = $${paramIndex++}`);
            values.push(data.points);
        }

        values.push(id);

        await query(
            `UPDATE penalties SET ${sets.join(', ')} WHERE id = $${paramIndex}`,
            values
        );

        return this.findById(id);
    }

    async approve(id: string, data: ApprovePenaltyRequest): Promise<Penalty | null> {
        const sets = ['status = $1', 'approved_at = NOW()', 'updated_at = NOW()'];
        const values: unknown[] = ['approved'];
        let paramIndex = 2;

        if (data.notes) {
            // Append to evidence bundle
        }
        if (data.modifiedValue) {
            sets.push(`penalty_value = $${paramIndex++}`);
            values.push(data.modifiedValue);
        }

        values.push(id);

        await query(
            `UPDATE penalties SET ${sets.join(', ')} WHERE id = $${paramIndex}`,
            values
        );

        return this.findById(id);
    }

    private mapRow(row: Record<string, unknown>): Penalty {
        return {
            id: row.id as string,
            sessionId: row.session_id as string,
            incidentId: row.incident_id as string | undefined,
            rulebookId: row.rulebook_id as string | undefined,
            driverId: row.driver_id as string,
            driverName: row.driver_name as string,
            carNumber: row.car_number as string,
            type: row.penalty_type as Penalty['type'],
            value: row.penalty_value as string,
            ruleReference: row.rule_reference as string | undefined,
            severity: (row.severity as Penalty['severity']) || 'medium',
            points: row.points as number | undefined,
            rationale: row.rationale as string,
            evidenceBundle: (row.evidence_bundle as Penalty['evidenceBundle']) || {},
            status: row.status as Penalty['status'],
            proposedBy: row.proposed_by as 'system' | string,
            proposedAt: new Date(row.created_at as string),
            approvedBy: row.approved_by as string | undefined,
            approvedAt: row.approved_at ? new Date(row.approved_at as string) : undefined,
            appliedAt: row.applied_at ? new Date(row.applied_at as string) : undefined,
            isAppealed: row.is_appealed as boolean || false,
            appeal: row.appeal as Penalty['appeal'],
            createdAt: new Date(row.created_at as string),
            updatedAt: new Date(row.updated_at as string),
        };
    }
}
