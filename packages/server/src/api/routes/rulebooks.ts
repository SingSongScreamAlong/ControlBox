// =====================================================================
// Rulebooks Routes
// =====================================================================

import { Router, type Request, type Response } from 'express';
import type { CreateRulebookRequest, UpdateRulebookRequest } from '@controlbox/common';
import { RulebookRepository } from '../../db/repositories/rulebook.repo.js';

export const rulebooksRouter = Router();
const rulebookRepo = new RulebookRepository();

// GET /api/rulebooks - List rulebooks
rulebooksRouter.get('/', async (_req: Request, res: Response): Promise<void> => {
    try {
        const rulebooks = await rulebookRepo.findAll();
        res.json({ success: true, data: rulebooks });
    } catch {
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch rulebooks' },
        });
    }
});

// GET /api/rulebooks/:id - Get rulebook by ID
rulebooksRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        const rulebook = await rulebookRepo.findById(req.params.id);

        if (!rulebook) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Rulebook not found' },
            });
            return;
        }

        res.json({ success: true, data: rulebook });
    } catch {
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch rulebook' },
        });
    }
});

// POST /api/rulebooks - Create rulebook
rulebooksRouter.post('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const data: CreateRulebookRequest = req.body;
        const rulebook = await rulebookRepo.create(data);

        res.status(201).json({ success: true, data: rulebook });
    } catch {
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Failed to create rulebook' },
        });
    }
});

// PUT /api/rulebooks/:id - Update rulebook
rulebooksRouter.put('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        const data: UpdateRulebookRequest = req.body;
        const rulebook = await rulebookRepo.update(req.params.id, data);

        if (!rulebook) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Rulebook not found' },
            });
            return;
        }

        res.json({ success: true, data: rulebook });
    } catch {
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Failed to update rulebook' },
        });
    }
});

// DELETE /api/rulebooks/:id - Delete rulebook
rulebooksRouter.delete('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        const deleted = await rulebookRepo.delete(req.params.id);

        if (!deleted) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Rulebook not found' },
            });
            return;
        }

        res.json({ success: true, data: { deleted: true } });
    } catch {
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Failed to delete rulebook' },
        });
    }
});

// POST /api/rulebooks/:id/validate - Validate rulebook
rulebooksRouter.post('/:id/validate', async (req: Request, res: Response): Promise<void> => {
    try {
        const rulebook = await rulebookRepo.findById(req.params.id);

        if (!rulebook) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Rulebook not found' },
            });
            return;
        }

        // TODO: Implement proper validation
        res.json({
            success: true,
            data: {
                isValid: true,
                errors: [],
                warnings: [],
            },
        });
    } catch {
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Failed to validate rulebook' },
        });
    }
});
