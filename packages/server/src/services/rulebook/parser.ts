// =====================================================================
// Rulebook Parser
// Parses and validates rulebook definitions
// =====================================================================

import type {
    Rulebook,
    Rule,
    RuleCondition,
    RulebookValidation,
    RulebookValidationError,
    RulebookValidationWarning
} from '@controlbox/common';

const VALID_OPERATORS = ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'in', 'nin', 'contains', 'exists', 'regex'];
const VALID_PENALTY_TYPES = ['warning', 'reprimand', 'time_penalty', 'position_penalty', 'drive_through', 'stop_go', 'disqualification', 'grid_penalty', 'points_deduction', 'race_ban', 'custom'];

export class RulebookParser {
    /**
     * Validate a rulebook structure
     */
    validate(rulebook: Rulebook): RulebookValidation {
        const errors: RulebookValidationError[] = [];
        const warnings: RulebookValidationWarning[] = [];

        // Validate basic fields
        if (!rulebook.name || rulebook.name.trim() === '') {
            errors.push({ field: 'name', message: 'Rulebook name is required' });
        }

        if (!rulebook.leagueName || rulebook.leagueName.trim() === '') {
            errors.push({ field: 'leagueName', message: 'League name is required' });
        }

        // Validate rules
        if (!rulebook.rules || !Array.isArray(rulebook.rules)) {
            errors.push({ field: 'rules', message: 'Rules must be an array' });
        } else {
            for (const rule of rulebook.rules) {
                const ruleErrors = this.validateRule(rule);
                errors.push(...ruleErrors);
            }

            if (rulebook.rules.length === 0) {
                warnings.push({ message: 'Rulebook has no rules defined' });
            }
        }

        // Validate penalty matrix
        if (!rulebook.penaltyMatrix) {
            errors.push({ field: 'penaltyMatrix', message: 'Penalty matrix is required' });
        } else {
            const matrixErrors = this.validatePenaltyMatrix(rulebook.penaltyMatrix);
            errors.push(...matrixErrors);
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
        };
    }

    private validateRule(rule: Rule): RulebookValidationError[] {
        const errors: RulebookValidationError[] = [];

        if (!rule.id) {
            errors.push({ ruleId: rule.id, field: 'id', message: 'Rule ID is required' });
        }

        if (!rule.reference) {
            errors.push({ ruleId: rule.id, field: 'reference', message: 'Rule reference is required' });
        }

        if (!rule.title) {
            errors.push({ ruleId: rule.id, field: 'title', message: 'Rule title is required' });
        }

        // Validate conditions
        if (!rule.conditions || rule.conditions.length === 0) {
            errors.push({ ruleId: rule.id, field: 'conditions', message: 'At least one condition is required' });
        } else {
            for (const condition of rule.conditions) {
                const condErrors = this.validateCondition(condition, rule.id);
                errors.push(...condErrors);
            }
        }

        // Validate penalty
        if (!rule.penalty) {
            errors.push({ ruleId: rule.id, field: 'penalty', message: 'Rule penalty is required' });
        } else if (!VALID_PENALTY_TYPES.includes(rule.penalty.type)) {
            errors.push({
                ruleId: rule.id,
                field: 'penalty.type',
                message: `Invalid penalty type: ${rule.penalty.type}`
            });
        }

        return errors;
    }

    private validateCondition(condition: RuleCondition, ruleId: string): RulebookValidationError[] {
        const errors: RulebookValidationError[] = [];

        if (!condition.field) {
            errors.push({ ruleId, field: 'condition.field', message: 'Condition field is required' });
        }

        if (!VALID_OPERATORS.includes(condition.operator)) {
            errors.push({
                ruleId,
                field: 'condition.operator',
                message: `Invalid operator: ${condition.operator}`
            });
        }

        // Validate nested conditions
        if (condition.and) {
            for (const nested of condition.and) {
                errors.push(...this.validateCondition(nested, ruleId));
            }
        }
        if (condition.or) {
            for (const nested of condition.or) {
                errors.push(...this.validateCondition(nested, ruleId));
            }
        }

        return errors;
    }

    private validatePenaltyMatrix(matrix: Rulebook['penaltyMatrix']): RulebookValidationError[] {
        const errors: RulebookValidationError[] = [];

        if (!matrix.severity) {
            errors.push({ field: 'penaltyMatrix.severity', message: 'Severity mapping is required' });
        } else {
            for (const level of ['light', 'medium', 'heavy'] as const) {
                if (!matrix.severity[level]) {
                    errors.push({
                        field: `penaltyMatrix.severity.${level}`,
                        message: `Severity level '${level}' is required`
                    });
                }
            }
        }

        if (!matrix.repeat) {
            errors.push({ field: 'penaltyMatrix.repeat', message: 'Repeat penalty rule is required' });
        }

        return errors;
    }

    /**
     * Parse a JSON/YAML string into a rulebook
     */
    parse(content: string): Rulebook {
        // Try JSON first
        try {
            return JSON.parse(content) as Rulebook;
        } catch {
            // Could add YAML support here
            throw new Error('Failed to parse rulebook: invalid JSON');
        }
    }
}
