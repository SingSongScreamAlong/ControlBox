// =====================================================================
// Rulebook Type Definitions
// Defines league rules, conditions, and penalty structures
// =====================================================================

import type { SeverityLevel, IncidentType, ContactType } from './incident.js';

/**
 * Complete rulebook definition
 */
export interface Rulebook {
    /** Unique rulebook identifier */
    id: string;
    /** Rulebook name */
    name: string;
    /** League or organization name */
    leagueName: string;
    /** Rulebook version */
    version: string;
    /** Rulebook description */
    description?: string;

    /** Individual rules */
    rules: Rule[];
    /** Standard penalty matrix */
    penaltyMatrix: PenaltyMatrix;
    /** Global rulebook settings */
    settings: RulebookSettings;

    /** Is this rulebook currently active */
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Individual rule definition
 */
export interface Rule {
    /** Unique rule identifier */
    id: string;
    /** Section reference (e.g., "3.2.1") */
    reference: string;
    /** Rule title */
    title: string;
    /** Full rule description */
    description: string;
    /** Short summary */
    summary?: string;

    /** Conditions that trigger this rule */
    conditions: RuleCondition[];
    /** Resulting penalty if conditions match */
    penalty: PenaltyDefinition;

    /** Priority for conflict resolution (higher = more important) */
    priority: number;
    /** Is this rule active */
    isActive: boolean;
    /** Additional notes for stewards */
    stewardNotes?: string;
}

/**
 * Rule condition for evaluation
 */
export interface RuleCondition {
    /** Field path to evaluate (e.g., "incident.contactType") */
    field: string;
    /** Comparison operator */
    operator: ConditionOperator;
    /** Value to compare against */
    value: unknown;

    /** Nested AND conditions */
    and?: RuleCondition[];
    /** Nested OR conditions */
    or?: RuleCondition[];
}

export type ConditionOperator =
    | 'eq'        // equals
    | 'neq'       // not equals
    | 'gt'        // greater than
    | 'lt'        // less than
    | 'gte'       // greater than or equal
    | 'lte'       // less than or equal
    | 'in'        // in array
    | 'nin'       // not in array
    | 'contains'  // string contains
    | 'exists'    // field exists
    | 'regex';    // regex match

/**
 * Penalty definition
 */
export interface PenaltyDefinition {
    /** Penalty type */
    type: PenaltyType;
    /** Penalty value (e.g., "5 seconds", "3 positions") */
    value?: string;
    /** License/penalty points */
    points?: number;
    /** Duration in seconds (for time penalties) */
    durationSeconds?: number;
    /** Position penalty count */
    positionPenalty?: number;
    /** Additional notes */
    notes?: string;
}

export type PenaltyType =
    | 'warning'
    | 'reprimand'
    | 'time_penalty'
    | 'position_penalty'
    | 'drive_through'
    | 'stop_go'
    | 'disqualification'
    | 'grid_penalty'
    | 'points_deduction'
    | 'race_ban'
    | 'custom';

/**
 * Penalty severity matrix
 */
export interface PenaltyMatrix {
    /** Severity to penalty mapping */
    severity: Record<SeverityLevel, PenaltyDefinition>;
    /** Incident type overrides */
    incidentOverrides?: Record<IncidentType, PenaltyDefinition>;
    /** Contact type overrides */
    contactOverrides?: Record<ContactType, PenaltyDefinition>;
    /** Repeat offender escalation */
    repeat: RepeatPenaltyRule;
}

/**
 * Repeat offender escalation rules
 */
export interface RepeatPenaltyRule {
    /** Warning threshold before escalation */
    warningThreshold: number;
    /** Time window to count warnings (hours) */
    timeWindowHours: number;
    /** Escalated penalty */
    escalation: PenaltyDefinition;
}

/**
 * Rulebook global settings
 */
export interface RulebookSettings {
    /** Automatically propose penalties for high-confidence incidents */
    autoPropose: boolean;
    /** Minimum AI confidence to auto-propose */
    autoProposeThreshold: number;
    /** Require steward approval for all penalties */
    requireApproval: boolean;
    /** Time limit for steward review (hours) */
    reviewTimeLimit: number;
    /** Allow driver protests */
    allowProtests: boolean;
    /** Protest submission window (hours) */
    protestWindow: number;
    /** Track-specific rules keyed by track name */
    trackSpecificRules?: Record<string, Rule[]>;
}

/**
 * Rulebook validation result
 */
export interface RulebookValidation {
    /** Is the rulebook valid */
    isValid: boolean;
    /** Validation errors */
    errors: RulebookValidationError[];
    /** Validation warnings */
    warnings: RulebookValidationWarning[];
}

export interface RulebookValidationError {
    /** Rule ID with the error */
    ruleId?: string;
    /** Field with the error */
    field: string;
    /** Error message */
    message: string;
}

export interface RulebookValidationWarning {
    /** Rule ID with the warning */
    ruleId?: string;
    /** Warning message */
    message: string;
}
