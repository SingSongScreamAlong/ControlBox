// =====================================================================
// Incidents Routes
// =====================================================================

import { Router, type Request, type Response } from 'express';
import type { ListIncidentsParams, UpdateIncidentRequest } from '@controlbox/common';
import { IncidentRepository } from '../../db/repositories/incident.repo.js';

export const incidentsRouter = Router();
const incidentRepo = new IncidentRepository();

// GET /api/incidents - List incidents
incidentsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const params: ListIncidentsParams = {
            page: parseInt(req.query.page as string) || 1,
            pageSize: parseInt(req.query.pageSize as string) || 20,
            sessionId: req.query.sessionId as string,
            type: req.query.type as string,
            severity: req.query.severity as string,
            status: req.query.status as string,
            driverId: req.query.driverId as string,
        };

        const incidents = await incidentRepo.findAll(params);
        const total = await incidentRepo.count(params);

        res.json({
            success: true,
            data: incidents,
            meta: {
                page: params.page,
                pageSize: params.pageSize,
                totalCount: total,
                totalPages: Math.ceil(total / (params.pageSize || 20)),
            },
        });
    } catch {
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch incidents' },
        });
    }
});

// GET /api/incidents/:id - Get incident by ID
incidentsRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        const incident = await incidentRepo.findById(req.params.id);

        if (!incident) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Incident not found' },
            });
            return;
        }

        res.json({ success: true, data: incident });
    } catch {
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch incident' },
        });
    }
});

// PATCH /api/incidents/:id - Update incident (review)
incidentsRouter.patch('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        const data: UpdateIncidentRequest = req.body;
        const incident = await incidentRepo.update(req.params.id, data);

        if (!incident) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Incident not found' },
            });
            return;
        }

        res.json({ success: true, data: incident });
    } catch {
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Failed to update incident' },
        });
    }
});

// POST /api/incidents/:id/analyze - Trigger AI analysis
incidentsRouter.post('/:id/analyze', async (req: Request, res: Response): Promise<void> => {
    try {
        const incident = await incidentRepo.findById(req.params.id);

        if (!incident) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Incident not found' },
            });
            return;
        }

        // Import advisor service dynamically to avoid circular deps
        const { stewardAdvisor } = await import('../../services/advisor/steward-advisor.js');

        // Get rules from request body (client should pass applicable rules)
        const rules = req.body.rules || [];
        const context = req.body.context || {
            previousIncidents: 0,
            isRepeatOffense: false,
            sessionType: 'race'
        };

        // Generate AI advice using StewardAdvisor
        const advice = stewardAdvisor.generateAdvice(incident, rules, context);

        // Extract primary recommendation from advice
        const primaryAdvice = advice[0];
        const recommendation = primaryAdvice?.alternatives?.[0]?.label?.toLowerCase().includes('apply')
            ? 'penalize'
            : primaryAdvice?.confidence === 'LOW'
                ? 'investigate'
                : 'no_action';

        // Calculate confidence as numeric value
        const confidenceMap = { 'HIGH': 0.9, 'MEDIUM': 0.7, 'LOW': 0.5 };
        const confidence = confidenceMap[primaryAdvice?.confidence || 'LOW'] || 0.5;

        // Log analysis for audit
        console.log('[AI ANALYSIS] Analyzed incident', {
            type: 'AI_ANALYSIS',
            incidentId: incident.id,
            recommendation,
            confidence,
            rulesApplied: primaryAdvice?.applicableRules || [],
            timestamp: new Date(),
        });

        res.json({
            success: true,
            data: {
                recommendation,
                confidence,
                reasoning: primaryAdvice?.reasoning || 'Unable to generate analysis',
                faultAttribution: incident.involvedDrivers?.reduce((acc, driver, idx) => {
                    // Simple fault attribution based on incident data
                    acc[driver.driverId || `driver_${idx}`] = idx === 0 ? 0.7 : 0.3;
                    return acc;
                }, {} as Record<string, number>) || {},
                patterns: primaryAdvice?.flags?.map(f => f.message) || [],
                modelId: 'steward-advisor-v1',
                analyzedAt: new Date(),
                advice: advice, // Include full advice for detailed view
            },
        });
    } catch (error) {
        console.error('Failed to analyze incident:', error);
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Failed to analyze incident' },
        });
    }
});

// POST /api/incidents/:id/advice - Get steward advisor recommendations
incidentsRouter.post('/:id/advice', async (req: Request, res: Response): Promise<void> => {
    try {
        const incident = await incidentRepo.findById(req.params.id);

        if (!incident) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Incident not found' },
            });
            return;
        }

        // Import advisor service dynamically to avoid circular deps
        const { stewardAdvisor } = await import('../../services/advisor/steward-advisor.js');

        // Get applicable rules from request or use empty array
        // In production, this would fetch from RulebookEngine
        const rules = req.body.rules || [];
        const context = req.body.context || {};

        const advice = stewardAdvisor.generateAdvice(incident, rules, context);

        // Log advisor generation for audit
        console.log('[ADVISOR] Generated advice for incident', {
            type: 'ADVISOR_GENERATED',
            incidentId: incident.id,
            ruleIdsUsed: advice.flatMap(a => a.applicableRules),
            confidenceLevels: advice.map(a => a.confidence),
            timestamp: new Date(),
        });

        res.json({
            success: true,
            data: advice,
        });
    } catch (error) {
        console.error('Failed to generate advisor recommendations:', error);
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Failed to generate advisor recommendations' },
        });
    }
});
