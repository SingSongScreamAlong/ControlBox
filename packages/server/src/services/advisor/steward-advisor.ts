// =====================================================================
// Steward Advisor Service
// AI-assisted advisory guidance for incident review
//
// IMPORTANT: iRacing's SDK is READ-ONLY for external applications.
// ControlBox can NEVER control the simulation — no throwing flags,
// no applying penalties, no modifying game state.
//
// Advisors provide RECOMMENDATIONS ONLY for human stewards.
// This includes suggested flag states, which are purely informational.
// =====================================================================

import { v4 as uuid } from 'uuid';
import type {
    StewardAdvice,
    AdvisorFlag,
    AlternativeOutcome,
    AdvisorConfidence
    // SuggestedFlagState available for future flag state recommendations
} from '@controlbox/common';
import type { Rule, IncidentEvent } from '@controlbox/common';

// Severity thresholds for rule expectations
const SEVERITY_THRESHOLDS: Record<string, { min: number; max: number }> = {
    warning: { min: 0, max: 30 },
    reprimand: { min: 20, max: 50 },
    time_penalty: { min: 40, max: 70 },
    position_penalty: { min: 50, max: 80 },
    drive_through: { min: 60, max: 90 },
    stop_go: { min: 70, max: 95 },
    disqualification: { min: 85, max: 100 }
};

export class StewardAdvisorService {
    /**
     * Generate advice for an incident based on applicable rules
     */
    generateAdvice(
        incident: IncidentEvent,
        rules: Rule[],
        context?: {
            previousIncidents?: number;
            isRepeatOffense?: boolean;
            sessionType?: string;
        }
    ): StewardAdvice[] {
        const advice: StewardAdvice[] = [];
        const applicableRules = this.findApplicableRules(incident, rules);

        if (applicableRules.length === 0) {
            // No matching rules found
            advice.push(this.createNoRulesAdvice(incident));
            return advice;
        }

        // Check for conflicting rules
        const conflicts = this.detectConflicts(applicableRules);

        // Generate advice for each applicable rule
        for (const rule of applicableRules) {
            const ruleAdvice = this.generateRuleAdvice(
                incident,
                rule,
                conflicts,
                context
            );
            advice.push(ruleAdvice);
        }

        // If multiple rules apply, add summary advice
        if (applicableRules.length > 1) {
            advice.unshift(this.createSummaryAdvice(applicableRules, conflicts));
        }

        return advice;
    }

    /**
     * Find rules that match the incident
     */
    private findApplicableRules(incident: IncidentEvent, rules: Rule[]): Rule[] {
        return rules.filter(rule => {
            if (!rule.isActive) return false;

            // Check if any condition matches
            for (const condition of rule.conditions) {
                if (this.matchesCondition(incident, condition)) {
                    return true;
                }
            }
            return false;
        });
    }

    /**
     * Check if incident matches a condition
     */
    private matchesCondition(
        incident: IncidentEvent,
        condition: { field: string; operator: string; value: unknown }
    ): boolean {
        const fieldValue = this.getFieldValue(incident, condition.field);

        switch (condition.operator) {
            case 'eq':
                return fieldValue === condition.value;
            case 'neq':
                return fieldValue !== condition.value;
            case 'in':
                return Array.isArray(condition.value) && condition.value.includes(fieldValue);
            case 'gt':
                return typeof fieldValue === 'number' && typeof condition.value === 'number' && fieldValue > condition.value;
            case 'gte':
                return typeof fieldValue === 'number' && typeof condition.value === 'number' && fieldValue >= condition.value;
            case 'lt':
                return typeof fieldValue === 'number' && typeof condition.value === 'number' && fieldValue < condition.value;
            case 'lte':
                return typeof fieldValue === 'number' && typeof condition.value === 'number' && fieldValue <= condition.value;
            default:
                return false;
        }
    }

    /**
     * Get field value from incident using dot notation
     */
    private getFieldValue(incident: IncidentEvent, field: string): unknown {
        const parts = field.split('.');
        let current: unknown = incident;

        for (const part of parts) {
            if (current === null || current === undefined) return undefined;
            if (typeof current === 'object') {
                current = (current as Record<string, unknown>)[part];
            } else {
                return undefined;
            }
        }
        return current;
    }

    /**
     * Detect conflicting rules
     */
    private detectConflicts(rules: Rule[]): Map<string, string[]> {
        const conflicts = new Map<string, string[]>();

        // Group by penalty type
        const byPenalty: Map<string, Rule[]> = new Map();
        for (const rule of rules) {
            const penaltyType = rule.penalty.type;
            if (!byPenalty.has(penaltyType)) {
                byPenalty.set(penaltyType, []);
            }
            byPenalty.get(penaltyType)!.push(rule);
        }

        // If different penalty types, mark as conflict
        if (byPenalty.size > 1) {
            const conflictingRuleIds: string[] = [];
            for (const [penaltyType, penaltyRules] of byPenalty) {
                for (const rule of penaltyRules) {
                    conflictingRuleIds.push(rule.id);
                    if (!conflicts.has(rule.id)) {
                        conflicts.set(rule.id, []);
                    }
                    conflicts.get(rule.id)!.push(
                        `Conflicts with rules suggesting ${penaltyType}`
                    );
                }
            }
        }

        return conflicts;
    }

    /**
     * Generate advice for a specific rule
     */
    private generateRuleAdvice(
        incident: IncidentEvent,
        rule: Rule,
        conflicts: Map<string, string[]>,
        context?: {
            previousIncidents?: number;
            isRepeatOffense?: boolean;
            sessionType?: string;
        }
    ): StewardAdvice {
        const flags: AdvisorFlag[] = [];
        const alternatives: AlternativeOutcome[] = [];
        let confidence: AdvisorConfidence = 'HIGH';

        // Check severity match
        const severityMatch = this.checkSeverityMatch(incident, rule);
        if (!severityMatch.matches) {
            flags.push({
                type: 'SEVERITY_MISMATCH',
                message: severityMatch.reason
            });
            confidence = this.lowerConfidence(confidence);
        }

        // Check for conflicts
        if (conflicts.has(rule.id)) {
            flags.push({
                type: 'CONFLICTING_RULE',
                message: conflicts.get(rule.id)!.join('; ')
            });
            confidence = this.lowerConfidence(confidence);
        }

        // Check for ambiguity
        if (rule.conditions.length === 0 || !rule.description) {
            flags.push({
                type: 'AMBIGUITY',
                message: 'Rule conditions or description may be incomplete'
            });
            confidence = this.lowerConfidence(confidence);
        }

        // Generate alternatives
        alternatives.push(...this.generateAlternatives(rule, incident, context));

        // Build summary
        const summary = this.buildSummary(rule, incident);
        const reasoning = this.buildReasoning(rule, incident, severityMatch, context);

        return {
            id: uuid(),
            summary,
            reasoning,
            applicableRules: [rule.reference],
            confidence,
            alternatives,
            flags,
            generatedAt: new Date().toISOString()
        };
    }

    /**
     * Create advice when no rules match
     */
    private createNoRulesAdvice(incident: IncidentEvent): StewardAdvice {
        return {
            id: uuid(),
            summary: 'No matching rules found for this incident',
            reasoning: `The incident of type "${incident.type}" with severity "${incident.severity}" does not match any active rules in the current rulebook. Manual review by stewards is recommended.`,
            applicableRules: [],
            confidence: 'LOW',
            alternatives: [
                {
                    label: 'No Action',
                    description: 'Treat as racing incident with no penalty',
                    consequence: 'Incident noted but no penalty applied'
                },
                {
                    label: 'Steward Review',
                    description: 'Escalate to full steward panel for review',
                    consequence: 'Extended review time, potential penalty after deliberation'
                }
            ],
            flags: [
                {
                    type: 'LOW_DATA',
                    message: 'No rules matched — requires manual assessment'
                }
            ],
            generatedAt: new Date().toISOString()
        };
    }

    /**
     * Create summary advice when multiple rules apply
     */
    private createSummaryAdvice(rules: Rule[], conflicts: Map<string, string[]>): StewardAdvice {
        const hasConflicts = conflicts.size > 0;
        const ruleRefs = rules.map(r => r.reference);

        return {
            id: uuid(),
            summary: hasConflicts
                ? `Multiple conflicting rules apply (${rules.length} rules)`
                : `Multiple rules apply (${rules.length} rules)`,
            reasoning: hasConflicts
                ? `The following rules have conflicting recommendations: ${ruleRefs.join(', ')}. Steward judgment required to determine precedence.`
                : `Multiple rules match this incident: ${ruleRefs.join(', ')}. Consider the most specific or highest priority rule.`,
            applicableRules: ruleRefs,
            confidence: hasConflicts ? 'LOW' : 'MEDIUM',
            alternatives: [],
            flags: hasConflicts
                ? [{ type: 'CONFLICTING_RULE', message: 'Multiple rules suggest different outcomes' }]
                : [],
            generatedAt: new Date().toISOString()
        };
    }

    /**
     * Check if incident severity matches rule expectations
     */
    private checkSeverityMatch(
        incident: IncidentEvent,
        rule: Rule
    ): { matches: boolean; reason: string } {
        const severityScore = incident.severityScore || 50;
        const penaltyType = rule.penalty.type;
        const threshold = SEVERITY_THRESHOLDS[penaltyType];

        if (!threshold) {
            return { matches: true, reason: '' };
        }

        if (severityScore < threshold.min) {
            return {
                matches: false,
                reason: `Severity score (${severityScore}) is below typical range for ${penaltyType} (${threshold.min}-${threshold.max})`
            };
        }

        if (severityScore > threshold.max) {
            return {
                matches: false,
                reason: `Severity score (${severityScore}) exceeds typical range for ${penaltyType} (${threshold.min}-${threshold.max})`
            };
        }

        return { matches: true, reason: '' };
    }

    /**
     * Generate alternative outcomes
     */
    private generateAlternatives(
        rule: Rule,
        incident: IncidentEvent,
        context?: { previousIncidents?: number; isRepeatOffense?: boolean }
    ): AlternativeOutcome[] {
        const alternatives: AlternativeOutcome[] = [];

        // Standard application
        alternatives.push({
            label: 'Apply as Written',
            description: `Apply ${rule.penalty.type}${rule.penalty.value ? ` (${rule.penalty.value})` : ''}`,
            consequence: 'Standard penalty per rulebook'
        });

        // Reduced penalty option
        if (incident.severityScore && incident.severityScore < 40) {
            alternatives.push({
                label: 'Reduced Penalty',
                description: 'Consider lighter penalty due to low severity',
                consequence: 'May set precedent for similar incidents'
            });
        }

        // Enhanced penalty for repeat offenses
        if (context?.isRepeatOffense) {
            alternatives.push({
                label: 'Enhanced Penalty',
                description: 'Consider stricter penalty for repeat offense',
                consequence: 'Stronger deterrent but may be contested'
            });
        }

        // Racing incident option
        alternatives.push({
            label: 'Racing Incident',
            description: 'No penalty — treat as normal racing contact',
            consequence: 'Incident noted but no action taken'
        });

        return alternatives;
    }

    /**
     * Build summary text
     */
    private buildSummary(rule: Rule, incident: IncidentEvent): string {
        return `Rule ${rule.reference}: ${rule.penalty.type.replace(/_/g, ' ')} recommended for ${incident.type} incident`;
    }

    /**
     * Build reasoning text
     */
    private buildReasoning(
        rule: Rule,
        incident: IncidentEvent,
        severityMatch: { matches: boolean; reason: string },
        context?: { previousIncidents?: number; isRepeatOffense?: boolean }
    ): string {
        const parts: string[] = [];

        parts.push(`Based on Rule ${rule.reference} ("${rule.title}"), this ${incident.type} incident warrants consideration of a ${rule.penalty.type.replace(/_/g, ' ')}.`);

        if (incident.severityScore !== undefined) {
            parts.push(`Incident severity score: ${incident.severityScore}/100.`);
        }

        if (!severityMatch.matches) {
            parts.push(`Note: ${severityMatch.reason}`);
        }

        if (context?.previousIncidents && context.previousIncidents > 0) {
            parts.push(`Driver has ${context.previousIncidents} previous incident(s) this session.`);
        }

        if (context?.isRepeatOffense) {
            parts.push(`This is a repeat offense — escalated penalty may be appropriate.`);
        }

        return parts.join(' ');
    }

    /**
     * Lower confidence level
     */
    private lowerConfidence(current: AdvisorConfidence): AdvisorConfidence {
        if (current === 'HIGH') return 'MEDIUM';
        if (current === 'MEDIUM') return 'LOW';
        return 'LOW';
    }
}

// Export singleton instance
export const stewardAdvisor = new StewardAdvisorService();
