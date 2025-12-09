// =====================================================================
// Validators
// Runtime validation utilities for ControlBox data structures
// =====================================================================

/**
 * Validation result
 */
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
}

/**
 * Validate a telemetry frame structure
 */
export function validateTelemetryFrame(frame: unknown): ValidationResult {
    const errors: string[] = [];

    if (!frame || typeof frame !== 'object') {
        return { isValid: false, errors: ['Frame must be an object'] };
    }

    const f = frame as Record<string, unknown>;

    if (typeof f.timestamp !== 'number') {
        errors.push('timestamp must be a number');
    }
    if (typeof f.sessionTimeMs !== 'number') {
        errors.push('sessionTimeMs must be a number');
    }
    if (typeof f.frameId !== 'number') {
        errors.push('frameId must be a number');
    }
    if (!f.session || typeof f.session !== 'object') {
        errors.push('session must be an object');
    }
    if (!Array.isArray(f.drivers)) {
        errors.push('drivers must be an array');
    }

    return { isValid: errors.length === 0, errors };
}

/**
 * Validate driver telemetry structure
 */
export function validateDriverTelemetry(driver: unknown): ValidationResult {
    const errors: string[] = [];

    if (!driver || typeof driver !== 'object') {
        return { isValid: false, errors: ['Driver must be an object'] };
    }

    const d = driver as Record<string, unknown>;

    if (typeof d.driverId !== 'string' || !d.driverId) {
        errors.push('driverId must be a non-empty string');
    }
    if (typeof d.lapDistPct !== 'number' || d.lapDistPct < 0 || d.lapDistPct > 1) {
        errors.push('lapDistPct must be between 0 and 1');
    }
    if (typeof d.speed !== 'number' || d.speed < 0) {
        errors.push('speed must be a non-negative number');
    }

    return { isValid: errors.length === 0, errors };
}

/**
 * Validate an incident event
 */
export function validateIncidentEvent(incident: unknown): ValidationResult {
    const errors: string[] = [];

    if (!incident || typeof incident !== 'object') {
        return { isValid: false, errors: ['Incident must be an object'] };
    }

    const i = incident as Record<string, unknown>;

    if (typeof i.id !== 'string' || !i.id) {
        errors.push('id must be a non-empty string');
    }
    if (typeof i.sessionId !== 'string' || !i.sessionId) {
        errors.push('sessionId must be a non-empty string');
    }
    if (typeof i.type !== 'string') {
        errors.push('type must be a string');
    }
    if (!['light', 'medium', 'heavy'].includes(i.severity as string)) {
        errors.push('severity must be light, medium, or heavy');
    }
    if (!Array.isArray(i.involvedDrivers) || i.involvedDrivers.length === 0) {
        errors.push('involvedDrivers must be a non-empty array');
    }

    return { isValid: errors.length === 0, errors };
}

/**
 * Validate a severity score
 */
export function validateSeverityScore(score: unknown): ValidationResult {
    const errors: string[] = [];

    if (typeof score !== 'number') {
        errors.push('score must be a number');
    } else if (score < 0 || score > 100) {
        errors.push('score must be between 0 and 100');
    }

    return { isValid: errors.length === 0, errors };
}

/**
 * Validate a rulebook structure
 */
export function validateRulebook(rulebook: unknown): ValidationResult {
    const errors: string[] = [];

    if (!rulebook || typeof rulebook !== 'object') {
        return { isValid: false, errors: ['Rulebook must be an object'] };
    }

    const r = rulebook as Record<string, unknown>;

    if (typeof r.name !== 'string' || !r.name) {
        errors.push('name must be a non-empty string');
    }
    if (typeof r.leagueName !== 'string' || !r.leagueName) {
        errors.push('leagueName must be a non-empty string');
    }
    if (!Array.isArray(r.rules)) {
        errors.push('rules must be an array');
    }
    if (!r.penaltyMatrix || typeof r.penaltyMatrix !== 'object') {
        errors.push('penaltyMatrix must be an object');
    }

    return { isValid: errors.length === 0, errors };
}

/**
 * Validate a rule condition
 */
export function validateRuleCondition(condition: unknown): ValidationResult {
    const errors: string[] = [];

    if (!condition || typeof condition !== 'object') {
        return { isValid: false, errors: ['Condition must be an object'] };
    }

    const c = condition as Record<string, unknown>;

    if (typeof c.field !== 'string' || !c.field) {
        errors.push('field must be a non-empty string');
    }

    const validOperators = ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'in', 'nin', 'contains', 'exists', 'regex'];
    if (!validOperators.includes(c.operator as string)) {
        errors.push(`operator must be one of: ${validOperators.join(', ')}`);
    }

    return { isValid: errors.length === 0, errors };
}

/**
 * Check if a value is a valid UUID
 */
export function isValidUuid(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
}

/**
 * Check if a value is a valid session ID (external)
 */
export function isValidSessionId(value: unknown): boolean {
    return typeof value === 'string' && value.length > 0 && value.length <= 255;
}
