// =====================================================================
// Event Service
// CRUD operations for scheduled race events
// =====================================================================

import { pool } from '../../db/client.js';
import type {
    Event,
    CreateEventRequest,
    UpdateEventRequest,
    EventWithArtifacts
} from '@controlbox/common';

interface EventRow {
    id: string;
    league_id: string;
    series_id: string;
    season_id: string;
    name: string;
    scheduled_at: Date;
    started_at: Date | null;
    ended_at: Date | null;
    track_name: string | null;
    track_config: string | null;
    session_id: string | null;
    notes: string | null;
    created_at: Date;
    updated_at: Date | null;
}

function mapRowToEvent(row: EventRow): Event {
    return {
        id: row.id,
        leagueId: row.league_id,
        seriesId: row.series_id,
        seasonId: row.season_id,
        name: row.name,
        scheduledAt: row.scheduled_at,
        startedAt: row.started_at ?? undefined,
        endedAt: row.ended_at ?? undefined,
        trackName: row.track_name ?? undefined,
        trackConfig: row.track_config ?? undefined,
        sessionId: row.session_id ?? undefined,
        notes: row.notes ?? undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at ?? undefined
    };
}

export class EventService {
    /**
     * Create a new event
     */
    async create(
        leagueId: string,
        seriesId: string,
        seasonId: string,
        data: CreateEventRequest
    ): Promise<Event> {
        const result = await pool.query<EventRow>(
            `INSERT INTO events (league_id, series_id, season_id, name, scheduled_at, track_name, track_config, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [
                leagueId,
                seriesId,
                seasonId,
                data.name,
                data.scheduledAt,
                data.trackName ?? null,
                data.trackConfig ?? null,
                data.notes ?? null
            ]
        );

        return mapRowToEvent(result.rows[0]);
    }

    /**
     * Get event by ID
     */
    async getById(eventId: string): Promise<Event | null> {
        const result = await pool.query<EventRow>(
            `SELECT * FROM events WHERE id = $1`,
            [eventId]
        );

        if (result.rows.length === 0) {
            return null;
        }

        return mapRowToEvent(result.rows[0]);
    }

    /**
     * Get event with artifacts and report
     */
    async getWithArtifacts(eventId: string): Promise<EventWithArtifacts | null> {
        const event = await this.getById(eventId);
        if (!event) return null;

        // Get artifacts
        const artifactsResult = await pool.query(
            `SELECT * FROM event_artifacts WHERE event_id = $1 ORDER BY created_at DESC`,
            [eventId]
        );

        // Get report
        const reportResult = await pool.query(
            `SELECT * FROM post_race_reports WHERE event_id = $1`,
            [eventId]
        );

        const artifacts = artifactsResult.rows.map(row => ({
            id: row.id,
            eventId: row.event_id,
            type: row.type,
            filename: row.filename,
            storagePath: row.storage_path,
            fileSizeBytes: row.file_size_bytes,
            mimeType: row.mime_type,
            uploadedBy: row.uploaded_by,
            processedAt: row.processed_at ?? undefined,
            processingError: row.processing_error ?? undefined,
            metadata: row.metadata ?? {},
            createdAt: row.created_at,
            updatedAt: row.updated_at ?? undefined
        }));

        const report = reportResult.rows.length > 0 ? {
            id: reportResult.rows[0].id,
            eventId: reportResult.rows[0].event_id,
            status: reportResult.rows[0].status,
            generatedBy: reportResult.rows[0].generated_by ?? undefined,
            summary: reportResult.rows[0].summary_json ?? {},
            processingStartedAt: reportResult.rows[0].processing_started_at ?? undefined,
            processingCompletedAt: reportResult.rows[0].processing_completed_at ?? undefined,
            errorMessage: reportResult.rows[0].error_message ?? undefined,
            version: reportResult.rows[0].version ?? 1,
            createdAt: reportResult.rows[0].created_at,
            updatedAt: reportResult.rows[0].updated_at ?? undefined
        } : undefined;

        return {
            ...event,
            artifacts,
            report,
            hasReplay: artifacts.some(a => a.type === 'replay'),
            hasResults: artifacts.some(a => a.type === 'results')
        };
    }

    /**
     * Get events for a season
     */
    async getBySeason(seasonId: string): Promise<Event[]> {
        const result = await pool.query<EventRow>(
            `SELECT * FROM events WHERE season_id = $1 ORDER BY scheduled_at ASC`,
            [seasonId]
        );

        return result.rows.map(mapRowToEvent);
    }

    /**
     * Get upcoming events (for reminders)
     */
    async getUpcoming(hoursAhead: number = 24): Promise<Event[]> {
        const result = await pool.query<EventRow>(
            `SELECT e.* FROM events e
             JOIN seasons s ON s.id = e.season_id
             JOIN licenses l ON l.season_id = s.id
             WHERE e.scheduled_at > NOW()
               AND e.scheduled_at < NOW() + INTERVAL '1 hour' * $1
               AND e.started_at IS NULL
               AND l.status = 'active'
             ORDER BY e.scheduled_at ASC`,
            [hoursAhead]
        );

        return result.rows.map(mapRowToEvent);
    }

    /**
     * Update an event
     */
    async update(eventId: string, data: UpdateEventRequest): Promise<Event | null> {
        const updates: string[] = [];
        const values: unknown[] = [];
        let paramIndex = 1;

        if (data.name !== undefined) {
            updates.push(`name = $${paramIndex++}`);
            values.push(data.name);
        }
        if (data.scheduledAt !== undefined) {
            updates.push(`scheduled_at = $${paramIndex++}`);
            values.push(data.scheduledAt);
        }
        if (data.startedAt !== undefined) {
            updates.push(`started_at = $${paramIndex++}`);
            values.push(data.startedAt);
        }
        if (data.endedAt !== undefined) {
            updates.push(`ended_at = $${paramIndex++}`);
            values.push(data.endedAt);
        }
        if (data.trackName !== undefined) {
            updates.push(`track_name = $${paramIndex++}`);
            values.push(data.trackName);
        }
        if (data.trackConfig !== undefined) {
            updates.push(`track_config = $${paramIndex++}`);
            values.push(data.trackConfig);
        }
        if (data.sessionId !== undefined) {
            updates.push(`session_id = $${paramIndex++}`);
            values.push(data.sessionId);
        }
        if (data.notes !== undefined) {
            updates.push(`notes = $${paramIndex++}`);
            values.push(data.notes);
        }

        if (updates.length === 0) {
            return this.getById(eventId);
        }

        values.push(eventId);

        const result = await pool.query<EventRow>(
            `UPDATE events SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            values
        );

        if (result.rows.length === 0) {
            return null;
        }

        return mapRowToEvent(result.rows[0]);
    }

    /**
     * Mark event as started
     */
    async markStarted(eventId: string, sessionId?: string): Promise<Event | null> {
        const result = await pool.query<EventRow>(
            `UPDATE events SET started_at = NOW(), session_id = $2 WHERE id = $1 RETURNING *`,
            [eventId, sessionId ?? null]
        );

        return result.rows.length > 0 ? mapRowToEvent(result.rows[0]) : null;
    }

    /**
     * Mark event as ended
     */
    async markEnded(eventId: string): Promise<Event | null> {
        const result = await pool.query<EventRow>(
            `UPDATE events SET ended_at = NOW() WHERE id = $1 RETURNING *`,
            [eventId]
        );

        return result.rows.length > 0 ? mapRowToEvent(result.rows[0]) : null;
    }

    /**
     * Delete an event
     */
    async delete(eventId: string): Promise<boolean> {
        const result = await pool.query(
            `DELETE FROM events WHERE id = $1`,
            [eventId]
        );

        return (result.rowCount ?? 0) > 0;
    }
}

// Singleton instance
let eventService: EventService | null = null;

export function getEventService(): EventService {
    if (!eventService) {
        eventService = new EventService();
    }
    return eventService;
}
