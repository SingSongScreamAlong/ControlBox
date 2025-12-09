// =====================================================================
// Penalties Routes
// =====================================================================

import { Router, type Request, type Response } from 'express';
import type {
    ListPenaltiesParams,
    CreatePenaltyRequest,
    UpdatePenaltyRequest,
    ApprovePenaltyRequest
} from '@controlbox/common';
import { PenaltyRepository } from '../../db/repositories/penalty.repo.js';

export const penaltiesRouter = Router();
const penaltyRepo = new PenaltyRepository();

// GET /api/penalties - List penalties
penaltiesRouter.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const params: ListPenaltiesParams = {
            page: parseInt(req.query.page as string) || 1,
            pageSize: parseInt(req.query.pageSize as string) || 20,
            sessionId: req.query.sessionId as string,
            status: req.query.status as string,
            driverId: req.query.driverId as string,
            type: req.query.type as string,
        };

        const penalties = await penaltyRepo.findAll(params);
        const total = await penaltyRepo.count(params);

        res.json({
            success: true,
            data: penalties,
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
            error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch penalties' },
        });
    }
});

// GET /api/penalties/:id - Get penalty by ID
penaltiesRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        const penalty = await penaltyRepo.findById(req.params.id);

        if (!penalty) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Penalty not found' },
            });
            return;
        }

        res.json({ success: true, data: penalty });
    } catch {
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch penalty' },
        });
    }
});

// POST /api/penalties - Create manual penalty
penaltiesRouter.post('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const data: CreatePenaltyRequest = req.body;
        const penalty = await penaltyRepo.create(data);

        res.status(201).json({ success: true, data: penalty });
    } catch {
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Failed to create penalty' },
        });
    }
});

// PATCH /api/penalties/:id - Update penalty
penaltiesRouter.patch('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        const data: UpdatePenaltyRequest = req.body;
        const penalty = await penaltyRepo.update(req.params.id, data);

        if (!penalty) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Penalty not found' },
            });
            return;
        }

        res.json({ success: true, data: penalty });
    } catch {
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Failed to update penalty' },
        });
    }
});

// POST /api/penalties/:id/approve - Approve penalty
penaltiesRouter.post('/:id/approve', async (req: Request, res: Response): Promise<void> => {
    try {
        const data: ApprovePenaltyRequest = req.body;
        const penalty = await penaltyRepo.approve(req.params.id, data);

        if (!penalty) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Penalty not found' },
            });
            return;
        }

        res.json({ success: true, data: penalty });
    } catch {
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Failed to approve penalty' },
        });
    }
});
