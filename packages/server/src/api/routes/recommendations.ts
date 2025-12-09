// =====================================================================
// Recommendation Routes
// REST API endpoints for recommendation management
// =====================================================================

import { Router, Request, Response } from 'express';
import { pool } from '../../db/client.js';
import type {
    Recommendation,
    RecommendationStatus,
    ActionRecommendationRequest
} from '@controlbox/common';

const router = Router();

/**
 * Database row type
 */
interface RecommendationRow {
    id: string;
    session_id: string;
    incident_id: string | null;
    recommendation_type: string;
    discipline_context: string | null;
    details: string | null;
    confidence: string;
    priority: number;
    payload: Record<string, unknown>;
    status: string;
    actioned_by: string | null;
    actioned_at: Date | null;
    action_notes: string | null;
    created_at: Date;
    updated_at: Date | null;
}

/**
 * Map row to recommendation
 */
function mapRowToRecommendation(row: RecommendationRow): Recommendation {
    return {
        id: row.id,
        sessionId: row.session_id,
        incidentId: row.incident_id ?? undefined,
        type: row.recommendation_type as Recommendation['type'],
        disciplineContext: (row.discipline_context as Recommendation['disciplineContext']) ?? 'road',
        details: row.details ?? '',
        confidence: parseFloat(row.confidence),
        status: row.status as RecommendationStatus,
        priority: row.priority,
        actionedBy: row.actioned_by ?? undefined,
        actionedAt: row.actioned_at ?? undefined,
        actionNotes: row.action_notes ?? undefined,
        timestamp: row.created_at.getTime(),
        createdAt: row.created_at
    };
}

/**
 * Get recommendations for a session
 * GET /api/sessions/:sessionId/recommendations
 */
router.get('/sessions/:sessionId/recommendations', async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;
        const { status, type, limit = '50', offset = '0' } = req.query;

        let query = `SELECT * FROM recommendations WHERE session_id = $1`;
        const params: unknown[] = [sessionId];
        let paramIndex = 2;

        if (status) {
            query += ` AND status = $${paramIndex++}`;
            params.push(status);
        }

        if (type) {
            query += ` AND recommendation_type = $${paramIndex++}`;
            params.push(type);
        }

        query += ` ORDER BY priority DESC, created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
        params.push(parseInt(limit as string), parseInt(offset as string));

        const result = await pool.query<RecommendationRow>(query, params);
        const recommendations = result.rows.map(mapRowToRecommendation);

        // Get total count
        let countQuery = `SELECT COUNT(*) FROM recommendations WHERE session_id = $1`;
        const countParams: unknown[] = [sessionId];
        if (status) {
            countQuery += ` AND status = $2`;
            countParams.push(status);
        }
        const countResult = await pool.query(countQuery, countParams);
        const totalCount = parseInt(countResult.rows[0].count);

        res.json({
            success: true,
            data: recommendations,
            meta: {
                totalCount,
                limit: parseInt(limit as string),
                offset: parseInt(offset as string)
            }
        });
    } catch (error) {
        console.error('Error fetching recommendations:', error);
        res.status(500).json({
            success: false,
            error: { code: 'FETCH_ERROR', message: 'Failed to fetch recommendations' }
        });
    }
});

/**
 * Get a specific recommendation
 * GET /api/recommendations/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const result = await pool.query<RecommendationRow>(
            `SELECT * FROM recommendations WHERE id = $1`,
            [req.params.id]
        );

        if (result.rows.length === 0) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Recommendation not found' }
            });
            return;
        }

        res.json({
            success: true,
            data: mapRowToRecommendation(result.rows[0])
        });
    } catch (error) {
        console.error('Error fetching recommendation:', error);
        res.status(500).json({
            success: false,
            error: { code: 'FETCH_ERROR', message: 'Failed to fetch recommendation' }
        });
    }
});

/**
 * Take action on a recommendation
 * POST /api/recommendations/:id/action
 */
router.post('/:id/action', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { action, notes, modifiedPayload } = req.body as ActionRecommendationRequest;

        // Validate action
        if (!['accept', 'dismiss', 'modify'].includes(action)) {
            res.status(400).json({
                success: false,
                error: { code: 'INVALID_ACTION', message: 'Action must be accept, dismiss, or modify' }
            });
            return;
        }

        // Map action to status
        const statusMap: Record<string, RecommendationStatus> = {
            accept: 'accepted',
            dismiss: 'dismissed',
            modify: 'modified'
        };
        const newStatus = statusMap[action];

        // Update recommendation
        let updateQuery = `
            UPDATE recommendations 
            SET status = $1, actioned_at = NOW(), action_notes = $2, updated_at = NOW()
        `;
        const params: unknown[] = [newStatus, notes ?? null];
        let paramIndex = 3;

        if (modifiedPayload) {
            updateQuery += `, payload = $${paramIndex++}`;
            params.push(JSON.stringify(modifiedPayload));
        }

        // TODO: Add actioned_by when auth is implemented
        // updateQuery += `, actioned_by = $${paramIndex++}`;
        // params.push(userId);

        updateQuery += ` WHERE id = $${paramIndex} RETURNING *`;
        params.push(id);

        const result = await pool.query<RecommendationRow>(updateQuery, params);

        if (result.rows.length === 0) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Recommendation not found' }
            });
            return;
        }

        const recommendation = mapRowToRecommendation(result.rows[0]);

        console.log(`✓ Recommendation ${id} ${action}ed`);

        res.json({
            success: true,
            data: recommendation
        });
    } catch (error) {
        console.error('Error actioning recommendation:', error);
        res.status(500).json({
            success: false,
            error: { code: 'ACTION_ERROR', message: 'Failed to action recommendation' }
        });
    }
});

/**
 * Get pending recommendations count for session
 * GET /api/sessions/:sessionId/recommendations/pending-count
 */
router.get('/sessions/:sessionId/recommendations/pending-count', async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;

        const result = await pool.query(
            `SELECT COUNT(*) as count FROM recommendations WHERE session_id = $1 AND status = 'pending'`,
            [sessionId]
        );

        res.json({
            success: true,
            data: { count: parseInt(result.rows[0].count) }
        });
    } catch (error) {
        console.error('Error fetching pending count:', error);
        res.status(500).json({
            success: false,
            error: { code: 'FETCH_ERROR', message: 'Failed to fetch pending count' }
        });
    }
});

export default router;
