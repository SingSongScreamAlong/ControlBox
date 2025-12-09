// =====================================================================
// Scoring Service
// Calculate points, standings, and handle drop weeks
// =====================================================================

import { pool } from '../../db/client.js';
import type {
    PointsTable,
    DriverStanding,
    TeamStanding,
    EventResult,
    BonusPointsConfig
} from '@controlbox/common';

interface PointsTableRow {
    id: string;
    series_id: string;
    name: string;
    is_default: boolean;
    points: Record<string, number>;
    class_points: Record<string, Record<string, number>> | null;
    created_at: Date;
    updated_at: Date | null;
}

interface EventResultRow {
    id: string;
    event_id: string;
    driver_id: string;
    driver_name: string;
    team_id: string | null;
    team_name: string | null;
    car_number: string | null;
    car_class: string | null;
    car_name: string | null;
    starting_position: number | null;
    finishing_position: number;
    class_starting_position: number | null;
    class_finishing_position: number | null;
    laps_completed: number;
    laps_led: number;
    finish_status: string;
    base_points: number;
    bonus_points: number;
    penalty_points: number;
    total_points: number;
    is_dropped: boolean;
    fastest_lap_time: number | null;
    incident_count: number;
}

function mapRowToPointsTable(row: PointsTableRow): PointsTable {
    const points: Record<number, number> = {};
    Object.entries(row.points).forEach(([pos, pts]) => {
        points[parseInt(pos)] = pts as number;
    });

    return {
        id: row.id,
        seriesId: row.series_id,
        name: row.name,
        isDefault: row.is_default,
        points,
        classPoints: row.class_points as Record<string, Record<number, number>> | undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at ?? undefined
    };
}

export class ScoringService {
    // ========================
    // Points Tables
    // ========================

    async getPointsTable(seriesId: string): Promise<PointsTable | null> {
        const result = await pool.query<PointsTableRow>(
            `SELECT * FROM points_tables WHERE series_id = $1 AND is_default = true`,
            [seriesId]
        );

        return result.rows.length > 0 ? mapRowToPointsTable(result.rows[0]) : null;
    }

    async updatePointsTable(
        seriesId: string,
        data: { name?: string; points?: Record<number, number>; classPoints?: Record<string, Record<number, number>> }
    ): Promise<PointsTable> {
        const existing = await this.getPointsTable(seriesId);

        if (existing) {
            const result = await pool.query<PointsTableRow>(
                `UPDATE points_tables SET name = COALESCE($2, name), points = COALESCE($3, points), class_points = COALESCE($4, class_points)
                 WHERE id = $1 RETURNING *`,
                [existing.id, data.name, data.points ? JSON.stringify(data.points) : null, data.classPoints ? JSON.stringify(data.classPoints) : null]
            );
            return mapRowToPointsTable(result.rows[0]);
        } else {
            const result = await pool.query<PointsTableRow>(
                `INSERT INTO points_tables (series_id, name, is_default, points, class_points)
                 VALUES ($1, $2, true, $3, $4) RETURNING *`,
                [seriesId, data.name || 'Default Points', JSON.stringify(data.points || {}), data.classPoints ? JSON.stringify(data.classPoints) : null]
            );
            return mapRowToPointsTable(result.rows[0]);
        }
    }

    // ========================
    // Event Scoring
    // ========================

    async scoreEvent(eventId: string, performedBy?: string): Promise<EventResult[]> {
        // Get event and series info
        const eventResult = await pool.query(
            `SELECT e.*, s.id as series_id FROM events e JOIN seasons s ON s.id = e.season_id WHERE e.id = $1`,
            [eventId]
        );

        if (eventResult.rows.length === 0) {
            throw new Error('Event not found');
        }

        const event = eventResult.rows[0];
        const seriesId = event.series_id;

        // Get points table
        const pointsTable = await this.getPointsTable(seriesId);
        if (!pointsTable) {
            throw new Error('No points table configured for series');
        }

        // Get bonus configs
        const bonusResult = await pool.query(
            `SELECT * FROM bonus_points_config WHERE series_id = $1`,
            [seriesId]
        );
        const bonusConfigs = bonusResult.rows;

        // Get existing results or create from report
        let results = await this.getEventResults(eventId);

        if (results.length === 0) {
            // Try to create from post_race_reports
            const reportResult = await pool.query(
                `SELECT summary_json FROM post_race_reports WHERE event_id = $1 AND status = 'ready'`,
                [eventId]
            );

            if (reportResult.rows.length > 0) {
                const summary = reportResult.rows[0].summary_json;
                results = await this.createResultsFromReport(eventId, summary);
            }
        }

        if (results.length === 0) {
            throw new Error('No results found for event');
        }

        // Score each result
        for (const result of results) {
            const pts = this.calculatePoints(result, pointsTable, bonusConfigs);

            await pool.query(
                `UPDATE event_results SET base_points = $2, bonus_points = $3, penalty_points = $4, total_points = $5
                 WHERE id = $1`,
                [result.id, pts.base, pts.bonus, pts.penalty, pts.total]
            );

            result.basePoints = pts.base;
            result.bonusPoints = pts.bonus;
            result.penaltyPoints = pts.penalty;
            result.totalPoints = pts.total;
        }

        // Log audit
        await pool.query(
            `INSERT INTO scoring_audit_log (event_id, action, performed_by, details)
             VALUES ($1, 'score_event', $2, $3)`,
            [eventId, performedBy ?? null, JSON.stringify({ resultCount: results.length })]
        );

        // Rebuild standings
        await this.rebuildStandings(event.season_id);

        return results;
    }

    private calculatePoints(
        result: EventResult,
        pointsTable: PointsTable,
        _bonusConfigs: BonusPointsConfig[]
    ): { base: number; bonus: number; penalty: number; total: number } {
        let base = 0;
        let bonus = 0;
        const penalty = result.penaltyPoints || 0;

        // Base points from position
        if (result.finishStatus === 'finished' || result.finishStatus === 'dnf') {
            // Check for class-specific points
            if (result.carClass && pointsTable.classPoints?.[result.carClass]) {
                base = pointsTable.classPoints[result.carClass][result.finishingPosition] || 0;
            } else {
                base = pointsTable.points[result.finishingPosition] || 0;
            }
        }

        // DNF gets reduced points (50%)
        if (result.finishStatus === 'dnf') {
            base = Math.floor(base * 0.5);
        }

        // DSQ/DQ gets no points
        if (result.finishStatus === 'dsq' || result.finishStatus === 'dq') {
            base = 0;
        }

        // TODO: Apply bonus points based on configs
        // - Pole position
        // - Laps led
        // - Fastest lap
        // - Clean race

        const total = base + bonus - penalty;

        return { base, bonus, penalty, total: Math.max(0, total) };
    }

    private async createResultsFromReport(eventId: string, summary: { finishingOrder?: { driverName: string; carNumber: string; carClass?: string; lapsCompleted: number; finishStatus: string; position: number }[] }): Promise<EventResult[]> {
        if (!summary.finishingOrder) return [];

        const results: EventResult[] = [];

        for (const driver of summary.finishingOrder) {
            const insertResult = await pool.query<EventResultRow>(
                `INSERT INTO event_results (event_id, driver_id, driver_name, car_number, car_class, finishing_position, laps_completed, finish_status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 ON CONFLICT (event_id, driver_id) DO UPDATE SET finishing_position = EXCLUDED.finishing_position
                 RETURNING *`,
                [
                    eventId,
                    driver.carNumber, // Use car number as driver ID for now
                    driver.driverName,
                    driver.carNumber,
                    driver.carClass ?? null,
                    driver.position,
                    driver.lapsCompleted,
                    driver.finishStatus
                ]
            );

            results.push(this.mapRowToResult(insertResult.rows[0]));
        }

        return results;
    }

    private mapRowToResult(row: EventResultRow): EventResult {
        return {
            id: row.id,
            eventId: row.event_id,
            driverId: row.driver_id,
            driverName: row.driver_name,
            teamId: row.team_id ?? undefined,
            teamName: row.team_name ?? undefined,
            carNumber: row.car_number ?? undefined,
            carClass: row.car_class ?? undefined,
            carName: row.car_name ?? undefined,
            startingPosition: row.starting_position ?? undefined,
            finishingPosition: row.finishing_position,
            classStartingPosition: row.class_starting_position ?? undefined,
            classFinishingPosition: row.class_finishing_position ?? undefined,
            lapsCompleted: row.laps_completed,
            lapsLed: row.laps_led,
            finishStatus: row.finish_status as EventResult['finishStatus'],
            basePoints: row.base_points,
            bonusPoints: row.bonus_points,
            penaltyPoints: row.penalty_points,
            totalPoints: row.total_points,
            isDropped: row.is_dropped,
            fastestLapTime: row.fastest_lap_time ?? undefined,
            incidentCount: row.incident_count
        };
    }

    async getEventResults(eventId: string): Promise<EventResult[]> {
        const result = await pool.query<EventResultRow>(
            `SELECT * FROM event_results WHERE event_id = $1 ORDER BY finishing_position ASC`,
            [eventId]
        );

        return result.rows.map(r => this.mapRowToResult(r));
    }

    // ========================
    // Standings
    // ========================

    async rebuildStandings(seasonId: string): Promise<void> {
        // Get all event results for season
        const resultsQuery = await pool.query<EventResultRow>(
            `SELECT er.* FROM event_results er
             JOIN events e ON e.id = er.event_id
             WHERE e.season_id = $1 AND er.is_dropped = false
             ORDER BY er.driver_id, e.scheduled_at`,
            [seasonId]
        );

        // Aggregate by driver
        const driverStats: Map<string, {
            driverId: string;
            driverName: string;
            teamId?: string;
            teamName?: string;
            carClass?: string;
            points: number;
            wins: number;
            podiums: number;
            top5s: number;
            top10s: number;
            dnfs: number;
            dsqs: number;
            lapsLed: number;
            incidents: number;
            racesStarted: number;
        }> = new Map();

        for (const result of resultsQuery.rows) {
            const existing = driverStats.get(result.driver_id) || {
                driverId: result.driver_id,
                driverName: result.driver_name,
                teamId: result.team_id ?? undefined,
                teamName: result.team_name ?? undefined,
                carClass: result.car_class ?? undefined,
                points: 0,
                wins: 0,
                podiums: 0,
                top5s: 0,
                top10s: 0,
                dnfs: 0,
                dsqs: 0,
                lapsLed: 0,
                incidents: 0,
                racesStarted: 0
            };

            existing.points += result.total_points;
            existing.racesStarted++;
            existing.lapsLed += result.laps_led;
            existing.incidents += result.incident_count;

            if (result.finishing_position === 1) existing.wins++;
            if (result.finishing_position <= 3) existing.podiums++;
            if (result.finishing_position <= 5) existing.top5s++;
            if (result.finishing_position <= 10) existing.top10s++;
            if (result.finish_status === 'dnf') existing.dnfs++;
            if (result.finish_status === 'dsq' || result.finish_status === 'dq') existing.dsqs++;

            driverStats.set(result.driver_id, existing);
        }

        // Sort by points and calculate positions
        const sorted = [...driverStats.values()].sort((a, b) => b.points - a.points);
        const leader = sorted[0]?.points || 0;

        // Upsert standings
        for (let i = 0; i < sorted.length; i++) {
            const driver = sorted[i];
            const position = i + 1;

            await pool.query(
                `INSERT INTO driver_standings 
                    (season_id, driver_id, driver_name, team_id, team_name, car_class, position, points, points_with_drops, wins, podiums, top5s, top10s, dnfs, dsqs, laps_led, incidents, races_started, behind_leader)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
                 ON CONFLICT (season_id, driver_id) DO UPDATE SET
                    driver_name = EXCLUDED.driver_name,
                    team_id = EXCLUDED.team_id,
                    team_name = EXCLUDED.team_name,
                    car_class = EXCLUDED.car_class,
                    position = EXCLUDED.position,
                    points = EXCLUDED.points,
                    points_with_drops = EXCLUDED.points_with_drops,
                    wins = EXCLUDED.wins,
                    podiums = EXCLUDED.podiums,
                    top5s = EXCLUDED.top5s,
                    top10s = EXCLUDED.top10s,
                    dnfs = EXCLUDED.dnfs,
                    dsqs = EXCLUDED.dsqs,
                    laps_led = EXCLUDED.laps_led,
                    incidents = EXCLUDED.incidents,
                    races_started = EXCLUDED.races_started,
                    behind_leader = EXCLUDED.behind_leader`,
                [
                    seasonId,
                    driver.driverId,
                    driver.driverName,
                    driver.teamId ?? null,
                    driver.teamName ?? null,
                    driver.carClass ?? null,
                    position,
                    driver.points,
                    driver.wins,
                    driver.podiums,
                    driver.top5s,
                    driver.top10s,
                    driver.dnfs,
                    driver.dsqs,
                    driver.lapsLed,
                    driver.incidents,
                    driver.racesStarted,
                    leader - driver.points
                ]
            );
        }
    }

    async getDriverStandings(seasonId: string, carClass?: string, limit = 50, offset = 0): Promise<{ standings: DriverStanding[]; totalCount: number }> {
        const whereClause = carClass
            ? 'WHERE season_id = $1 AND car_class = $2'
            : 'WHERE season_id = $1';

        const params = carClass ? [seasonId, carClass, limit, offset] : [seasonId, limit, offset];
        const paramOffset = carClass ? 2 : 1;

        const countResult = await pool.query(
            `SELECT COUNT(*) FROM driver_standings ${whereClause}`,
            carClass ? [seasonId, carClass] : [seasonId]
        );

        const result = await pool.query(
            `SELECT * FROM driver_standings ${whereClause} ORDER BY position ASC LIMIT $${paramOffset + 1} OFFSET $${paramOffset + 2}`,
            params
        );

        return {
            standings: result.rows.map(row => ({
                id: row.id,
                seasonId: row.season_id,
                driverId: row.driver_id,
                driverName: row.driver_name,
                teamId: row.team_id ?? undefined,
                teamName: row.team_name ?? undefined,
                carClass: row.car_class ?? undefined,
                position: row.position,
                classPosition: row.class_position ?? undefined,
                points: row.points,
                pointsWithDrops: row.points_with_drops,
                wins: row.wins,
                podiums: row.podiums,
                top5s: row.top5s,
                top10s: row.top10s,
                dnfs: row.dnfs,
                dsqs: row.dsqs,
                lapsLed: row.laps_led,
                poles: row.poles,
                incidents: row.incidents,
                racesStarted: row.races_started,
                behindLeader: row.behind_leader
            })),
            totalCount: parseInt(countResult.rows[0].count)
        };
    }

    async getTeamStandings(seasonId: string): Promise<{ standings: TeamStanding[]; totalCount: number }> {
        // Aggregate from driver standings
        const result = await pool.query(
            `SELECT team_id, team_name, car_class, SUM(points) as points, SUM(wins) as wins
             FROM driver_standings
             WHERE season_id = $1 AND team_id IS NOT NULL
             GROUP BY team_id, team_name, car_class
             ORDER BY points DESC`,
            [seasonId]
        );

        return {
            standings: result.rows.map((row, idx) => ({
                id: row.team_id,
                seasonId,
                teamId: row.team_id,
                teamName: row.team_name,
                carClass: row.car_class ?? undefined,
                position: idx + 1,
                points: parseInt(row.points),
                wins: parseInt(row.wins)
            })),
            totalCount: result.rows.length
        };
    }
}

// Singleton
let scoringService: ScoringService | null = null;

export function getScoringService(): ScoringService {
    if (!scoringService) {
        scoringService = new ScoringService();
    }
    return scoringService;
}
