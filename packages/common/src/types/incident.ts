// =====================================================================
// Incident Type Definitions
// Defines incidents, classifications, and AI analysis structures
// =====================================================================

import type { TelemetryFrame, DriverTelemetry } from './telemetry.js';
import type { DisciplineCategory } from './discipline.js';

// ========================
// Incident Classification
// ========================

/**
 * Primary incident type categories
 */
export type IncidentType =
    | 'contact'
    | 'off_track'
    | 'spin'
    | 'loss_of_control'
    | 'unsafe_rejoin'
    | 'blocking'
    | 'cutting'
    | 'pit_lane_violation';

/**
 * Contact incident sub-classifications
 */
export type ContactType =
    | 'rear_end'
    | 'side_to_side'
    | 'divebomb'
    | 't_bone'
    | 'squeeze'
    | 'punt'
    | 'brake_check'
    | 'netcode_likely'
    | 'racing_incident'
    | 'no_contact';

/**
 * Severity classification levels
 */
export type SeverityLevel = 'light' | 'medium' | 'heavy';

/**
 * Incident review status
 */
export type IncidentStatus = 'pending' | 'under_review' | 'reviewed' | 'dismissed' | 'escalated';

// ========================
// Core Incident Types
// ========================

/**
 * Complete incident event record
 */
export interface IncidentEvent {
    /** Unique incident identifier */
    id: string;
    /** Session this incident occurred in */
    sessionId: string;

    // Classification
    /** Primary incident type */
    type: IncidentType;
    /** Contact sub-type if applicable */
    contactType?: ContactType;
    /** Severity level */
    severity: SeverityLevel;
    /** Calculated severity score (0-100) */
    severityScore: number;
    /** Discipline context for rule application */
    disciplineContext?: DisciplineCategory;

    // Location
    /** Lap number when incident occurred */
    lapNumber: number;
    /** Session elapsed time in milliseconds */
    sessionTimeMs: number;
    /** Track position (0.0 - 1.0) */
    trackPosition: number;
    /** Name of the corner or track section */
    cornerName?: string;

    // Involved parties
    /** Drivers involved in the incident */
    involvedDrivers: InvolvedDriver[];

    // Analysis
    /** AI analysis results if available */
    aiAnalysis?: AIAnalysis;

    // Status
    /** Current review status */
    status: IncidentStatus;
    /** Steward who reviewed the incident */
    reviewedBy?: string;
    /** When the incident was reviewed */
    reviewedAt?: Date;
    /** Steward notes on the incident */
    stewardNotes?: string;

    // Evidence
    /** Replay timestamp for video review */
    replayTimestampMs?: number;
    /** Telemetry snapshot at time of incident */
    telemetrySnapshot?: IncidentTelemetrySnapshot;

    // Metadata
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Driver involved in an incident
 */
export interface InvolvedDriver {
    /** Driver identifier */
    driverId: string;
    /** Driver display name */
    driverName: string;
    /** Car number */
    carNumber: string;
    /** Car name/model */
    carName?: string;
    /** Role in the incident */
    role: DriverRole;
    /** Calculated fault probability (0.0 - 1.0) */
    faultProbability?: number;
    /** Position before the incident */
    positionBefore?: number;
    /** Position after the incident */
    positionAfter?: number;
    /** Did this driver report the incident */
    isReporter?: boolean;
}

export type DriverRole = 'aggressor' | 'victim' | 'involved' | 'unknown' | 'witness';

/**
 * Telemetry snapshot for incident analysis
 */
export interface IncidentTelemetrySnapshot {
    /** Frames leading up to incident (typically 5 seconds before) */
    framesBefore: TelemetryFrame[];
    /** Frame at the moment of incident */
    incidentFrame: TelemetryFrame;
    /** Frames after incident (typically 5 seconds after) */
    framesAfter: TelemetryFrame[];
    /** Extracted driver telemetry for involved parties */
    involvedDriversTelemetry: Record<string, DriverTelemetry[]>;
}

// ========================
// AI Analysis Types
// ========================

/**
 * AI-generated incident analysis
 */
export interface AIAnalysis {
    /** Recommended action */
    recommendation: AIRecommendation;
    /** Confidence in the analysis (0.0 - 1.0) */
    confidence: number;
    /** Human-readable reasoning explanation */
    reasoning: string;
    /** Detailed reasoning trace for explainability */
    reasoningTrace?: ReasoningStep[];
    /** Fault attribution probabilities by driver */
    faultAttribution: Record<string, number>;
    /** Detected patterns that influenced analysis */
    patterns: IncidentPattern[];
    /** Model identifier used for analysis */
    modelId: string;
    /** Analysis timestamp */
    analyzedAt: Date;
}

export type AIRecommendation =
    | 'no_fault'
    | 'racing_incident'
    | 'warning'
    | 'investigate'
    | 'penalty_likely'
    | 'penalty_recommended';

/**
 * Step in the AI reasoning trace
 */
export interface ReasoningStep {
    /** Step number */
    step: number;
    /** Analysis factor being evaluated */
    factor: string;
    /** Observation or finding */
    observation: string;
    /** How this affects the conclusion */
    impact: 'supports_no_fault' | 'supports_fault' | 'neutral' | 'requires_review';
    /** Confidence in this specific step */
    confidence: number;
}

/**
 * Detected incident pattern
 */
export interface IncidentPattern {
    /** Pattern identifier */
    patternId: string;
    /** Human-readable pattern name */
    name: string;
    /** Pattern description */
    description: string;
    /** How strongly this pattern matches */
    matchStrength: number;
    /** Related historical incidents */
    relatedIncidents?: string[];
}

// ========================
// Incident Detection Types
// ========================

/**
 * Raw incident trigger from event detector
 */
export interface IncidentTrigger {
    /** Trigger type */
    type: IncidentTriggerType;
    /** When the trigger was detected */
    timestamp: number;
    /** Session time in milliseconds */
    sessionTimeMs: number;
    /** Primary driver involved */
    primaryDriverId: string;
    /** Additional drivers that might be involved */
    nearbyDriverIds: string[];
    /** Raw trigger data for analysis */
    triggerData: Record<string, unknown>;
}

export type IncidentTriggerType =
    | 'incident_count_increase'
    | 'off_track_detected'
    | 'spin_detected'
    | 'contact_proximity'
    | 'sudden_deceleration'
    | 'erratic_trajectory';

/**
 * Contact detection result
 */
export interface ContactDetection {
    /** Did contact occur */
    hasContact: boolean;
    /** Classified contact type */
    contactType: ContactType;
    /** Confidence in detection (0.0 - 1.0) */
    confidence: number;
    /** Estimated closing speed at contact (m/s) */
    closingSpeed: number;
    /** Contact angle in degrees */
    contactAngle: number;
    /** Is this likely netcode rather than real contact */
    isNetcodeLikely: boolean;
    /** Evidence supporting the classification */
    evidence: ContactEvidence;
}

export interface ContactEvidence {
    /** Speed differential at contact */
    speedDifferential: number;
    /** Overlap percentage at point of contact */
    overlapPercentage: number;
    /** Time to contact from decision point */
    timeToContact: number;
    /** Was contact avoidable */
    avoidabilityScore: number;
    /** Relative positions */
    relativePosition: 'ahead' | 'alongside' | 'behind';
    /** Racing line analysis */
    racingLineDeviation: number;
}
