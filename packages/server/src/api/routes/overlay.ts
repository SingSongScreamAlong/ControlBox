// =====================================================================
// Overlay Routes
// Real-time data for broadcast overlays (OBS, HTML/CSS overlays, BroadcastBox)
// =====================================================================

import { Router, Request, Response } from 'express';
import { pool } from '../../db/client.js';

const router = Router();

// Overlay routes are PUBLIC for easy OBS integration

/**
 * Get full overlay data for a session/event
 * GET /api/overlay/:eventId/full
 */
router.get('/:eventId/full', async (req: Request, res: Response) => {
    try {
        const { eventId } = req.params;

        // Get event info
        const eventResult = await pool.query(
            `SELECT e.*, s.name as season_name, sr.name as series_name, l.name as league_name
             FROM events e
             JOIN seasons s ON s.id = e.season_id
             JOIN series sr ON sr.id = s.series_id
             JOIN leagues l ON l.id = e.league_id
             WHERE e.id = $1`,
            [eventId]
        );

        if (eventResult.rows.length === 0) {
            res.status(404).json({ error: 'Event not found' });
            return;
        }

        const event = eventResult.rows[0];

        // Get running order from results
        const resultsQuery = await pool.query(
            `SELECT er.*, 
                    CASE WHEN er.finishing_position = 1 THEN true ELSE false END as is_leader
             FROM event_results er
             WHERE er.event_id = $1
             ORDER BY er.finishing_position ASC`,
            [eventId]
        );

        // Get pending penalties
        const penaltiesQuery = await pool.query(
            `SELECT p.* FROM penalties p
             JOIN sessions s ON s.id = p.session_id
             WHERE s.id = $1 AND p.status = 'pending'`,
            [event.session_id]
        );

        // Get recent incidents
        const incidentsQuery = await pool.query(
            `SELECT i.* FROM incidents i
             JOIN sessions s ON s.id = i.session_id
             WHERE s.id = $1
             ORDER BY i.created_at DESC
             LIMIT 5`,
            [event.session_id]
        );

        // Build running order
        const runningOrder = resultsQuery.rows.map((r, idx) => ({
            position: r.finishing_position,
            carNumber: r.car_number,
            driverName: r.driver_name,
            teamName: r.team_name,
            carClass: r.car_class,
            laps: r.laps_completed,
            gap: r.gap_to_leader || (idx === 0 ? 'Leader' : ''),
            status: r.finish_status,
            isLeader: r.is_leader
        }));

        // Build class leaders
        const classLeaders: Record<string, typeof runningOrder[0]> = {};
        for (const entry of runningOrder) {
            if (entry.carClass && !classLeaders[entry.carClass]) {
                classLeaders[entry.carClass] = entry;
            }
        }

        res.json({
            event: {
                id: event.id,
                name: event.name,
                track: event.track_name,
                trackConfig: event.track_config,
                series: event.series_name,
                season: event.season_name,
                league: event.league_name,
                isLive: event.started_at && !event.ended_at
            },
            runningOrder,
            classLeaders,
            pendingPenalties: penaltiesQuery.rows.map(p => ({
                carNumber: p.car_number,
                driverName: p.driver_name,
                penaltyType: p.type,
                status: p.status
            })),
            recentIncidents: incidentsQuery.rows.map(i => ({
                lap: i.lap,
                type: i.type,
                drivers: i.involved_drivers,
                severity: i.severity
            })),
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Overlay error:', error);
        res.status(500).json({ error: 'Failed to load overlay data' });
    }
});

/**
 * Get running order only
 * GET /api/overlay/:eventId/running-order
 */
router.get('/:eventId/running-order', async (req: Request, res: Response) => {
    try {
        const { eventId } = req.params;
        const { limit } = req.query;

        const resultsQuery = await pool.query(
            `SELECT er.finishing_position as position, er.car_number, er.driver_name, 
                    er.team_name, er.car_class, er.laps_completed as laps, er.gap_to_leader as gap
             FROM event_results er
             WHERE er.event_id = $1
             ORDER BY er.finishing_position ASC
             LIMIT $2`,
            [eventId, parseInt(limit as string) || 40]
        );

        res.json({
            order: resultsQuery.rows,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Overlay error:', error);
        res.status(500).json({ error: 'Failed to load running order' });
    }
});

/**
 * Get battle box (top positions in a close battle)
 * GET /api/overlay/:eventId/battle
 */
router.get('/:eventId/battle', async (req: Request, res: Response) => {
    try {
        const { eventId } = req.params;
        const { position, size } = req.query;

        const startPos = parseInt(position as string) || 1;
        const battleSize = parseInt(size as string) || 4;

        const resultsQuery = await pool.query(
            `SELECT er.finishing_position as position, er.car_number, er.driver_name,
                    er.team_name, er.car_class, er.gap_to_leader as gap
             FROM event_results er
             WHERE er.event_id = $1 
               AND er.finishing_position >= $2 
               AND er.finishing_position < $2 + $3
             ORDER BY er.finishing_position ASC`,
            [eventId, startPos, battleSize]
        );

        res.json({
            battleFor: startPos === 1 ? 'Lead' : `P${startPos}`,
            drivers: resultsQuery.rows,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Overlay error:', error);
        res.status(500).json({ error: 'Failed to load battle data' });
    }
});

/**
 * Get ticker data (scrolling running order)
 * GET /api/overlay/:eventId/ticker
 */
router.get('/:eventId/ticker', async (req: Request, res: Response) => {
    try {
        const { eventId } = req.params;

        const resultsQuery = await pool.query(
            `SELECT er.finishing_position as pos, er.car_number as num, 
                    SUBSTRING(er.driver_name FROM 1 FOR 15) as name, er.car_class as class
             FROM event_results er
             WHERE er.event_id = $1
             ORDER BY er.finishing_position ASC`,
            [eventId]
        );

        res.json({
            ticker: resultsQuery.rows,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Overlay error:', error);
        res.status(500).json({ error: 'Failed to load ticker data' });
    }
});

export default router;
