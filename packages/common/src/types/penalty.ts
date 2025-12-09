// =====================================================================
// Penalty Type Definitions
// Defines penalty records, status, and approval workflow
// =====================================================================

import type { PenaltyType, PenaltyDefinition } from './rulebook.js';
import type { IncidentEvent } from './incident.js';

/**
 * Penalty record status
 */
export type PenaltyStatus =
    | 'proposed'      // System proposed, awaiting review
    | 'under_review'  // Being reviewed by steward
    | 'approved'      // Approved by steward
    | 'applied'       // Applied to race results
    | 'appealed'      // Driver filed appeal
    | 'overturned'    // Penalty was overturned
    | 'rejected';     // Steward rejected the penalty

/**
 * Complete penalty record
 */
export interface Penalty {
    /** Unique penalty identifier */
    id: string;
    /** Session ID */
    sessionId: string;
    /** Linked incident ID (optional - manual penalties may not have one) */
    incidentId?: string;
    /** Rulebook used for this penalty */
    rulebookId?: string;

    // Target
    /** Penalized driver ID */
    driverId: string;
    /** Driver display name */
    driverName: string;
    /** Car number */
    carNumber: string;

    // Penalty details
    /** Penalty type */
    type: PenaltyType;
    /** Penalty value description */
    value: string;
    /** Rule reference (e.g., "Section 3.2.1") */
    ruleReference?: string;
    /** Penalty severity */
    severity: 'light' | 'medium' | 'heavy';
    /** License/penalty points */
    points?: number;

    // Reasoning
    /** Rationale for the penalty */
    rationale: string;
    /** Linked evidence */
    evidenceBundle: EvidenceBundle;

    // Workflow
    /** Current status */
    status: PenaltyStatus;
    /** Who proposed the penalty */
    proposedBy: 'system' | string;
    /** When it was proposed */
    proposedAt: Date;
    /** Steward who approved/rejected */
    approvedBy?: string;
    /** Approval timestamp */
    approvedAt?: Date;
    /** Applied to results timestamp */
    appliedAt?: Date;

    // Appeal
    /** Has this been appealed */
    isAppealed: boolean;
    /** Appeal details */
    appeal?: PenaltyAppeal;

    createdAt: Date;
    updatedAt: Date;
}

/**
 * Evidence bundle for a penalty
 */
export interface EvidenceBundle {
    /** Linked incident details */
    incident?: Partial<IncidentEvent>;
    /** AI analysis summary */
    aiAnalysisSummary?: string;
    /** AI confidence score */
    aiConfidence?: number;
    /** Replay timestamp */
    replayTimestampMs?: number;
    /** Screenshots or video links */
    mediaLinks?: string[];
    /** Steward notes */
    stewardNotes?: string[];
    /** Additional context */
    additionalContext?: string;
}

/**
 * Penalty appeal record
 */
export interface PenaltyAppeal {
    /** Appeal ID */
    id: string;
    /** Who filed the appeal */
    filedBy: string;
    /** When the appeal was filed */
    filedAt: Date;
    /** Reason for appeal */
    reason: string;
    /** Supporting evidence */
    supportingEvidence?: string[];
    /** Appeal status */
    status: 'pending' | 'reviewing' | 'upheld' | 'overturned' | 'modified';
    /** Appeal decision */
    decision?: string;
    /** Who handled the appeal */
    handledBy?: string;
    /** Decision timestamp */
    decidedAt?: Date;
}

/**
 * Penalty queue for steward review
 */
export interface PenaltyQueue {
    /** Session ID */
    sessionId: string;
    /** Pending penalties awaiting review */
    pending: Penalty[];
    /** Under review penalties */
    underReview: Penalty[];
    /** Recently processed (for context) */
    recentlyProcessed: Penalty[];
    /** Total pending count */
    totalPending: number;
}

/**
 * Steward action on a penalty
 */
export interface StewardAction {
    /** Action type */
    action: 'approve' | 'reject' | 'modify' | 'escalate' | 'defer';
    /** Penalty ID */
    penaltyId: string;
    /** Steward ID */
    stewardId: string;
    /** Steward notes */
    notes?: string;
    /** Modified penalty (if action is 'modify') */
    modifiedPenalty?: Partial<PenaltyDefinition>;
    /** Action timestamp */
    timestamp: Date;
}

/**
 * Penalty statistics for a session or driver
 */
export interface PenaltyStats {
    /** Total penalties */
    total: number;
    /** Breakdown by type */
    byType: Record<PenaltyType, number>;
    /** Breakdown by status */
    byStatus: Record<PenaltyStatus, number>;
    /** Total points issued */
    totalPoints: number;
    /** Appeal rate */
    appealRate: number;
    /** Overturn rate */
    overturnRate: number;
}
