// =====================================================================
// Audit Log Types
// Types for comprehensive audit logging system
// =====================================================================

export type AuditAction =
    | 'create'
    | 'update'
    | 'delete'
    | 'penalty_issued'
    | 'penalty_revoked'
    | 'protest_submitted'
    | 'protest_resolved'
    | 'appeal_submitted'
    | 'appeal_resolved'
    | 'vote_cast'
    | 'panel_closed'
    | 'rulebook_updated'
    | 'rule_added'
    | 'rule_deleted'
    | 'session_started'
    | 'session_ended'
    | 'login'
    | 'logout';

export interface AuditLogEntry {
    id: string;

    // Actor
    actorId?: string;
    actorEmail?: string;
    actorIp?: string;

    // Action
    action: AuditAction;
    entityType: string;
    entityId?: string;

    // Details
    description?: string;
    oldValue?: unknown;
    newValue?: unknown;

    // Metadata
    userAgent?: string;
    leagueId?: string;

    createdAt: string;
}

export interface AuditLogQuery {
    leagueId?: string;
    actorId?: string;
    entityType?: string;
    entityId?: string;
    action?: AuditAction;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
}

export interface CreateAuditLogRequest {
    actorId?: string;
    actorEmail?: string;
    actorIp?: string;
    action: AuditAction;
    entityType: string;
    entityId?: string;
    description?: string;
    oldValue?: unknown;
    newValue?: unknown;
    leagueId?: string;
}
