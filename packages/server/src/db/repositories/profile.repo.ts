// =====================================================================
// Discipline Profile Repository
// Database access for discipline profiles
// =====================================================================

import { pool } from '../client.js';
import type {
    DisciplineProfile,
    DisciplineCategory,
    CautionConfiguration,
    PenaltyModelConfiguration,
    SeverityThresholds,
    SpecialRulesConfiguration,
    CreateProfileRequest,
    UpdateProfileRequest
} from '@controlbox/common';

/**
 * Database row type for discipline_profiles table
 */
interface ProfileRow {
    id: string;
    name: string;
    category: string;
    description: string | null;
    caution_rules: CautionConfiguration;
    penalty_model: PenaltyModelConfiguration;
    incident_thresholds: SeverityThresholds;
    special_rules: SpecialRulesConfiguration;
    is_default: boolean;
    is_builtin: boolean;
    version: string;
    created_at: Date;
    updated_at: Date;
}

/**
 * Maps database row to DisciplineProfile
 */
function mapRowToProfile(row: ProfileRow): DisciplineProfile {
    return {
        id: row.id,
        name: row.name,
        category: row.category as DisciplineCategory,
        description: row.description ?? undefined,
        cautionRules: row.caution_rules,
        penaltyModel: row.penalty_model,
        incidentThresholds: row.incident_thresholds,
        specialRules: row.special_rules,
        isDefault: row.is_default,
        version: row.version,
        metadata: { isBuiltin: row.is_builtin },
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

export class DisciplineProfileRepository {
    /**
     * Find profile by ID
     */
    async findById(id: string): Promise<DisciplineProfile | null> {
        const result = await pool.query<ProfileRow>(
            `SELECT * FROM discipline_profiles WHERE id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return null;
        }

        return mapRowToProfile(result.rows[0]);
    }

    /**
     * Find all profiles
     */
    async findAll(): Promise<DisciplineProfile[]> {
        const result = await pool.query<ProfileRow>(
            `SELECT * FROM discipline_profiles ORDER BY category, name`
        );

        return result.rows.map(mapRowToProfile);
    }

    /**
     * Find profiles by category
     */
    async findByCategory(category: DisciplineCategory): Promise<DisciplineProfile[]> {
        const result = await pool.query<ProfileRow>(
            `SELECT * FROM discipline_profiles WHERE category = $1 ORDER BY name`,
            [category]
        );

        return result.rows.map(mapRowToProfile);
    }

    /**
     * Find default profile for a category
     */
    async findDefault(category: DisciplineCategory): Promise<DisciplineProfile | null> {
        const result = await pool.query<ProfileRow>(
            `SELECT * FROM discipline_profiles WHERE category = $1 AND is_default = true LIMIT 1`,
            [category]
        );

        if (result.rows.length === 0) {
            // Fall back to any profile in category
            const fallback = await pool.query<ProfileRow>(
                `SELECT * FROM discipline_profiles WHERE category = $1 ORDER BY created_at LIMIT 1`,
                [category]
            );
            if (fallback.rows.length > 0) {
                return mapRowToProfile(fallback.rows[0]);
            }
            return null;
        }

        return mapRowToProfile(result.rows[0]);
    }

    /**
     * Find all built-in profiles
     */
    async findBuiltIn(): Promise<DisciplineProfile[]> {
        const result = await pool.query<ProfileRow>(
            `SELECT * FROM discipline_profiles WHERE is_builtin = true ORDER BY category, name`
        );

        return result.rows.map(mapRowToProfile);
    }

    /**
     * Create a new profile
     */
    async create(request: CreateProfileRequest): Promise<DisciplineProfile> {
        const result = await pool.query<ProfileRow>(
            `INSERT INTO discipline_profiles (
                name, category, description, 
                caution_rules, penalty_model, incident_thresholds, special_rules,
                is_default, version
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *`,
            [
                request.name,
                request.category,
                request.description ?? null,
                JSON.stringify(request.cautionRules),
                JSON.stringify(request.penaltyModel),
                JSON.stringify(request.incidentThresholds),
                JSON.stringify(request.specialRules ?? {}),
                request.isDefault ?? false,
                request.version ?? '1.0.0'
            ]
        );

        return mapRowToProfile(result.rows[0]);
    }

    /**
     * Update an existing profile
     */
    async update(id: string, updates: UpdateProfileRequest): Promise<DisciplineProfile | null> {
        // Build dynamic update query
        const setClauses: string[] = [];
        const values: unknown[] = [];
        let paramIndex = 1;

        if (updates.name !== undefined) {
            setClauses.push(`name = $${paramIndex++}`);
            values.push(updates.name);
        }
        if (updates.description !== undefined) {
            setClauses.push(`description = $${paramIndex++}`);
            values.push(updates.description);
        }
        if (updates.cautionRules !== undefined) {
            setClauses.push(`caution_rules = $${paramIndex++}`);
            values.push(JSON.stringify(updates.cautionRules));
        }
        if (updates.penaltyModel !== undefined) {
            setClauses.push(`penalty_model = $${paramIndex++}`);
            values.push(JSON.stringify(updates.penaltyModel));
        }
        if (updates.incidentThresholds !== undefined) {
            setClauses.push(`incident_thresholds = $${paramIndex++}`);
            values.push(JSON.stringify(updates.incidentThresholds));
        }
        if (updates.specialRules !== undefined) {
            setClauses.push(`special_rules = $${paramIndex++}`);
            values.push(JSON.stringify(updates.specialRules));
        }
        if (updates.isDefault !== undefined) {
            setClauses.push(`is_default = $${paramIndex++}`);
            values.push(updates.isDefault);
        }
        if (updates.version !== undefined) {
            setClauses.push(`version = $${paramIndex++}`);
            values.push(updates.version);
        }

        if (setClauses.length === 0) {
            return this.findById(id);
        }

        setClauses.push(`updated_at = NOW()`);
        values.push(id);

        const result = await pool.query<ProfileRow>(
            `UPDATE discipline_profiles SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            values
        );

        if (result.rows.length === 0) {
            return null;
        }

        return mapRowToProfile(result.rows[0]);
    }

    /**
     * Delete a profile (built-in profiles cannot be deleted)
     */
    async delete(id: string): Promise<boolean> {
        const result = await pool.query(
            `DELETE FROM discipline_profiles WHERE id = $1 AND is_builtin = false`,
            [id]
        );

        return (result.rowCount ?? 0) > 0;
    }

    /**
     * Set a profile as the default for its category
     */
    async setAsDefault(id: string): Promise<DisciplineProfile | null> {
        const profile = await this.findById(id);
        if (!profile) return null;

        // Clear current default for category
        await pool.query(
            `UPDATE discipline_profiles SET is_default = false WHERE category = $1`,
            [profile.category]
        );

        // Set new default
        const result = await pool.query<ProfileRow>(
            `UPDATE discipline_profiles SET is_default = true, updated_at = NOW() WHERE id = $1 RETURNING *`,
            [id]
        );

        return mapRowToProfile(result.rows[0]);
    }

    /**
     * Duplicate an existing profile
     */
    async duplicate(id: string, newName: string): Promise<DisciplineProfile | null> {
        const source = await this.findById(id);
        if (!source) return null;

        return this.create({
            name: newName,
            category: source.category,
            description: source.description ? `Copy of ${source.description}` : undefined,
            cautionRules: source.cautionRules,
            penaltyModel: source.penaltyModel,
            incidentThresholds: source.incidentThresholds,
            specialRules: source.specialRules,
            isDefault: false,
            version: '1.0.0'
        });
    }
}
