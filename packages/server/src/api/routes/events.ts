// =====================================================================
// Event Routes
// CRUD for scheduled race events
// =====================================================================

import { Router, Request, Response } from 'express';
import type { CreateEventRequest, UpdateEventRequest } from '@controlbox/common';
import { requireAuth } from '../middleware/auth.js';
import { requireLicense, requireRole } from '../middleware/license.js';
import { getEventService } from '../../services/events/event-service.js';
import { getDiscordService } from '../../services/discord/discord-service.js';

const router = Router();

// All routes require auth
router.use(requireAuth);

/**
 * Get events for a season
 * GET /api/seasons/:seasonId/events
 */
router.get('/seasons/:seasonId/events', requireLicense, async (req: Request, res: Response) => {
    try {
        const eventService = getEventService();
        const events = await eventService.getBySeason(req.params.seasonId);

        res.json({
            success: true,
            data: events,
            meta: { totalCount: events.length }
        });
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({
            success: false,
            error: { code: 'FETCH_ERROR', message: 'Failed to fetch events' }
        });
    }
});

/**
 * Create an event
 * POST /api/seasons/:seasonId/events
 */
router.post('/seasons/:seasonId/events', requireLicense, requireRole('RaceControl'), async (req: Request, res: Response) => {
    try {
        const data = req.body as CreateEventRequest;

        if (!data.name || !data.scheduledAt) {
            res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'name and scheduledAt are required' }
            });
            return;
        }

        // Get league/series from license context
        const license = req.license!;

        const eventService = getEventService();
        const event = await eventService.create(
            license.leagueId,
            license.seriesId,
            req.params.seasonId,
            data
        );

        res.status(201).json({
            success: true,
            data: event
        });
    } catch (error) {
        console.error('Error creating event:', error);
        res.status(500).json({
            success: false,
            error: { code: 'CREATE_ERROR', message: 'Failed to create event' }
        });
    }
});

/**
 * Get event with artifacts and report
 * GET /api/events/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const eventService = getEventService();
        const event = await eventService.getWithArtifacts(req.params.id);

        if (!event) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Event not found' }
            });
            return;
        }

        res.json({
            success: true,
            data: event
        });
    } catch (error) {
        console.error('Error fetching event:', error);
        res.status(500).json({
            success: false,
            error: { code: 'FETCH_ERROR', message: 'Failed to fetch event' }
        });
    }
});

/**
 * Update an event
 * PATCH /api/events/:id
 */
router.patch('/:id', async (req: Request, res: Response) => {
    try {
        const data = req.body as UpdateEventRequest;
        const eventService = getEventService();
        const event = await eventService.update(req.params.id, data);

        if (!event) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Event not found' }
            });
            return;
        }

        res.json({
            success: true,
            data: event
        });
    } catch (error) {
        console.error('Error updating event:', error);
        res.status(500).json({
            success: false,
            error: { code: 'UPDATE_ERROR', message: 'Failed to update event' }
        });
    }
});

/**
 * Start an event (marks as started, sends Discord notification)
 * POST /api/events/:id/start
 */
router.post('/:id/start', async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.body;
        const eventService = getEventService();

        const event = await eventService.markStarted(req.params.id, sessionId);

        if (!event) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Event not found' }
            });
            return;
        }

        // Send Discord notification
        const discordService = getDiscordService();
        await discordService.sendSessionStarted(event);

        res.json({
            success: true,
            data: event
        });
    } catch (error) {
        console.error('Error starting event:', error);
        res.status(500).json({
            success: false,
            error: { code: 'UPDATE_ERROR', message: 'Failed to start event' }
        });
    }
});

/**
 * End an event
 * POST /api/events/:id/end
 */
router.post('/:id/end', async (req: Request, res: Response) => {
    try {
        const eventService = getEventService();
        const event = await eventService.markEnded(req.params.id);

        if (!event) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Event not found' }
            });
            return;
        }

        res.json({
            success: true,
            data: event
        });
    } catch (error) {
        console.error('Error ending event:', error);
        res.status(500).json({
            success: false,
            error: { code: 'UPDATE_ERROR', message: 'Failed to end event' }
        });
    }
});

/**
 * Delete an event
 * DELETE /api/events/:id
 */
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const eventService = getEventService();
        const deleted = await eventService.delete(req.params.id);

        if (!deleted) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Event not found' }
            });
            return;
        }

        res.json({
            success: true,
            data: { deleted: true }
        });
    } catch (error) {
        console.error('Error deleting event:', error);
        res.status(500).json({
            success: false,
            error: { code: 'DELETE_ERROR', message: 'Failed to delete event' }
        });
    }
});

export default router;
