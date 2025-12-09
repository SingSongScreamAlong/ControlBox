// =====================================================================
// Widgets Routes
// Public embeddable widgets for external websites
// =====================================================================

import { Router, Request, Response } from 'express';
import { pool } from '../../db/client.js';
import { getScoringService } from '../../services/scoring/scoring-service.js';

const router = Router();

// Widget routes are PUBLIC (no auth required)
// Data is scoped to league and respects public visibility settings

/**
 * Get standings widget data
 * GET /api/widgets/:leagueId/standings
 */
router.get('/:leagueId/standings', async (req: Request, res: Response) => {
    try {
        const { leagueId } = req.params;
        const { seasonId, classId, limit } = req.query;

        // Get active season if not specified
        let targetSeasonId = seasonId as string;
        if (!targetSeasonId) {
            const seasonResult = await pool.query(
                `SELECT s.id FROM seasons s 
                 JOIN licenses l ON l.season_id = s.id 
                 WHERE l.league_id = $1 AND l.status = 'active'
                 ORDER BY s.start_date DESC LIMIT 1`,
                [leagueId]
            );
            if (seasonResult.rows.length === 0) {
                res.status(404).json({ error: 'No active season found' });
                return;
            }
            targetSeasonId = seasonResult.rows[0].id;
        }

        const scoringService = getScoringService();
        const result = await scoringService.getDriverStandings(
            targetSeasonId,
            classId as string | undefined,
            parseInt(limit as string) || 20,
            0
        );

        // Get league/season info for display
        const infoResult = await pool.query(
            `SELECT l.name as league_name, s.name as season_name, sr.name as series_name
             FROM leagues l
             JOIN series sr ON sr.league_id = l.id
             JOIN seasons s ON s.series_id = sr.id
             WHERE s.id = $1`,
            [targetSeasonId]
        );

        const info = infoResult.rows[0] || {};

        res.json({
            league: info.league_name,
            series: info.series_name,
            season: info.season_name,
            standings: result.standings.map(s => ({
                position: s.position,
                driver: s.driverName,
                team: s.teamName,
                points: s.points,
                wins: s.wins,
                behind: s.behindLeader
            })),
            updatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Widget error:', error);
        res.status(500).json({ error: 'Failed to load standings' });
    }
});

/**
 * Get upcoming events widget data
 * GET /api/widgets/:leagueId/events
 */
router.get('/:leagueId/events', async (req: Request, res: Response) => {
    try {
        const { leagueId } = req.params;
        const { limit } = req.query;

        // Get upcoming events across all active seasons
        const eventsResult = await pool.query(
            `SELECT e.id, e.name, e.scheduled_at, e.track_name, e.track_config,
                    s.name as season_name, sr.name as series_name
             FROM events e
             JOIN seasons s ON s.id = e.season_id
             JOIN series sr ON sr.id = s.series_id
             JOIN licenses l ON l.season_id = s.id
             WHERE l.league_id = $1 AND l.status = 'active'
               AND e.scheduled_at > NOW()
               AND e.ended_at IS NULL
             ORDER BY e.scheduled_at ASC
             LIMIT $2`,
            [leagueId, parseInt(limit as string) || 5]
        );

        res.json({
            events: eventsResult.rows.map(e => ({
                id: e.id,
                name: e.name,
                scheduledAt: e.scheduled_at,
                track: e.track_name,
                trackConfig: e.track_config,
                series: e.series_name,
                season: e.season_name
            })),
            updatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Widget error:', error);
        res.status(500).json({ error: 'Failed to load events' });
    }
});

/**
 * Get recent results widget data
 * GET /api/widgets/:leagueId/results
 */
router.get('/:leagueId/results', async (req: Request, res: Response) => {
    try {
        const { leagueId } = req.params;
        const { limit } = req.query;

        const resultsQuery = await pool.query(
            `SELECT e.id, e.name, e.scheduled_at, e.track_name,
                    s.name as season_name, sr.name as series_name,
                    (SELECT json_agg(json_build_object(
                        'position', er.finishing_position,
                        'driver', er.driver_name,
                        'carNumber', er.car_number,
                        'points', er.total_points
                    ) ORDER BY er.finishing_position)
                    FROM event_results er WHERE er.event_id = e.id LIMIT 5) as top5
             FROM events e
             JOIN seasons s ON s.id = e.season_id
             JOIN series sr ON sr.id = s.series_id
             JOIN licenses l ON l.season_id = s.id
             WHERE l.league_id = $1 AND l.status = 'active'
               AND e.ended_at IS NOT NULL
             ORDER BY e.scheduled_at DESC
             LIMIT $2`,
            [leagueId, parseInt(limit as string) || 3]
        );

        res.json({
            results: resultsQuery.rows.map(r => ({
                id: r.id,
                name: r.name,
                date: r.scheduled_at,
                track: r.track_name,
                series: r.series_name,
                season: r.season_name,
                top5: r.top5 || []
            })),
            updatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Widget error:', error);
        res.status(500).json({ error: 'Failed to load results' });
    }
});

/**
 * Get driver card widget data
 * GET /api/widgets/:leagueId/driver/:driverId
 */
router.get('/:leagueId/driver/:driverId', async (req: Request, res: Response) => {
    try {
        const { leagueId, driverId } = req.params;

        // Get driver stats across all active seasons
        const driverResult = await pool.query(
            `SELECT ds.*, s.name as season_name, sr.name as series_name
             FROM driver_standings ds
             JOIN seasons s ON s.id = ds.season_id
             JOIN series sr ON sr.id = s.series_id
             JOIN licenses l ON l.season_id = s.id
             WHERE l.league_id = $1 AND l.status = 'active'
               AND ds.driver_id = $2
             ORDER BY ds.points DESC
             LIMIT 1`,
            [leagueId, driverId]
        );

        if (driverResult.rows.length === 0) {
            res.status(404).json({ error: 'Driver not found' });
            return;
        }

        const d = driverResult.rows[0];

        res.json({
            driver: {
                name: d.driver_name,
                team: d.team_name,
                position: d.position,
                points: d.points,
                wins: d.wins,
                podiums: d.podiums,
                top5s: d.top5s,
                top10s: d.top10s,
                dnfs: d.dnfs,
                lapsLed: d.laps_led,
                racesStarted: d.races_started,
                series: d.series_name,
                season: d.season_name
            },
            updatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Widget error:', error);
        res.status(500).json({ error: 'Failed to load driver' });
    }
});

/**
 * Get next event countdown widget data
 * GET /api/widgets/:leagueId/countdown
 */
router.get('/:leagueId/countdown', async (req: Request, res: Response) => {
    try {
        const { leagueId } = req.params;

        const eventResult = await pool.query(
            `SELECT e.id, e.name, e.scheduled_at, e.track_name, e.track_config,
                    s.name as season_name, sr.name as series_name
             FROM events e
             JOIN seasons s ON s.id = e.season_id
             JOIN series sr ON sr.id = s.series_id
             JOIN licenses l ON l.season_id = s.id
             WHERE l.league_id = $1 AND l.status = 'active'
               AND e.scheduled_at > NOW()
               AND e.started_at IS NULL
             ORDER BY e.scheduled_at ASC
             LIMIT 1`,
            [leagueId]
        );

        if (eventResult.rows.length === 0) {
            res.json({
                nextEvent: null,
                message: 'No upcoming events'
            });
            return;
        }

        const e = eventResult.rows[0];
        const scheduledAt = new Date(e.scheduled_at);
        const now = new Date();
        const diffMs = scheduledAt.getTime() - now.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

        res.json({
            nextEvent: {
                id: e.id,
                name: e.name,
                scheduledAt: e.scheduled_at,
                track: e.track_name,
                trackConfig: e.track_config,
                series: e.series_name,
                season: e.season_name
            },
            countdown: {
                days: diffDays,
                hours: diffHours,
                minutes: diffMinutes,
                totalSeconds: Math.floor(diffMs / 1000)
            },
            updatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Widget error:', error);
        res.status(500).json({ error: 'Failed to load countdown' });
    }
});

/**
 * Serve widget embed script
 * GET /api/widgets/embed.js
 */
router.get('/embed.js', (_req: Request, res: Response) => {
    const script = `
(function() {
    const API_BASE = window.CONTROLBOX_API || 'https://control.okboxbox.com/api/widgets';
    
    document.querySelectorAll('[data-controlbox-widget]').forEach(async el => {
        const type = el.dataset.controlboxWidget;
        const leagueId = el.dataset.leagueId;
        
        if (!leagueId) return;
        
        try {
            const res = await fetch(API_BASE + '/' + leagueId + '/' + type);
            const data = await res.json();
            
            if (type === 'standings') renderStandings(el, data);
            else if (type === 'events') renderEvents(el, data);
            else if (type === 'countdown') renderCountdown(el, data);
        } catch (e) {
            el.innerHTML = '<p style="color: red;">Failed to load widget</p>';
        }
    });
    
    function renderStandings(el, data) {
        let html = '<div class="cb-widget cb-standings">';
        html += '<h3>' + (data.season || 'Standings') + '</h3>';
        html += '<table><thead><tr><th>Pos</th><th>Driver</th><th>Pts</th></tr></thead><tbody>';
        data.standings.forEach(s => {
            html += '<tr><td>' + s.position + '</td><td>' + s.driver + '</td><td>' + s.points + '</td></tr>';
        });
        html += '</tbody></table></div>';
        el.innerHTML = html;
    }
    
    function renderEvents(el, data) {
        let html = '<div class="cb-widget cb-events">';
        html += '<h3>Upcoming Events</h3><ul>';
        data.events.forEach(e => {
            html += '<li><strong>' + e.name + '</strong> - ' + new Date(e.scheduledAt).toLocaleDateString() + '</li>';
        });
        html += '</ul></div>';
        el.innerHTML = html;
    }
    
    function renderCountdown(el, data) {
        if (!data.nextEvent) {
            el.innerHTML = '<div class="cb-widget cb-countdown"><p>No upcoming events</p></div>';
            return;
        }
        let html = '<div class="cb-widget cb-countdown">';
        html += '<h3>' + data.nextEvent.name + '</h3>';
        html += '<div class="cb-timer">' + data.countdown.days + 'd ' + data.countdown.hours + 'h ' + data.countdown.minutes + 'm</div>';
        html += '</div>';
        el.innerHTML = html;
    }
})();
    `.trim();

    res.setHeader('Content-Type', 'application/javascript');
    res.send(script);
});

export default router;
