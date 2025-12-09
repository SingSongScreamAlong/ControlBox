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

        // TODO: Implement proper export (PDF, CSV)
        res.json({
            success: true,
            data: {
                format: data.format,
                message: 'Export functionality not yet implemented',
            },
        });
    } catch {
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Failed to export report' },
        });
    }
});
