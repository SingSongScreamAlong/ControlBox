// =====================================================================
// Event Reports Routes
// Post-race report generation and export for scheduled events
// =====================================================================

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getReportService } from '../../services/reports/report-service.js';
import { getEventService } from '../../services/events/event-service.js';
import { getDiscordService } from '../../services/discord/discord-service.js';

// Inline type for CSV export (avoids needing package rebuild)
interface DriverResultForCSV {
    position: number;
    driverName: string;
    carNumber: string;
    carClass?: string;
    lapsCompleted: number;
    finishStatus: string;
    gapToLeader?: string;
    fastestLap?: number;
    incidentPoints?: number;
}

const router = Router();

// All routes require auth
router.use(requireAuth);

/**
 * Get report for an event
 * GET /api/events/:eventId/report
 */
router.get('/:eventId/report', async (req: Request, res: Response) => {
    try {
        const reportService = getReportService();
        const report = await reportService.getByEvent(req.params.eventId);

        if (!report) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Report not found' }
            });
            return;
        }

        res.json({
            success: true,
            data: report
        });
    } catch (error) {
        console.error('Error fetching report:', error);
        res.status(500).json({
            success: false,
            error: { code: 'FETCH_ERROR', message: 'Failed to fetch report' }
        });
    }
});

/**
 * Generate/regenerate report for an event
 * POST /api/events/:eventId/report/generate
 */
router.post('/:eventId/report/generate', async (req: Request, res: Response) => {
    try {
        const reportService = getReportService();
        const report = await reportService.generate(req.params.eventId, req.user!.id);

        // If report is ready, send Discord notification
        if (report.status === 'ready') {
            const eventService = getEventService();
            const event = await eventService.getById(req.params.eventId);

            if (event) {
                const discordService = getDiscordService();
                await discordService.sendReportPublished(event, report);
            }
        }

        res.json({
            success: true,
            data: report
        });
    } catch (error) {
        console.error('Error generating report:', error);
        res.status(500).json({
            success: false,
            error: { code: 'GENERATE_ERROR', message: error instanceof Error ? error.message : 'Failed to generate report' }
        });
    }
});

/**
 * Get report status (for polling during generation)
 * GET /api/events/:eventId/report/status
 */
router.get('/:eventId/report/status', async (req: Request, res: Response) => {
    try {
        const reportService = getReportService();
        const report = await reportService.getByEvent(req.params.eventId);

        res.json({
            success: true,
            data: {
                status: report?.status ?? 'not_started',
                version: report?.version ?? 0,
                errorMessage: report?.errorMessage
            }
        });
    } catch (error) {
        console.error('Error fetching report status:', error);
        res.status(500).json({
            success: false,
            error: { code: 'FETCH_ERROR', message: 'Failed to fetch report status' }
        });
    }
});

/**
 * Export report as JSON
 * GET /api/events/:eventId/report/export
 */
router.get('/:eventId/report/export', async (req: Request, res: Response) => {
    try {
        const reportService = getReportService();
        const exportData = await reportService.exportJSON(req.params.eventId);

        res.json({
            success: true,
            data: exportData
        });
    } catch (error) {
        console.error('Error exporting report:', error);
        res.status(500).json({
            success: false,
            error: { code: 'EXPORT_ERROR', message: error instanceof Error ? error.message : 'Failed to export report' }
        });
    }
});

/**
 * Export report as CSV (simplified driver results)
 * GET /api/events/:eventId/report/export/csv
 */
router.get('/:eventId/report/export/csv', async (req: Request, res: Response) => {
    try {
        const reportService = getReportService();
        const report = await reportService.getByEvent(req.params.eventId);

        if (!report || report.status !== 'ready') {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Report not ready' }
            });
            return;
        }

        // Build CSV
        const headers = ['Position', 'Driver', 'Car #', 'Class', 'Laps', 'Status', 'Gap', 'Fastest Lap', 'Incidents'];
        const rows = report.summary.finishingOrder.map((d: DriverResultForCSV) => [
            d.position,
            d.driverName,
            d.carNumber,
            d.carClass ?? '',
            d.lapsCompleted,
            d.finishStatus,
            d.gapToLeader ?? '',
            d.fastestLap ?? '',
            d.incidentPoints ?? ''
        ]);

        const csv = [
            headers.join(','),
            ...rows.map((row: (string | number)[]) => row.join(','))
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="results-${req.params.eventId}.csv"`);
        res.send(csv);
    } catch (error) {
        console.error('Error exporting CSV:', error);
        res.status(500).json({
            success: false,
            error: { code: 'EXPORT_ERROR', message: 'Failed to export CSV' }
        });
    }
});

export default router;
