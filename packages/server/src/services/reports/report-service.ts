// =====================================================================
// Report Service
// Post-race report generation and results parsing
// =====================================================================

import { pool } from '../../db/client.js';
import type {
    EventReport,
    EventReportSummary,
    DriverResult,
    RaceStatistics,
    ReportStatus,
    ParsedResultsRow
} from '@controlbox/common';
import { getArtifactService } from '../uploads/artifact-service.js';

interface ReportRow {
    id: string;
    event_id: string;
    status: string;
    generated_by: string | null;
    summary_json: EventReportSummary;
    processing_started_at: Date | null;
    processing_completed_at: Date | null;
    error_message: string | null;
    version: number;
    created_at: Date;
    updated_at: Date | null;
}

function mapRowToReport(row: ReportRow): EventReport {
    return {
        id: row.id,
        eventId: row.event_id,
        status: row.status as ReportStatus,
        generatedBy: row.generated_by ?? undefined,
        summary: row.summary_json,
        processingStartedAt: row.processing_started_at ?? undefined,
        processingCompletedAt: row.processing_completed_at ?? undefined,
        errorMessage: row.error_message ?? undefined,
        version: row.version,
        createdAt: row.created_at,
        updatedAt: row.updated_at ?? undefined
    };
}

export class ReportService {
    /**
     * Get report for an event
     */
    async getByEvent(eventId: string): Promise<EventReport | null> {
        const result = await pool.query<ReportRow>(
            `SELECT * FROM post_race_reports WHERE event_id = $1`,
            [eventId]
        );

        return result.rows.length > 0 ? mapRowToReport(result.rows[0]) : null;
    }

    /**
     * Generate a report for an event
     */
    async generate(eventId: string, generatedBy?: string): Promise<EventReport> {
        // Check if report already exists
        const existing = await this.getByEvent(eventId);
        if (existing && existing.status === 'ready') {
            // Increment version and regenerate
            await pool.query(
                `UPDATE post_race_reports SET status = 'processing', processing_started_at = NOW(), version = version + 1 WHERE event_id = $1`,
                [eventId]
            );
        } else if (!existing) {
            // Create new report
            await pool.query(
                `INSERT INTO post_race_reports (event_id, status, generated_by, processing_started_at)
                 VALUES ($1, 'processing', $2, NOW())`,
                [eventId, generatedBy ?? null]
            );
        } else {
            // Update existing pending/failed report
            await pool.query(
                `UPDATE post_race_reports SET status = 'processing', processing_started_at = NOW(), generated_by = $2 WHERE event_id = $1`,
                [eventId, generatedBy ?? null]
            );
        }

        try {
            // Get results artifact
            const artifactService = getArtifactService();
            const resultsArtifact = await artifactService.getResultsArtifact(eventId);

            if (!resultsArtifact) {
                throw new Error('No results file uploaded for this event');
            }

            // Parse results (placeholder - would fetch from storage and parse)
            const summary = await this.parseAndGenerateSummary(resultsArtifact.storagePath);

            // Update report with summary
            const result = await pool.query<ReportRow>(
                `UPDATE post_race_reports 
                 SET status = 'ready', summary_json = $2, processing_completed_at = NOW(), error_message = NULL
                 WHERE event_id = $1
                 RETURNING *`,
                [eventId, JSON.stringify(summary)]
            );

            // Mark artifact as processed
            await artifactService.markProcessed(resultsArtifact.id);

            return mapRowToReport(result.rows[0]);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            await pool.query(
                `UPDATE post_race_reports SET status = 'failed', error_message = $2, processing_completed_at = NOW() WHERE event_id = $1`,
                [eventId, errorMessage]
            );

            throw error;
        }
    }

    /**
     * Parse results file and generate summary
     * TODO: Implement actual file parsing from object storage
     */
    private async parseAndGenerateSummary(_storagePath: string): Promise<EventReportSummary> {
        // Placeholder implementation - would fetch file from storage and parse
        // For now, return mock data structure

        // In production:
        // 1. Fetch file from DO Spaces using storagePath
        // 2. Detect format (CSV/JSON)
        // 3. Parse with appropriate parser
        // 4. Map to DriverResult[] and calculate statistics

        return {
            finishingOrder: [],
            penalties: [],
            incidents: [],
            statistics: {
                totalDrivers: 0,
                finishers: 0,
                dnfs: 0,
                dsqs: 0,
                totalLaps: 0,
                totalIncidents: 0
            },
            notes: 'Report generated - awaiting results file processing implementation'
        };
    }

    /**
     * Parse CSV results data
     */
    parseCSV(csvContent: string, hasHeader: boolean = true): ParsedResultsRow[] {
        const lines = csvContent.trim().split('\n');
        if (lines.length === 0) return [];

        const headers = hasHeader
            ? lines[0].split(',').map(h => h.trim().toLowerCase())
            : ['position', 'driver', 'car', 'laps', 'time', 'gap', 'inc'];

        const dataLines = hasHeader ? lines.slice(1) : lines;

        return dataLines.map(line => {
            const values = this.parseCSVLine(line);
            const row: ParsedResultsRow = {};

            headers.forEach((header, index) => {
                if (values[index] !== undefined) {
                    row[header] = values[index];
                }
            });

            return row;
        });
    }

    /**
     * Parse a single CSV line handling quoted values
     */
    private parseCSVLine(line: string): string[] {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;

        for (const char of line) {
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }

        result.push(current.trim());
        return result;
    }

    /**
     * Parse JSON results data
     */
    parseJSON(jsonContent: string): ParsedResultsRow[] {
        const data = JSON.parse(jsonContent);

        // Handle various JSON formats
        if (Array.isArray(data)) {
            return data;
        }

        // iRacing format might have results nested
        if (data.results && Array.isArray(data.results)) {
            return data.results;
        }

        if (data.drivers && Array.isArray(data.drivers)) {
            return data.drivers;
        }

        throw new Error('Unrecognized JSON results format');
    }

    /**
     * Transform parsed rows to DriverResult[]
     */
    transformToDriverResults(rows: ParsedResultsRow[]): DriverResult[] {
        return rows.map((row, index) => {
            const position = this.parseNumber(row.position) ?? (index + 1);
            const startPos = this.parseNumber(row.startPos) ?? this.parseNumber(row.qualPos);

            return {
                position,
                driverName: String(row.driverName ?? row.driver ?? row.name ?? 'Unknown'),
                carNumber: String(row.carNumber ?? row.carNum ?? row.num ?? ''),
                carClass: row.carClass ?? row.class as string | undefined,
                carName: row.car ?? row.carName as string | undefined,
                teamName: row.team ?? row.teamName as string | undefined,
                lapsCompleted: this.parseNumber(row.laps) ?? 0,
                finishStatus: this.parseFinishStatus(row.status),
                gapToLeader: row.gap as string | undefined,
                positionsGained: startPos !== undefined ? startPos - position : undefined,
                qualifyingPosition: startPos,
                averageLapTime: this.parseLapTime(row.avgLap as string),
                fastestLap: this.parseLapTime(row.fastLap as string),
                incidentPoints: this.parseNumber(row.inc)
            };
        });
    }

    /**
     * Calculate race statistics from driver results
     */
    calculateStatistics(results: DriverResult[]): RaceStatistics {
        const finishers = results.filter(r => r.finishStatus === 'finished');
        const dnfs = results.filter(r => r.finishStatus === 'dnf');
        const dsqs = results.filter(r => r.finishStatus === 'dsq' || r.finishStatus === 'dq');

        const totalIncidents = results.reduce((sum, r) => sum + (r.incidentPoints ?? 0), 0);
        const maxLaps = Math.max(...results.map(r => r.lapsCompleted));

        const fastestDriver = results.reduce((fastest, r) => {
            if (!r.fastestLap) return fastest;
            if (!fastest || r.fastestLap < (fastest.fastestLap ?? Infinity)) {
                return r;
            }
            return fastest;
        }, null as DriverResult | null);

        return {
            totalDrivers: results.length,
            finishers: finishers.length,
            dnfs: dnfs.length,
            dsqs: dsqs.length,
            totalLaps: maxLaps,
            totalIncidents,
            fastestLap: fastestDriver ? {
                driverName: fastestDriver.driverName,
                carNumber: fastestDriver.carNumber,
                lapTime: fastestDriver.fastestLap!,
                lapNumber: fastestDriver.fastestLapNumber ?? 0
            } : undefined
        };
    }

    /**
     * Export report as JSON
     */
    async exportJSON(eventId: string): Promise<object> {
        const report = await this.getByEvent(eventId);
        if (!report) {
            throw new Error('Report not found');
        }

        // Get event details
        const eventResult = await pool.query(
            `SELECT e.*, s.name as season_name, sr.name as series_name, l.name as league_name
             FROM events e
             JOIN seasons s ON s.id = e.season_id
             JOIN series sr ON sr.id = e.series_id
             JOIN leagues l ON l.id = e.league_id
             WHERE e.id = $1`,
            [eventId]
        );

        const event = eventResult.rows[0];

        return {
            event: {
                name: event.name,
                date: event.scheduled_at,
                track: event.track_name,
                trackConfig: event.track_config,
                series: event.series_name,
                season: event.season_name,
                league: event.league_name
            },
            report: {
                generatedAt: report.processingCompletedAt,
                version: report.version,
                ...report.summary
            }
        };
    }

    // Helper methods
    private parseNumber(value: unknown): number | undefined {
        if (value === undefined || value === null || value === '') return undefined;
        const num = Number(value);
        return isNaN(num) ? undefined : num;
    }

    private parseLapTime(value: string | undefined): number | undefined {
        if (!value) return undefined;
        // Handle MM:SS.mmm format
        const match = value.match(/(\d+):(\d+)\.(\d+)/);
        if (match) {
            return parseInt(match[1]) * 60 + parseFloat(`${match[2]}.${match[3]}`);
        }
        // Try as seconds
        const num = parseFloat(value);
        return isNaN(num) ? undefined : num;
    }

    private parseFinishStatus(status: unknown): DriverResult['finishStatus'] {
        if (!status) return 'finished';
        const s = String(status).toLowerCase();
        if (s.includes('dnf') || s.includes('out') || s.includes('retired')) return 'dnf';
        if (s.includes('dsq') || s.includes('disq')) return 'dsq';
        if (s.includes('dns')) return 'dns';
        if (s.includes('dq')) return 'dq';
        return 'finished';
    }
}

// Singleton instance
let reportService: ReportService | null = null;

export function getReportService(): ReportService {
    if (!reportService) {
        reportService = new ReportService();
    }
    return reportService;
}
