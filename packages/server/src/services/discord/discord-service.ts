// =====================================================================
// Discord Service
// Outbound-only notifications for active licensed seasons
// Web app is primary UI - Discord is optional notification companion
// =====================================================================

import { pool } from '../../db/client.js';
import type {
    LeagueDiscordConfig,
    DiscordNotification,
    DiscordNotificationType,
    UpdateDiscordConfigRequest,
    Event,
    EventReport
} from '@controlbox/common';

// Discord API base URL
const DISCORD_API = 'https://discord.com/api/v10';
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const APP_URL = process.env.APP_URL || 'https://control.okboxbox.com';

interface ConfigRow {
    id: string;
    league_id: string;
    discord_guild_id: string;
    announcements_channel_id: string | null;
    results_channel_id: string | null;
    race_control_channel_id: string | null;
    steward_channel_id: string | null;
    is_enabled: boolean;
    pre_race_reminder_hours: number;
    bot_nickname: string | null;
    webhook_url: string | null;
    created_at: Date;
    updated_at: Date | null;
}

function mapRowToConfig(row: ConfigRow): LeagueDiscordConfig {
    return {
        id: row.id,
        leagueId: row.league_id,
        discordGuildId: row.discord_guild_id,
        announcementsChannelId: row.announcements_channel_id ?? undefined,
        resultsChannelId: row.results_channel_id ?? undefined,
        raceControlChannelId: row.race_control_channel_id ?? undefined,
        stewardChannelId: row.steward_channel_id ?? undefined,
        isEnabled: row.is_enabled,
        preRaceReminderHours: row.pre_race_reminder_hours,
        botNickname: row.bot_nickname ?? undefined,
        webhookUrl: row.webhook_url ?? undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at ?? undefined
    };
}

export class DiscordService {
    // ========================
    // Configuration
    // ========================

    /**
     * Get Discord config for a league
     */
    async getConfig(leagueId: string): Promise<LeagueDiscordConfig | null> {
        const result = await pool.query<ConfigRow>(
            `SELECT * FROM league_discord_configs WHERE league_id = $1`,
            [leagueId]
        );

        return result.rows.length > 0 ? mapRowToConfig(result.rows[0]) : null;
    }

    /**
     * Update Discord config for a league
     */
    async updateConfig(leagueId: string, data: UpdateDiscordConfigRequest): Promise<LeagueDiscordConfig> {
        // Check if config exists
        const existing = await this.getConfig(leagueId);

        if (existing) {
            // Update
            const result = await pool.query<ConfigRow>(
                `UPDATE league_discord_configs SET
                    discord_guild_id = COALESCE($2, discord_guild_id),
                    announcements_channel_id = COALESCE($3, announcements_channel_id),
                    results_channel_id = COALESCE($4, results_channel_id),
                    race_control_channel_id = COALESCE($5, race_control_channel_id),
                    steward_channel_id = COALESCE($6, steward_channel_id),
                    is_enabled = COALESCE($7, is_enabled),
                    pre_race_reminder_hours = COALESCE($8, pre_race_reminder_hours),
                    bot_nickname = COALESCE($9, bot_nickname),
                    webhook_url = COALESCE($10, webhook_url)
                 WHERE league_id = $1
                 RETURNING *`,
                [
                    leagueId,
                    data.discordGuildId,
                    data.announcementsChannelId,
                    data.resultsChannelId,
                    data.raceControlChannelId,
                    data.stewardChannelId,
                    data.isEnabled,
                    data.preRaceReminderHours,
                    data.botNickname,
                    data.webhookUrl
                ]
            );
            return mapRowToConfig(result.rows[0]);
        } else {
            // Create
            const result = await pool.query<ConfigRow>(
                `INSERT INTO league_discord_configs 
                    (league_id, discord_guild_id, announcements_channel_id, results_channel_id, 
                     race_control_channel_id, steward_channel_id, is_enabled, pre_race_reminder_hours,
                     bot_nickname, webhook_url)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                 RETURNING *`,
                [
                    leagueId,
                    data.discordGuildId ?? '',
                    data.announcementsChannelId,
                    data.resultsChannelId,
                    data.raceControlChannelId,
                    data.stewardChannelId,
                    data.isEnabled ?? true,
                    data.preRaceReminderHours ?? 2,
                    data.botNickname,
                    data.webhookUrl
                ]
            );
            return mapRowToConfig(result.rows[0]);
        }
    }

    // ========================
    // License Checks
    // ========================

    /**
     * Check if notifications are allowed for this event
     * Returns true only if Discord is enabled AND license is active
     */
    private async canNotify(leagueId: string, seasonId: string): Promise<{ allowed: boolean; config: LeagueDiscordConfig | null }> {
        const config = await this.getConfig(leagueId);

        if (!config || !config.isEnabled) {
            return { allowed: false, config: null };
        }

        // Check license status
        const licenseResult = await pool.query(
            `SELECT status FROM licenses WHERE season_id = $1 AND status = 'active'`,
            [seasonId]
        );

        if (licenseResult.rows.length === 0) {
            return { allowed: false, config };
        }

        return { allowed: true, config };
    }

    // ========================
    // Notifications
    // ========================

    /**
     * Send pre-race reminder
     */
    async sendPreRaceReminder(event: Event): Promise<void> {
        const { allowed, config } = await this.canNotify(event.leagueId, event.seasonId);
        if (!allowed || !config?.announcementsChannelId) return;

        const hoursUntil = Math.round((event.scheduledAt.getTime() - Date.now()) / (1000 * 60 * 60));

        const message = `📢 **Reminder:** ${event.name} starts in ${hoursUntil} hour${hoursUntil !== 1 ? 's' : ''}.\n` +
            `${event.trackName ? `🏁 Track: ${event.trackName}${event.trackConfig ? ` (${event.trackConfig})` : ''}\n` : ''}` +
            `Please be on the server and in the sim early for drivers' briefing.`;

        await this.sendMessage(
            config.announcementsChannelId,
            message,
            event.leagueId,
            event.id,
            'pre_race_reminder'
        );
    }

    /**
     * Send session started notification
     */
    async sendSessionStarted(event: Event): Promise<void> {
        const { allowed, config } = await this.canNotify(event.leagueId, event.seasonId);
        if (!allowed) return;

        const channelId = config!.raceControlChannelId ?? config!.announcementsChannelId;
        if (!channelId) return;

        const reportUrl = `${APP_URL}/events/${event.id}`;

        const message = `🟢 **ControlBox race control is now live** for ${event.name}.\n` +
            `📊 Live dashboard: ${reportUrl}`;

        await this.sendMessage(
            channelId,
            message,
            event.leagueId,
            event.id,
            'session_started'
        );
    }

    /**
     * Send report published notification
     */
    async sendReportPublished(event: Event, report: EventReport): Promise<void> {
        const { allowed, config } = await this.canNotify(event.leagueId, event.seasonId);
        if (!allowed || !config?.resultsChannelId) return;

        const reportUrl = `${APP_URL}/events/${event.id}/report`;
        const summary = report.summary;

        // Build top 3 finishers
        const top3 = summary.finishingOrder.slice(0, 3);
        const podiumText = top3.length > 0
            ? top3.map((d: { position: number; carNumber: string; driverName: string }) => `P${d.position}: #${d.carNumber} ${d.driverName}`).join(' | ')
            : 'Results pending';

        const message = `📊 **Final results for ${event.name}** are now available.\n\n` +
            `🏆 ${podiumText}\n\n` +
            `👥 ${summary.statistics.totalDrivers} drivers | ` +
            `✅ ${summary.statistics.finishers} finishers | ` +
            `⚠️ ${summary.statistics.totalIncidents} incidents\n\n` +
            `📋 Full report: ${reportUrl}`;

        await this.sendMessage(
            config.resultsChannelId,
            message,
            event.leagueId,
            event.id,
            'report_published'
        );
    }

    /**
     * Send penalty notification
     */
    async sendPenaltyNotification(
        event: Event,
        driverName: string,
        carNumber: string,
        penaltyType: string,
        reason: string,
        lap?: number
    ): Promise<void> {
        const { allowed, config } = await this.canNotify(event.leagueId, event.seasonId);
        if (!allowed) return;

        const channelId = config!.stewardChannelId ?? config!.resultsChannelId;
        if (!channelId) return;

        const lapText = lap ? `, Lap ${lap}` : '';

        const message = `⚖️ **Steward Decision:** Car #${carNumber} (${driverName}) – ${penaltyType}\n` +
            `Reason: ${reason}${lapText}`;

        await this.sendMessage(
            channelId,
            message,
            event.leagueId,
            event.id,
            'penalty_finalized'
        );
    }

    /**
     * Send season ended notification (one-time when license expires)
     */
    async sendSeasonEnded(leagueId: string, _seasonId: string, seasonName: string): Promise<void> {
        const config = await this.getConfig(leagueId);
        if (!config || !config.isEnabled || !config.announcementsChannelId) return;

        const message = `⏹ **ControlBox race control support** for ${seasonName} has ended.\n` +
            `Contact your league admin if you believe this is incorrect.`;

        await this.sendMessage(
            config.announcementsChannelId,
            message,
            leagueId,
            undefined,
            'season_ended'
        );
    }

    /**
     * Send a test notification
     */
    async sendTestMessage(leagueId: string, channelId: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
        const message = `✅ **ControlBox test notification**\n` +
            `Discord integration is working correctly for your league.`;

        return this.sendMessage(channelId, message, leagueId, undefined, 'test_message');
    }

    // ========================
    // Low-level Discord API
    // ========================

    /**
     * Send a message to a Discord channel
     */
    private async sendMessage(
        channelId: string,
        content: string,
        leagueId: string,
        eventId: string | undefined,
        notificationType: DiscordNotificationType
    ): Promise<{ success: boolean; messageId?: string; error?: string }> {
        // Log the attempt
        const logResult = await pool.query(
            `INSERT INTO discord_notifications (league_id, event_id, notification_type, channel_id, message_content)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            [leagueId, eventId ?? null, notificationType, channelId, content]
        );
        const notificationId = logResult.rows[0].id;

        if (!BOT_TOKEN) {
            const error = 'Discord bot token not configured';
            await this.updateNotificationLog(notificationId, undefined, error);
            console.warn('Discord notification skipped:', error);
            return { success: false, error };
        }

        try {
            const response = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bot ${BOT_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ content })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const error = `Discord API error: ${response.status} - ${JSON.stringify(errorData)}`;
                await this.updateNotificationLog(notificationId, undefined, error);
                return { success: false, error };
            }

            const data = await response.json() as { id: string };
            await this.updateNotificationLog(notificationId, data.id);

            console.log(`✓ Discord notification sent: ${notificationType} to channel ${channelId}`);
            return { success: true, messageId: data.id };
        } catch (err) {
            const error = err instanceof Error ? err.message : 'Unknown error';
            await this.updateNotificationLog(notificationId, undefined, error);
            return { success: false, error };
        }
    }

    /**
     * Update notification log with result
     */
    private async updateNotificationLog(
        notificationId: string,
        discordMessageId: string | undefined,
        errorMessage?: string
    ): Promise<void> {
        await pool.query(
            `UPDATE discord_notifications 
             SET sent_at = $2, discord_message_id = $3, error_message = $4
             WHERE id = $1`,
            [
                notificationId,
                errorMessage ? null : new Date(),
                discordMessageId ?? null,
                errorMessage ?? null
            ]
        );
    }

    /**
     * Get notification log for a league
     */
    async getNotificationLog(leagueId: string, limit: number = 50): Promise<DiscordNotification[]> {
        const result = await pool.query(
            `SELECT * FROM discord_notifications 
             WHERE league_id = $1 
             ORDER BY created_at DESC 
             LIMIT $2`,
            [leagueId, limit]
        );

        return result.rows.map(row => ({
            id: row.id,
            leagueId: row.league_id,
            eventId: row.event_id ?? undefined,
            notificationType: row.notification_type,
            channelId: row.channel_id,
            messageContent: row.message_content,
            discordMessageId: row.discord_message_id ?? undefined,
            sentAt: row.sent_at ?? undefined,
            errorMessage: row.error_message ?? undefined,
            retryCount: row.retry_count,
            createdAt: row.created_at
        }));
    }

    /**
     * Get bot invite URL
     */
    getBotInviteUrl(): string {
        const clientId = process.env.DISCORD_CLIENT_ID || 'YOUR_CLIENT_ID';
        // Minimal permissions: Send Messages, Embed Links
        const permissions = '2048';
        return `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=${permissions}&scope=bot`;
    }
}

// Singleton instance
let discordService: DiscordService | null = null;

export function getDiscordService(): DiscordService {
    if (!discordService) {
        discordService = new DiscordService();
    }
    return discordService;
}
