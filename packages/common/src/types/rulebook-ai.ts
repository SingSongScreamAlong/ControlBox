// =====================================================================
// Rulebook AI Types
// Natural-language rulebook interpretation system
// =====================================================================

import type { Rule, PenaltyDefinition } from './rulebook.js';

/**
 * Confidence level for interpreted rules
 */
export type RuleConfidence = 'LOW' | 'MEDIUM' | 'HIGH';

/**
 * Category of interpreted rule
 */
export type RuleCategory =
    | 'INCIDENT'      // Contact, spin, off-track violations
    | 'PENALTY'       // Penalty definitions and escalations
    | 'START_PROC'    // Start procedure rules
    | 'RACE_CONTROL'  // Caution, restart, flag procedures
    | 'CONDUCT'       // Driver conduct, sportsmanship
    | 'OTHER';        // Uncategorized

/**
 * Status of an interpreted rule
 */
export type InterpretedRuleStatus = 'pending' | 'approved' | 'rejected' | 'edited';

/**
 * AI-interpreted rule from natural language
 */
export interface InterpretedRule {
    /** Unique ID for this interpretation */
    id: string;

    /** Original text snippet from the rulebook */
    originalText: string;

    /** Line numbers in source document */
    sourceLines?: { start: number; end: number };

    /** AI-generated summary of the rule */
    summary: string;

    /** Generated structured rule (RuleDefinition compatible) */
    structuredRule: Rule;

    /** Confidence level */
    confidence: RuleConfidence;

    /** Rule category */
    category: RuleCategory;

    /** Status of this interpretation */
    status: InterpretedRuleStatus;

    /** Admin notes/edits */
    adminNotes?: string;

    /** Timestamp */
    interpretedAt: Date;
}

/**
 * Rulebook interpretation session
 */
export interface InterpretationSession {
    /** Session ID */
    id: string;

    /** Target rulebook ID */
    rulebookId: string;

    /** Original uploaded file name */
    fileName: string;

    /** File type */
    fileType: 'txt' | 'md' | 'pdf';

    /** Total character count of source */
    sourceCharCount: number;

    /** Extracted raw text */
    extractedText: string;

    /** AI-interpreted rules */
    interpretedRules: InterpretedRule[];

    /** Session status */
    status: 'processing' | 'ready' | 'committed' | 'failed';

    /** Error message if failed */
    errorMessage?: string;

    /** Processing stats */
    stats: {
        totalRulesFound: number;
        approved: number;
        rejected: number;
        pending: number;
        byConfidence: {
            LOW: number;
            MEDIUM: number;
            HIGH: number;
        };
        byCategory: Record<RuleCategory, number>;
    };

    /** Created by user */
    createdBy: string;

    /** Timestamps */
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Request to interpret raw rulebook text
 */
export interface InterpretRulebookRequest {
    /** Raw text from uploaded file */
    rawText: string;

    /** Optional: file name for context */
    fileName?: string;

    /** Optional: league discipline (oval, road, etc.) for context */
    discipline?: string;

    /** Optional: hints for interpretation (e.g., rule section names) */
    hints?: Record<string, string>;
}

/**
 * Response from rulebook interpretation
 */
export interface InterpretRulebookResponse {
    /** Session ID for tracking */
    sessionId: string;

    /** Interpreted rules */
    rules: InterpretedRule[];

    /** Processing metadata */
    metadata: {
        processingTimeMs: number;
        sectionsFound: string[];
    };
}

/**
 * Request to commit approved rules
 */
export interface CommitRulesRequest {
    /** Rule IDs to commit (approved ones) */
    ruleIds: string[];
}

/**
 * Response from committing rules
 */
export interface CommitRulesResponse {
    /** Number of rules committed */
    committedCount: number;

    /** Committed rule IDs */
    committedRuleIds: string[];
}

/**
 * Bulk action on interpreted rules
 */
export interface BulkRuleAction {
    /** Action type */
    action: 'approve' | 'reject';

    /** Rule IDs to act on */
    ruleIds: string[];
}

/**
 * Simulation preview request
 */
export interface SimulationPreviewRequest {
    /** Rule to test */
    rule: Rule;

    /** Sample incident data */
    sampleIncident: {
        type: string;
        contactType?: string;
        severity: string;
        lapNumber: number;
        trackPosition?: number;
    };
}

/**
 * Simulation preview result
 */
export interface SimulationPreviewResult {
    /** Would this rule trigger? */
    wouldTrigger: boolean;

    /** Confidence of match */
    matchConfidence: number;

    /** Resulting penalty if triggered */
    resultingPenalty?: PenaltyDefinition;

    /** Explanation */
    explanation: string;

    /** Matched conditions */
    matchedConditions: string[];

    /** Unmatched conditions */
    unmatchedConditions: string[];
}

/**
 * Extracted trigger from natural language
 */
export interface ExtractedTrigger {
    type: 'contact' | 'off_track' | 'unsafe_rejoin' | 'spin' | 'blocking' | 'pit_violation' | 'yellow_flag' | 'other';
    confidence: RuleConfidence;
    sourceText: string;
}

/**
 * Extracted condition from natural language
 */
export interface ExtractedCondition {
    field: string;
    operator: string;
    value: unknown;
    confidence: RuleConfidence;
    sourceText: string;
}

/**
 * Extracted penalty from natural language
 */
export interface ExtractedPenalty {
    type: string;
    value?: string;
    points?: number;
    durationSeconds?: number;
    confidence: RuleConfidence;
    sourceText: string;
}
