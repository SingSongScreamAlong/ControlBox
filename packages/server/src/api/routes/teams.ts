// =====================================================================
// Teams API Routes
// Team management and team standings
// =====================================================================

import { Router, Request, Response } from 'express';
import { pool } from '../../db/client.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// List teams
router.get('/', requireAuth, async (req: Request, res: Response) => {
    try {
        const { leagueId, isActive } = req.query;

        let query = `
            SELECT t.*,
                   (SELECT COUNT(*) FROM drivers_entries de WHERE de.team_id = t.id) as driver_count
            FROM teams t
            WHERE 1=1
        `;
        const params: unknown[] = [];
        let paramCount = 0;

        if (leagueId) {
            paramCount++;
            query += ` AND t.league_id = $${paramCount}`;
            params.push(leagueId);
        }

        if (isActive !== undefined) {
            paramCount++;
            query += ` AND t.is_active = $${paramCount}`;
            params.push(isActive === 'true');
        }

        query += ` ORDER BY t.name`;

        const result = await pool.query(query, params);

        res.json({
            success: true,
            data: result.rows.map(row => ({
                id: row.id,
                leagueId: row.league_id,
                name: row.name,
                shortName: row.short_name,
                color: row.color,
                logoUrl: row.logo_url,
                isActive: row.is_active,
                driverCount: parseInt(row.driver_count) || 0,
                createdAt: row.created_at,
                updatedAt: row.updated_at
            }))
        });
    } catch (error) {
        console.error('Error fetching teams:', error);
        return void res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch teams' } });
    }
});

// Get single team
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const result = await pool.query(`
            SELECT t.*,
                   (SELECT COUNT(*) FROM drivers_entries de WHERE de.team_id = t.id) as driver_count
            FROM teams t
            WHERE t.id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return void res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Team not found' } });
        }

        const row = result.rows[0];
        res.json({
            success: true,
            data: {
                id: row.id,
                leagueId: row.league_id,
                name: row.name,
                shortName: row.short_name,
                color: row.color,
                logoUrl: row.logo_url,
                isActive: row.is_active,
                driverCount: parseInt(row.driver_count) || 0,
                createdAt: row.created_at,
                updatedAt: row.updated_at
            }
        });
    } catch (error) {
        console.error('Error fetching team:', error);
        return void res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch team' } });
    }
});

// Create team
router.post('/', requireAuth, async (req: Request, res: Response) => {
    try {
        const { leagueId, name, shortName, color, logoUrl } = req.body;

        if (!leagueId || !name) {
            return void res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'leagueId and name are required' }
            });
        }

        const result = await pool.query(`
            INSERT INTO teams (league_id, name, short_name, color, logo_url)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [leagueId, name, shortName || null, color || null, logoUrl || null]);

        return void res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error: any) {
        if (error.code === '23505') {
            return void res.status(400).json({
                success: false,
                error: { code: 'DUPLICATE', message: 'A team with this name already exists in the league' }
            });
        }
        console.error('Error creating team:', error);
        return void res.status(500).json({ success: false, error: { code: 'CREATE_ERROR', message: 'Failed to create team' } });
    }
});

// Update team
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, shortName, color, logoUrl, isActive } = req.body;

        const result = await pool.query(`
            UPDATE teams SET
                name = COALESCE($1, name),
                short_name = COALESCE($2, short_name),
                color = COALESCE($3, color),
                logo_url = COALESCE($4, logo_url),
                is_active = COALESCE($5, is_active),
                updated_at = NOW()
            WHERE id = $6
            RETURNING *
        `, [name, shortName, color, logoUrl, isActive, id]);

        if (result.rows.length === 0) {
            return void res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Team not found' } });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error updating team:', error);
        return void res.status(500).json({ success: false, error: { code: 'UPDATE_ERROR', message: 'Failed to update team' } });
    }
});

// Delete team
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // First unlink any drivers
        await pool.query(`UPDATE drivers_entries SET team_id = NULL WHERE team_id = $1`, [id]);

        const result = await pool.query(`DELETE FROM teams WHERE id = $1 RETURNING id`, [id]);

        if (result.rows.length === 0) {
            return void res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Team not found' } });
        }

        res.json({ success: true, data: { deleted: true } });
    } catch (error) {
        console.error('Error deleting team:', error);
        return void res.status(500).json({ success: false, error: { code: 'DELETE_ERROR', message: 'Failed to delete team' } });
    }
});

// Team standings
router.get('/:leagueId/standings', requireAuth, async (req: Request, res: Response) => {
    try {
        const { leagueId } = req.params;
        const { seasonId: _seasonId } = req.query;

        // Get team totals by aggregating driver standings
        const result = await pool.query(`
            SELECT t.id, t.name, t.color,
                   COALESCE(SUM(s.points), 0) as total_points,
                   COALESCE(SUM(s.wins), 0) as wins,
                   COALESCE(SUM(s.podiums), 0) as podiums,
                   JSON_AGG(JSON_BUILD_OBJECT(
                       'driverId', de.id,
                       'driverName', de.driver_name,
                       'points', COALESCE(s.points, 0)
                   )) as drivers
            FROM teams t
            LEFT JOIN drivers_entries de ON de.team_id = t.id
            LEFT JOIN standings s ON s.driver_id = de.id
            WHERE t.league_id = $1
            GROUP BY t.id, t.name, t.color
            ORDER BY total_points DESC
        `, [leagueId]);

        const standings = result.rows.map((row, idx) => ({
            position: idx + 1,
            teamId: row.id,
            teamName: row.name,
            teamColor: row.color,
            points: parseInt(row.total_points) || 0,
            wins: parseInt(row.wins) || 0,
            podiums: parseInt(row.podiums) || 0,
            drivers: row.drivers?.filter((d: any) => d.driverId) || []
        }));

        res.json({ success: true, data: standings });
    } catch (error) {
        console.error('Error fetching team standings:', error);
        return void res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch team standings' } });
    }
});

export default router;
