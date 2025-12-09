// =====================================================================
// Deterministic Rulebook Parser
// Regex-based fallback when LLM is unavailable
// =====================================================================

import { v4 as uuid } from 'uuid';
import type {
    InterpretedRule,
    RuleConfidence,
    RuleCategory
} from '@controlbox/common';
import type { Rule, RuleCondition, PenaltyDefinition, ConditionOperator } from '@controlbox/common';

// --- Pattern Definitions ---

const INCIDENT_PATTERNS: Record<string, RegExp[]> = {
    contact: [
        /\b(contact|collision|hit|struck|impacting)\b/i,
        /\b(side[\s-]?swipe|rear[\s-]?end|t[\s-]?bone)\b/i,
        /\b(making contact|causing contact)\b/i
    ],
    off_track: [
        /\b(off[\s-]?track|leaving the track|exceeding track limits)\b/i,
        /\b(four wheels off|all four wheels)\b/i
    ],
    unsafe_rejoin: [
        /\b(unsafe[\s-]?rejoin|rejoining unsafely|dangerous rejoin)\b/i,
        /\b(re-?entering.*unsafe|rejoin.*dangerous)\b/i
    ],
    blocking: [
        /\b(blocking|impeding|holding up)\b/i,
        /\b(more than one defensive move|moving under braking)\b/i
    ],
    pit_violation: [
        /\b(pit[\s-]?lane|pit[\s-]?entry|pit[\s-]?exit)\b/i,
        /\b(speed limit|pit speed)\b/i
    ],
    yellow_flag_violation: [
        /\b(yellow flag|caution|under.*yellow)\b/i,
        /\b(overtaking under.*caution|passing.*yellow)\b/i
    ],
    track_limits: [
        /\b(track limits|exceeding.*boundaries|gaining.*advantage)\b/i,
        /\b(cutting|corner[\s-]?cutting)\b/i
    ],
    spin: [
        /\b(spin|spinning|loss of control)\b/i,
        /\b(losing control|lost control)\b/i
    ]
};

const PENALTY_PATTERNS: Record<string, { pattern: RegExp; valueExtractor?: RegExp }> = {
    warning: {
        pattern: /\b(warning|first offense|verbal warning|formal warning)\b/i
    },
    reprimand: {
        pattern: /\b(reprimand|official reprimand)\b/i
    },
    time_penalty: {
        pattern: /\b(time penalty|(\d+)\s*second[s]?\s*penalty|added to.*time)\b/i,
        valueExtractor: /(\d+)\s*second/i
    },
    position_penalty: {
        pattern: /\b(position penalty|(\d+)\s*position|lose.*position|drop.*position)\b/i,
        valueExtractor: /(\d+)\s*position/i
    },
    drive_through: {
        pattern: /\b(drive[\s-]?through|drive through penalty)\b/i
    },
    stop_go: {
        pattern: /\b(stop[\s-]?(?:and[\s-]?)?go|stop go penalty)\b/i,
        valueExtractor: /(\d+)\s*second/i
    },
    disqualification: {
        pattern: /\b(disqualif|DQ|excluded from|exclusion)\b/i
    },
    grid_penalty: {
        pattern: /\b(grid penalty|(\d+)\s*place.*grid|start.*behind)\b/i,
        valueExtractor: /(\d+)\s*(?:place|position)/i
    }
};

const CONDITION_PATTERNS: Record<string, { field: string; operator: ConditionOperator; value: unknown; pattern: RegExp }[]> = {
    severity: [
        { field: 'incident.severity', operator: 'eq', value: 'light', pattern: /\b(minor|slight|light|minimal)\b/i },
        { field: 'incident.severity', operator: 'eq', value: 'medium', pattern: /\b(moderate|medium|significant)\b/i },
        { field: 'incident.severity', operator: 'eq', value: 'heavy', pattern: /\b(major|heavy|serious|severe)\b/i }
    ],
    context: [
        { field: 'context.isUnderCaution', operator: 'eq', value: true, pattern: /\b(under.*caution|during.*yellow|yellow flag condition)\b/i },
        { field: 'context.isInPitLane', operator: 'eq', value: true, pattern: /\b(in pit lane|pit area|pit road)\b/i },
        { field: 'session.flagState', operator: 'eq', value: 'green', pattern: /\b(green flag|racing condition|under green)\b/i }
    ],
    timing: [
        { field: 'incident.lapNumber', operator: 'eq', value: 1, pattern: /\b(first lap|lap 1|opening lap|start)\b/i },
        { field: 'incident.lapNumber', operator: 'lte', value: 3, pattern: /\b(first few laps|opening laps|early in the race)\b/i }
    ]
};

const CATEGORY_PATTERNS: Record<RuleCategory, RegExp[]> = {
    INCIDENT: [/\b(incident|contact|collision|accident)\b/i],
    PENALTY: [/\b(penalty|penalt|punishment|sanction)\b/i],
    START_PROC: [/\b(start|formation|grid|rolling start|standing start)\b/i],
    RACE_CONTROL: [/\b(race control|safety car|virtual safety car|VSC|red flag)\b/i],
    CONDUCT: [/\b(conduct|behavior|sportsmanship|unsportsmanlike)\b/i],
    OTHER: []
};

// --- Parser Class ---

export class DeterministicParser {
    /**
     * Parse raw rulebook text into structured rules without using LLM
     */
    parseText(rawText: string, _discipline?: string): InterpretedRule[] {
        const rules: InterpretedRule[] = [];
        const sections = this.splitIntoSections(rawText);

        for (const section of sections) {
            const extracted = this.extractRule(section);
            if (extracted) {
                rules.push(extracted);
            }
        }

        return rules;
    }

    /**
     * Split raw text into logical sections (rules/articles)
     */
    private splitIntoSections(text: string): string[] {
        // Split by common rule/article patterns
        const sectionPatterns = [
            /(?:^|\n)(?:Article|Section|Rule|§)\s*\d+[\.\:]/gim,
            /(?:^|\n)\d+\.\d+(?:\.\d+)?[\s\.\:]/gm,
            /(?:^|\n)[A-Z]\.\s+[A-Z]/gm
        ];

        let sections: string[] = [];

        // Try each pattern
        for (const pattern of sectionPatterns) {
            const matches = text.split(pattern);
            if (matches.length > 1) {
                sections = matches.filter(s => s.trim().length > 30);
                break;
            }
        }

        // Fallback: split by double newlines if no pattern matched
        if (sections.length === 0) {
            sections = text.split(/\n\s*\n/).filter(s => s.trim().length > 30);
        }

        return sections.slice(0, 50); // Cap at 50 sections
    }

    /**
     * Extract a rule from a text section
     */
    private extractRule(section: string): InterpretedRule | null {
        // Detect incident type
        const incidentType = this.detectIncidentType(section);
        if (!incidentType && !this.looksLikeRule(section)) {
            return null;
        }

        // Extract penalty
        const penalty = this.extractPenalty(section);
        if (!penalty) {
            return null;
        }

        // Build conditions
        const conditions = this.extractConditions(section, incidentType);

        // Determine category
        const category = this.detectCategory(section);

        // Calculate confidence
        const confidence = this.calculateConfidence(incidentType, penalty, conditions);

        // Generate summary
        const summary = this.generateSummary(incidentType, penalty, conditions);

        // Create structured rule
        const structuredRule: Rule = {
            id: uuid(),
            reference: this.extractReference(section) || `RULE-${Date.now()}`,
            title: this.extractTitle(section) || summary.slice(0, 50),
            description: section.slice(0, 200),
            conditions,
            penalty,
            priority: this.calculatePriority(penalty),
            isActive: false // Must be approved first
        };

        return {
            id: uuid(),
            originalText: section.slice(0, 500),
            summary,
            structuredRule,
            confidence,
            category,
            status: 'pending',
            interpretedAt: new Date()
        };
    }

    /**
     * Detect incident type from text
     */
    private detectIncidentType(text: string): string | null {
        for (const [type, patterns] of Object.entries(INCIDENT_PATTERNS)) {
            for (const pattern of patterns) {
                if (pattern.test(text)) {
                    return type;
                }
            }
        }
        return null;
    }

    /**
     * Extract penalty from text
     */
    private extractPenalty(text: string): PenaltyDefinition | null {
        for (const [type, { pattern, valueExtractor }] of Object.entries(PENALTY_PATTERNS)) {
            if (pattern.test(text)) {
                let value: string | undefined;
                if (valueExtractor) {
                    const match = text.match(valueExtractor);
                    if (match) {
                        value = `${match[1]} seconds`;
                    }
                }
                return {
                    type: type as PenaltyDefinition['type'],
                    value,
                    notes: `${type.replace(/_/g, ' ')}${value ? ` (${value})` : ''}`
                };
            }
        }
        return null;
    }

    /**
     * Extract conditions from text
     */
    private extractConditions(text: string, incidentType: string | null): RuleCondition[] {
        const conditions: RuleCondition[] = [];

        // Add incident type condition if detected
        if (incidentType) {
            conditions.push({
                field: 'incident.type',
                operator: 'eq',
                value: incidentType
            });
        }

        // Check for additional condition patterns
        for (const group of Object.values(CONDITION_PATTERNS)) {
            for (const { field, operator, value, pattern } of group) {
                if (pattern.test(text)) {
                    // Avoid duplicate conditions
                    if (!conditions.some(c => c.field === field && c.value === value)) {
                        conditions.push({ field, operator, value });
                    }
                }
            }
        }

        return conditions;
    }

    /**
     * Detect rule category
     */
    private detectCategory(text: string): RuleCategory {
        for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
            for (const pattern of patterns) {
                if (pattern.test(text)) {
                    return category as RuleCategory;
                }
            }
        }
        return 'OTHER';
    }

    /**
     * Calculate confidence score
     */
    private calculateConfidence(
        incidentType: string | null,
        penalty: PenaltyDefinition | null,
        conditions: RuleCondition[]
    ): RuleConfidence {
        let score = 0;

        // Has clear incident type
        if (incidentType) score += 30;

        // Has penalty
        if (penalty) score += 30;

        // Has penalty value
        if (penalty?.value) score += 10;

        // Has conditions
        score += Math.min(conditions.length * 10, 30);

        if (score >= 70) return 'HIGH';
        if (score >= 40) return 'MEDIUM';
        return 'LOW';
    }

    /**
     * Check if text section looks like a rule
     */
    private looksLikeRule(text: string): boolean {
        // Check for penalty-like language
        for (const { pattern } of Object.values(PENALTY_PATTERNS)) {
            if (pattern.test(text)) return true;
        }

        // Check for regulatory language
        const regulatoryPatterns = [
            /\bshall\b/i,
            /\bmust\b/i,
            /\bwill result in\b/i,
            /\bsubject to\b/i,
            /\bprohibited\b/i
        ];

        return regulatoryPatterns.some(p => p.test(text));
    }

    /**
     * Extract rule reference from text
     */
    private extractReference(text: string): string | null {
        const patterns = [
            /(?:Article|Section|Rule|§)\s*(\d+(?:\.\d+)*)/i,
            /^(\d+\.\d+(?:\.\d+)?)/m
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                return match[1];
            }
        }
        return null;
    }

    /**
     * Extract title from text
     */
    private extractTitle(text: string): string | null {
        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length > 0) {
            const firstLine = lines[0].trim();
            if (firstLine.length < 100) {
                return firstLine.replace(/^[\d\.\:\-\s]+/, '').trim();
            }
        }
        return null;
    }

    /**
     * Generate summary from extracted data
     */
    private generateSummary(
        incidentType: string | null,
        penalty: PenaltyDefinition | null,
        conditions: RuleCondition[]
    ): string {
        const parts: string[] = [];

        if (incidentType) {
            parts.push(`${incidentType.replace(/_/g, ' ')} incident`);
        }

        const contextConditions = conditions.filter(c => c.field.startsWith('context.') || c.field.startsWith('session.'));
        if (contextConditions.length > 0) {
            const contexts = contextConditions.map(c => {
                if (c.field === 'context.isUnderCaution' && c.value) return 'under caution';
                if (c.field === 'incident.lapNumber' && c.value === 1) return 'on lap 1';
                return null;
            }).filter(Boolean);
            if (contexts.length > 0) {
                parts.push(contexts.join(', '));
            }
        }

        if (penalty) {
            parts.push(`→ ${penalty.type.replace(/_/g, ' ')}${penalty.value ? ` (${penalty.value})` : ''}`);
        }

        return parts.join(' ') || 'Rule detected';
    }

    /**
     * Calculate rule priority based on penalty severity
     */
    private calculatePriority(penalty: PenaltyDefinition): number {
        const priorities: Record<string, number> = {
            disqualification: 100,
            stop_go: 90,
            drive_through: 80,
            position_penalty: 70,
            time_penalty: 60,
            grid_penalty: 50,
            reprimand: 30,
            warning: 10
        };
        return priorities[penalty.type] || 50;
    }
}

// Export singleton instance
export const deterministicParser = new DeterministicParser();
