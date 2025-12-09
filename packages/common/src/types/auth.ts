// =====================================================================
// Auth & Licensing Type Definitions
// Admin users, roles, licenses, and authentication
// =====================================================================

// ========================
// License Types
// ========================

/**
 * License status values
 */
export type LicenseStatus = 'pending' | 'active' | 'expired' | 'suspended';

/**
 * License record - unlocks ControlBox for a league/series/season
 */
export interface License {
    id: string;
    leagueId: string;
    seriesId: string;
    seasonId: string;

    status: LicenseStatus;
    startDate: Date;
    endDate: Date;

    notes?: string;
    maxConcurrentSessions: number;
    features: Record<string, boolean>;

    createdAt: Date;
    updatedAt: Date;
}

/**
 * Check if a license is currently valid
 */
export interface LicenseValidation {
    isValid: boolean;
    license?: License;
    error?: LicenseError;
}

export type LicenseError =
    | 'LICENSE_NOT_FOUND'
    | 'LICENSE_INACTIVE'
    | 'LICENSE_EXPIRED'
    | 'LICENSE_SUSPENDED'
    | 'LICENSE_NOT_STARTED';

// ========================
// Admin User Types
// ========================

/**
 * Admin role levels
 */
export type AdminRole = 'Owner' | 'RaceControl' | 'Steward' | 'Broadcaster' | 'ReadOnly';

/**
 * Role permissions mapping
 */
export const ROLE_PERMISSIONS: Record<AdminRole, {
    liveControl: boolean;
    stewardReview: boolean;
    sessionConfig: boolean;
    viewData: boolean;
    manageUsers: boolean;
}> = {
    Owner: { liveControl: true, stewardReview: true, sessionConfig: true, viewData: true, manageUsers: true },
    RaceControl: { liveControl: true, stewardReview: true, sessionConfig: true, viewData: true, manageUsers: false },
    Steward: { liveControl: false, stewardReview: true, sessionConfig: false, viewData: true, manageUsers: false },
    Broadcaster: { liveControl: false, stewardReview: false, sessionConfig: false, viewData: true, manageUsers: false },
    ReadOnly: { liveControl: false, stewardReview: false, sessionConfig: false, viewData: true, manageUsers: false }
};

/**
 * Admin user account
 */
export interface AdminUser {
    id: string;
    email: string;
    displayName: string;

    isSuperAdmin: boolean;
    isActive: boolean;
    emailVerified: boolean;
    lastLoginAt?: Date;

    createdAt: Date;
    updatedAt: Date;
}

/**
 * Admin user with password (internal only)
 */
export interface AdminUserWithPassword extends AdminUser {
    passwordHash: string;
}

/**
 * Role assignment for a user in a league/series/season
 */
export interface AdminUserLeagueRole {
    id: string;
    adminUserId: string;
    leagueId: string;
    seriesId?: string;
    seasonId?: string;
    role: AdminRole;
    grantedBy?: string;
    grantedAt: Date;
    createdAt: Date;
}

// ========================
// Series & Season Types
// ========================

/**
 * Series within a league
 */
export interface Series {
    id: string;
    leagueId: string;
    name: string;
    description?: string;
    defaultDiscipline?: string;
    defaultProfileId?: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Season within a series
 */
export interface Season {
    id: string;
    leagueId: string;
    seriesId: string;
    name: string;
    description?: string;
    startDate: Date;
    endDate: Date;
    rulebookId?: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

// ========================
// League Context
// ========================

/**
 * Context for scoping operations to a league/series/season
 */
export interface LeagueContext {
    leagueId: string;
    seriesId?: string;
    seasonId?: string;
    licenseId?: string;
}

/**
 * Extended context with license validation
 */
export interface ValidatedLeagueContext extends LeagueContext {
    license: License;
    userRole: AdminRole;
}

// ========================
// Authentication Types
// ========================

/**
 * Login request
 */
export interface LoginRequest {
    email: string;
    password: string;
}

/**
 * Login response
 */
export interface LoginResponse {
    user: AdminUser;
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
}

/**
 * Token refresh request
 */
export interface RefreshTokenRequest {
    refreshToken: string;
}

/**
 * JWT payload
 */
export interface JWTPayload {
    sub: string; // user id
    email: string;
    displayName: string;
    isSuperAdmin: boolean;
    iat: number;
    exp: number;
}

/**
 * Authenticated request context
 */
export interface AuthContext {
    user: AdminUser;
    token: string;
}

// ========================
// iRacing Link Types
// ========================

/**
 * iRacing account link (stub)
 */
export interface IRacingAccountLink {
    id: string;
    adminUserId: string;
    iracingCustomerId: string;
    iracingDisplayName?: string;
    verifiedAt?: Date;
    verificationMethod?: string;
    createdAt: Date;
}

// ========================
// API Request/Response Types
// ========================

export interface CreateLicenseRequest {
    leagueId: string;
    seriesId: string;
    seasonId: string;
    status?: LicenseStatus;
    startDate: string;
    endDate: string;
    notes?: string;
    maxConcurrentSessions?: number;
}

export interface UpdateLicenseRequest {
    status?: LicenseStatus;
    startDate?: string;
    endDate?: string;
    notes?: string;
    maxConcurrentSessions?: number;
}

export interface CreateAdminUserRequest {
    email: string;
    password: string;
    displayName: string;
    isSuperAdmin?: boolean;
}

export interface AssignRoleRequest {
    adminUserId: string;
    leagueId: string;
    seriesId?: string;
    seasonId?: string;
    role: AdminRole;
}

export interface CreateSeriesRequest {
    leagueId: string;
    name: string;
    description?: string;
    defaultDiscipline?: string;
    defaultProfileId?: string;
}

export interface CreateSeasonRequest {
    leagueId: string;
    seriesId: string;
    name: string;
    description?: string;
    startDate: string;
    endDate: string;
    rulebookId?: string;
}

// ========================
// User's League Access View
// ========================

/**
 * League with user's access info (for dashboard)
 */
export interface LeagueAccess {
    league: {
        id: string;
        name: string;
    };
    role: AdminRole;
    series: SeriesAccess[];
}

export interface SeriesAccess {
    series: {
        id: string;
        name: string;
    };
    role?: AdminRole;
    seasons: SeasonAccess[];
}

export interface SeasonAccess {
    season: {
        id: string;
        name: string;
        startDate: Date;
        endDate: Date;
    };
    role?: AdminRole;
    license?: {
        id: string;
        status: LicenseStatus;
        isActive: boolean;
    };
}
