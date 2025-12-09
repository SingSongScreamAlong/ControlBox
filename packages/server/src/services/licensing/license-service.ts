// =====================================================================
// License Service
// License management and validation
// =====================================================================

import type {
    License,
    LicenseStatus,
    LicenseValidation,
    LicenseError,
    CreateLicenseRequest,
    UpdateLicenseRequest
} from '@controlbox/common';
import { pool } from '../../db/client.js';

/**
 * Database row type for licenses
 */
interface LicenseRow {
    id: string;
    league_id: string;
    series_id: string;
    season_id: string;
    status: string;
    start_date: Date;
    end_date: Date;
    notes: string | null;
    max_concurrent_sessions: number;
    features: Record<string, boolean>;
    created_at: Date;
    updated_at: Date;
}

function mapRowToLicense(row: LicenseRow): License {
    return {
        id: row.id,
        leagueId: row.league_id,
        seriesId: row.series_id,
        seasonId: row.season_id,
        status: row.status as LicenseStatus,
        startDate: row.start_date,
        endDate: row.end_date,
        notes: row.notes ?? undefined,
        maxConcurrentSessions: row.max_concurrent_sessions,
        features: row.features,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

export class LicenseService {
    /**
     * Get license by ID
     */
    async getById(id: string): Promise<License | null> {
        const result = await pool.query<LicenseRow>(
            `SELECT * FROM licenses WHERE id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return null;
        }

        return mapRowToLicense(result.rows[0]);
    }

    /**
     * Get license for a season
     */
    async getBySeasonId(seasonId: string): Promise<License | null> {
        const result = await pool.query<LicenseRow>(
            `SELECT * FROM licenses WHERE season_id = $1`,
            [seasonId]
        );

        if (result.rows.length === 0) {
            return null;
        }

        return mapRowToLicense(result.rows[0]);
    }

    /**
     * Get all licenses for a league
     */
    async getByLeagueId(leagueId: string): Promise<License[]> {
        const result = await pool.query<LicenseRow>(
            `SELECT * FROM licenses WHERE league_id = $1 ORDER BY created_at DESC`,
            [leagueId]
        );

        return result.rows.map(mapRowToLicense);
    }

    /**
     * Get all licenses
     */
    async getAll(): Promise<License[]> {
        const result = await pool.query<LicenseRow>(
            `SELECT * FROM licenses ORDER BY created_at DESC`
        );

        return result.rows.map(mapRowToLicense);
    }

    /**
     * Validate a license for current access
     */
    async validateLicense(seasonId: string): Promise<LicenseValidation> {
        const license = await this.getBySeasonId(seasonId);

        if (!license) {
            return { isValid: false, error: 'LICENSE_NOT_FOUND' };
        }

        return this.checkLicenseValidity(license);
    }

    /**
     * Validate a license by ID
     */
    async validateLicenseById(licenseId: string): Promise<LicenseValidation> {
        const license = await this.getById(licenseId);

        if (!license) {
            return { isValid: false, error: 'LICENSE_NOT_FOUND' };
        }

        return this.checkLicenseValidity(license);
    }

    /**
     * Check if a license is currently valid
     */
    checkLicenseValidity(license: License): LicenseValidation {
        const now = new Date();

        // Check status
        if (license.status === 'suspended') {
            return { isValid: false, license, error: 'LICENSE_SUSPENDED' };
        }

        if (license.status === 'expired') {
            return { isValid: false, license, error: 'LICENSE_EXPIRED' };
        }

        if (license.status === 'pending') {
            return { isValid: false, license, error: 'LICENSE_INACTIVE' };
        }

        // Check dates
        if (now < license.startDate) {
            return { isValid: false, license, error: 'LICENSE_NOT_STARTED' };
        }

        if (now > license.endDate) {
            return { isValid: false, license, error: 'LICENSE_EXPIRED' };
        }

        // License is valid
        return { isValid: true, license };
    }

    /**
     * Create a new license
     */
    async create(request: CreateLicenseRequest): Promise<License> {
        const result = await pool.query<LicenseRow>(
            `INSERT INTO licenses (league_id, series_id, season_id, status, start_date, end_date, notes, max_concurrent_sessions)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [
                request.leagueId,
                request.seriesId,
                request.seasonId,
                request.status ?? 'pending',
                request.startDate,
                request.endDate,
                request.notes ?? null,
                request.maxConcurrentSessions ?? 1
            ]
        );

        console.log(`📜 Created license for season ${request.seasonId}`);
        return mapRowToLicense(result.rows[0]);
    }

    /**
     * Update license status
     */
    async updateStatus(id: string, status: LicenseStatus): Promise<License | null> {
        const result = await pool.query<LicenseRow>(
            `UPDATE licenses SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
            [status, id]
        );

        if (result.rows.length === 0) {
            return null;
        }

        console.log(`📜 License ${id} status updated to ${status}`);
        return mapRowToLicense(result.rows[0]);
    }

    /**
     * Update license
     */
    async update(id: string, updates: UpdateLicenseRequest): Promise<License | null> {
        const setClauses: string[] = [];
        const values: unknown[] = [];
        let paramIndex = 1;

        if (updates.status !== undefined) {
            setClauses.push(`status = $${paramIndex++}`);
            values.push(updates.status);
        }
        if (updates.startDate !== undefined) {
            setClauses.push(`start_date = $${paramIndex++}`);
            values.push(updates.startDate);
        }
        if (updates.endDate !== undefined) {
            setClauses.push(`end_date = $${paramIndex++}`);
            values.push(updates.endDate);
        }
        if (updates.notes !== undefined) {
            setClauses.push(`notes = $${paramIndex++}`);
            values.push(updates.notes);
        }
        if (updates.maxConcurrentSessions !== undefined) {
            setClauses.push(`max_concurrent_sessions = $${paramIndex++}`);
            values.push(updates.maxConcurrentSessions);
        }

        if (setClauses.length === 0) {
            return this.getById(id);
        }

        setClauses.push(`updated_at = NOW()`);
        values.push(id);

        const result = await pool.query<LicenseRow>(
            `UPDATE licenses SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            values
        );

        if (result.rows.length === 0) {
            return null;
        }

        return mapRowToLicense(result.rows[0]);
    }

    /**
     * Activate a pending license
     */
    async activateLicense(id: string): Promise<License | null> {
        return this.updateStatus(id, 'active');
    }

    /**
     * Suspend an active license
     */
    async suspendLicense(id: string): Promise<License | null> {
        return this.updateStatus(id, 'suspended');
    }

    /**
     * Expire a license
     */
    async expireLicense(id: string): Promise<License | null> {
        return this.updateStatus(id, 'expired');
    }

    /**
     * Auto-expire licenses past their end date
     */
    async autoExpireOldLicenses(): Promise<number> {
        const result = await pool.query(
            `UPDATE licenses SET status = 'expired', updated_at = NOW()
             WHERE status = 'active' AND end_date < NOW()`
        );

        const count = result.rowCount ?? 0;
        if (count > 0) {
            console.log(`⏰ Auto-expired ${count} licenses`);
        }

        return count;
    }

    /**
     * Get human-readable error message for license errors
     */
    getLicenseErrorMessage(error: LicenseError): string {
        switch (error) {
            case 'LICENSE_NOT_FOUND':
                return 'No license found for this season. Contact your league admin to obtain access.';
            case 'LICENSE_INACTIVE':
                return 'This season\'s license is pending activation. Contact your league admin.';
            case 'LICENSE_EXPIRED':
                return 'This season\'s ControlBox license has expired. Contact your league admin to renew access.';
            case 'LICENSE_SUSPENDED':
                return 'This season\'s license has been suspended. Contact your league admin for more information.';
            case 'LICENSE_NOT_STARTED':
                return 'This season\'s license is not yet active. It will become available on the start date.';
            default:
                return 'License validation failed. Contact your league admin.';
        }
    }
}

// Singleton instance
let licenseServiceInstance: LicenseService | null = null;

export function getLicenseService(): LicenseService {
    if (!licenseServiceInstance) {
        licenseServiceInstance = new LicenseService();
    }
    return licenseServiceInstance;
}
