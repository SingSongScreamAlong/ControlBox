// =====================================================================
// Rulebook AI Interpretation Routes
// Natural-language rulebook parsing endpoints
// =====================================================================

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getRulebookInterpretationService } from '../../services/rulebook/interpretation-service.js';

const router = Router();

// All routes require auth
router.use(requireAuth);

/**
 * Interpret raw rulebook text
 * POST /api/rulebooks/:id/interpret
 */
router.post('/:rulebookId/interpret', async (req: Request, res: Response) => {
    try {
        const { rulebookId } = req.params;
        const { rawText, fileName, discipline, hints } = req.body;

        if (!rawText || typeof rawText !== 'string') {
            res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'rawText is required' }
            });
            return;
        }

        if (rawText.length < 50) {
            res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'rawText is too short (min 50 characters)' }
            });
            return;
        }

        if (rawText.length > 500000) {
            res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'rawText is too large (max 500KB)' }
            });
            return;
        }

        const service = getRulebookInterpretationService();
        const result = await service.interpretRulebook(
            rulebookId,
            { rawText, fileName, discipline, hints },
            req.user?.id || 'unknown'
        );

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Interpretation error:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERPRETATION_ERROR',
                message: error instanceof Error ? error.message : 'Failed to interpret rulebook'
            }
        });
    }
});

/**
 * Get interpretation session
 * GET /api/rulebooks/interpretation-sessions/:sessionId
 */
router.get('/interpretation-sessions/:sessionId', async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;

        const service = getRulebookInterpretationService();
        const session = await service.getSession(sessionId);

        if (!session) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Session not found' }
            });
            return;
        }

        res.json({
            success: true,
            data: session
        });
    } catch (error) {
        console.error('Session fetch error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'FETCH_ERROR', message: 'Failed to fetch session' }
        });
    }
});

/**
 * Update rule status (approve/reject)
 * PATCH /api/rulebooks/interpretation-sessions/:sessionId/rules/:ruleId
 */
router.patch('/interpretation-sessions/:sessionId/rules/:ruleId', async (req: Request, res: Response) => {
    try {
        const { sessionId, ruleId } = req.params;
        const { status, notes } = req.body;

        if (!['approved', 'rejected'].includes(status)) {
            res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'status must be "approved" or "rejected"' }
            });
            return;
        }

        const service = getRulebookInterpretationService();
        await service.updateRuleStatus(sessionId, ruleId, status, notes);

        res.json({
            success: true,
            data: { ruleId, status }
        });
    } catch (error) {
        console.error('Rule update error:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'UPDATE_ERROR',
                message: error instanceof Error ? error.message : 'Failed to update rule'
            }
        });
    }
});

/**
 * Bulk update rule statuses
 * POST /api/rulebooks/interpretation-sessions/:sessionId/bulk-action
 */
router.post('/interpretation-sessions/:sessionId/bulk-action', async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;
        const { action, ruleIds } = req.body;

        if (!['approve', 'reject'].includes(action)) {
            res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'action must be "approve" or "reject"' }
            });
            return;
        }

        if (!Array.isArray(ruleIds) || ruleIds.length === 0) {
            res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'ruleIds must be a non-empty array' }
            });
            return;
        }

        const service = getRulebookInterpretationService();
        const status = action === 'approve' ? 'approved' : 'rejected';
        await service.bulkUpdateStatus(sessionId, ruleIds, status);

        res.json({
            success: true,
            data: { action, count: ruleIds.length }
        });
    } catch (error) {
        console.error('Bulk action error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'BULK_ACTION_ERROR', message: 'Failed to perform bulk action' }
        });
    }
});

/**
 * Commit approved rules to rulebook
 * POST /api/rulebooks/interpretation-sessions/:sessionId/commit
 */
router.post('/interpretation-sessions/:sessionId/commit', async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;
        const { ruleIds } = req.body;

        if (!Array.isArray(ruleIds) || ruleIds.length === 0) {
            res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'ruleIds must be a non-empty array' }
            });
            return;
        }

        const service = getRulebookInterpretationService();
        const result = await service.commitRules(sessionId, ruleIds);

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Commit error:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'COMMIT_ERROR',
                message: error instanceof Error ? error.message : 'Failed to commit rules'
            }
        });
    }
});

/**
 * Simulate rule against sample incident
 * POST /api/rulebooks/simulate
 */
router.post('/simulate', async (req: Request, res: Response) => {
    try {
        const { rule, sampleIncident } = req.body;

        if (!rule || !sampleIncident) {
            res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'rule and sampleIncident are required' }
            });
            return;
        }

        // Simple simulation using condition matching logic
        const result = simulateRule(rule, sampleIncident);

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Simulation error:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'SIMULATION_ERROR',
                message: error instanceof Error ? error.message : 'Failed to simulate rule'
            }
        });
    }
});

/**
 * Simple local simulation of rule matching
 */
interface SimulationSampleIncident {
    type?: string;
    contactType?: string;
    severity?: string;
    severityScore?: number;
    lapNumber?: number;
    trackPosition?: number;
    isUnderCaution?: boolean;
}

interface SimulationRule {
    conditions: Array<{
        field: string;
        operator: string;
        value: unknown;
    }>;
    penalty: {
        type: string;
        value?: string;
    };
}

function simulateRule(rule: SimulationRule, incident: SimulationSampleIncident) {
    const matchedConditions: string[] = [];
    const unmatchedConditions: string[] = [];

    for (const condition of rule.conditions || []) {
        const conditionStr = `${condition.field} ${condition.operator} ${JSON.stringify(condition.value)}`;
        const fieldValue = getFieldValue(condition.field, incident);
        const matches = evaluateCondition(fieldValue, condition.operator, condition.value);

        if (matches) {
            matchedConditions.push(conditionStr);
        } else {
            unmatchedConditions.push(conditionStr);
        }
    }

    const wouldTrigger = unmatchedConditions.length === 0 && matchedConditions.length > 0;
    const matchConfidence = matchedConditions.length / (matchedConditions.length + unmatchedConditions.length) || 0;

    return {
        wouldTrigger,
        matchConfidence,
        resultingPenalty: wouldTrigger ? rule.penalty : undefined,
        explanation: wouldTrigger
            ? `Rule would trigger. All ${matchedConditions.length} conditions matched.`
            : `Rule would NOT trigger. ${unmatchedConditions.length} condition(s) did not match.`,
        matchedConditions,
        unmatchedConditions
    };
}

function getFieldValue(field: string, incident: SimulationSampleIncident): unknown {
    const fieldMap: Record<string, unknown> = {
        'incident.type': incident.type,
        'incident.contactType': incident.contactType,
        'incident.severity': incident.severity,
        'incident.severityScore': incident.severityScore,
        'incident.lapNumber': incident.lapNumber,
        'incident.trackPosition': incident.trackPosition,
        'context.isUnderCaution': incident.isUnderCaution
    };
    return fieldMap[field];
}

function evaluateCondition(actual: unknown, operator: string, expected: unknown): boolean {
    switch (operator) {
        case 'eq': return actual === expected;
        case 'neq': return actual !== expected;
        case 'gt': return typeof actual === 'number' && typeof expected === 'number' && actual > expected;
        case 'lt': return typeof actual === 'number' && typeof expected === 'number' && actual < expected;
        case 'gte': return typeof actual === 'number' && typeof expected === 'number' && actual >= expected;
        case 'lte': return typeof actual === 'number' && typeof expected === 'number' && actual <= expected;
        case 'in': return Array.isArray(expected) && expected.includes(actual);
        default: return false;
    }
}

export default router;

