// =====================================================================
// Auth Middleware
// JWT verification and user attachment
// =====================================================================

import { Request, Response, NextFunction } from 'express';
import type { AdminUser } from '@controlbox/common';
import { getAuthService } from '../../services/auth/auth-service.js';

/**
 * Extend Express Request with auth context
 */
declare global {
    namespace Express {
        interface Request {
            user?: AdminUser;
            token?: string;
        }
    }
}

/**
 * Extract JWT from Authorization header
 */
function extractToken(req: Request): string | null {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return null;
    }

    const [type, token] = authHeader.split(' ');

    if (type !== 'Bearer' || !token) {
        return null;
    }

    return token;
}

/**
 * Middleware to require authentication
 * Verifies JWT and attaches user to request
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    const token = extractToken(req);

    if (!token) {
        res.status(401).json({
            success: false,
            error: {
                code: 'AUTH_REQUIRED',
                message: 'Authentication required. Please provide a valid access token.'
            }
        });
        return;
    }

    const authService = getAuthService();
    const payload = authService.verifyAccessToken(token);

    if (!payload) {
        res.status(401).json({
            success: false,
            error: {
                code: 'TOKEN_INVALID',
                message: 'Invalid or expired access token. Please login again.'
            }
        });
        return;
    }

    // Fetch full user from database (ensures user is still active)
    const user = await authService.getUserById(payload.sub);

    if (!user || !user.isActive) {
        res.status(401).json({
            success: false,
            error: {
                code: 'USER_INACTIVE',
                message: 'Your account has been deactivated. Contact an administrator.'
            }
        });
        return;
    }

    // Attach user and token to request
    req.user = user;
    req.token = token;

    next();
}

/**
 * Middleware to optionally authenticate
 * If token present, verifies and attaches user
 * If no token, continues without user
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const token = extractToken(req);

    if (!token) {
        next();
        return;
    }

    const authService = getAuthService();
    const payload = authService.verifyAccessToken(token);

    if (payload) {
        const user = await authService.getUserById(payload.sub);
        if (user && user.isActive) {
            req.user = user;
            req.token = token;
        }
    }

    next();
}

/**
 * Middleware to require super admin
 */
export async function requireSuperAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    // First ensure authenticated
    if (!req.user) {
        res.status(401).json({
            success: false,
            error: {
                code: 'AUTH_REQUIRED',
                message: 'Authentication required.'
            }
        });
        return;
    }

    if (!req.user.isSuperAdmin) {
        res.status(403).json({
            success: false,
            error: {
                code: 'FORBIDDEN',
                message: 'Super admin privileges required.'
            }
        });
        return;
    }

    next();
}
