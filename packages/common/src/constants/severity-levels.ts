// =====================================================================
// Severity Level Constants
// Thresholds and configurations for severity scoring
// =====================================================================

import type { SeverityLevel } from '../types/incident.js';

/**
 * Severity level codes
 */
export const SEVERITY_LEVELS = {
    LIGHT: 'light',
    MEDIUM: 'medium',
    HEAVY: 'heavy',
} as const;

/**
 * Severity score thresholds
 * Score ranges for each severity level
 */
export const SEVERITY_SCORE_THRESHOLDS = {
    light: { min: 0, max: 33 },
    medium: { min: 34, max: 66 },
    heavy: { min: 67, max: 100 },
} as const;

/**
 * Get severity level from numeric score
 */
export function getSeverityFromScore(score: number): SeverityLevel {
    if (score <= SEVERITY_SCORE_THRESHOLDS.light.max) {
        return 'light';
    } else if (score <= SEVERITY_SCORE_THRESHOLDS.medium.max) {
        return 'medium';
    }
    return 'heavy';
}

/**
 * Severity colors for UI display (CSS color values)
 */
export const SEVERITY_COLORS: Record<SeverityLevel, { bg: string; text: string; border: string }> = {
    light: {
        bg: '#fef3c7',     // amber-100
        text: '#92400e',   // amber-800
        border: '#f59e0b', // amber-500
    },
    medium: {
        bg: '#fed7aa',     // orange-200
        text: '#c2410c',   // orange-700
        border: '#f97316', // orange-500
    },
    heavy: {
        bg: '#fee2e2',     // red-100
        text: '#991b1b',   // red-800
        border: '#ef4444', // red-500
    },
};

/**
 * Severity labels for display
 */
export const SEVERITY_LABELS: Record<SeverityLevel, string> = {
    light: 'Light',
    medium: 'Medium',
    heavy: 'Heavy',
};

/**
 * Severity icons (emoji for simple display)
 */
export const SEVERITY_ICONS: Record<SeverityLevel, string> = {
    light: '⚡',
    medium: '⚠️',
    heavy: '🔴',
};

/**
 * Impact factors for severity calculation
 */
export const SEVERITY_IMPACT_FACTORS = {
    // Base factors (0-1 weight)
    speedDifferential: 0.3,      // How different speeds were at contact
    positionLoss: 0.25,          // How many positions were lost
    offTrackResult: 0.2,         // Did the victim go off track
    spinResult: 0.15,            // Did the victim spin
    cornerPhase: 0.1,            // Where in the corner (entry vs apex vs exit)

    // Modifiers (multipliers)
    intentionalBonus: 1.5,       // If deemed intentional
    repeatOffenderBonus: 1.25,   // If repeat offender
    safetyCarCausedBonus: 1.5,   // If caused safety car
    retirementCausedBonus: 1.75, // If caused retirement
} as const;
