// =====================================================================
// Condition Evaluator Unit Tests
// =====================================================================

import { ConditionEvaluator } from '../condition-evaluator';
import type { RuleCondition, IncidentEvent } from '@controlbox/common';

describe('ConditionEvaluator', () => {
    let evaluator: ConditionEvaluator;

    beforeEach(() => {
        evaluator = new ConditionEvaluator();
    });

    describe('basic operators', () => {
        it('should evaluate eq (equals) correctly', () => {
            // Field path is relative to the incident object directly
            const conditions: RuleCondition[] = [
                { field: 'type', operator: 'eq', value: 'contact' }
            ];

            const incident = createIncident({ type: 'contact' });
            expect(evaluator.evaluate(conditions, incident)).toBe(true);

            const otherIncident = createIncident({ type: 'spin' });
            expect(evaluator.evaluate(conditions, otherIncident)).toBe(false);
        });

        it('should evaluate neq (not equals) correctly', () => {
            const conditions: RuleCondition[] = [
                { field: 'type', operator: 'neq', value: 'spin' }
            ];

            const incident = createIncident({ type: 'contact' });
            expect(evaluator.evaluate(conditions, incident)).toBe(true);

            const spinIncident = createIncident({ type: 'spin' });
            expect(evaluator.evaluate(conditions, spinIncident)).toBe(false);
        });

        it('should evaluate gt (greater than) correctly', () => {
            const conditions: RuleCondition[] = [
                { field: 'severityScore', operator: 'gt', value: 50 }
            ];

            const highSeverity = createIncident({ severityScore: 75 });
            expect(evaluator.evaluate(conditions, highSeverity)).toBe(true);

            const lowSeverity = createIncident({ severityScore: 30 });
            expect(evaluator.evaluate(conditions, lowSeverity)).toBe(false);
        });

        it('should evaluate lt (less than) correctly', () => {
            const conditions: RuleCondition[] = [
                { field: 'lapNumber', operator: 'lt', value: 3 }
            ];

            const earlyLap = createIncident({ lapNumber: 1 });
            expect(evaluator.evaluate(conditions, earlyLap)).toBe(true);

            const lateLap = createIncident({ lapNumber: 10 });
            expect(evaluator.evaluate(conditions, lateLap)).toBe(false);
        });

        it('should evaluate gte (greater or equal) correctly', () => {
            const conditions: RuleCondition[] = [
                { field: 'severityScore', operator: 'gte', value: 50 }
            ];

            const exact = createIncident({ severityScore: 50 });
            expect(evaluator.evaluate(conditions, exact)).toBe(true);

            const above = createIncident({ severityScore: 60 });
            expect(evaluator.evaluate(conditions, above)).toBe(true);

            const below = createIncident({ severityScore: 49 });
            expect(evaluator.evaluate(conditions, below)).toBe(false);
        });

        it('should evaluate lte (less or equal) correctly', () => {
            const conditions: RuleCondition[] = [
                { field: 'lapNumber', operator: 'lte', value: 3 }
            ];

            const lap3 = createIncident({ lapNumber: 3 });
            expect(evaluator.evaluate(conditions, lap3)).toBe(true);

            const lap4 = createIncident({ lapNumber: 4 });
            expect(evaluator.evaluate(conditions, lap4)).toBe(false);
        });

        it('should evaluate in (in array) correctly', () => {
            const conditions: RuleCondition[] = [
                { field: 'type', operator: 'in', value: ['contact', 'spin', 'off_track'] }
            ];

            const contact = createIncident({ type: 'contact' });
            expect(evaluator.evaluate(conditions, contact)).toBe(true);

            const blocking = createIncident({ type: 'blocking' });
            expect(evaluator.evaluate(conditions, blocking)).toBe(false);
        });
    });

    describe('multiple conditions (AND logic)', () => {
        it('should require all conditions to match', () => {
            const conditions: RuleCondition[] = [
                { field: 'type', operator: 'eq', value: 'contact' },
                { field: 'severity', operator: 'eq', value: 'heavy' }
            ];

            // Both match
            const heavyContact = createIncident({ type: 'contact', severity: 'heavy' });
            expect(evaluator.evaluate(conditions, heavyContact)).toBe(true);

            // Only type matches
            const lightContact = createIncident({ type: 'contact', severity: 'light' });
            expect(evaluator.evaluate(conditions, lightContact)).toBe(false);

            // Only severity matches
            const heavySpin = createIncident({ type: 'spin', severity: 'heavy' });
            expect(evaluator.evaluate(conditions, heavySpin)).toBe(false);
        });
    });

    describe('nested object fields', () => {
        it('should access nested fields with dot notation', () => {
            const conditions: RuleCondition[] = [
                { field: 'context.isUnderCaution', operator: 'eq', value: true }
            ];

            const underCaution = createIncident({});
            (underCaution as Record<string, unknown>).context = { isUnderCaution: true };
            expect(evaluator.evaluate(conditions, underCaution)).toBe(true);

            const greenFlag = createIncident({});
            (greenFlag as Record<string, unknown>).context = { isUnderCaution: false };
            expect(evaluator.evaluate(conditions, greenFlag)).toBe(false);
        });
    });

    describe('edge cases', () => {
        it('should return true for empty conditions', () => {
            const conditions: RuleCondition[] = [];
            const incident = createIncident({});
            expect(evaluator.evaluate(conditions, incident)).toBe(true);
        });

        it('should handle missing fields gracefully', () => {
            const conditions: RuleCondition[] = [
                { field: 'nonexistent.field', operator: 'eq', value: 'test' }
            ];
            const incident = createIncident({});
            expect(evaluator.evaluate(conditions, incident)).toBe(false);
        });
    });
});

// Helper to create incident objects
function createIncident(overrides: Partial<IncidentEvent>): IncidentEvent {
    return {
        id: 'test-incident',
        sessionId: 'test-session',
        type: 'contact',
        severity: 'medium',
        severityScore: 50,
        lapNumber: 5,
        timestamp: new Date(),
        drivers: [],
        ...overrides
    } as IncidentEvent;
}
