// =====================================================================
// Condition Evaluator
// Evaluates rule conditions against incidents
// =====================================================================

import type { RuleCondition, IncidentEvent } from '@controlbox/common';

export class ConditionEvaluator {
    /**
     * Evaluate a set of conditions against an incident
     * All top-level conditions must match (AND logic)
     */
    evaluate(conditions: RuleCondition[], incident: IncidentEvent): boolean {
        for (const condition of conditions) {
            if (!this.evaluateCondition(condition, incident)) {
                return false;
            }
        }
        return true;
    }

    private evaluateCondition(condition: RuleCondition, incident: IncidentEvent): boolean {
        // Evaluate nested AND conditions
        if (condition.and && condition.and.length > 0) {
            for (const nested of condition.and) {
                if (!this.evaluateCondition(nested, incident)) {
                    return false;
                }
            }
        }

        // Evaluate nested OR conditions
        if (condition.or && condition.or.length > 0) {
            let anyMatch = false;
            for (const nested of condition.or) {
                if (this.evaluateCondition(nested, incident)) {
                    anyMatch = true;
                    break;
                }
            }
            if (!anyMatch) return false;
        }

        // Evaluate the main condition
        const value = this.getFieldValue(condition.field, incident);
        return this.compareValues(value, condition.operator, condition.value);
    }

    private getFieldValue(field: string, incident: IncidentEvent): unknown {
        // Parse dot-notation field path
        const parts = field.split('.');
        let current: unknown = incident;

        for (const part of parts) {
            if (current === null || current === undefined) {
                return undefined;
            }

            if (typeof current === 'object') {
                current = (current as Record<string, unknown>)[part];
            } else {
                return undefined;
            }
        }

        return current;
    }

    private compareValues(actual: unknown, operator: string, expected: unknown): boolean {
        switch (operator) {
            case 'eq':
                return actual === expected;

            case 'neq':
                return actual !== expected;

            case 'gt':
                return typeof actual === 'number' && typeof expected === 'number' && actual > expected;

            case 'lt':
                return typeof actual === 'number' && typeof expected === 'number' && actual < expected;

            case 'gte':
                return typeof actual === 'number' && typeof expected === 'number' && actual >= expected;

            case 'lte':
                return typeof actual === 'number' && typeof expected === 'number' && actual <= expected;

            case 'in':
                return Array.isArray(expected) && expected.includes(actual);

            case 'nin':
                return Array.isArray(expected) && !expected.includes(actual);

            case 'contains':
                return typeof actual === 'string' && typeof expected === 'string' && actual.includes(expected);

            case 'exists':
                return expected ? actual !== undefined && actual !== null : actual === undefined || actual === null;

            case 'regex':
                if (typeof actual !== 'string' || typeof expected !== 'string') return false;
                try {
                    return new RegExp(expected).test(actual);
                } catch {
                    return false;
                }

            default:
                console.warn(`Unknown operator: ${operator}`);
                return false;
        }
    }
}
