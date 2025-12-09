// =====================================================================
// Steward Advisor Service Unit Tests
// =====================================================================

import { StewardAdvisorService } from '../steward-advisor';
import type { Rule, IncidentEvent } from '@controlbox/common';

describe('StewardAdvisorService', () => {
    let service: StewardAdvisorService;

    beforeEach(() => {
        service = new StewardAdvisorService();
    });

    describe('generateAdvice', () => {
        it('should return no-rules advice when no rules match', () => {
            const incident = createIncident({ type: 'contact', severity: 'medium' });
            const rules: Rule[] = [];

            const advice = service.generateAdvice(incident, rules);

            expect(advice.length).toBe(1);
            expect(advice[0].summary).toContain('No matching rules');
            expect(advice[0].confidence).toBe('LOW');
            expect(advice[0].flags.some(f => f.type === 'LOW_DATA')).toBe(true);
        });

        it('should match rules based on incident type', () => {
            const incident = createIncident({ type: 'contact', severity: 'medium', severityScore: 60 });
            const rules: Rule[] = [
                createRule({
                    id: 'rule-1',
                    reference: '3.1',
                    conditions: [{ field: 'type', operator: 'eq', value: 'contact' }],
                    penalty: { type: 'time_penalty', value: '5 seconds' }
                })
            ];

            const advice = service.generateAdvice(incident, rules);

            expect(advice.length).toBe(1);
            expect(advice[0].applicableRules).toContain('3.1');
            expect(advice[0].summary).toContain('time penalty');
        });

        it('should detect conflicting rules', () => {
            const incident = createIncident({ type: 'contact', severity: 'heavy', severityScore: 75 });
            const rules: Rule[] = [
                createRule({
                    id: 'rule-1',
                    reference: '3.1',
                    conditions: [{ field: 'type', operator: 'eq', value: 'contact' }],
                    penalty: { type: 'time_penalty', value: '5 seconds' }
                }),
                createRule({
                    id: 'rule-2',
                    reference: '3.2',
                    conditions: [{ field: 'type', operator: 'eq', value: 'contact' }],
                    penalty: { type: 'drive_through' }
                })
            ];

            const advice = service.generateAdvice(incident, rules);

            // Should have summary + 2 rule advices
            expect(advice.length).toBe(3);
            // First should be summary with conflict warning
            expect(advice[0].summary).toContain('conflicting');
            expect(advice[0].flags.some(f => f.type === 'CONFLICTING_RULE')).toBe(true);
        });

        it('should flag severity mismatch', () => {
            const incident = createIncident({ type: 'contact', severity: 'light', severityScore: 20 });
            const rules: Rule[] = [
                createRule({
                    id: 'rule-1',
                    reference: '3.1',
                    conditions: [{ field: 'type', operator: 'eq', value: 'contact' }],
                    penalty: { type: 'disqualification' } // Very severe for low severity incident
                })
            ];

            const advice = service.generateAdvice(incident, rules);

            expect(advice.length).toBe(1);
            expect(advice[0].flags.some(f => f.type === 'SEVERITY_MISMATCH')).toBe(true);
            expect(advice[0].confidence).not.toBe('HIGH');
        });

        it('should provide alternatives including racing incident option', () => {
            const incident = createIncident({ type: 'contact', severity: 'medium', severityScore: 50 });
            const rules: Rule[] = [
                createRule({
                    id: 'rule-1',
                    reference: '3.1',
                    conditions: [{ field: 'type', operator: 'eq', value: 'contact' }],
                    penalty: { type: 'warning' }
                })
            ];

            const advice = service.generateAdvice(incident, rules);

            expect(advice[0].alternatives.length).toBeGreaterThan(0);
            expect(advice[0].alternatives.some(a => a.label === 'Racing Incident')).toBe(true);
        });

        it('should suggest enhanced penalty for repeat offenses', () => {
            const incident = createIncident({ type: 'contact', severity: 'medium', severityScore: 55 });
            const rules: Rule[] = [
                createRule({
                    id: 'rule-1',
                    reference: '3.1',
                    conditions: [{ field: 'type', operator: 'eq', value: 'contact' }],
                    penalty: { type: 'time_penalty', value: '5 seconds' }
                })
            ];

            const advice = service.generateAdvice(incident, rules, { isRepeatOffense: true });

            expect(advice[0].alternatives.some(a => a.label === 'Enhanced Penalty')).toBe(true);
            expect(advice[0].reasoning).toContain('repeat offense');
        });

        it('should skip inactive rules', () => {
            const incident = createIncident({ type: 'contact', severity: 'medium' });
            const rules: Rule[] = [
                createRule({
                    id: 'rule-1',
                    reference: '3.1',
                    isActive: false,
                    conditions: [{ field: 'type', operator: 'eq', value: 'contact' }],
                    penalty: { type: 'warning' }
                })
            ];

            const advice = service.generateAdvice(incident, rules);

            expect(advice[0].summary).toContain('No matching rules');
        });

        it('should include applicable rule references', () => {
            const incident = createIncident({ type: 'off_track', severity: 'light', severityScore: 25 });
            const rules: Rule[] = [
                createRule({
                    id: 'rule-1',
                    reference: '4.2.1',
                    conditions: [{ field: 'type', operator: 'eq', value: 'off_track' }],
                    penalty: { type: 'warning' }
                })
            ];

            const advice = service.generateAdvice(incident, rules);

            expect(advice[0].applicableRules).toEqual(['4.2.1']);
        });
    });

    describe('condition matching', () => {
        it('should match eq operator', () => {
            const incident = createIncident({ type: 'spin' });
            const rules: Rule[] = [
                createRule({
                    conditions: [{ field: 'type', operator: 'eq', value: 'spin' }],
                    penalty: { type: 'warning' }
                })
            ];

            const advice = service.generateAdvice(incident, rules);
            expect(advice[0].applicableRules.length).toBeGreaterThan(0);
        });

        it('should match in operator', () => {
            const incident = createIncident({ type: 'contact' });
            const rules: Rule[] = [
                createRule({
                    conditions: [{ field: 'type', operator: 'in', value: ['contact', 'spin', 'off_track'] }],
                    penalty: { type: 'warning' }
                })
            ];

            const advice = service.generateAdvice(incident, rules);
            expect(advice[0].applicableRules.length).toBeGreaterThan(0);
        });

        it('should match gt operator for numeric fields', () => {
            const incident = createIncident({ severityScore: 80 });
            const rules: Rule[] = [
                createRule({
                    conditions: [{ field: 'severityScore', operator: 'gt', value: 70 }],
                    penalty: { type: 'drive_through' }
                })
            ];

            const advice = service.generateAdvice(incident, rules);
            expect(advice[0].applicableRules.length).toBeGreaterThan(0);
        });
    });
});

// Helper functions
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

function createRule(overrides: Partial<Rule>): Rule {
    return {
        id: 'test-rule',
        reference: 'TEST.1',
        title: 'Test Rule',
        description: 'A test rule',
        conditions: [],
        penalty: { type: 'warning' },
        priority: 50,
        isActive: true,
        ...overrides
    } as Rule;
}
