// =====================================================================
// Artifact Routes
// File upload handling for event artifacts
// =====================================================================

import { Router, Request, Response } from 'express';
import type { ArtifactType } from '@controlbox/common';
import { requireAuth } from '../middleware/auth.js';
import { getArtifactService } from '../../services/uploads/artifact-service.js';
import { getReportService } from '../../services/reports/report-service.js';

const router = Router();

// All routes require auth
router.use(requireAuth);

/**
 * Get artifacts for an event
 * GET /api/events/:eventId/artifacts
 */
router.get('/events/:eventId/artifacts', async (req: Request, res: Response) => {
    try {
        const artifactService = getArtifactService();
        const artifacts = await artifactService.getByEvent(req.params.eventId);

        res.json({
            success: true,
            data: artifacts
        });
    } catch (error) {
        console.error('Error fetching artifacts:', error);
        res.status(500).json({
            success: false,
            error: { code: 'FETCH_ERROR', message: 'Failed to fetch artifacts' }
        });
    }
});

/**
 * Initiate artifact upload (get presigned URL)
 * POST /api/events/:eventId/artifacts
 */
router.post('/events/:eventId/artifacts', async (req: Request, res: Response) => {
    try {
        const { type, filename, mimeType, fileSizeBytes } = req.body;

        if (!type || !filename) {
            res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'type and filename are required' }
            });
            return;
        }

        const validTypes: ArtifactType[] = ['replay', 'results', 'other'];
        if (!validTypes.includes(type)) {
            res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: `type must be one of: ${validTypes.join(', ')}` }
            });
            return;
        }

        const artifactService = getArtifactService();
        const result = await artifactService.initiateUpload(
            req.params.eventId,
            type,
            filename,
            mimeType || 'application/octet-stream',
            fileSizeBytes || 0,
            req.user!.id
        );

        res.status(201).json({
            success: true,
            data: {
                artifact: result.artifact,
                uploadUrl: result.uploadUrl
            }
        });
    } catch (error) {
        console.error('Error initiating upload:', error);
        res.status(500).json({
            success: false,
            error: { code: 'UPLOAD_ERROR', message: error instanceof Error ? error.message : 'Failed to initiate upload' }
        });
    }
});

/**
 * Mark artifact upload as complete
 * POST /api/artifacts/:id/complete
 */
router.post('/:id/complete', async (req: Request, res: Response) => {
    try {
        const artifactService = getArtifactService();
        const artifact = await artifactService.markUploadComplete(req.params.id);

        if (!artifact) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Artifact not found' }
            });
            return;
        }

        // If this is a results file, trigger report generation
        if (artifact.type === 'results') {
            const reportService = getReportService();
            // Fire and forget - don't wait for report generation
            reportService.generate(artifact.eventId, req.user!.id).catch(err => {
                console.error('Background report generation failed:', err);
            });
        }

        res.json({
            success: true,
            data: artifact
        });
    } catch (error) {
        console.error('Error completing upload:', error);
        res.status(500).json({
            success: false,
            error: { code: 'UPDATE_ERROR', message: 'Failed to complete upload' }
        });
    }
});

/**
 * Get download URL for artifact
 * GET /api/artifacts/:id/download
 */
router.get('/:id/download', async (req: Request, res: Response) => {
    try {
        const artifactService = getArtifactService();
        const artifact = await artifactService.getById(req.params.id);

        if (!artifact) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Artifact not found' }
            });
            return;
        }

        const downloadUrl = await artifactService.generateDownloadUrl(artifact.storagePath);

        res.json({
            success: true,
            data: { downloadUrl }
        });
    } catch (error) {
        console.error('Error getting download URL:', error);
        res.status(500).json({
            success: false,
            error: { code: 'FETCH_ERROR', message: 'Failed to get download URL' }
        });
    }
});

/**
 * Delete an artifact
 * DELETE /api/artifacts/:id
 */
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const artifactService = getArtifactService();
        const deleted = await artifactService.delete(req.params.id);

        if (!deleted) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Artifact not found' }
            });
            return;
        }

        res.json({
            success: true,
            data: { deleted: true }
        });
    } catch (error) {
        console.error('Error deleting artifact:', error);
        res.status(500).json({
            success: false,
            error: { code: 'DELETE_ERROR', message: 'Failed to delete artifact' }
        });
    }
});

export default router;
