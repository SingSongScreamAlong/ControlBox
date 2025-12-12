// =====================================================================
// Reports Routes
// =====================================================================

import { Router, type Request, type Response } from 'express';
import type { PostRaceReport, ExportReportRequest } from '@controlbox/common';
import { SessionRepository } from '../../db/repositories/session.repo.js';
import { IncidentRepository } from '../../db/repositories/incident.repo.js';
import { PenaltyRepository } from '../../db/repositories/penalty.repo.js';

export const reportsRouter = Router();
const sessionRepo = new SessionRepository();
const incidentRepo = new IncidentRepository();
const penaltyRepo = new PenaltyRepository();

// GET /api/sessions/:id/report - Get post-race report
reportsRouter.get('/:id/report', async (req: Request, res: Response): Promise<void> => {
    try {
        const session = await sessionRepo.findById(req.params.id);

        if (!session) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Session not found' },
            });
            return;
        }

        const drivers = await sessionRepo.getDrivers(req.params.id);
        const incidents = await incidentRepo.findAll({ sessionId: req.params.id });
        const penalties = await penaltyRepo.findAll({ sessionId: req.params.id });

        // Calculate stats
        const incidentsByType: Record<string, number> = {};
        for (const incident of incidents) {
            incidentsByType[incident.type] = (incidentsByType[incident.type] || 0) + 1;
        }

        const penaltiesByType: Record<string, number> = {};
        for (const penalty of penalties) {
            penaltiesByType[penalty.type] = (penaltiesByType[penalty.type] || 0) + 1;
        }

        // Find cleanest and most incident drivers
        const driverIncidentCounts: Record<string, { driverId: string; driverName: string; count: number }> = {};
        for (const driver of drivers) {
            driverIncidentCounts[driver.driverId] = {
                driverId: driver.driverId,
                driverName: driver.driverName,
                count: 0,
            };
        }
        for (const incident of incidents) {
            for (const involved of incident.involvedDrivers || []) {
                if (driverIncidentCounts[involved.driverId]) {
                    driverIncidentCounts[involved.driverId].count++;
                }
            }
        }

        const sortedDrivers = Object.values(driverIncidentCounts).sort((a, b) => a.count - b.count);

        const report: PostRaceReport = {
            sessionId: session.id,
            session,
            drivers,
            incidents,
            penalties,
            stats: {
                totalIncidents: incidents.length,
                incidentsByType,
                totalPenalties: penalties.length,
                penaltiesByType,
                cleanestDrivers: sortedDrivers.slice(0, 3).map(d => ({
                    driverId: d.driverId,
                    driverName: d.driverName,
                    incidents: d.count,
                })),
                mostIncidents: sortedDrivers.slice(-3).reverse().map(d => ({
                    driverId: d.driverId,
                    driverName: d.driverName,
                    incidents: d.count,
                })),
            },
            generatedAt: new Date(),
        };

        res.json({ success: true, data: report });
    } catch {
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Failed to generate report' },
        });
    }
});

// POST /api/sessions/:id/report/export - Export report
reportsRouter.post('/:id/report/export', async (req: Request, res: Response): Promise<void> => {
    try {
        const data: ExportReportRequest = req.body;
        const format = data.format || 'json';

        // Fetch report data
        const session = await sessionRepo.findById(req.params.id);
        if (!session) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Session not found' },
            });
            return;
        }

        const drivers = await sessionRepo.getDrivers(req.params.id);
        const incidents = await incidentRepo.findAll({ sessionId: req.params.id });
        const penalties = await penaltyRepo.findAll({ sessionId: req.params.id });

        if (format === 'csv') {
            // Generate CSV export
            const csvLines: string[] = [];

            // Incidents CSV
            csvLines.push('=== INCIDENTS ===');
            csvLines.push('ID,Type,Severity,Lap,Location,Drivers,Status,SessionTimeMs');
            for (const incident of incidents) {
                const driverNames = incident.involvedDrivers?.map(d => d.driverName).join('; ') || '';
                csvLines.push([
                    incident.id,
                    incident.type,
                    incident.severity,
                    incident.lapNumber || 0,
                    incident.cornerName || `${(incident.trackPosition * 100).toFixed(1)}%`,
                    `"${driverNames}"`,
                    incident.status,
                    incident.sessionTimeMs
                ].join(','));
            }

            csvLines.push('');
            csvLines.push('=== PENALTIES ===');
            csvLines.push('ID,Driver,Type,Value,Status,Reason');
            for (const penalty of penalties) {
                csvLines.push([
                    penalty.id,
                    penalty.driverName,
                    penalty.type,
                    penalty.value,
                    penalty.status,
                    `"${penalty.rationale?.replace(/"/g, '""') || ''}"`
                ].join(','));
            }

            csvLines.push('');
            csvLines.push('=== DRIVERS ===');
            csvLines.push('ID,Name,CarNumber,CarName,iRating');
            for (const driver of drivers) {
                csvLines.push([
                    driver.driverId,
                    driver.driverName,
                    driver.carNumber,
                    driver.carName,
                    driver.irating || ''
                ].join(','));
            }

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="report-${req.params.id}.csv"`);
            res.send(csvLines.join('\n'));
        } else {
            // JSON export (default)
            const jsonReport = {
                session,
                drivers,
                incidents,
                penalties,
                exportedAt: new Date().toISOString(),
                exportFormat: 'json'
            };

            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="report-${req.params.id}.json"`);
            res.json(jsonReport);
        }
    } catch (error) {
        console.error('Failed to export report:', error);
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Failed to export report' },
        });
    }
});
