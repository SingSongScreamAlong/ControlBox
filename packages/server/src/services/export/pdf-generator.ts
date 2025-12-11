// =====================================================================
// PDF Generator Service
// Generate PDF documents for steward bulletins and reports
// =====================================================================

import PDFDocument from 'pdfkit';
import { pool } from '../../db/client.js';

interface PenaltyForBulletin {
    id: string;
    driverName: string;
    incidentType: string;
    penaltyType: string;
    penaltyValue?: string;
    description?: string;
    ruleReference?: string;
    lapNumber?: number;
}

interface BulletinData {
    eventName: string;
    eventDate: string;
    leagueName: string;
    penalties: PenaltyForBulletin[];
    stewardName?: string;
}

/**
 * Generate a steward bulletin PDF
 */
export async function generateStewardBulletin(eventId: string): Promise<Buffer> {
    // Fetch event and penalties data
    const eventResult = await pool.query(`
        SELECT e.name, e.scheduled_date, l.name as league_name
        FROM events e
        JOIN seasons s ON e.season_id = s.id
        JOIN series sr ON s.series_id = sr.id
        JOIN leagues l ON sr.league_id = l.id
        WHERE e.id = $1
    `, [eventId]);

    if (eventResult.rows.length === 0) {
        throw new Error('Event not found');
    }

    const penaltiesResult = await pool.query(`
        SELECT p.id, p.driver_name, p.penalty_type, p.time_penalty_seconds,
               p.position_penalty, p.description, p.rule_reference,
               i.type as incident_type, i.lap_number
        FROM penalties p
        LEFT JOIN incidents i ON p.incident_id = i.id
        WHERE i.session_id IN (SELECT id FROM event_sessions WHERE event_id = $1)
        ORDER BY p.created_at
    `, [eventId]);

    const event = eventResult.rows[0];
    const data: BulletinData = {
        eventName: event.name,
        eventDate: new Date(event.scheduled_date).toLocaleDateString(),
        leagueName: event.league_name,
        penalties: penaltiesResult.rows.map(row => ({
            id: row.id,
            driverName: row.driver_name,
            incidentType: row.incident_type || 'Racing Incident',
            penaltyType: row.penalty_type,
            penaltyValue: row.time_penalty_seconds
                ? `${row.time_penalty_seconds}s`
                : row.position_penalty
                    ? `${row.position_penalty} positions`
                    : undefined,
            description: row.description,
            ruleReference: row.rule_reference,
            lapNumber: row.lap_number
        }))
    };

    return createBulletinPDF(data);
}

/**
 * Create the actual PDF document
 */
function createBulletinPDF(data: BulletinData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50 });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header
        doc.fontSize(20).font('Helvetica-Bold');
        doc.text('STEWARD BULLETIN', { align: 'center' });
        doc.moveDown(0.5);

        doc.fontSize(12).font('Helvetica');
        doc.text(data.leagueName, { align: 'center' });
        doc.text(data.eventName, { align: 'center' });
        doc.text(data.eventDate, { align: 'center' });
        doc.moveDown(1.5);

        // Divider
        doc.strokeColor('#333333')
            .lineWidth(1)
            .moveTo(50, doc.y)
            .lineTo(545, doc.y)
            .stroke();
        doc.moveDown(1);

        // Penalties header
        doc.fontSize(14).font('Helvetica-Bold');
        doc.text('DECISIONS', { underline: true });
        doc.moveDown(0.5);

        if (data.penalties.length === 0) {
            doc.fontSize(11).font('Helvetica');
            doc.text('No penalties were issued during this event.');
        } else {
            data.penalties.forEach((penalty, index) => {
                doc.fontSize(12).font('Helvetica-Bold');
                doc.text(`Decision ${index + 1}`, { underline: true });
                doc.moveDown(0.3);

                doc.fontSize(10).font('Helvetica');
                doc.text(`Driver: ${penalty.driverName}`);
                doc.text(`Incident: ${penalty.incidentType}${penalty.lapNumber ? ` (Lap ${penalty.lapNumber})` : ''}`);
                doc.text(`Penalty: ${formatPenaltyType(penalty.penaltyType)}${penalty.penaltyValue ? ` - ${penalty.penaltyValue}` : ''}`);

                if (penalty.ruleReference) {
                    doc.text(`Rule: ${penalty.ruleReference}`);
                }

                if (penalty.description) {
                    doc.moveDown(0.3);
                    doc.text(`Reasoning: ${penalty.description}`, { width: 495 });
                }

                doc.moveDown(1);
            });
        }

        // Footer
        doc.moveDown(2);
        doc.strokeColor('#333333')
            .lineWidth(0.5)
            .moveTo(50, doc.y)
            .lineTo(545, doc.y)
            .stroke();
        doc.moveDown(0.5);

        doc.fontSize(9).font('Helvetica');
        doc.text(`Generated by ControlBox • ${new Date().toISOString()}`, { align: 'center' });

        doc.end();
    });
}

/**
 * Format penalty type for display
 */
function formatPenaltyType(type: string): string {
    const map: Record<string, string> = {
        time_penalty: 'Time Penalty',
        position_penalty: 'Grid/Position Penalty',
        drive_through: 'Drive-Through Penalty',
        stop_go: 'Stop & Go Penalty',
        disqualification: 'Disqualification',
        warning: 'Official Warning',
        reprimand: 'Reprimand',
        license_points: 'License Points',
        fine: 'Fine'
    };
    return map[type] || type;
}

/**
 * Generate incident summary PDF
 */
export async function generateIncidentSummary(incidentId: string): Promise<Buffer> {
    const result = await pool.query(`
        SELECT i.*, 
               p.penalty_type, p.time_penalty_seconds, p.description as penalty_desc
        FROM incidents i
        LEFT JOIN penalties p ON p.incident_id = i.id
        WHERE i.id = $1
    `, [incidentId]);

    if (result.rows.length === 0) {
        throw new Error('Incident not found');
    }

    const incident = result.rows[0];

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50 });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header
        doc.fontSize(16).font('Helvetica-Bold');
        doc.text('INCIDENT SUMMARY', { align: 'center' });
        doc.moveDown(1);

        // Incident details
        doc.fontSize(11).font('Helvetica');
        doc.text(`Incident ID: ${incident.id}`);
        doc.text(`Type: ${incident.type}`);
        doc.text(`Severity: ${incident.severity}`);
        doc.text(`Lap: ${incident.lap_number || 'N/A'}`);
        doc.text(`Drivers: ${incident.drivers_involved?.join(', ') || 'Unknown'}`);

        if (incident.description) {
            doc.moveDown(0.5);
            doc.text(`Description: ${incident.description}`);
        }

        if (incident.penalty_type) {
            doc.moveDown(1);
            doc.fontSize(12).font('Helvetica-Bold');
            doc.text('DECISION');
            doc.fontSize(11).font('Helvetica');
            doc.text(`Penalty: ${formatPenaltyType(incident.penalty_type)}`);
            if (incident.penalty_desc) {
                doc.text(`Reasoning: ${incident.penalty_desc}`);
            }
        }

        doc.moveDown(2);
        doc.fontSize(9).font('Helvetica');
        doc.text(`Generated by ControlBox • ${new Date().toISOString()}`, { align: 'center' });

        doc.end();
    });
}
