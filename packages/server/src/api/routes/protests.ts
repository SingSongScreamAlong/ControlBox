// =====================================================================
// Protests API Routes
// CRUD operations for protests and appeals
// =====================================================================

import { Router, Request, Response } from 'express';
import { pool } from '../../db/client.js';
import { requireAuth } from '../middleware/auth.js';
import type { CreateProtestRequest, CreateAppealRequest } from '@controlbox/common';

const router = Router();

// ========================
// Protests Routes
// ========================

// List protests
router.get('/', requireAuth, async (req: Request, res: Response) => {
    try {
        const { leagueId, status, limit = 50, offset = 0 } = req.query;

        let query = `
            SELECT p.*, 
                   i.type as incident_type,
                   i.severity as incident_severity,
                   au.display_name as resolved_by_name
            FROM protests p
            LEFT JOIN incidents i ON p.incident_id = i.id
            LEFT JOIN admin_users au ON p.resolved_by = au.id
            WHERE 1=1
        `;
        const params: unknown[] = [];
        let paramCount = 0;

        if (leagueId) {
            paramCount++;
            query += ` AND p.league_id = $${paramCount}`;
            params.push(leagueId);
        }

        if (status) {
            paramCount++;
            query += ` AND p.status = $${paramCount}`;
            params.push(status);
        }

        query += ` ORDER BY p.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);

        res.json({
            success: true,
            data: result.rows.map(row => ({
                id: row.id,
                leagueId: row.league_id,
                incidentId: row.incident_id,
                penaltyId: row.penalty_id,
                submittedByDriverId: row.submitted_by_driver_id,
                submittedByName: row.submitted_by_name,
                submittedByEmail: row.submitted_by_email,
                status: row.status,
                grounds: row.grounds,
                evidenceUrls: row.evidence_urls || [],
                stewardNotes: row.steward_notes,
                resolution: row.resolution,
                resolvedBy: row.resolved_by,
                resolvedByName: row.resolved_by_name,
                resolvedAt: row.resolved_at,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
                incidentType: row.incident_type,
                incidentSeverity: row.incident_severity
            }))
        });
    } catch (error) {
        console.error('Error fetching protests:', error);
        return void res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch protests' } });
    }
});

// Get single protest
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const result = await pool.query(`
            SELECT p.*, 
                   i.type as incident_type,
                   i.severity as incident_severity,
                   au.display_name as resolved_by_name
            FROM protests p
            LEFT JOIN incidents i ON p.incident_id = i.id
            LEFT JOIN admin_users au ON p.resolved_by = au.id
            WHERE p.id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return void res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Protest not found' } });
        }

        const row = result.rows[0];
        res.json({
            success: true,
            data: {
                id: row.id,
                leagueId: row.league_id,
                incidentId: row.incident_id,
                penaltyId: row.penalty_id,
                submittedByDriverId: row.submitted_by_driver_id,
                submittedByName: row.submitted_by_name,
                submittedByEmail: row.submitted_by_email,
                status: row.status,
                grounds: row.grounds,
                evidenceUrls: row.evidence_urls || [],
                stewardNotes: row.steward_notes,
                resolution: row.resolution,
                resolvedBy: row.resolved_by,
                resolvedByName: row.resolved_by_name,
                resolvedAt: row.resolved_at,
                createdAt: row.created_at,
                updatedAt: row.updated_at
            }
        });
    } catch (error) {
        console.error('Error fetching protest:', error);
        return void res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch protest' } });
    }
});

// Submit protest
router.post('/', async (req: Request, res: Response) => {
    try {
        const body = req.body as CreateProtestRequest;

        if (!body.leagueId || !body.driverId || !body.grounds) {
            return void res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: leagueId, driverId, grounds' }
            });
        }

        const result = await pool.query(`
            INSERT INTO protests (
                league_id, incident_id, penalty_id,
                submitted_by_driver_id, submitted_by_name, submitted_by_email,
                grounds, evidence_urls
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [
            body.leagueId,
            body.incidentId || null,
            body.penaltyId || null,
            body.driverId,
            body.driverName,
            body.driverEmail || null,
            body.grounds,
            body.evidenceUrls || []
        ]);

        const row = result.rows[0];
        return void res.status(201).json({
            success: true,
            data: {
                id: row.id,
                leagueId: row.league_id,
                status: row.status,
                grounds: row.grounds,
                createdAt: row.created_at
            }
        });
    } catch (error) {
        console.error('Error creating protest:', error);
        return void res.status(500).json({ success: false, error: { code: 'CREATE_ERROR', message: 'Failed to create protest' } });
    }
});

// Update protest status
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status, stewardNotes, resolution } = req.body;
        const user = (req as any).user;

        const updates: string[] = [];
        const params: unknown[] = [];
        let paramCount = 0;

        if (status) {
            paramCount++;
            updates.push(`status = $${paramCount}`);
            params.push(status);
        }

        if (stewardNotes !== undefined) {
            paramCount++;
            updates.push(`steward_notes = $${paramCount}`);
            params.push(stewardNotes);
        }

        if (resolution !== undefined) {
            paramCount++;
            updates.push(`resolution = $${paramCount}`);
            params.push(resolution);
        }

        if (status === 'upheld' || status === 'rejected') {
            paramCount++;
            updates.push(`resolved_by = $${paramCount}`);
            params.push(user?.sub);

            paramCount++;
            updates.push(`resolved_at = $${paramCount}`);
            params.push(new Date().toISOString());
        }

        updates.push('updated_at = NOW()');

        paramCount++;
        const result = await pool.query(
            `UPDATE protests SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
            [...params, id]
        );

        if (result.rows.length === 0) {
            return void res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Protest not found' } });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error updating protest:', error);
        return void res.status(500).json({ success: false, error: { code: 'UPDATE_ERROR', message: 'Failed to update protest' } });
    }
});

// ========================
// Appeals Routes
// ========================

// List appeals
router.get('/appeals', requireAuth, async (req: Request, res: Response) => {
    try {
        const { leagueId, status, limit = 50, offset = 0 } = req.query;

        let query = `SELECT * FROM appeals WHERE 1=1`;
        const params: unknown[] = [];
        let paramCount = 0;

        if (leagueId) {
            paramCount++;
            query += ` AND league_id = $${paramCount}`;
            params.push(leagueId);
        }

        if (status) {
            paramCount++;
            query += ` AND status = $${paramCount}`;
            params.push(status);
        }

        query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);

        res.json({
            success: true,
            data: result.rows.map(row => ({
                id: row.id,
                leagueId: row.league_id,
                protestId: row.protest_id,
                originalPenaltyId: row.original_penalty_id,
                submittedBy: row.submitted_by,
                submittedByName: row.submitted_by_name,
                status: row.status,
                grounds: row.grounds,
                newEvidence: row.new_evidence || [],
                panelNotes: row.panel_notes,
                finalRuling: row.final_ruling,
                resolvedAt: row.resolved_at,
                createdAt: row.created_at
            }))
        });
    } catch (error) {
        console.error('Error fetching appeals:', error);
        return void res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch appeals' } });
    }
});

// Submit appeal
router.post('/appeals', requireAuth, async (req: Request, res: Response) => {
    try {
        const body = req.body as CreateAppealRequest;

        if (!body.leagueId || !body.submittedBy || !body.grounds) {
            return void res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' }
            });
        }

        const result = await pool.query(`
            INSERT INTO appeals (
                league_id, protest_id, original_penalty_id,
                submitted_by, submitted_by_name, grounds, new_evidence
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [
            body.leagueId,
            body.protestId || null,
            body.originalPenaltyId || null,
            body.submittedBy,
            body.submittedByName || null,
            body.grounds,
            body.newEvidence || []
        ]);

        return void res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error creating appeal:', error);
        return void res.status(500).json({ success: false, error: { code: 'CREATE_ERROR', message: 'Failed to create appeal' } });
    }
});

// Resolve appeal
router.put('/appeals/:id', requireAuth, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status, panelNotes, finalRuling } = req.body;
        const user = (req as any).user;

        const result = await pool.query(`
            UPDATE appeals SET
                status = COALESCE($1, status),
                panel_notes = COALESCE($2, panel_notes),
                final_ruling = COALESCE($3, final_ruling),
                resolved_by = $4,
                resolved_at = CASE WHEN $1 IN ('granted', 'denied') THEN NOW() ELSE resolved_at END,
                updated_at = NOW()
            WHERE id = $5
            RETURNING *
        `, [status, panelNotes, finalRuling, user?.sub, id]);

        if (result.rows.length === 0) {
            return void res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Appeal not found' } });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error updating appeal:', error);
        return void res.status(500).json({ success: false, error: { code: 'UPDATE_ERROR', message: 'Failed to update appeal' } });
    }
});

export default router;
