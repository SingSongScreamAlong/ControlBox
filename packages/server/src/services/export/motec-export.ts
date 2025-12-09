// =====================================================================
// MoTeC Export Service
// Generates MoTeC i2 compatible .ld files from telemetry data
// =====================================================================

import { pool } from '../../db/client.js';

/**
 * MoTeC .ld file structure reference:
 * - Header (binary format with metadata)
 * - Channel definitions
 * - Sample data
 * 
 * This is a simplified CSV export that MoTeC can import.
 * Full .ld binary format would require additional libraries.
 */

export interface MotecExportOptions {
    sessionId: string;
    driverId?: string;
    startLap?: number;
    endLap?: number;
    channels?: string[];
}

export interface MotecChannelData {
    name: string;
    unit: string;
    samples: number[];
    sampleRate: number;
}

export interface MotecExportResult {
    success: boolean;
    filename: string;
    data: string;
    format: 'csv' | 'ld';
    channelCount: number;
    sampleCount: number;
    error?: string;
}

// Default telemetry channels to export
const DEFAULT_CHANNELS = [
    'Speed',
    'RPM',
    'Throttle',
    'Brake',
    'Gear',
    'SteeringAngle',
    'LapTime',
    'LapNumber',
    'TrackPosition',
    'FuelLevel',
    'TireTemp_FL',
    'TireTemp_FR',
    'TireTemp_RL',
    'TireTemp_RR',
];

export class MotecExportService {
    /**
     * Export telemetry data to MoTeC-compatible CSV format
     */
    async exportToCSV(options: MotecExportOptions): Promise<MotecExportResult> {
        try {
            const channels = options.channels || DEFAULT_CHANNELS;

            // Fetch telemetry data from database
            const telemetryData = await this.fetchTelemetryData(options);

            if (telemetryData.length === 0) {
                return {
                    success: false,
                    filename: '',
                    data: '',
                    format: 'csv',
                    channelCount: 0,
                    sampleCount: 0,
                    error: 'No telemetry data found for this session'
                };
            }

            // Build CSV content
            const csvContent = this.buildCSV(telemetryData, channels);

            // Generate filename
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `telemetry_${options.sessionId}_${timestamp}.csv`;

            return {
                success: true,
                filename,
                data: csvContent,
                format: 'csv',
                channelCount: channels.length,
                sampleCount: telemetryData.length,
            };
        } catch (error) {
            return {
                success: false,
                filename: '',
                data: '',
                format: 'csv',
                channelCount: 0,
                sampleCount: 0,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Fetch telemetry data from database
     */
    private async fetchTelemetryData(options: MotecExportOptions): Promise<Record<string, unknown>[]> {
        let query = `
            SELECT * FROM telemetry_samples
            WHERE session_id = $1
        `;
        const params: unknown[] = [options.sessionId];
        let paramIndex = 2;

        if (options.driverId) {
            query += ` AND driver_id = $${paramIndex}`;
            params.push(options.driverId);
            paramIndex++;
        }

        if (options.startLap !== undefined) {
            query += ` AND lap_number >= $${paramIndex}`;
            params.push(options.startLap);
            paramIndex++;
        }

        if (options.endLap !== undefined) {
            query += ` AND lap_number <= $${paramIndex}`;
            params.push(options.endLap);
            paramIndex++;
        }

        query += ' ORDER BY timestamp ASC';

        const result = await pool.query(query, params);
        return result.rows;
    }

    /**
     * Build CSV content from telemetry data
     */
    private buildCSV(data: Record<string, unknown>[], channels: string[]): string {
        // Header row
        const header = ['Timestamp', 'LapNumber', ...channels].join(',');

        // Data rows
        const rows = data.map(sample => {
            const values = [
                sample.timestamp,
                sample.lap_number,
                ...channels.map(ch => {
                    const key = this.channelToDbKey(ch);
                    return sample[key] ?? '';
                })
            ];
            return values.join(',');
        });

        return [header, ...rows].join('\n');
    }

    /**
     * Convert MoTeC channel name to database column name
     */
    private channelToDbKey(channel: string): string {
        const mapping: Record<string, string> = {
            'Speed': 'speed',
            'RPM': 'rpm',
            'Throttle': 'throttle',
            'Brake': 'brake',
            'Gear': 'gear',
            'SteeringAngle': 'steering_angle',
            'LapTime': 'lap_time',
            'LapNumber': 'lap_number',
            'TrackPosition': 'track_position',
            'FuelLevel': 'fuel_level',
            'TireTemp_FL': 'tire_temp_fl',
            'TireTemp_FR': 'tire_temp_fr',
            'TireTemp_RL': 'tire_temp_rl',
            'TireTemp_RR': 'tire_temp_rr',
        };
        return mapping[channel] || channel.toLowerCase();
    }

    /**
     * Get available channels for a session
     */
    async getAvailableChannels(_sessionId: string): Promise<string[]> {
        // Return default channels for now
        // In production, this would query the actual available data
        return DEFAULT_CHANNELS;
    }

    /**
     * Get session metadata for export
     */
    async getSessionMetadata(sessionId: string): Promise<{
        driverName?: string;
        trackName?: string;
        carName?: string;
        sessionType?: string;
        sampleCount: number;
    } | null> {
        const result = await pool.query(
            `SELECT s.*, COUNT(t.id) as sample_count
             FROM sessions s
             LEFT JOIN telemetry_samples t ON t.session_id = s.id
             WHERE s.id = $1
             GROUP BY s.id`,
            [sessionId]
        );

        if (result.rows.length === 0) return null;

        const row = result.rows[0];
        return {
            driverName: row.driver_name,
            trackName: row.track_name,
            carName: row.car_name,
            sessionType: row.session_type,
            sampleCount: parseInt(row.sample_count) || 0,
        };
    }
}

// Singleton instance
let motecService: MotecExportService | null = null;

export function getMotecExportService(): MotecExportService {
    if (!motecService) {
        motecService = new MotecExportService();
    }
    return motecService;
}
