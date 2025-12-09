// =====================================================================
// API Type Definitions
// DTOs and request/response types for REST and WebSocket APIs
// =====================================================================

import type { Session, SessionDriver, SessionTiming } from './session.js';
import type { IncidentEvent, AIAnalysis } from './incident.js';
import type { Penalty, PenaltyQueue, StewardAction } from './penalty.js';
import type { Rulebook } from './rulebook.js';

// ========================
// Common API Types
// ========================

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: ApiError;
    meta?: ApiMeta;
}

export interface ApiError {
    code: string;
    message: string;
    details?: Record<string, unknown>;
}

export interface ApiMeta {
    page?: number;
    pageSize?: number;
    totalCount?: number;
    totalPages?: number;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

// ========================
// Session API
// ========================

export interface ListSessionsParams extends PaginationParams {
    status?: string;
    simType?: string;
    fromDate?: string;
    toDate?: string;
}

export interface CreateSessionRequest {
    externalId?: string;
    simType: 'iracing' | 'acc' | 'rf2';
    trackName: string;
    trackConfig?: string;
    sessionType: 'practice' | 'qualifying' | 'race' | 'warmup';
    rulebookId?: string;
    metadata?: Record<string, unknown>;
}

export interface UpdateSessionRequest {
    status?: string;
    endedAt?: string;
    metadata?: Record<string, unknown>;
}

export type SessionResponse = ApiResponse<Session>;
export type SessionListResponse = ApiResponse<Session[]>;
export type SessionTimingResponse = ApiResponse<SessionTiming>;
export type SessionDriversResponse = ApiResponse<SessionDriver[]>;

// ========================
// Incident API
// ========================

export interface ListIncidentsParams extends PaginationParams {
    sessionId?: string;
    type?: string;
    severity?: string;
    status?: string;
    driverId?: string;
    fromTime?: number;
    toTime?: number;
}

export interface UpdateIncidentRequest {
    status?: string;
    stewardNotes?: string;
    reviewedBy?: string;
}

export interface AnalyzeIncidentRequest {
    modelId?: string;
    forceReanalyze?: boolean;
}

export type IncidentResponse = ApiResponse<IncidentEvent>;
export type IncidentListResponse = ApiResponse<IncidentEvent[]>;
export type IncidentAnalysisResponse = ApiResponse<AIAnalysis>;

// ========================
// Penalty API
// ========================

export interface ListPenaltiesParams extends PaginationParams {
    sessionId?: string;
    status?: string;
    driverId?: string;
    type?: string;
}

export interface CreatePenaltyRequest {
    sessionId: string;
    incidentId?: string;
    driverId: string;
    driverName: string;
    carNumber: string;
    type: string;
    value: string;
    ruleReference?: string;
    rationale: string;
    points?: number;
}

export interface UpdatePenaltyRequest {
    status?: string;
    rationale?: string;
    type?: string;
    value?: string;
    points?: number;
}

export interface ApprovePenaltyRequest {
    notes?: string;
    modifiedValue?: string;
}

export type PenaltyResponse = ApiResponse<Penalty>;
export type PenaltyListResponse = ApiResponse<Penalty[]>;
export type PenaltyQueueResponse = ApiResponse<PenaltyQueue>;

// ========================
// Rulebook API
// ========================

export interface CreateRulebookRequest {
    name: string;
    leagueName: string;
    version: string;
    description?: string;
    rules: Rulebook['rules'];
    penaltyMatrix: Rulebook['penaltyMatrix'];
    settings: Rulebook['settings'];
}

export interface UpdateRulebookRequest extends Partial<CreateRulebookRequest> {
    isActive?: boolean;
}

export type RulebookResponse = ApiResponse<Rulebook>;
export type RulebookListResponse = ApiResponse<Rulebook[]>;
export type RulebookValidationResponse = ApiResponse<{
    isValid: boolean;
    errors: Array<{ field: string; message: string }>;
    warnings: Array<{ message: string }>;
}>;

// ========================
// Report API
// ========================

export interface PostRaceReport {
    sessionId: string;
    session: Session;
    drivers: SessionDriver[];
    incidents: IncidentEvent[];
    penalties: Penalty[];
    stats: ReportStats;
    generatedAt: Date;
}

export interface ReportStats {
    totalIncidents: number;
    incidentsByType: Record<string, number>;
    totalPenalties: number;
    penaltiesByType: Record<string, number>;
    cleanestDrivers: Array<{ driverId: string; driverName: string; incidents: number }>;
    mostIncidents: Array<{ driverId: string; driverName: string; incidents: number }>;
}

export interface ExportReportRequest {
    format: 'json' | 'pdf' | 'csv';
    includeDetails?: boolean;
    includeTelemetry?: boolean;
}

export type ReportResponse = ApiResponse<PostRaceReport>;

// ========================
// WebSocket Events
// ========================

export interface WebSocketMessage<T = unknown> {
    event: string;
    data: T;
    timestamp: number;
}

// Client -> Server events
export interface JoinRoomMessage {
    sessionId: string;
}

export interface LeaveRoomMessage {
    sessionId: string;
}

export interface StewardActionMessage extends StewardAction { }

// Server -> Client events
export interface TimingUpdateMessage {
    sessionId: string;
    timing: SessionTiming;
}

export interface IncidentNewMessage {
    sessionId: string;
    incident: IncidentEvent;
}

export interface IncidentUpdatedMessage {
    sessionId: string;
    incident: IncidentEvent;
}

export interface PenaltyProposedMessage {
    sessionId: string;
    penalty: Penalty;
}

export interface PenaltyApprovedMessage {
    sessionId: string;
    penalty: Penalty;
}

export interface SessionStateMessage {
    sessionId: string;
    state: string;
    timestamp: number;
}

// ========================
// Health API
// ========================

export interface HealthCheckResponse {
    status: 'healthy' | 'degraded' | 'unhealthy';
    version: string;
    uptime: number;
    checks: {
        database: 'ok' | 'error';
        redis: 'ok' | 'error';
        ai: 'ok' | 'error' | 'disabled';
    };
    timestamp: string;
}

export type HealthResponse = ApiResponse<HealthCheckResponse>;
