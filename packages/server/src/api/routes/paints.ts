// =====================================================================
// Paints Routes
// Paint/livery submission and management
// =====================================================================

import { Router, Request, Response } from 'express';
import { pool } from '../../db/client.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

interface PaintSubmission {
    id: string;
    leagueId: string;
    seriesId: string;
    driverId: string;
    driverName: string;
    carNumber?: string;
    tradingPaintsUrl?: string;
    customFilePath?: string;
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    teamName?: string;
    teamLogoUrl?: string;
    status: 'pending' | 'approved' | 'rejected' | 'revision_needed';
    adminNotes?: string;
    isOfficial: boolean;
    createdAt: Date;
}

/**
 * Get all paints for a series
 * GET /api/series/:seriesId/paints
 */
router.get('/series/:seriesId/paints', requireAuth, async (req: Request, res: Response) => {
    try {
        const { seriesId } = req.params;
        const { status } = req.query;

        let query = `SELECT * FROM paint_submissions WHERE series_id = $1`;
        const params: (string | undefined)[] = [seriesId];

        if (status) {
            query += ` AND status = $2`;
            params.push(status as string);
        }

        query += ` ORDER BY driver_name ASC`;

        const result = await pool.query(query, params);

        res.json({
            success: true,
            data: result.rows.map(mapRowToPaint)
        });
    } catch (error) {
        console.error('Error fetching paints:', error);
        res.status(500).json({
            success: false,
            error: { code: 'FETCH_ERROR', message: 'Failed to fetch paints' }
        });
    }
});

/**
 * Submit a paint
 * POST /api/series/:seriesId/paints
 */
router.post('/series/:seriesId/paints', requireAuth, async (req: Request, res: Response) => {
    try {
        const { seriesId } = req.params;
        const {
            leagueId,
            driverId,
            driverName,
            carNumber,
            tradingPaintsUrl,
            primaryColor,
            secondaryColor,
            accentColor,
            teamName,
            teamLogoUrl
        } = req.body;

        if (!driverId || !driverName) {
            res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'driverId and driverName are required' }
            });
            return;
        }

        const result = await pool.query(
            `INSERT INTO paint_submissions 
                (league_id, series_id, driver_id, driver_name, car_number, trading_paints_url,
                 primary_color, secondary_color, accent_color, team_name, team_logo_url, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending')
             RETURNING *`,
            [leagueId, seriesId, driverId, driverName, carNumber, tradingPaintsUrl,
                primaryColor, secondaryColor, accentColor, teamName, teamLogoUrl]
        );

        res.status(201).json({
            success: true,
            data: mapRowToPaint(result.rows[0])
        });
    } catch (error) {
        console.error('Error submitting paint:', error);
        res.status(500).json({
            success: false,
            error: { code: 'CREATE_ERROR', message: 'Failed to submit paint' }
        });
    }
});

/**
 * Review a paint (approve/reject)
 * PATCH /api/paints/:paintId
 */
router.patch('/:paintId', requireAuth, async (req: Request, res: Response) => {
    try {
        const { paintId } = req.params;
        const { status, adminNotes, isOfficial } = req.body;

        const validStatuses = ['pending', 'approved', 'rejected', 'revision_needed'];
        if (status && !validStatuses.includes(status)) {
            res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: `status must be one of: ${validStatuses.join(', ')}` }
            });
            return;
        }

        const result = await pool.query(
            `UPDATE paint_submissions SET
                status = COALESCE($2, status),
                admin_notes = COALESCE($3, admin_notes),
                is_official = COALESCE($4, is_official),
                reviewed_by = $5,
                reviewed_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [paintId, status, adminNotes, isOfficial, req.user?.id]
        );

        if (result.rows.length === 0) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Paint not found' }
            });
            return;
        }

        res.json({
            success: true,
            data: mapRowToPaint(result.rows[0])
        });
    } catch (error) {
        console.error('Error updating paint:', error);
        res.status(500).json({
            success: false,
            error: { code: 'UPDATE_ERROR', message: 'Failed to update paint' }
        });
    }
});

/**
 * Get paint manifest for broadcasters
 * GET /api/series/:seriesId/paints/manifest
 */
router.get('/series/:seriesId/paints/manifest', async (req: Request, res: Response) => {
    try {
        const { seriesId } = req.params;

        const result = await pool.query(
            `SELECT * FROM paint_submissions 
             WHERE series_id = $1 AND status = 'approved' AND is_official = true
             ORDER BY car_number ASC`,
            [seriesId]
        );

        // Build manifest for broadcasters
        const manifest = result.rows.map(row => ({
            carNumber: row.car_number,
            driverName: row.driver_name,
            teamName: row.team_name,
            tradingPaintsUrl: row.trading_paints_url,
            colors: {
                primary: row.primary_color,
                secondary: row.secondary_color,
                accent: row.accent_color
            },
            teamLogoUrl: row.team_logo_url
        }));

        res.json({
            seriesId,
            generatedAt: new Date().toISOString(),
            manifest
        });
    } catch (error) {
        console.error('Error generating manifest:', error);
        res.status(500).json({ error: 'Failed to generate manifest' });
    }
});

/**
 * Delete a paint
 * DELETE /api/paints/:paintId
 */
router.delete('/:paintId', requireAuth, async (req: Request, res: Response) => {
    try {
        const { paintId } = req.params;

        const result = await pool.query(
            `DELETE FROM paint_submissions WHERE id = $1 RETURNING id`,
            [paintId]
        );

        if (result.rows.length === 0) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Paint not found' }
            });
            return;
        }

        res.json({
            success: true,
            data: { deleted: true }
        });
    } catch (error) {
        console.error('Error deleting paint:', error);
        res.status(500).json({
            success: false,
            error: { code: 'DELETE_ERROR', message: 'Failed to delete paint' }
        });
    }
});

function mapRowToPaint(row: Record<string, unknown>): PaintSubmission {
    return {
        id: row.id as string,
        leagueId: row.league_id as string,
        seriesId: row.series_id as string,
        driverId: row.driver_id as string,
        driverName: row.driver_name as string,
        carNumber: row.car_number as string | undefined,
        tradingPaintsUrl: row.trading_paints_url as string | undefined,
        customFilePath: row.custom_file_path as string | undefined,
        primaryColor: row.primary_color as string | undefined,
        secondaryColor: row.secondary_color as string | undefined,
        accentColor: row.accent_color as string | undefined,
        teamName: row.team_name as string | undefined,
        teamLogoUrl: row.team_logo_url as string | undefined,
        status: row.status as PaintSubmission['status'],
        adminNotes: row.admin_notes as string | undefined,
        isOfficial: row.is_official as boolean,
        createdAt: row.created_at as Date
    };
}

export default router;
