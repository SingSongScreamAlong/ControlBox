// =====================================================================
// Sessions Routes
// =====================================================================

import { Router, type Request, type Response } from 'express';
import type {
    CreateSessionRequest,
    UpdateSessionRequest,
    ListSessionsParams
} from '@controlbox/common';
import { SessionRepository } from '../../db/repositories/session.repo.js';

export const sessionsRouter = Router();
const sessionRepo = new SessionRepository();

// GET /api/sessions - List all sessions
sessionsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const params: ListSessionsParams = {
            page: parseInt(req.query.page as string) || 1,
            pageSize: parseInt(req.query.pageSize as string) || 20,
            status: req.query.status as string,
            simType: req.query.simType as string,
        };

        const sessions = await sessionRepo.findAll(params);
        const total = await sessionRepo.count(params);

        res.json({
            success: true,
            data: sessions,
            meta: {
                page: params.page,
                pageSize: params.pageSize,
                totalCount: total,
                totalPages: Math.ceil(total / (params.pageSize || 20)),
            },
        });
    } catch {
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch sessions' },
        });
    }
});

// GET /api/sessions/:id - Get session by ID
sessionsRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        const session = await sessionRepo.findById(req.params.id);

        if (!session) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Session not found' },
            });
            return;
        }

        res.json({ success: true, data: session });
    } catch {
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch session' },
        });
    }
});

// POST /api/sessions - Create new session
sessionsRouter.post('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const data: CreateSessionRequest = req.body;
        const session = await sessionRepo.create(data);

        res.status(201).json({ success: true, data: session });
    } catch {
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Failed to create session' },
        });
    }
});

// PATCH /api/sessions/:id - Update session
sessionsRouter.patch('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        const data: UpdateSessionRequest = req.body;
        const session = await sessionRepo.update(req.params.id, data);

        if (!session) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Session not found' },
            });
            return;
        }

        res.json({ success: true, data: session });
    } catch {
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Failed to update session' },
        });
    }
});

// GET /api/sessions/:id/drivers - Get session drivers
sessionsRouter.get('/:id/drivers', async (req: Request, res: Response): Promise<void> => {
    try {
        const drivers = await sessionRepo.getDrivers(req.params.id);
        res.json({ success: true, data: drivers });
    } catch {
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch drivers' },
        });
    }
});
