// =====================================================================
// Discipline Profile Routes
// REST API endpoints for profile management
// =====================================================================

import { Router, Request, Response } from 'express';
import { getProfileService } from '../../services/discipline/profile-service.js';
import type {
    DisciplineCategory,
    CreateProfileRequest,
    UpdateProfileRequest
} from '@controlbox/common';

const router = Router();

/**
 * Get all profiles
 * GET /api/profiles
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const service = getProfileService();
        const { category, builtinOnly } = req.query;

        let profiles;
        if (builtinOnly === 'true') {
            profiles = await service.getBuiltIn();
        } else if (category) {
            profiles = await service.getByCategory(category as DisciplineCategory);
        } else {
            profiles = await service.getAll();
        }

        res.json({
            success: true,
            data: profiles,
            meta: { totalCount: profiles.length }
        });
    } catch (error) {
        console.error('Error fetching profiles:', error);
        res.status(500).json({
            success: false,
            error: { code: 'FETCH_ERROR', message: 'Failed to fetch profiles' }
        });
    }
});

/**
 * Get built-in default profiles
 * GET /api/profiles/defaults
 */
router.get('/defaults', async (_req: Request, res: Response): Promise<void | Response> => {
    try {
        const service = getProfileService();
        const profiles = await service.getBuiltIn();

        res.json({
            success: true,
            data: profiles
        });
    } catch (error) {
        console.error('Error fetching defaults:', error);
        res.status(500).json({
            success: false,
            error: { code: 'FETCH_ERROR', message: 'Failed to fetch default profiles' }
        });
    }
});

/**
 * Get profiles by category
 * GET /api/profiles/category/:category
 */
router.get('/category/:category', async (req: Request, res: Response): Promise<void | Response> => {
    try {
        const service = getProfileService();
        const category = req.params.category as DisciplineCategory;

        const validCategories = ['oval', 'road', 'dirtOval', 'dirtRoad', 'endurance', 'openWheel'];
        if (!validCategories.includes(category)) {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_CATEGORY', message: `Invalid category. Must be one of: ${validCategories.join(', ')}` }
            });
        }

        const profiles = await service.getByCategory(category);

        res.json({
            success: true,
            data: profiles,
            meta: { category, totalCount: profiles.length }
        });
    } catch (error) {
        console.error('Error fetching profiles by category:', error);
        res.status(500).json({
            success: false,
            error: { code: 'FETCH_ERROR', message: 'Failed to fetch profiles' }
        });
    }
});

/**
 * Get profile by ID
 * GET /api/profiles/:id
 */
router.get('/:id', async (req: Request, res: Response): Promise<void | Response> => {
    try {
        const service = getProfileService();
        const profile = await service.getById(req.params.id);

        if (!profile) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Profile not found' }
            });
        }

        res.json({
            success: true,
            data: profile
        });
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({
            success: false,
            error: { code: 'FETCH_ERROR', message: 'Failed to fetch profile' }
        });
    }
});

/**
 * Create a new profile
 * POST /api/profiles
 */
router.post('/', async (req: Request, res: Response): Promise<void | Response> => {
    try {
        const service = getProfileService();
        const request = req.body as CreateProfileRequest;

        // Validate required fields
        if (!request.name || !request.category || !request.cautionRules ||
            !request.penaltyModel || !request.incidentThresholds) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Missing required fields: name, category, cautionRules, penaltyModel, incidentThresholds'
                }
            });
        }

        const profile = await service.create(request);

        res.status(201).json({
            success: true,
            data: profile
        });
    } catch (error) {
        console.error('Error creating profile:', error);
        res.status(500).json({
            success: false,
            error: { code: 'CREATE_ERROR', message: 'Failed to create profile' }
        });
    }
});

/**
 * Update a profile
 * PUT /api/profiles/:id
 */
router.put('/:id', async (req: Request, res: Response): Promise<void | Response> => {
    try {
        const service = getProfileService();
        const updates = req.body as UpdateProfileRequest;

        const profile = await service.update(req.params.id, updates);

        if (!profile) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Profile not found' }
            });
        }

        res.json({
            success: true,
            data: profile
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({
            success: false,
            error: { code: 'UPDATE_ERROR', message: 'Failed to update profile' }
        });
    }
});

/**
 * Delete a profile
 * DELETE /api/profiles/:id
 */
router.delete('/:id', async (req: Request, res: Response): Promise<void | Response> => {
    try {
        const service = getProfileService();
        const deleted = await service.delete(req.params.id);

        if (!deleted) {
            return res.status(404).json({
                success: false,
                error: { code: 'DELETE_FAILED', message: 'Profile not found or is a built-in profile' }
            });
        }

        res.json({
            success: true,
            data: { deleted: true }
        });
    } catch (error) {
        console.error('Error deleting profile:', error);
        res.status(500).json({
            success: false,
            error: { code: 'DELETE_ERROR', message: 'Failed to delete profile' }
        });
    }
});

/**
 * Set profile as default for its category
 * POST /api/profiles/:id/set-default
 */
router.post('/:id/set-default', async (req: Request, res: Response): Promise<void | Response> => {
    try {
        const service = getProfileService();
        const profile = await service.setAsDefault(req.params.id);

        if (!profile) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Profile not found' }
            });
        }

        res.json({
            success: true,
            data: profile
        });
    } catch (error) {
        console.error('Error setting default:', error);
        res.status(500).json({
            success: false,
            error: { code: 'UPDATE_ERROR', message: 'Failed to set default profile' }
        });
    }
});

/**
 * Duplicate a profile
 * POST /api/profiles/:id/duplicate
 */
router.post('/:id/duplicate', async (req: Request, res: Response): Promise<void | Response> => {
    try {
        const service = getProfileService();
        const { name } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'New name is required' }
            });
        }

        const profile = await service.duplicate(req.params.id, name);

        if (!profile) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Source profile not found' }
            });
        }

        res.status(201).json({
            success: true,
            data: profile
        });
    } catch (error) {
        console.error('Error duplicating profile:', error);
        res.status(500).json({
            success: false,
            error: { code: 'DUPLICATE_ERROR', message: 'Failed to duplicate profile' }
        });
    }
});

export default router;
