// =====================================================================
// League Routes
// User-accessible league, series, season endpoints
// =====================================================================

import { Router, Request, Response } from 'express';
import type {
    LeagueAccess,
    SeriesAccess,
    SeasonAccess,
    CreateSeriesRequest,
    CreateSeasonRequest
} from '@controlbox/common';
import { requireAuth, requireSuperAdmin } from '../middleware/auth.js';
import { pool } from '../../db/client.js';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// ========================
// Leagues
// ========================

/**
 * Get user's accessible leagues with series/seasons
 * GET /api/leagues
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const user = req.user!;

        // Super admins see all leagues
        let leagueQuery: string;
        let params: unknown[];

        if (user.isSuperAdmin) {
            leagueQuery = `SELECT * FROM leagues ORDER BY name`;
            params = [];
        } else {
            leagueQuery = `
                SELECT DISTINCT l.*
                FROM leagues l
                JOIN admin_user_league_roles r ON r.league_id = l.id
                WHERE r.admin_user_id = $1
                ORDER BY l.name`;
            params = [user.id];
        }

        const leaguesResult = await pool.query(leagueQuery, params);
        const leagueAccess: LeagueAccess[] = [];

        for (const league of leaguesResult.rows) {
            // Get user's role for this league
            let role = 'Owner'; // Super admins get owner access

            if (!user.isSuperAdmin) {
                const roleResult = await pool.query(
                    `SELECT role FROM admin_user_league_roles
                     WHERE admin_user_id = $1 AND league_id = $2 AND series_id IS NULL
                     LIMIT 1`,
                    [user.id, league.id]
                );
                role = roleResult.rows[0]?.role ?? 'ReadOnly';
            }

            // Get series for this league
            const seriesResult = await pool.query(
                `SELECT * FROM series WHERE league_id = $1 ORDER BY name`,
                [league.id]
            );

            const seriesAccess: SeriesAccess[] = [];

            for (const series of seriesResult.rows) {
                // Get seasons for this series
                const seasonsResult = await pool.query(
                    `SELECT s.*, l.id as license_id, l.status as license_status
                     FROM seasons s
                     LEFT JOIN licenses l ON l.season_id = s.id
                     WHERE s.series_id = $1
                     ORDER BY s.start_date DESC`,
                    [series.id]
                );

                const seasonAccess: SeasonAccess[] = seasonsResult.rows.map(season => ({
                    season: {
                        id: season.id,
                        name: season.name,
                        startDate: season.start_date,
                        endDate: season.end_date
                    },
                    license: season.license_id ? {
                        id: season.license_id,
                        status: season.license_status,
                        isActive: season.license_status === 'active'
                    } : undefined
                }));

                seriesAccess.push({
                    series: {
                        id: series.id,
                        name: series.name
                    },
                    seasons: seasonAccess
                });
            }

            leagueAccess.push({
                league: {
                    id: league.id,
                    name: league.name
                },
                role: role as LeagueAccess['role'],
                series: seriesAccess
            });
        }

        res.json({
            success: true,
            data: leagueAccess
        });
    } catch (error) {
        console.error('Error fetching leagues:', error);
        res.status(500).json({
            success: false,
            error: { code: 'FETCH_ERROR', message: 'Failed to fetch leagues' }
        });
    }
});

/**
 * Get a specific league
 * GET /api/leagues/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const result = await pool.query(
            `SELECT * FROM leagues WHERE id = $1`,
            [req.params.id]
        );

        if (result.rows.length === 0) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'League not found' }
            });
            return;
        }

        const league = result.rows[0];
        res.json({
            success: true,
            data: {
                id: league.id,
                name: league.name,
                description: league.description,
                contactEmail: league.contact_email,
                defaultProfileId: league.default_profile_id,
                defaultRulebookId: league.default_rulebook_id,
                isActive: league.is_active,
                createdAt: league.created_at
            }
        });
    } catch (error) {
        console.error('Error fetching league:', error);
        res.status(500).json({
            success: false,
            error: { code: 'FETCH_ERROR', message: 'Failed to fetch league' }
        });
    }
});

/**
 * Create a league (super admin only)
 * POST /api/leagues
 */
router.post('/', requireSuperAdmin, async (req: Request, res: Response) => {
    try {
        const { name, description, contactEmail } = req.body;

        if (!name) {
            res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'Name is required' }
            });
            return;
        }

        const result = await pool.query(
            `INSERT INTO leagues (name, description, contact_email, owner_id)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [name, description ?? null, contactEmail ?? null, req.user!.id]
        );

        res.status(201).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error creating league:', error);
        res.status(500).json({
            success: false,
            error: { code: 'CREATE_ERROR', message: 'Failed to create league' }
        });
    }
});

// ========================
// Series
// ========================

/**
 * Get series for a league
 * GET /api/leagues/:leagueId/series
 */
router.get('/:leagueId/series', async (req: Request, res: Response) => {
    try {
        const result = await pool.query(
            `SELECT * FROM series WHERE league_id = $1 ORDER BY name`,
            [req.params.leagueId]
        );

        res.json({
            success: true,
            data: result.rows.map(row => ({
                id: row.id,
                leagueId: row.league_id,
                name: row.name,
                description: row.description,
                defaultDiscipline: row.default_discipline,
                defaultProfileId: row.default_profile_id,
                isActive: row.is_active,
                createdAt: row.created_at
            }))
        });
    } catch (error) {
        console.error('Error fetching series:', error);
        res.status(500).json({
            success: false,
            error: { code: 'FETCH_ERROR', message: 'Failed to fetch series' }
        });
    }
});

/**
 * Create a series
 * POST /api/leagues/:leagueId/series
 */
router.post('/:leagueId/series', requireSuperAdmin, async (req: Request, res: Response) => {
    try {
        const request = req.body as CreateSeriesRequest;
        const leagueId = req.params.leagueId;

        if (!request.name) {
            res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'Name is required' }
            });
            return;
        }

        const result = await pool.query(
            `INSERT INTO series (league_id, name, description, default_discipline, default_profile_id)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [leagueId, request.name, request.description ?? null,
                request.defaultDiscipline ?? null, request.defaultProfileId ?? null]
        );

        res.status(201).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error creating series:', error);
        res.status(500).json({
            success: false,
            error: { code: 'CREATE_ERROR', message: 'Failed to create series' }
        });
    }
});

// ========================
// Seasons
// ========================

/**
 * Get seasons for a series
 * GET /api/series/:seriesId/seasons
 */
router.get('/series/:seriesId/seasons', async (req: Request, res: Response) => {
    try {
        const result = await pool.query(
            `SELECT s.*, l.id as license_id, l.status as license_status, l.start_date as license_start, l.end_date as license_end
             FROM seasons s
             LEFT JOIN licenses l ON l.season_id = s.id
             WHERE s.series_id = $1
             ORDER BY s.start_date DESC`,
            [req.params.seriesId]
        );

        res.json({
            success: true,
            data: result.rows.map(row => ({
                id: row.id,
                leagueId: row.league_id,
                seriesId: row.series_id,
                name: row.name,
                description: row.description,
                startDate: row.start_date,
                endDate: row.end_date,
                rulebookId: row.rulebook_id,
                isActive: row.is_active,
                createdAt: row.created_at,
                license: row.license_id ? {
                    id: row.license_id,
                    status: row.license_status,
                    startDate: row.license_start,
                    endDate: row.license_end
                } : null
            }))
        });
    } catch (error) {
        console.error('Error fetching seasons:', error);
        res.status(500).json({
            success: false,
            error: { code: 'FETCH_ERROR', message: 'Failed to fetch seasons' }
        });
    }
});

/**
 * Create a season
 * POST /api/series/:seriesId/seasons
 */
router.post('/series/:seriesId/seasons', requireSuperAdmin, async (req: Request, res: Response) => {
    try {
        const request = req.body as Omit<CreateSeasonRequest, 'seriesId'>;
        const seriesId = req.params.seriesId;

        if (!request.name || !request.startDate || !request.endDate) {
            res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'name, startDate, endDate are required' }
            });
            return;
        }

        // Get league_id from series
        const seriesResult = await pool.query(
            `SELECT league_id FROM series WHERE id = $1`,
            [seriesId]
        );

        if (seriesResult.rows.length === 0) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Series not found' }
            });
            return;
        }

        const leagueId = seriesResult.rows[0].league_id;

        const result = await pool.query(
            `INSERT INTO seasons (league_id, series_id, name, description, start_date, end_date, rulebook_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [leagueId, seriesId, request.name, request.description ?? null,
                request.startDate, request.endDate, request.rulebookId ?? null]
        );

        res.status(201).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error creating season:', error);
        res.status(500).json({
            success: false,
            error: { code: 'CREATE_ERROR', message: 'Failed to create season' }
        });
    }
});

export default router;
