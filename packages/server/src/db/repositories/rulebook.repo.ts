// =====================================================================
// Rulebook Repository
// =====================================================================

import { v4 as uuid } from 'uuid';
import { query, queryOne } from '../client.js';
import type { Rulebook, CreateRulebookRequest, UpdateRulebookRequest } from '@controlbox/common';

export class RulebookRepository {
    async findAll(): Promise<Rulebook[]> {
        const rows = await query<Record<string, unknown>>(
            'SELECT * FROM rulebooks ORDER BY created_at DESC'
        );

        return rows.map(this.mapRow);
    }

    async findById(id: string): Promise<Rulebook | null> {
        const row = await queryOne<Record<string, unknown>>(
            'SELECT * FROM rulebooks WHERE id = $1',
            [id]
        );

        return row ? this.mapRow(row) : null;
    }

    async findActive(): Promise<Rulebook | null> {
        const row = await queryOne<Record<string, unknown>>(
            'SELECT * FROM rulebooks WHERE is_active = true ORDER BY created_at DESC LIMIT 1'
        );

        return row ? this.mapRow(row) : null;
    }

    async create(data: CreateRulebookRequest): Promise<Rulebook> {
        const id = uuid();
        const now = new Date();

        await query(
            `INSERT INTO rulebooks (id, name, league_name, version, description, rules, penalty_matrix, settings, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9, $10)`,
            [
                id, data.name, data.leagueName, data.version, data.description,
                JSON.stringify(data.rules), JSON.stringify(data.penaltyMatrix), JSON.stringify(data.settings),
                now, now
            ]
        );

        return this.findById(id) as Promise<Rulebook>;
    }

    async update(id: string, data: UpdateRulebookRequest): Promise<Rulebook | null> {
        const sets: string[] = ['updated_at = NOW()'];
        const values: unknown[] = [];
        let paramIndex = 1;

        if (data.name !== undefined) {
            sets.push(`name = $${paramIndex++}`);
            values.push(data.name);
        }
        if (data.leagueName !== undefined) {
            sets.push(`league_name = $${paramIndex++}`);
            values.push(data.leagueName);
        }
        if (data.version !== undefined) {
            sets.push(`version = $${paramIndex++}`);
            values.push(data.version);
        }
        if (data.description !== undefined) {
            sets.push(`description = $${paramIndex++}`);
            values.push(data.description);
        }
        if (data.rules !== undefined) {
            sets.push(`rules = $${paramIndex++}`);
            values.push(JSON.stringify(data.rules));
        }
        if (data.penaltyMatrix !== undefined) {
            sets.push(`penalty_matrix = $${paramIndex++}`);
            values.push(JSON.stringify(data.penaltyMatrix));
        }
        if (data.settings !== undefined) {
            sets.push(`settings = $${paramIndex++}`);
            values.push(JSON.stringify(data.settings));
        }
        if (data.isActive !== undefined) {
            sets.push(`is_active = $${paramIndex++}`);
            values.push(data.isActive);
        }

        values.push(id);

        await query(
            `UPDATE rulebooks SET ${sets.join(', ')} WHERE id = $${paramIndex}`,
            values
        );

        return this.findById(id);
    }

    async delete(id: string): Promise<boolean> {
        const result = await query(
            'DELETE FROM rulebooks WHERE id = $1',
            [id]
        );

        return result.length >= 0; // pg returns empty array on success
    }

    private mapRow(row: Record<string, unknown>): Rulebook {
        return {
            id: row.id as string,
            name: row.name as string,
            leagueName: row.league_name as string,
            version: row.version as string,
            description: row.description as string | undefined,
            rules: row.rules as Rulebook['rules'],
            penaltyMatrix: row.penalty_matrix as Rulebook['penaltyMatrix'],
            settings: row.settings as Rulebook['settings'],
            isActive: row.is_active as boolean,
            createdAt: new Date(row.created_at as string),
            updatedAt: new Date(row.updated_at as string),
        };
    }
}
