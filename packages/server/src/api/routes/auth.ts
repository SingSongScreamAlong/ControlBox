// =====================================================================
// Auth Routes
// Login, logout, token refresh, current user
// =====================================================================

import { Router, Request, Response } from 'express';
import type { LoginRequest, RefreshTokenRequest } from '@controlbox/common';
import { getAuthService } from '../../services/auth/auth-service.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/**
 * Login
 * POST /api/auth/login
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
    try {
        const loginRequest = req.body as LoginRequest;

        if (!loginRequest.email || !loginRequest.password) {
            res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'Email and password are required' }
            });
            return;
        }

        const authService = getAuthService();
        const result = await authService.login(
            loginRequest,
            req.headers['user-agent'],
            req.ip
        );

        if (!result) {
            res.status(401).json({
                success: false,
                error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }
            });
            return;
        }

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'LOGIN_ERROR', message: 'Login failed' }
        });
    }
});

/**
 * Logout (revoke refresh token)
 * POST /api/auth/logout
 */
router.post('/logout', async (req: Request, res: Response): Promise<void> => {
    try {
        const { refreshToken } = req.body as { refreshToken?: string };

        if (refreshToken) {
            const authService = getAuthService();
            await authService.revokeRefreshToken(refreshToken);
        }

        res.json({
            success: true,
            data: { message: 'Logged out successfully' }
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'LOGOUT_ERROR', message: 'Logout failed' }
        });
    }
});

/**
 * Refresh access token
 * POST /api/auth/refresh
 */
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
    try {
        const { refreshToken } = req.body as RefreshTokenRequest;

        if (!refreshToken) {
            res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'Refresh token is required' }
            });
            return;
        }

        const authService = getAuthService();
        const result = await authService.refreshAccessToken(refreshToken);

        if (!result) {
            res.status(401).json({
                success: false,
                error: { code: 'TOKEN_INVALID', message: 'Invalid or expired refresh token' }
            });
            return;
        }

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'REFRESH_ERROR', message: 'Token refresh failed' }
        });
    }
});

/**
 * Get current user
 * GET /api/auth/me
 */
router.get('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        res.json({
            success: true,
            data: {
                user: req.user
            }
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'FETCH_ERROR', message: 'Failed to get user info' }
        });
    }
});

export default router;
