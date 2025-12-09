// =====================================================================
// AI Routes
// OpenAI GPT-5 powered analysis endpoints
// =====================================================================

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
    getLLMModelInfo,
    analyzeIncident,
    generateCommentary,
    analyzeDriverBehavior
} from '../../services/ai/llm-service.js';

const router = Router();

// All AI routes require auth
router.use(requireAuth);

/**
 * Get AI model info
 * GET /api/ai/status
 */
router.get('/status', (_req: Request, res: Response) => {
    const info = getLLMModelInfo();

    res.json({
        success: true,
        data: {
            model: info.model,
            fallbackModel: info.fallback,
            configured: info.configured,
            message: info.configured
                ? `GPT-5 ready (model: ${info.model})`
                : 'OpenAI API key not configured'
        }
    });
});

/**
 * Analyze an incident with AI
 * POST /api/ai/analyze-incident
 */
router.post('/analyze-incident', async (req: Request, res: Response) => {
    try {
        const { description, context } = req.body;

        if (!description) {
            res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'description is required' }
            });
            return;
        }

        const result = await analyzeIncident(description, context || {});

        if (!result.success) {
            res.status(500).json({
                success: false,
                error: { code: 'AI_ERROR', message: result.error }
            });
            return;
        }

        // Parse JSON from response
        let analysis;
        try {
            analysis = JSON.parse(result.content || '{}');
        } catch {
            analysis = { raw: result.content };
        }

        res.json({
            success: true,
            data: {
                analysis,
                model: result.model,
                tokens: result.tokens
            }
        });
    } catch (error) {
        console.error('AI analysis error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'AI_ERROR', message: 'Failed to analyze incident' }
        });
    }
});

/**
 * Generate AI commentary
 * POST /api/ai/commentary
 */
router.post('/commentary', async (req: Request, res: Response) => {
    try {
        const { eventContext, recentEvents, style } = req.body;

        if (!eventContext || !recentEvents) {
            res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'eventContext and recentEvents required' }
            });
            return;
        }

        const result = await generateCommentary(
            eventContext,
            recentEvents,
            style || 'professional'
        );

        if (!result.success) {
            res.status(500).json({
                success: false,
                error: { code: 'AI_ERROR', message: result.error }
            });
            return;
        }

        res.json({
            success: true,
            data: {
                commentary: result.content,
                model: result.model,
                tokens: result.tokens
            }
        });
    } catch (error) {
        console.error('AI commentary error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'AI_ERROR', message: 'Failed to generate commentary' }
        });
    }
});

/**
 * Analyze driver behavior
 * POST /api/ai/analyze-driver
 */
router.post('/analyze-driver', async (req: Request, res: Response) => {
    try {
        const { driverHistory } = req.body;

        if (!driverHistory || !driverHistory.name) {
            res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'driverHistory with name required' }
            });
            return;
        }

        const result = await analyzeDriverBehavior(driverHistory);

        if (!result.success) {
            res.status(500).json({
                success: false,
                error: { code: 'AI_ERROR', message: result.error }
            });
            return;
        }

        // Parse JSON from response
        let analysis;
        try {
            analysis = JSON.parse(result.content || '{}');
        } catch {
            analysis = { raw: result.content };
        }

        res.json({
            success: true,
            data: {
                analysis,
                model: result.model,
                tokens: result.tokens
            }
        });
    } catch (error) {
        console.error('AI driver analysis error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'AI_ERROR', message: 'Failed to analyze driver' }
        });
    }
});

export default router;
