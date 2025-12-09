// =====================================================================
// Discord Routes
// League Discord integration configuration
// =====================================================================

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getDiscordService } from '../../services/discord/discord-service.js';

interface UpdateDiscordConfigRequest {
    discordGuildId?: string;
    announcementsChannelId?: string;
    resultsChannelId?: string;
    raceControlChannelId?: string;
    stewardChannelId?: string;
    isEnabled?: boolean;
    preRaceReminderHours?: number;
}

const router = Router();

// All routes require auth
router.use(requireAuth);

/**
 * Get Discord config for a league
 * GET /api/leagues/:leagueId/discord
 */
router.get('/leagues/:leagueId/discord', async (req: Request, res: Response) => {
    try {
        const discordService = getDiscordService();
        const config = await discordService.getConfig(req.params.leagueId);

        res.json({
            success: true,
            data: {
                config,
                botInviteUrl: discordService.getBotInviteUrl()
            }
        });
    } catch (error) {
        console.error('Error fetching Discord config:', error);
        res.status(500).json({
            success: false,
            error: { code: 'FETCH_ERROR', message: 'Failed to fetch Discord config' }
        });
    }
});

/**
 * Update Discord config for a league
 * PUT /api/leagues/:leagueId/discord
 */
router.put('/leagues/:leagueId/discord', async (req: Request, res: Response) => {
    try {
        const data = req.body as UpdateDiscordConfigRequest;

        if (!data.discordGuildId) {
            res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'discordGuildId is required' }
            });
            return;
        }

        const discordService = getDiscordService();
        const config = await discordService.updateConfig(req.params.leagueId, data);

        res.json({
            success: true,
            data: config
        });
    } catch (error) {
        console.error('Error updating Discord config:', error);
        res.status(500).json({
            success: false,
            error: { code: 'UPDATE_ERROR', message: 'Failed to update Discord config' }
        });
    }
});

/**
 * Send test notification
 * POST /api/leagues/:leagueId/discord/test
 */
router.post('/leagues/:leagueId/discord/test', async (req: Request, res: Response) => {
    try {
        const { channelId } = req.body;

        if (!channelId) {
            res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'channelId is required' }
            });
            return;
        }

        const discordService = getDiscordService();
        const result = await discordService.sendTestMessage(req.params.leagueId, channelId);

        if (result.success) {
            res.json({
                success: true,
                data: { messageId: result.messageId }
            });
        } else {
            res.status(400).json({
                success: false,
                error: { code: 'SEND_FAILED', message: result.error || 'Failed to send test message' }
            });
        }
    } catch (error) {
        console.error('Error sending test notification:', error);
        res.status(500).json({
            success: false,
            error: { code: 'SEND_ERROR', message: 'Failed to send test notification' }
        });
    }
});

/**
 * Get notification log
 * GET /api/leagues/:leagueId/discord/logs
 */
router.get('/leagues/:leagueId/discord/logs', async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 50;

        const discordService = getDiscordService();
        const notifications = await discordService.getNotificationLog(req.params.leagueId, limit);

        res.json({
            success: true,
            data: notifications
        });
    } catch (error) {
        console.error('Error fetching notification logs:', error);
        res.status(500).json({
            success: false,
            error: { code: 'FETCH_ERROR', message: 'Failed to fetch notification logs' }
        });
    }
});

/**
 * Get bot invite URL (public info)
 * GET /api/discord/invite
 */
router.get('/invite', async (_req: Request, res: Response) => {
    try {
        const discordService = getDiscordService();

        res.json({
            success: true,
            data: { inviteUrl: discordService.getBotInviteUrl() }
        });
    } catch (error) {
        console.error('Error getting invite URL:', error);
        res.status(500).json({
            success: false,
            error: { code: 'ERROR', message: 'Failed to get invite URL' }
        });
    }
});

export default router;
