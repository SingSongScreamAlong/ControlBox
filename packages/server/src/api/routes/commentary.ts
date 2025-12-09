// =====================================================================
// Commentary Routes
// Structured data feed for AI commentary systems
// =====================================================================

import { Router, Request, Response } from 'express';
import { pool } from '../../db/client.js';

const router = Router();

// Commentary routes are PUBLIC for easy AI integration

/**
 * Commentary event types
 */
type CommentaryEventType =
    | 'overtake'
    | 'lead_change'
    | 'penalty_issued'
    | 'driver_dnf'
    | 'caution_start'
    | 'restart'
    | 'pit_stop'
    | 'position_battle'
    | 'points_implication';

interface CommentaryEvent {
    id: string;
    timestamp: Date;
    type: CommentaryEventType;
    priority: 'low' | 'medium' | 'high';
    shortSummary: string;
    expandedContext: string;
    drivers?: string[];
    lap?: number;
}

/**
 * Get commentary event feed
 * GET /api/commentary/:eventId/feed
 */
router.get('/:eventId/feed', async (req: Request, res: Response) => {
    try {
        const { eventId } = req.params;
        const { since, limit } = req.query;

        // Get event info
        const eventResult = await pool.query(
            `SELECT e.*, s.name as season_name, sr.name as series_name
             FROM events e
             JOIN seasons s ON s.id = e.season_id
             JOIN series sr ON sr.id = s.series_id
             WHERE e.id = $1`,
            [eventId]
        );

        if (eventResult.rows.length === 0) {
            res.status(404).json({ error: 'Event not found' });
            return;
        }

        const event = eventResult.rows[0];
        const events: CommentaryEvent[] = [];

        // Get recent incidents (become commentary events)
        const incidentsSince = since ? new Date(since as string) : new Date(0);
        const incidentsQuery = await pool.query(
            `SELECT i.* FROM incidents i
             JOIN sessions s ON s.id = i.session_id
             WHERE s.id = $1 AND i.created_at > $2
             ORDER BY i.created_at DESC
             LIMIT $3`,
            [event.session_id, incidentsSince, parseInt(limit as string) || 20]
        );

        for (const incident of incidentsQuery.rows) {
            const drivers = incident.involved_drivers?.map((d: { driverName: string }) => d.driverName) || [];

            events.push({
                id: incident.id,
                timestamp: incident.created_at,
                type: 'penalty_issued',
                priority: incident.severity === 'major' ? 'high' : 'medium',
                shortSummary: `Incident on Lap ${incident.lap}: ${incident.type}`,
                expandedContext: `A ${incident.severity} incident occurred on lap ${incident.lap} involving ${drivers.join(' and ')}. ` +
                    `This was classified as ${incident.type}. ${incident.notes || ''}`,
                drivers,
                lap: incident.lap
            });
        }

        // Get recent penalties
        const penaltiesQuery = await pool.query(
            `SELECT p.* FROM penalties p
             JOIN sessions s ON s.id = p.session_id
             WHERE s.id = $1 AND p.created_at > $2
             ORDER BY p.created_at DESC
             LIMIT $3`,
            [event.session_id, incidentsSince, parseInt(limit as string) || 10]
        );

        for (const penalty of penaltiesQuery.rows) {
            events.push({
                id: penalty.id,
                timestamp: penalty.created_at,
                type: 'penalty_issued',
                priority: 'high',
                shortSummary: `Penalty: ${penalty.driver_name} receives ${penalty.type}`,
                expandedContext: `The stewards have issued a ${penalty.type} to ${penalty.driver_name} (Car #${penalty.car_number}) ` +
                    `for ${penalty.reason}. ${penalty.notes || ''}`,
                drivers: [penalty.driver_name],
                lap: penalty.lap
            });
        }

        // Sort by timestamp descending
        events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        res.json({
            eventName: event.name,
            series: event.series_name,
            season: event.season_name,
            isLive: event.started_at && !event.ended_at,
            feed: events.slice(0, parseInt(limit as string) || 20),
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Commentary error:', error);
        res.status(500).json({ error: 'Failed to load commentary feed' });
    }
});

/**
 * Get race highlights (top moments for post-race)
 * GET /api/commentary/:eventId/highlights
 */
router.get('/:eventId/highlights', async (req: Request, res: Response) => {
    try {
        const { eventId } = req.params;

        // Get event and results
        const eventResult = await pool.query(
            `SELECT e.*, s.name as season_name, sr.name as series_name
             FROM events e
             JOIN seasons s ON s.id = e.season_id
             JOIN series sr ON sr.id = s.series_id
             WHERE e.id = $1`,
            [eventId]
        );

        if (eventResult.rows.length === 0) {
            res.status(404).json({ error: 'Event not found' });
            return;
        }

        const event = eventResult.rows[0];

        // Get results for position changes
        const resultsQuery = await pool.query(
            `SELECT er.* FROM event_results er
             WHERE er.event_id = $1
             ORDER BY er.finishing_position ASC`,
            [eventId]
        );

        const highlights: CommentaryEvent[] = [];

        // Winner highlight
        if (resultsQuery.rows.length > 0) {
            const winner = resultsQuery.rows[0];
            highlights.push({
                id: 'winner',
                timestamp: new Date(),
                type: 'lead_change',
                priority: 'high',
                shortSummary: `${winner.driver_name} wins the ${event.name}!`,
                expandedContext: `${winner.driver_name} driving the #${winner.car_number} ${winner.car_name || 'car'} ` +
                    `has won the ${event.name} at ${event.track_name}. ` +
                    (winner.laps_led > 0 ? `They led ${winner.laps_led} laps. ` : '') +
                    `This is the ${event.series_name} round of the ${event.season_name} season.`,
                drivers: [winner.driver_name]
            });
        }

        // Big movers (gained 5+ positions)
        const bigMovers = resultsQuery.rows.filter(
            r => r.starting_position && (r.starting_position - r.finishing_position) >= 5
        );

        for (const mover of bigMovers.slice(0, 3)) {
            const gained = mover.starting_position - mover.finishing_position;
            highlights.push({
                id: `mover-${mover.id}`,
                timestamp: new Date(),
                type: 'position_battle',
                priority: 'medium',
                shortSummary: `${mover.driver_name} gains ${gained} positions`,
                expandedContext: `${mover.driver_name} had an impressive drive, starting P${mover.starting_position} ` +
                    `and finishing P${mover.finishing_position}, gaining ${gained} positions throughout the race.`,
                drivers: [mover.driver_name]
            });
        }

        // DNFs
        const dnfs = resultsQuery.rows.filter(r => r.finish_status === 'dnf');
        if (dnfs.length > 0) {
            highlights.push({
                id: 'dnfs',
                timestamp: new Date(),
                type: 'driver_dnf',
                priority: 'medium',
                shortSummary: `${dnfs.length} driver(s) did not finish`,
                expandedContext: `${dnfs.map(d => d.driver_name).join(', ')} were unable to finish the race.`,
                drivers: dnfs.map(d => d.driver_name)
            });
        }

        res.json({
            eventName: event.name,
            track: event.track_name,
            series: event.series_name,
            season: event.season_name,
            highlights,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Commentary error:', error);
        res.status(500).json({ error: 'Failed to load highlights' });
    }
});

/**
 * Get post-race summary for AI commentary
 * GET /api/commentary/:eventId/summary
 */
router.get('/:eventId/summary', async (req: Request, res: Response) => {
    try {
        const { eventId } = req.params;

        // Get event with report
        const eventResult = await pool.query(
            `SELECT e.*, s.name as season_name, sr.name as series_name, l.name as league_name,
                    pr.summary_json as report_summary
             FROM events e
             JOIN seasons s ON s.id = e.season_id
             JOIN series sr ON sr.id = s.series_id
             JOIN leagues l ON l.id = e.league_id
             LEFT JOIN post_race_reports pr ON pr.event_id = e.id AND pr.status = 'ready'
             WHERE e.id = $1`,
            [eventId]
        );

        if (eventResult.rows.length === 0) {
            res.status(404).json({ error: 'Event not found' });
            return;
        }

        const event = eventResult.rows[0];
        const summary = event.report_summary;

        // Build LLM-friendly summary block
        const summaryText = summary ? `
Race: ${event.name}
Track: ${event.track_name} ${event.track_config ? `(${event.track_config})` : ''}
Series: ${event.series_name} | Season: ${event.season_name} | League: ${event.league_name}

Results:
${summary.finishingOrder?.slice(0, 10).map((d: { position: number; driverName: string; carNumber: string }) =>
            `P${d.position}: ${d.driverName} (#${d.carNumber})`
        ).join('\n') || 'No results'}

Statistics:
- Total Drivers: ${summary.statistics?.totalDrivers || 0}
- Finishers: ${summary.statistics?.finishers || 0}
- DNFs: ${summary.statistics?.dnfs || 0}
- Total Incidents: ${summary.statistics?.totalIncidents || 0}

${summary.penalties?.length ? `Penalties Issued:\n${summary.penalties.map((p: { driverName: string; penaltyType: string; reason: string }) =>
            `- ${p.driverName}: ${p.penaltyType} for ${p.reason}`).join('\n')}` : 'No penalties issued.'}
        `.trim() : 'Report not yet generated.';

        res.json({
            eventId: event.id,
            eventName: event.name,
            summaryText,
            rawData: summary,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Commentary error:', error);
        res.status(500).json({ error: 'Failed to load summary' });
    }
});

export default router;
