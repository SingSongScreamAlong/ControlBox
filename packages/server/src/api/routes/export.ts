// =====================================================================
// MoTeC Export API Routes
// =====================================================================

import { Router, Request, Response } from 'express';
import { getMotecExportService } from '../../services/export/motec-export.js';

const router = Router();
const motecService = getMotecExportService();

/**
 * GET /api/export/motec/:sessionId
 * Export telemetry data as MoTeC-compatible CSV
 */
router.get('/motec/:sessionId', async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;
        const { driverId, startLap, endLap, channels } = req.query;

        const result = await motecService.exportToCSV({
            sessionId,
            driverId: driverId as string | undefined,
            startLap: startLap ? parseInt(startLap as string) : undefined,
            endLap: endLap ? parseInt(endLap as string) : undefined,
            channels: channels ? (channels as string).split(',') : undefined,
        });

        if (!result.success) {
            res.status(400).json({ error: result.error });
            return;
        }

        // Set headers for file download
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        res.send(result.data);
    } catch (error) {
        console.error('MoTeC export error:', error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Export failed'
        });
    }
});

/**
 * GET /api/export/motec/:sessionId/channels
 * Get available channels for export
 */
router.get('/motec/:sessionId/channels', async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;
        const channels = await motecService.getAvailableChannels(sessionId);
        res.json({ channels });
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to get channels'
        });
    }
});

/**
 * GET /api/export/motec/:sessionId/metadata
 * Get session metadata for export preview
 */
router.get('/motec/:sessionId/metadata', async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;
        const metadata = await motecService.getSessionMetadata(sessionId);

        if (!metadata) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }

        res.json(metadata);
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to get metadata'
        });
    }
});

export default router;
