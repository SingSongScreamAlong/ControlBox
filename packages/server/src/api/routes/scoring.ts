// =====================================================================
// Scoring Routes
// Standings, event scoring, points tables
// =====================================================================

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getScoringService } from '../../services/scoring/scoring-service.js';

const router = Router();

// All routes require auth
router.use(requireAuth);

/**
 * Get driver standings for a season
 * GET /api/seasons/:seasonId/standings
 */
router.get('/seasons/:seasonId/standings', async (req: Request, res: Response) => {
    try {
        const { seasonId } = req.params;
        const { classId, limit, offset } = req.query;

        const scoringService = getScoringService();
        const result = await scoringService.getDriverStandings(
            seasonId,
            classId as string | undefined,
            parseInt(limit as string) || 50,
            parseInt(offset as string) || 0
        );

        res.json({
            success: true,
            data: result.standings,
            meta: { totalCount: result.totalCount }
        });
    } catch (error) {
        console.error('Error fetching standings:', error);
        res.status(500).json({
            success: false,
            error: { code: 'FETCH_ERROR', message: 'Failed to fetch standings' }
        });
    }
});

/**
 * Get team standings for a season
 * GET /api/seasons/:seasonId/standings/teams
 */
router.get('/seasons/:seasonId/standings/teams', async (req: Request, res: Response) => {
    try {
        const { seasonId } = req.params;

        const scoringService = getScoringService();
        const result = await scoringService.getTeamStandings(seasonId);

        res.json({
            success: true,
            data: result.standings,
            meta: { totalCount: result.totalCount }
        });
    } catch (error) {
        console.error('Error fetching team standings:', error);
        res.status(500).json({
            success: false,
            error: { code: 'FETCH_ERROR', message: 'Failed to fetch team standings' }
        });
    }
});

/**
 * Get points table for a series
 * GET /api/series/:seriesId/points-table
 */
router.get('/series/:seriesId/points-table', async (req: Request, res: Response) => {
    try {
        const { seriesId } = req.params;

        const scoringService = getScoringService();
        const pointsTable = await scoringService.getPointsTable(seriesId);

        if (!pointsTable) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'No points table configured' }
            });
            return;
        }

        res.json({
            success: true,
            data: pointsTable
        });
    } catch (error) {
        console.error('Error fetching points table:', error);
        res.status(500).json({
            success: false,
            error: { code: 'FETCH_ERROR', message: 'Failed to fetch points table' }
        });
    }
});

/**
 * Update points table for a series
 * PUT /api/series/:seriesId/points-table
 */
router.put('/series/:seriesId/points-table', async (req: Request, res: Response) => {
    try {
        const { seriesId } = req.params;
        const { name, points, classPoints } = req.body;

        const scoringService = getScoringService();
        const pointsTable = await scoringService.updatePointsTable(seriesId, { name, points, classPoints });

        res.json({
            success: true,
            data: pointsTable
        });
    } catch (error) {
        console.error('Error updating points table:', error);
        res.status(500).json({
            success: false,
            error: { code: 'UPDATE_ERROR', message: 'Failed to update points table' }
        });
    }
});

/**
 * Score an event
 * POST /api/events/:eventId/score
 */
router.post('/events/:eventId/score', async (req: Request, res: Response) => {
    try {
        const { eventId } = req.params;

        const scoringService = getScoringService();
        const results = await scoringService.scoreEvent(eventId, req.user?.id);

        res.json({
            success: true,
            data: results,
            meta: { scoredCount: results.length }
        });
    } catch (error) {
        console.error('Error scoring event:', error);
        res.status(500).json({
            success: false,
            error: { code: 'SCORE_ERROR', message: error instanceof Error ? error.message : 'Failed to score event' }
        });
    }
});

/**
 * Get event results
 * GET /api/events/:eventId/results
 */
router.get('/events/:eventId/results', async (req: Request, res: Response) => {
    try {
        const { eventId } = req.params;

        const scoringService = getScoringService();
        const results = await scoringService.getEventResults(eventId);

        res.json({
            success: true,
            data: results
        });
    } catch (error) {
        console.error('Error fetching results:', error);
        res.status(500).json({
            success: false,
            error: { code: 'FETCH_ERROR', message: 'Failed to fetch results' }
        });
    }
});

export default router;
