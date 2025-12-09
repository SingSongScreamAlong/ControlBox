// =====================================================================
// Auth Service
// Authentication, JWT management, password hashing
// =====================================================================

import { randomBytes, createHash } from 'crypto';
import { sign, verify } from 'jsonwebtoken';
import { hash, compare } from 'bcrypt';
import type {
    AdminUser,
    JWTPayload,
    LoginRequest,
    LoginResponse
} from '@controlbox/common';
import { pool } from '../../db/client.js';

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'controlbox-dev-secret-change-in-production';
const JWT_EXPIRES_IN = '7d';
const REFRESH_TOKEN_EXPIRES_DAYS = 30;
const BCRYPT_ROUNDS = 12;

/**
 * Database row type for admin_users
 */
interface AdminUserRow {
    id: string;
    email: string;
    password_hash: string;
    display_name: string;
    is_super_admin: boolean;
    is_active: boolean;
    email_verified: boolean;
    last_login_at: Date | null;
    created_at: Date;
    updated_at: Date;
}

function mapRowToUser(row: AdminUserRow): AdminUser {
    return {
        id: row.id,
        email: row.email,
        displayName: row.display_name,
        isSuperAdmin: row.is_super_admin,
        isActive: row.is_active,
        emailVerified: row.email_verified,
        lastLoginAt: row.last_login_at ?? undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

export class AuthService {
    /**
     * Hash a password
     */
    async hashPassword(password: string): Promise<string> {
        return hash(password, BCRYPT_ROUNDS);
    }

    /**
     * Verify a password against a hash
     */
    async verifyPassword(password: string, passwordHash: string): Promise<boolean> {
        return compare(password, passwordHash);
    }

    /**
     * Generate a JWT access token
     */
    generateAccessToken(user: AdminUser): string {
        const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
            sub: user.id,
            email: user.email,
            displayName: user.displayName,
            isSuperAdmin: user.isSuperAdmin
        };

        return sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    }

    /**
     * Verify a JWT access token
     */
    verifyAccessToken(token: string): JWTPayload | null {
        try {
            return verify(token, JWT_SECRET) as JWTPayload;
        } catch {
            return null;
        }
    }

    /**
     * Generate a refresh token
     */
    async generateRefreshToken(userId: string, userAgent?: string, ipAddress?: string): Promise<string> {
        const token = randomBytes(64).toString('hex');
        const tokenHash = createHash('sha256').update(token).digest('hex');

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRES_DAYS);

        await pool.query(
            `INSERT INTO refresh_tokens (admin_user_id, token_hash, expires_at, user_agent, ip_address)
             VALUES ($1, $2, $3, $4, $5)`,
            [userId, tokenHash, expiresAt, userAgent, ipAddress]
        );

        return token;
    }

    /**
     * Validate and consume a refresh token
     */
    async validateRefreshToken(token: string): Promise<AdminUser | null> {
        const tokenHash = createHash('sha256').update(token).digest('hex');

        const result = await pool.query<AdminUserRow>(
            `SELECT au.* FROM refresh_tokens rt
             JOIN admin_users au ON au.id = rt.admin_user_id
             WHERE rt.token_hash = $1 
               AND rt.expires_at > NOW()
               AND rt.revoked_at IS NULL
               AND au.is_active = true`,
            [tokenHash]
        );

        if (result.rows.length === 0) {
            return null;
        }

        return mapRowToUser(result.rows[0]);
    }

    /**
     * Revoke a refresh token
     */
    async revokeRefreshToken(token: string): Promise<void> {
        const tokenHash = createHash('sha256').update(token).digest('hex');

        await pool.query(
            `UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1`,
            [tokenHash]
        );
    }

    /**
     * Revoke all refresh tokens for a user
     */
    async revokeAllUserTokens(userId: string): Promise<void> {
        await pool.query(
            `UPDATE refresh_tokens SET revoked_at = NOW() WHERE admin_user_id = $1 AND revoked_at IS NULL`,
            [userId]
        );
    }

    /**
     * Login with email and password
     */
    async login(request: LoginRequest, userAgent?: string, ipAddress?: string): Promise<LoginResponse | null> {
        // Find user by email
        const result = await pool.query<AdminUserRow>(
            `SELECT * FROM admin_users WHERE email = $1 AND is_active = true`,
            [request.email.toLowerCase()]
        );

        if (result.rows.length === 0) {
            return null;
        }

        const userRow = result.rows[0];

        // Verify password
        const passwordValid = await this.verifyPassword(request.password, userRow.password_hash);
        if (!passwordValid) {
            return null;
        }

        const user = mapRowToUser(userRow);

        // Update last login
        await pool.query(
            `UPDATE admin_users SET last_login_at = NOW() WHERE id = $1`,
            [user.id]
        );

        // Generate tokens
        const accessToken = this.generateAccessToken(user);
        const refreshToken = await this.generateRefreshToken(user.id, userAgent, ipAddress);

        // Calculate expiry
        const decoded = this.verifyAccessToken(accessToken);
        const expiresAt = decoded?.exp ?? 0;

        console.log(`✅ User logged in: ${user.email}`);

        return {
            user,
            accessToken,
            refreshToken,
            expiresAt
        };
    }

    /**
     * Refresh access token
     */
    async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: number } | null> {
        const user = await this.validateRefreshToken(refreshToken);
        if (!user) {
            return null;
        }

        const accessToken = this.generateAccessToken(user);
        const decoded = this.verifyAccessToken(accessToken);
        const expiresAt = decoded?.exp ?? 0;

        return { accessToken, expiresAt };
    }

    /**
     * Get user by ID
     */
    async getUserById(id: string): Promise<AdminUser | null> {
        const result = await pool.query<AdminUserRow>(
            `SELECT * FROM admin_users WHERE id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return null;
        }

        return mapRowToUser(result.rows[0]);
    }

    /**
     * Get user by email
     */
    async getUserByEmail(email: string): Promise<AdminUser | null> {
        const result = await pool.query<AdminUserRow>(
            `SELECT * FROM admin_users WHERE email = $1`,
            [email.toLowerCase()]
        );

        if (result.rows.length === 0) {
            return null;
        }

        return mapRowToUser(result.rows[0]);
    }

    /**
     * Create a new admin user
     */
    async createUser(email: string, password: string, displayName: string, isSuperAdmin = false): Promise<AdminUser> {
        const passwordHash = await this.hashPassword(password);

        const result = await pool.query<AdminUserRow>(
            `INSERT INTO admin_users (email, password_hash, display_name, is_super_admin, is_active)
             VALUES ($1, $2, $3, $4, true)
             RETURNING *`,
            [email.toLowerCase(), passwordHash, displayName, isSuperAdmin]
        );

        console.log(`📝 Created user: ${email}`);
        return mapRowToUser(result.rows[0]);
    }

    /**
     * Update user password
     */
    async updatePassword(userId: string, newPassword: string): Promise<void> {
        const passwordHash = await this.hashPassword(newPassword);

        await pool.query(
            `UPDATE admin_users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
            [passwordHash, userId]
        );

        // Revoke all tokens to force re-login
        await this.revokeAllUserTokens(userId);
    }

    /**
     * Deactivate a user
     */
    async deactivateUser(userId: string): Promise<void> {
        await pool.query(
            `UPDATE admin_users SET is_active = false, updated_at = NOW() WHERE id = $1`,
            [userId]
        );

        await this.revokeAllUserTokens(userId);
    }

    /**
     * Clean up expired refresh tokens
     */
    async cleanupExpiredTokens(): Promise<number> {
        const result = await pool.query(
            `DELETE FROM refresh_tokens WHERE expires_at < NOW() OR revoked_at IS NOT NULL`
        );

        return result.rowCount ?? 0;
    }
}

// Singleton instance
let authServiceInstance: AuthService | null = null;

export function getAuthService(): AuthService {
    if (!authServiceInstance) {
        authServiceInstance = new AuthService();
    }
    return authServiceInstance;
}
