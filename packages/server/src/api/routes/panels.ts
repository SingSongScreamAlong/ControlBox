// =====================================================================
// Steward Voting Panels API Routes
// Multi-steward voting system
// =====================================================================

import { Router, Request, Response } from 'express';
import { pool } from '../../db/client.js';
import { requireAuth } from '../middleware/auth.js';
import type { VotingSummary, VoteDecision } from '@controlbox/common';

const router = Router();

// ========================
// Panels Routes
// ========================

// List panels
router.get('/', requireAuth, async (req: Request, res: Response) => {
    try {
        const { leagueId, status, limit = 50, offset = 0 } = req.query;

        let query = `
            SELECT p.*,
                   (SELECT COUNT(*) FROM steward_votes sv WHERE sv.panel_id = p.id) as vote_count
            FROM steward_panels p
            WHERE 1=1
        `;
        const params: unknown[] = [];
        let paramCount = 0;

        if (leagueId) {
            paramCount++;
            query += ` AND p.league_id = $${paramCount}`;
            params.push(leagueId);
        }

        if (status) {
            paramCount++;
            query += ` AND p.status = $${paramCount}`;
            params.push(status);
        }

        query += ` ORDER BY p.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);

        res.json({
            success: true,
            data: result.rows.map(row => ({
                id: row.id,
                leagueId: row.league_id,
                incidentId: row.incident_id,
                protestId: row.protest_id,
                appealId: row.appeal_id,
                requiredVotes: row.required_votes,
                decisionMethod: row.decision_method,
                status: row.status,
                finalDecision: row.final_decision,
                decisionRationale: row.decision_rationale,
                votingDeadline: row.voting_deadline,
                createdAt: row.created_at,
                closedAt: row.closed_at,
                votedCount: parseInt(row.vote_count) || 0
            }))
        });
    } catch (error) {
        console.error('Error fetching panels:', error);
        return void res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch panels' } });
    }
});

// Get single panel with votes
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const panelResult = await pool.query(`
            SELECT * FROM steward_panels WHERE id = $1
        `, [id]);

        if (panelResult.rows.length === 0) {
            return void res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Panel not found' } });
        }

        const votesResult = await pool.query(`
            SELECT sv.*, au.display_name as steward_name, au.email as steward_email
            FROM steward_votes sv
            JOIN admin_users au ON sv.steward_id = au.id
            WHERE sv.panel_id = $1
            ORDER BY sv.voted_at
        `, [id]);

        const panel = panelResult.rows[0];
        const votes = votesResult.rows.map(row => ({
            id: row.id,
            panelId: row.panel_id,
            stewardId: row.steward_id,
            stewardName: row.steward_name,
            stewardEmail: row.steward_email,
            vote: row.vote,
            reasoning: row.reasoning,
            isDissent: row.is_dissent,
            votedAt: row.voted_at
        }));

        res.json({
            success: true,
            data: {
                id: panel.id,
                leagueId: panel.league_id,
                incidentId: panel.incident_id,
                protestId: panel.protest_id,
                appealId: panel.appeal_id,
                requiredVotes: panel.required_votes,
                decisionMethod: panel.decision_method,
                status: panel.status,
                finalDecision: panel.final_decision,
                decisionRationale: panel.decision_rationale,
                votingDeadline: panel.voting_deadline,
                createdAt: panel.created_at,
                closedAt: panel.closed_at,
                votes,
                votedCount: votes.length
            }
        });
    } catch (error) {
        console.error('Error fetching panel:', error);
        return void res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch panel' } });
    }
});

// Create panel
router.post('/', requireAuth, async (req: Request, res: Response) => {
    try {
        const { leagueId, incidentId, protestId, appealId, requiredVotes, decisionMethod, votingDeadline } = req.body;

        if (!leagueId) {
            return void res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'leagueId is required' }
            });
        }

        const result = await pool.query(`
            INSERT INTO steward_panels (
                league_id, incident_id, protest_id, appeal_id,
                required_votes, decision_method, voting_deadline
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [
            leagueId,
            incidentId || null,
            protestId || null,
            appealId || null,
            requiredVotes || 3,
            decisionMethod || 'majority',
            votingDeadline || null
        ]);

        return void res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error creating panel:', error);
        return void res.status(500).json({ success: false, error: { code: 'CREATE_ERROR', message: 'Failed to create panel' } });
    }
});

// Cast vote
router.post('/:id/vote', requireAuth, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { vote, reasoning } = req.body;
        const user = (req as any).user;

        if (!vote) {
            return void res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'vote is required' }
            });
        }

        // Check panel exists and is open
        const panelCheck = await pool.query(`SELECT * FROM steward_panels WHERE id = $1`, [id]);
        if (panelCheck.rows.length === 0) {
            return void res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Panel not found' } });
        }

        if (panelCheck.rows[0].status !== 'voting') {
            return void res.status(400).json({
                success: false,
                error: { code: 'VOTING_CLOSED', message: 'Voting is closed for this panel' }
            });
        }

        const result = await pool.query(`
            INSERT INTO steward_votes (panel_id, steward_id, vote, reasoning)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (panel_id, steward_id) 
            DO UPDATE SET vote = EXCLUDED.vote, reasoning = EXCLUDED.reasoning, voted_at = NOW()
            RETURNING *
        `, [id, user?.sub, vote, reasoning || null]);

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error casting vote:', error);
        return void res.status(500).json({ success: false, error: { code: 'VOTE_ERROR', message: 'Failed to cast vote' } });
    }
});

// Get voting summary
router.get('/:id/summary', requireAuth, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const panelResult = await pool.query(`SELECT * FROM steward_panels WHERE id = $1`, [id]);
        if (panelResult.rows.length === 0) {
            return void res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Panel not found' } });
        }

        const votesResult = await pool.query(`
            SELECT vote, COUNT(*) as count, 
                   ARRAY_AGG(steward_id) as steward_ids,
                   BOOL_OR(is_dissent) as has_dissent
            FROM steward_votes 
            WHERE panel_id = $1 
            GROUP BY vote
        `, [id]);

        const panel = panelResult.rows[0];
        const voteCounts: Record<string, number> = {};
        let totalVotes = 0;

        for (const row of votesResult.rows) {
            voteCounts[row.vote] = parseInt(row.count);
            totalVotes += parseInt(row.count);
        }

        // Find leading decision
        let leadingDecision: string | undefined;
        let maxVotes = 0;
        for (const [decision, count] of Object.entries(voteCounts)) {
            if (count > maxVotes) {
                maxVotes = count;
                leadingDecision = decision;
            }
        }

        const summary: VotingSummary = {
            panelId: id,
            totalVotes,
            requiredVotes: panel.required_votes,
            voteCounts: voteCounts as Record<VoteDecision, number>,
            hasQuorum: totalVotes >= panel.required_votes,
            leadingDecision: leadingDecision as VoteDecision | undefined,
            isUnanimous: Object.keys(voteCounts).length === 1 && totalVotes > 0,
            dissents: []
        };

        res.json({ success: true, data: summary });
    } catch (error) {
        console.error('Error getting summary:', error);
        return void res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to get summary' } });
    }
});

// Close panel
router.post('/:id/close', requireAuth, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { finalDecision, decisionRationale } = req.body;

        if (!finalDecision) {
            return void res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'finalDecision is required' }
            });
        }

        const result = await pool.query(`
            UPDATE steward_panels SET
                status = 'closed',
                final_decision = $1,
                decision_rationale = $2,
                closed_at = NOW()
            WHERE id = $3 AND status = 'voting'
            RETURNING *
        `, [finalDecision, decisionRationale || null, id]);

        if (result.rows.length === 0) {
            return void res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Panel not found or already closed' }
            });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error closing panel:', error);
        return void res.status(500).json({ success: false, error: { code: 'CLOSE_ERROR', message: 'Failed to close panel' } });
    }
});

export default router;
