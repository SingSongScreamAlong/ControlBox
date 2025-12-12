// =====================================================================
// Evidence Routes
// API endpoints for video/replay evidence management
// =====================================================================

import { Router, type Request, type Response } from 'express';
import type {
    EvidenceUploadRequest,
    EvidenceExternalUrlRequest,
    EvidenceReplayRefRequest,
    EvidenceUpdateRequest,
    EvidenceLinkRequest,
} from '@controlbox/common';
import { EvidenceRepository } from '../../db/repositories/evidence.repo.js';
import { storageService } from '../../services/storage/s3-storage.js';

export const evidenceRouter = Router();
const evidenceRepo = new EvidenceRepository();

// =====================================================================
// GET /api/evidence/:id - Get evidence by ID
// =====================================================================
evidenceRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        const evidence = await evidenceRepo.findById(req.params.id);

        if (!evidence) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Evidence not found' },
            });
            return;
        }

        // Add signed URL for uploads
        if (evidence.upload?.fileKey) {
            const { url, expiresAt } = await storageService.getDownloadUrl(evidence.upload.fileKey);
            evidence.upload.signedUrl = url;
            evidence.upload.signedUrlExpiresAt = expiresAt;
        }

        // Get linked entity IDs
        const links = await evidenceRepo.getLinkedEntityIds(evidence.id);
        evidence.incidentIds = links.incidentIds;
        evidence.caseIds = links.caseIds;
        evidence.protestIds = links.protestIds;

        res.json({ success: true, data: evidence });
    } catch (error) {
        console.error('Failed to fetch evidence:', error);
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch evidence' },
        });
    }
});

// =====================================================================
// GET /api/evidence/by-incident/:incidentId - List evidence for incident
// =====================================================================
evidenceRouter.get('/by-incident/:incidentId', async (req: Request, res: Response): Promise<void> => {
    try {
        const evidence = await evidenceRepo.findByIncidentId(req.params.incidentId);

        // Add signed URLs for uploads
        for (const ev of evidence) {
            if (ev.upload?.fileKey) {
                const { url, expiresAt } = await storageService.getDownloadUrl(ev.upload.fileKey);
                ev.upload.signedUrl = url;
                ev.upload.signedUrlExpiresAt = expiresAt;
            }
        }

        res.json({ success: true, data: evidence });
    } catch (error) {
        console.error('Failed to fetch evidence for incident:', error);
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch evidence' },
        });
    }
});

// =====================================================================
// GET /api/evidence/by-case/:caseId - List evidence for case
// =====================================================================
evidenceRouter.get('/by-case/:caseId', async (req: Request, res: Response): Promise<void> => {
    try {
        const evidence = await evidenceRepo.findByCaseId(req.params.caseId);

        for (const ev of evidence) {
            if (ev.upload?.fileKey) {
                const { url, expiresAt } = await storageService.getDownloadUrl(ev.upload.fileKey);
                ev.upload.signedUrl = url;
                ev.upload.signedUrlExpiresAt = expiresAt;
            }
        }

        res.json({ success: true, data: evidence });
    } catch (error) {
        console.error('Failed to fetch evidence for case:', error);
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch evidence' },
        });
    }
});

// =====================================================================
// GET /api/evidence/by-protest/:protestId - List evidence for protest
// =====================================================================
evidenceRouter.get('/by-protest/:protestId', async (req: Request, res: Response): Promise<void> => {
    try {
        const evidence = await evidenceRepo.findByProtestId(req.params.protestId);

        for (const ev of evidence) {
            if (ev.upload?.fileKey) {
                const { url, expiresAt } = await storageService.getDownloadUrl(ev.upload.fileKey);
                ev.upload.signedUrl = url;
                ev.upload.signedUrlExpiresAt = expiresAt;
            }
        }

        res.json({ success: true, data: evidence });
    } catch (error) {
        console.error('Failed to fetch evidence for protest:', error);
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch evidence' },
        });
    }
});

// =====================================================================
// POST /api/evidence/upload - Request pre-signed upload URL
// =====================================================================
evidenceRouter.post('/upload', async (req: Request, res: Response): Promise<void> => {
    try {
        const data: EvidenceUploadRequest = req.body;

        // Validate storage is configured
        if (!storageService.isConfigured()) {
            res.status(503).json({
                success: false,
                error: { code: 'STORAGE_NOT_CONFIGURED', message: 'Storage service not configured' },
            });
            return;
        }

        // Validate file
        const validation = storageService.validateFile(data.mimeType, data.sizeBytes);
        if (!validation.valid) {
            res.status(400).json({
                success: false,
                error: { code: 'INVALID_FILE', message: validation.error },
            });
            return;
        }

        // Get user from auth context (placeholder - would come from auth middleware)
        const userId = (req as any).user?.id || 'system';
        const userName = (req as any).user?.name || 'System';
        const leagueId = (req as any).user?.leagueId || 'default';

        // Create evidence record and get file key
        const fileKey = storageService.generateFileKey(leagueId, 'pending', data.fileName);

        const evidence = await evidenceRepo.createUploadEvidence({
            leagueId,
            userId,
            userName,
            title: data.title,
            source: data.source,
            visibility: data.visibility || 'STEWARDS_ONLY',
            fileKey,
            mimeType: data.mimeType,
            sizeBytes: data.sizeBytes,
        });

        // Link to entities if provided
        if (data.incidentId) {
            await evidenceRepo.linkToIncident(evidence.id, data.incidentId, userId);
        }
        if (data.caseId) {
            await evidenceRepo.linkToCase(evidence.id, data.caseId, userId);
        }
        if (data.protestId) {
            await evidenceRepo.linkToProtest(evidence.id, data.protestId, userId);
        }

        // Generate pre-signed upload URL
        const { url, expiresAt } = await storageService.getUploadUrl(fileKey, data.mimeType);

        res.json({
            success: true,
            data: {
                evidenceId: evidence.id,
                uploadUrl: url,
                expiresAt,
                fileKey,
            },
        });
    } catch (error) {
        console.error('Failed to create upload URL:', error);
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Failed to create upload URL' },
        });
    }
});

// =====================================================================
// POST /api/evidence/upload/complete - Confirm upload complete
// =====================================================================
evidenceRouter.post('/upload/complete', async (req: Request, res: Response): Promise<void> => {
    try {
        const { evidenceId, durationSeconds } = req.body;

        await evidenceRepo.completeUpload(evidenceId, durationSeconds);

        const evidence = await evidenceRepo.findById(evidenceId);

        res.json({ success: true, data: evidence });
    } catch (error) {
        console.error('Failed to complete upload:', error);
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Failed to complete upload' },
        });
    }
});

// =====================================================================
// POST /api/evidence/external - Add external URL evidence
// =====================================================================
evidenceRouter.post('/external', async (req: Request, res: Response): Promise<void> => {
    try {
        const data: EvidenceExternalUrlRequest = req.body;

        const userId = (req as any).user?.id || 'system';
        const userName = (req as any).user?.name || 'System';
        const leagueId = (req as any).user?.leagueId || 'default';

        // Detect provider from URL
        const providerHint = detectProvider(data.url);

        const evidence = await evidenceRepo.createExternalUrlEvidence({
            leagueId,
            userId,
            userName,
            title: data.title,
            notes: data.notes,
            source: data.source,
            visibility: data.visibility || 'STEWARDS_ONLY',
            url: data.url,
            providerHint,
        });

        // Link to entities
        if (data.incidentId) {
            await evidenceRepo.linkToIncident(evidence.id, data.incidentId, userId);
        }
        if (data.caseId) {
            await evidenceRepo.linkToCase(evidence.id, data.caseId, userId);
        }
        if (data.protestId) {
            await evidenceRepo.linkToProtest(evidence.id, data.protestId, userId);
        }

        res.json({ success: true, data: evidence });
    } catch (error) {
        console.error('Failed to add external URL:', error);
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Failed to add external URL' },
        });
    }
});

// =====================================================================
// POST /api/evidence/replay-ref - Add iRacing replay reference
// =====================================================================
evidenceRouter.post('/replay-ref', async (req: Request, res: Response): Promise<void> => {
    try {
        const data: EvidenceReplayRefRequest = req.body;

        const userId = (req as any).user?.id || 'system';
        const userName = (req as any).user?.name || 'System';
        const leagueId = (req as any).user?.leagueId || 'default';

        const evidence = await evidenceRepo.createReplayRefEvidence({
            leagueId,
            userId,
            userName,
            title: data.title,
            notes: data.notes,
            visibility: data.visibility || 'STEWARDS_ONLY',
            eventId: data.eventId,
            subsessionId: data.subsessionId,
            lap: data.lap,
            corner: data.corner,
            timecodeHint: data.timecodeHint,
            offsetSecondsBefore: data.offsetSecondsBefore || 10,
            offsetSecondsAfter: data.offsetSecondsAfter || 10,
            cameraHint: data.cameraHint,
        });

        // Link to incident
        if (data.incidentId) {
            await evidenceRepo.linkToIncident(evidence.id, data.incidentId, userId);
        }

        res.json({ success: true, data: evidence });
    } catch (error) {
        console.error('Failed to add replay reference:', error);
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Failed to add replay reference' },
        });
    }
});

// =====================================================================
// PATCH /api/evidence/:id - Update evidence metadata
// =====================================================================
evidenceRouter.patch('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        const data: EvidenceUpdateRequest = req.body;
        const userId = (req as any).user?.id || 'system';
        const userName = (req as any).user?.name || 'System';

        const evidence = await evidenceRepo.update(req.params.id, data, userId, userName);

        if (!evidence) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Evidence not found' },
            });
            return;
        }

        res.json({ success: true, data: evidence });
    } catch (error) {
        console.error('Failed to update evidence:', error);
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Failed to update evidence' },
        });
    }
});

// =====================================================================
// DELETE /api/evidence/:id - Delete evidence
// =====================================================================
evidenceRouter.delete('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = (req as any).user?.id || 'system';
        const userName = (req as any).user?.name || 'System';

        // Get evidence first to delete file if needed
        const evidence = await evidenceRepo.findById(req.params.id);
        if (!evidence) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Evidence not found' },
            });
            return;
        }

        // Delete from storage if upload
        if (evidence.upload?.fileKey) {
            try {
                await storageService.deleteFile(evidence.upload.fileKey);
            } catch (storageError) {
                console.error('Failed to delete file from storage:', storageError);
                // Continue with database deletion
            }
        }

        await evidenceRepo.delete(req.params.id, userId, userName);

        res.json({ success: true });
    } catch (error) {
        console.error('Failed to delete evidence:', error);
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Failed to delete evidence' },
        });
    }
});

// =====================================================================
// POST /api/evidence/:id/link - Link evidence to entities
// =====================================================================
evidenceRouter.post('/:id/link', async (req: Request, res: Response): Promise<void> => {
    try {
        const data: EvidenceLinkRequest = req.body;
        const userId = (req as any).user?.id || 'system';

        if (data.incidentIds) {
            for (const incidentId of data.incidentIds) {
                await evidenceRepo.linkToIncident(req.params.id, incidentId, userId);
            }
        }
        if (data.caseIds) {
            for (const caseId of data.caseIds) {
                await evidenceRepo.linkToCase(req.params.id, caseId, userId);
            }
        }
        if (data.protestIds) {
            for (const protestId of data.protestIds) {
                await evidenceRepo.linkToProtest(req.params.id, protestId, userId);
            }
        }

        const evidence = await evidenceRepo.findById(req.params.id);
        res.json({ success: true, data: evidence });
    } catch (error) {
        console.error('Failed to link evidence:', error);
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Failed to link evidence' },
        });
    }
});

// =====================================================================
// POST /api/evidence/:id/unlink - Unlink evidence from entities
// =====================================================================
evidenceRouter.post('/:id/unlink', async (req: Request, res: Response): Promise<void> => {
    try {
        const data: EvidenceLinkRequest = req.body;
        const userId = (req as any).user?.id || 'system';

        if (data.incidentIds) {
            for (const incidentId of data.incidentIds) {
                await evidenceRepo.unlinkFromIncident(req.params.id, incidentId, userId);
            }
        }
        if (data.caseIds) {
            for (const caseId of data.caseIds) {
                await evidenceRepo.unlinkFromCase(req.params.id, caseId, userId);
            }
        }
        if (data.protestIds) {
            for (const protestId of data.protestIds) {
                await evidenceRepo.unlinkFromProtest(req.params.id, protestId, userId);
            }
        }

        const evidence = await evidenceRepo.findById(req.params.id);
        res.json({ success: true, data: evidence });
    } catch (error) {
        console.error('Failed to unlink evidence:', error);
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Failed to unlink evidence' },
        });
    }
});

// =====================================================================
// GET /api/evidence/:id/audit - Get audit log for evidence
// =====================================================================
evidenceRouter.get('/:id/audit', async (req: Request, res: Response): Promise<void> => {
    try {
        const auditLog = await evidenceRepo.getAuditLog(req.params.id);
        res.json({ success: true, data: auditLog });
    } catch (error) {
        console.error('Failed to fetch audit log:', error);
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch audit log' },
        });
    }
});

// =====================================================================
// Helpers
// =====================================================================

function detectProvider(url: string): 'youtube' | 'streamable' | 'drive' | 'other' {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        return 'youtube';
    }
    if (url.includes('streamable.com')) {
        return 'streamable';
    }
    if (url.includes('drive.google.com')) {
        return 'drive';
    }
    return 'other';
}
