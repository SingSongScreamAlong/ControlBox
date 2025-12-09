// =====================================================================
// Recommendation Type Definitions
// Cloud-generated recommendations for race control actions
// =====================================================================

import type { DisciplineCategory } from './discipline.js';

// ========================
// Recommendation Types
// ========================

/**
 * Types of recommendations the engine can generate
 */
export type RecommendationType =
    | 'localYellow'      // Local caution zone
    | 'globalYellow'     // Full-course yellow/caution
    | 'slowZone'         // Endurance-style slow zone
    | 'reviewIncident'   // Requires steward review
    | 'penalty'          // Penalty recommendation
    | 'noAction'         // No action needed
    | 'warning'          // Driver warning
    | 'blackFlag'        // Black flag recommendation
    | 'safetyCarIn'      // Deploy safety car
    | 'safetyCarOut'     // Bring safety car in
    | 'restart';         // Initiate restart

/**
 * Recommendation status
 */
export type RecommendationStatus =
    | 'pending'          // Awaiting action
    | 'accepted'         // Steward accepted
    | 'dismissed'        // Steward dismissed
    | 'modified'         // Accepted with modifications
    | 'expired';         // Timed out

/**
 * Cloud-generated recommendation
 */
export interface Recommendation {
    /** Unique recommendation identifier */
    id: string;
    /** Session this recommendation belongs to */
    sessionId: string;
    /** Related incident ID (if applicable) */
    incidentId?: string;

    /** Recommendation type */
    type: RecommendationType;
    /** Discipline context for this recommendation */
    disciplineContext: DisciplineCategory;

    /** Human-readable details */
    details: string;
    /** Engine confidence (0.0 - 1.0) */
    confidence: number;

    /** Current status */
    status: RecommendationStatus;
    /** Priority level (higher = more urgent) */
    priority: number;

    /** Who actioned this recommendation */
    actionedBy?: string;
    /** When it was actioned */
    actionedAt?: Date;
    /** Notes from actioning steward */
    actionNotes?: string;

    /** When this recommendation was generated */
    timestamp: number;
    createdAt: Date;
    updatedAt?: Date;
}

// ========================
// Specific Recommendation Payload Types
// ========================

/**
 * Local yellow recommendation details
 */
export interface LocalYellowRecommendation extends Recommendation {
    type: 'localYellow';
    payload: {
        /** Track position start (0-1) */
        zoneStart: number;
        /** Track position end (0-1) */
        zoneEnd: number;
        /** Suggested duration (seconds) */
        suggestedDuration: number;
        /** Corner name or sector */
        locationName?: string;
    };
}

/**
 * Global yellow recommendation details
 */
export interface GlobalYellowRecommendation extends Recommendation {
    type: 'globalYellow';
    payload: {
        /** Reason for full course yellow */
        reason: 'multi_car_incident' | 'track_blockage' | 'safety_concern' | 'weather';
        /** Suggested caution laps (if applicable) */
        suggestedLaps?: number;
        /** Should pit road be closed */
        closePitRoad?: boolean;
    };
}

/**
 * Slow zone recommendation details
 */
export interface SlowZoneRecommendation extends Recommendation {
    type: 'slowZone';
    payload: {
        /** Track position start (0-1) */
        zoneStart: number;
        /** Track position end (0-1) */
        zoneEnd: number;
        /** Speed limit (km/h) */
        speedLimit: number;
        /** Suggested duration (seconds) */
        suggestedDuration: number;
    };
}

/**
 * Penalty recommendation details
 */
export interface PenaltyRecommendation extends Recommendation {
    type: 'penalty';
    payload: {
        /** Driver to penalize */
        driverId: string;
        /** Driver name */
        driverName: string;
        /** Suggested penalty type */
        penaltyType: string;
        /** Suggested penalty value */
        penaltyValue: string;
        /** Rule reference */
        ruleReference?: string;
        /** Points if applicable */
        points?: number;
    };
}

/**
 * Incident review recommendation details
 */
export interface ReviewRecommendation extends Recommendation {
    type: 'reviewIncident';
    payload: {
        /** Why this needs review */
        reviewReason: string;
        /** Suggested outcome options */
        suggestedOutcomes: string[];
        /** Replay timestamp for review */
        replayTimestamp?: number;
    };
}

// ========================
// Recommendation Engine Types
// ========================

/**
 * Context provided to recommendation engine
 */
export interface RecommendationContext {
    sessionId: string;
    discipline: DisciplineCategory;
    currentLap: number;
    sessionTimeMs: number;
    flagState: FlagState;
    recentIncidents: RecentIncident[];
    trackBlockage: boolean;
    safetyCarDeployed: boolean;
}

export type FlagState =
    | 'green'
    | 'yellow'
    | 'localYellow'
    | 'caution'
    | 'red'
    | 'restart'
    | 'checkered'
    | 'white';

export interface RecentIncident {
    id: string;
    type: string;
    severity: string;
    trackPosition: number;
    timestamp: number;
}

/**
 * Recommendation engine output
 */
export interface RecommendationResult {
    recommendations: Recommendation[];
    reasoning: string;
    evaluationTimeMs: number;
}

// ========================
// API Types
// ========================

/**
 * Action on a recommendation
 */
export interface ActionRecommendationRequest {
    action: 'accept' | 'dismiss' | 'modify';
    notes?: string;
    modifiedPayload?: Record<string, unknown>;
}

export interface ListRecommendationsParams {
    sessionId?: string;
    status?: RecommendationStatus;
    type?: RecommendationType;
    limit?: number;
    offset?: number;
}
