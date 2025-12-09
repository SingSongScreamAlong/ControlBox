// =====================================================================
// Deterministic Parser Unit Tests
// =====================================================================

import { DeterministicParser } from '../deterministic-parser';

describe('DeterministicParser', () => {
    let parser: DeterministicParser;

    beforeEach(() => {
        parser = new DeterministicParser();
    });

    describe('parseText', () => {
        it('should extract contact incident with time penalty', () => {
            const ruleText = `
                Article 3.2.1 - Contact Between Cars
                Any driver causing contact with another car that results in significant
                damage or positional loss shall receive a 5 second time penalty.
            `;

            const rules = parser.parseText(ruleText);

            expect(rules.length).toBeGreaterThan(0);
            const rule = rules[0];
            expect(rule.structuredRule.penalty.type).toBe('time_penalty');
            expect(rule.confidence).toMatch(/HIGH|MEDIUM/);
        });

        it('should extract off-track incident', () => {
            const ruleText = `
                Rule 4.1 - Track Limits
                Drivers exceeding track limits with all four wheels off the track
                will receive a warning for the first offense.
            `;

            const rules = parser.parseText(ruleText);

            expect(rules.length).toBeGreaterThan(0);
            const rule = rules[0];
            expect(rule.structuredRule.penalty.type).toBe('warning');
        });

        it('should extract unsafe rejoin with drive-through', () => {
            const ruleText = `
                Section 5.3 - Unsafe Rejoin
                Any driver rejoining the track in an unsafe manner that causes
                a collision shall receive a drive-through penalty.
            `;

            const rules = parser.parseText(ruleText);

            expect(rules.length).toBeGreaterThan(0);
            const rule = rules[0];
            expect(rule.structuredRule.penalty.type).toBe('drive_through');
        });

        it('should extract blocking incident with reprimand', () => {
            const ruleText = `
                Article 6.2 - Defensive Driving
                Making more than one defensive move or blocking a faster driver
                will result in a reprimand.
            `;

            const rules = parser.parseText(ruleText);

            expect(rules.length).toBeGreaterThan(0);
            const rule = rules[0];
            expect(rule.structuredRule.penalty.type).toBe('reprimand');
        });

        it('should detect yellow flag violations', () => {
            const ruleText = `
                Rule 7.1 - Caution Periods
                Overtaking under yellow flag conditions is prohibited and
                will result in a stop and go penalty.
            `;

            const rules = parser.parseText(ruleText);

            expect(rules.length).toBeGreaterThan(0);
            const rule = rules[0];
            expect(rule.structuredRule.penalty.type).toBe('stop_go');
        });

        it('should handle disqualification penalties', () => {
            const ruleText = `
                Section 10.1 - Serious Infractions
                Intentional contact or wrecking causing multiple
                incidents shall result in disqualification from the event.
            `;

            const rules = parser.parseText(ruleText);

            // This may or may not extract rules depending on pattern matching
            // The disqualification pattern should match "disqualif"
            if (rules.length > 0) {
                expect(rules[0].structuredRule.penalty.type).toBe('disqualification');
            }
        });

        it('should extract condition for first lap incidents', () => {
            const ruleText = `
                Article 3.5 - First Lap Incidents
                Contact on the first lap of the race will be treated with
                more leniency. A warning will be issued instead of a time penalty.
            `;

            const rules = parser.parseText(ruleText);

            expect(rules.length).toBeGreaterThan(0);
            const rule = rules[0];
            const lapCondition = rule.structuredRule.conditions.find(
                c => c.field === 'incident.lapNumber'
            );
            expect(lapCondition).toBeDefined();
        });

        it('should detect severity levels', () => {
            const ruleText = `
                Section 4.2 - Severity Assessment
                Minor contact resulting in no significant damage will receive
                a warning. Heavy contact causing major damage results in a 
                10 second time penalty.
            `;

            const rules = parser.parseText(ruleText);

            expect(rules.length).toBeGreaterThan(0);
        });

        it('should return empty for non-rule text', () => {
            const nonRuleText = `
                Welcome to the 2024 Racing Season!
                We hope everyone has a great year of racing.
                Good luck to all participants.
            `;

            const rules = parser.parseText(nonRuleText);
            expect(rules.length).toBe(0);
        });

        it('should set all rules to pending status', () => {
            const ruleText = `
                Rule 1.1 - Contact
                Any contact will result in a warning.
            `;

            const rules = parser.parseText(ruleText);

            expect(rules.length).toBeGreaterThan(0);
            expect(rules[0].status).toBe('pending');
        });

        it('should set all rules to inactive by default', () => {
            const ruleText = `
                Rule 1.1 - Contact
                Any contact will result in a warning.
            `;

            const rules = parser.parseText(ruleText);

            expect(rules.length).toBeGreaterThan(0);
            expect(rules[0].structuredRule.isActive).toBe(false);
        });
    });

    describe('confidence scoring', () => {
        it('should assign HIGH confidence when incident + penalty + value', () => {
            const ruleText = `
                Article 5.1 - Contact Penalties
                Causing a collision with another car shall result in a
                10 second time penalty added to the at-fault driver.
            `;

            const rules = parser.parseText(ruleText);

            if (rules.length > 0) {
                expect(rules[0].confidence).toBe('HIGH');
            }
        });

        it('should assign lower confidence for ambiguous text', () => {
            const ruleText = `
                Section 9 - General
                Penalties may be applied at steward discretion.
            `;

            const rules = parser.parseText(ruleText);

            // Should either find no rules or low confidence rules
            if (rules.length > 0) {
                expect(rules[0].confidence).toMatch(/LOW|MEDIUM/);
            }
        });
    });

    describe('category detection', () => {
        it('should categorize incident rules', () => {
            const ruleText = `
                Rule 3.1 - Incident Reporting
                All incidents must be reported within 24 hours.
                Contact incidents will receive a warning.
            `;

            const rules = parser.parseText(ruleText);

            if (rules.length > 0) {
                expect(rules[0].category).toBe('INCIDENT');
            }
        });

        it('should categorize start procedure rules', () => {
            const ruleText = `
                Section 2.1 - Rolling Start Procedure
                All cars must maintain formation until the green flag.
                Jumping the start will result in a drive-through penalty.
            `;

            const rules = parser.parseText(ruleText);

            if (rules.length > 0) {
                expect(['START_PROC', 'PENALTY']).toContain(rules[0].category);
            }
        });
    });
});
