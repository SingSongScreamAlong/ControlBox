// =====================================================================
// License Middleware
// License enforcement for protected routes
// =====================================================================

import { Request, Response, NextFunction } from 'express';
import type { License, LeagueContext, AdminRole } from '@controlbox/common';
import { getLicenseService } from '../../services/licensing/license-service.js';
import { pool } from '../../db/client.js';

/**
 * Extend Express Request with license context
 */
declare global {
    namespace Express {
        interface Request {
            leagueContext?: LeagueContext;
            license?: License;
            userRole?: AdminRole;
        }
    }
}

/**
 * Options for license middleware
 */
interface LicenseMiddlewareOptions {
    /** Extract context from these request fields */
    contextSource?: 'params' | 'query' | 'body';
    /** Allow super admins to bypass license check */
    allowSuperAdmin?: boolean;
    /** Required role(s) for this operation */
    requiredRoles?: AdminRole[];
}

/**
 * Get user's role for a league/series/season
 */
async function getUserRole(
    userId: string,
    leagueId: string,
    seriesId?: string,
    seasonId?: string
): Promise<AdminRole | null> {
    // Check for most specific role first (season → series → league)
    const result = await pool.query<{ role: string }>(
        `SELECT role FROM admin_user_league_roles
         WHERE admin_user_id = $1 AND league_id = $2
         AND (season_id = $3 OR (season_id IS NULL AND $3 IS NOT NULL))
         AND (series_id = $4 OR (series_id IS NULL AND $4 IS NOT NULL))
         ORDER BY 
            CASE WHEN season_id IS NOT NULL THEN 0
                 WHEN series_id IS NOT NULL THEN 1
                 ELSE 2 END
         LIMIT 1`,
        [userId, leagueId, seasonId ?? null, seriesId ?? null]
    );

    if (result.rows.length === 0) {
        return null;
    }

    return result.rows[0].role as AdminRole;
}

/**
 * Extract league context from session ID
 */
async function getContextFromSession(sessionId: string): Promise<LeagueContext | null> {
    const result = await pool.query<{
        league_id: string;
        series_id: string | null;
        season_id: string | null;
        license_id: string | null;
    }>(
        `SELECT league_id, series_id, season_id, license_id FROM sessions WHERE id = $1`,
        [sessionId]
    );

    if (result.rows.length === 0 || !result.rows[0].league_id) {
        return null;
    }

    const row = result.rows[0];
    return {
        leagueId: row.league_id,
        seriesId: row.series_id ?? undefined,
        seasonId: row.season_id ?? undefined,
        licenseId: row.license_id ?? undefined
    };
}

/**
 * Create license enforcement middleware
 */
export function requireLicense(options: LicenseMiddlewareOptions = {}) {
    const {
        contextSource = 'params',
        allowSuperAdmin = true,
        requiredRoles
    } = options;

    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        // Ensure user is authenticated
        if (!req.user) {
            res.status(401).json({
                success: false,
                error: { code: 'AUTH_REQUIRED', message: 'Authentication required.' }
            });
            return;
        }

        // Super admins can bypass license checks if allowed
        if (allowSuperAdmin && req.user.isSuperAdmin) {
            next();
            return;
        }

        // Extract context from request
        const source = req[contextSource] as Record<string, string>;
        let context: LeagueContext | null = null;

        // Try to get context from explicit params
        if (source.leagueId || source.seasonId || source.sessionId) {
            if (source.sessionId) {
                // Derive from session
                context = await getContextFromSession(source.sessionId);
            } else {
                context = {
                    leagueId: source.leagueId,
                    seriesId: source.seriesId,
                    seasonId: source.seasonId,
                    licenseId: source.licenseId
                };
            }
        }

        // Also try req.params.id for session routes
        if (!context && req.params.id) {
            context = await getContextFromSession(req.params.id);
        }

        if (!context || !context.leagueId) {
            res.status(400).json({
                success: false,
                error: { code: 'CONTEXT_REQUIRED', message: 'League context could not be determined.' }
            });
            return;
        }

        // Get user's role for this league
        const userRole = await getUserRole(
            req.user.id,
            context.leagueId,
            context.seriesId,
            context.seasonId
        );

        if (!userRole) {
            res.status(403).json({
                success: false,
                error: { code: 'NO_ACCESS', message: 'You do not have access to this league.' }
            });
            return;
        }

        // Check required roles
        if (requiredRoles && requiredRoles.length > 0 && !requiredRoles.includes(userRole)) {
            res.status(403).json({
                success: false,
                error: {
                    code: 'INSUFFICIENT_ROLE',
                    message: `This action requires one of: ${requiredRoles.join(', ')}`
                }
            });
            return;
        }

        // Validate license if season is specified
        if (context.seasonId) {
            const licenseService = getLicenseService();
            const validation = await licenseService.validateLicense(context.seasonId);

            if (!validation.isValid) {
                const errorMessage = licenseService.getLicenseErrorMessage(validation.error!);
                res.status(403).json({
                    success: false,
                    error: {
                        code: validation.error,
                        message: errorMessage
                    }
                });
                return;
            }

            req.license = validation.license;
        }

        // Attach context to request
        req.leagueContext = context;
        req.userRole = userRole;

        next();
    };
}

/**
 * Require specific roles
 */
export function requireRole(...roles: AdminRole[]) {
    return requireLicense({ requiredRoles: roles });
}

/**
 * Require live control access (Owner or RaceControl)
 */
export const requireLiveControl = requireRole('Owner', 'RaceControl');

/**
 * Require steward access (Owner, RaceControl, or Steward)
 */
export const requireStewardAccess = requireRole('Owner', 'RaceControl', 'Steward');

/**
 * Require at least read access
 */
export const requireReadAccess = requireLicense();
