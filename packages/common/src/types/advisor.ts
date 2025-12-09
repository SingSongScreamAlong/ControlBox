// =====================================================================
// Steward Advisor Types
// AI-assisted advisory guidance for incident review
// 
// IMPORTANT: iRacing's SDK is READ-ONLY for external applications.
// ControlBox can NEVER control the sim, throw flags, or apply penalties.
// All advisor outputs are RECOMMENDATIONS for human stewards only.
// =====================================================================

/**
 * Types of advisory flags that indicate special conditions
 */
export type AdvisorFlagType =
    | 'CONFLICTING_RULE'   // Multiple rules apply with different outcomes
    | 'LOW_DATA'           // Insufficient data for confident decision
    | 'AMBIGUITY'          // Rule interpretation is ambiguous
    | 'SEVERITY_MISMATCH'; // Severity doesn't match rule expectations

/**
 * Confidence level for advisor recommendations
 */
export type AdvisorConfidence = 'LOW' | 'MEDIUM' | 'HIGH';

/**
 * Advisory flag with contextual message
 */
export interface AdvisorFlag {
    type: AdvisorFlagType;
    message: string;
}

/**
 * Alternative outcome suggestion
 */
export interface AlternativeOutcome {
    label: string;
    description: string;
    consequence: string;
}

/**
 * Suggested flag state (ADVISORY ONLY - ControlBox cannot control iRacing)
 * This is purely informational for stewards to consider.
 */
export type SuggestedFlagState =
    | 'GREEN'           // No action needed, racing continues
    | 'LOCAL_YELLOW'    // Suggest local caution at incident location
    | 'FULL_CAUTION'    // Suggest full course caution
    | 'NO_CHANGE'       // No flag state change recommended
    | 'UNCLEAR';        // Insufficient data to suggest flag state

/**
 * Structured advice from steward advisor
 * 
 * CRITICAL: Advisors NEVER apply penalties or control flags.
 * iRacing's SDK does not allow external control of the simulation.
 * All advice is purely informational for human steward decision-making.
 */
export interface StewardAdvice {
    /** Unique advice identifier */
    id: string;
    /** Brief summary of the advice */
    summary: string;
    /** Distilled reasoning (no raw chain-of-thought) */
    reasoning: string;
    /** References to applicable RAID rulebook entries */
    applicableRules: string[];
    /** Confidence level of the advice */
    confidence: AdvisorConfidence;
    /** Alternative interpretations and outcomes */
    alternatives: AlternativeOutcome[];
    /** Flags indicating special conditions */
    flags: AdvisorFlag[];
    /** 
     * Suggested flag state (ADVISORY ONLY)
     * ControlBox cannot control iRacing — this is purely for steward reference
     */
    suggestedFlagState?: SuggestedFlagState;
    /** ISO timestamp when advice was generated */
    generatedAt: string;
}

/**
 * Request to generate steward advice
 */
export interface GenerateAdviceRequest {
    incidentId: string;
}

/**
 * Response containing steward advice
 */
export interface GenerateAdviceResponse {
    success: boolean;
    data?: StewardAdvice[];
    error?: string;
}

/**
 * Audit log entry for advisor generation
 */
export interface AdvisorAuditEntry {
    type: 'ADVISOR_GENERATED';
    incidentId: string;
    ruleIdsUsed: string[];
    confidenceLevels: AdvisorConfidence[];
    timestamp: Date;
    stewardUserId: string;
}
