// =====================================================================
// Admin Routes
// Internal admin functionality for users and licenses
// =====================================================================

import { Router, Request, Response } from 'express';
import type {
    CreateAdminUserRequest,
    CreateLicenseRequest,
    UpdateLicenseRequest,
    AssignRoleRequest,
    AdminRole
} from '@controlbox/common';
import { requireAuth, requireSuperAdmin } from '../middleware/auth.js';
import { getAuthService } from '../../services/auth/auth-service.js';
import { getLicenseService } from '../../services/licensing/license-service.js';
import { pool } from '../../db/client.js';

const router = Router();

// All admin routes require authentication
router.use(requireAuth);

// ========================
// User Management
// ========================

/**
 * List all users (super admin only)
 * GET /api/admin/users
 */
router.get('/users', requireSuperAdmin, async (_req: Request, res: Response): Promise<void> => {
    try {
        const result = await pool.query(
            `SELECT id, email, display_name, is_super_admin, is_active, email_verified, last_login_at, created_at
             FROM admin_users
             ORDER BY created_at DESC`
        );

        res.json({
            success: true,
            data: result.rows.map(row => ({
                id: row.id,
                email: row.email,
                displayName: row.display_name,
                isSuperAdmin: row.is_super_admin,
                isActive: row.is_active,
                emailVerified: row.email_verified,
                lastLoginAt: row.last_login_at,
                createdAt: row.created_at
            })),
            meta: { totalCount: result.rows.length }
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({
            success: false,
            error: { code: 'FETCH_ERROR', message: 'Failed to fetch users' }
        });
    }
});

/**
 * Create a new user (super admin only)
 * POST /api/admin/users
 */
router.post('/users', requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
        const request = req.body as CreateAdminUserRequest;

        if (!request.email || !request.password || !request.displayName) {
            res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'Email, password, and displayName are required' }
            });
            return;
        }

        if (request.password.length < 8) {
            res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters' }
            });
            return;
        }

        const authService = getAuthService();

        // Check if email already exists
        const existing = await authService.getUserByEmail(request.email);
        if (existing) {
            res.status(409).json({
                success: false,
                error: { code: 'DUPLICATE_EMAIL', message: 'A user with this email already exists' }
            });
            return;
        }

        const user = await authService.createUser(
            request.email,
            request.password,
            request.displayName,
            request.isSuperAdmin ?? false
        );

        res.status(201).json({
            success: true,
            data: user
        });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({
            success: false,
            error: { code: 'CREATE_ERROR', message: 'Failed to create user' }
        });
    }
});

/**
 * Deactivate a user (super admin only)
 * DELETE /api/admin/users/:id
 */
router.delete('/users/:id', requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
        const authService = getAuthService();
        await authService.deactivateUser(req.params.id);

        res.json({
            success: true,
            data: { deactivated: true }
        });
    } catch (error) {
        console.error('Error deactivating user:', error);
        res.status(500).json({
            success: false,
            error: { code: 'DELETE_ERROR', message: 'Failed to deactivate user' }
        });
    }
});

// ========================
// Role Management
// ========================

/**
 * Assign a role to a user
 * POST /api/admin/roles
 */
router.post('/roles', requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
        const request = req.body as AssignRoleRequest;

        if (!request.adminUserId || !request.leagueId || !request.role) {
            res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'adminUserId, leagueId, and role are required' }
            });
            return;
        }

        const validRoles: AdminRole[] = ['Owner', 'RaceControl', 'Steward', 'Broadcaster', 'ReadOnly'];
        if (!validRoles.includes(request.role)) {
            res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: `Role must be one of: ${validRoles.join(', ')}` }
            });
            return;
        }

        const result = await pool.query(
            `INSERT INTO admin_user_league_roles (admin_user_id, league_id, series_id, season_id, role, granted_by)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (admin_user_id, league_id, series_id, season_id, role) DO UPDATE SET updated_at = NOW()
             RETURNING *`,
            [
                request.adminUserId,
                request.leagueId,
                request.seriesId ?? null,
                request.seasonId ?? null,
                request.role,
                req.user!.id
            ]
        );

        res.status(201).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error assigning role:', error);
        res.status(500).json({
            success: false,
            error: { code: 'CREATE_ERROR', message: 'Failed to assign role' }
        });
    }
});

/**
 * Remove a role from a user
 * DELETE /api/admin/roles/:id
 */
router.delete('/roles/:id', requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
        await pool.query(
            `DELETE FROM admin_user_league_roles WHERE id = $1`,
            [req.params.id]
        );

        res.json({
            success: true,
            data: { deleted: true }
        });
    } catch (error) {
        console.error('Error removing role:', error);
        res.status(500).json({
            success: false,
            error: { code: 'DELETE_ERROR', message: 'Failed to remove role' }
        });
    }
});

// ========================
// License Management
// ========================

/**
 * List all licenses
 * GET /api/admin/licenses
 */
router.get('/licenses', requireSuperAdmin, async (_req: Request, res: Response): Promise<void> => {
    try {
        const licenseService = getLicenseService();
        const licenses = await licenseService.getAll();

        res.json({
            success: true,
            data: licenses,
            meta: { totalCount: licenses.length }
        });
    } catch (error) {
        console.error('Error fetching licenses:', error);
        res.status(500).json({
            success: false,
            error: { code: 'FETCH_ERROR', message: 'Failed to fetch licenses' }
        });
    }
});

/**
 * Create a license
 * POST /api/admin/licenses
 */
router.post('/licenses', requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
        const request = req.body as CreateLicenseRequest;

        if (!request.leagueId || !request.seriesId || !request.seasonId ||
            !request.startDate || !request.endDate) {
            res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'leagueId, seriesId, seasonId, startDate, endDate are required' }
            });
            return;
        }

        const licenseService = getLicenseService();
        const license = await licenseService.create(request);

        res.status(201).json({
            success: true,
            data: license
        });
    } catch (error) {
        console.error('Error creating license:', error);
        res.status(500).json({
            success: false,
            error: { code: 'CREATE_ERROR', message: 'Failed to create license' }
        });
    }
});

/**
 * Update a license
 * PATCH /api/admin/licenses/:id
 */
router.patch('/licenses/:id', requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
        const updates = req.body as UpdateLicenseRequest;

        const licenseService = getLicenseService();
        const license = await licenseService.update(req.params.id, updates);

        if (!license) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'License not found' }
            });
            return;
        }

        res.json({
            success: true,
            data: license
        });
    } catch (error) {
        console.error('Error updating license:', error);
        res.status(500).json({
            success: false,
            error: { code: 'UPDATE_ERROR', message: 'Failed to update license' }
        });
    }
});

/**
 * Activate a license
 * POST /api/admin/licenses/:id/activate
 */
router.post('/licenses/:id/activate', requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
        const licenseService = getLicenseService();
        const license = await licenseService.activateLicense(req.params.id);

        if (!license) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'License not found' }
            });
            return;
        }

        res.json({
            success: true,
            data: license
        });
    } catch (error) {
        console.error('Error activating license:', error);
        res.status(500).json({
            success: false,
            error: { code: 'UPDATE_ERROR', message: 'Failed to activate license' }
        });
    }
});

/**
 * Suspend a license
 * POST /api/admin/licenses/:id/suspend
 */
router.post('/licenses/:id/suspend', requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
        const licenseService = getLicenseService();
        const license = await licenseService.suspendLicense(req.params.id);

        if (!license) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'License not found' }
            });
            return;
        }

        res.json({
            success: true,
            data: license
        });
    } catch (error) {
        console.error('Error suspending license:', error);
        res.status(500).json({
            success: false,
            error: { code: 'UPDATE_ERROR', message: 'Failed to suspend license' }
        });
    }
});

export default router;
