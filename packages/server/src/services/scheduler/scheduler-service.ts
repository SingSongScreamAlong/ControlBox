// =====================================================================
// Scheduler Service
// Background jobs for pre-race reminders and maintenance tasks
// =====================================================================

import { pool } from '../../db/client.js';
import { getDiscordService } from '../discord/discord-service.js';

// Check interval (every 5 minutes)
const CHECK_INTERVAL = 5 * 60 * 1000;

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

interface UpcomingEvent {
    id: string;
    league_id: string;
    season_id: string;
    name: string;
    scheduled_at: Date;
    track_name: string | null;
    track_config: string | null;
    reminder_hours: number;
}

export class SchedulerService {
    private isRunning = false;

    /**
     * Start the scheduler
     */
    start(): void {
        if (this.isRunning) {
            console.log('Scheduler already running');
            return;
        }

        console.log('Starting pre-race reminder scheduler...');
        this.isRunning = true;

        // Run immediately, then on interval
        this.checkReminders();
        schedulerInterval = setInterval(() => this.checkReminders(), CHECK_INTERVAL);
    }

    /**
     * Stop the scheduler
     */
    stop(): void {
        if (schedulerInterval) {
            clearInterval(schedulerInterval);
            schedulerInterval = null;
        }
        this.isRunning = false;
        console.log('Scheduler stopped');
    }

    /**
     * Check for events needing reminders
     */
    private async checkReminders(): Promise<void> {
        try {
            // Find events that:
            // 1. Are scheduled within their reminder window
            // 2. Haven't started yet
            // 3. Haven't had a reminder sent
            // 4. Have an active license
            // 5. Have Discord enabled with a configured reminder

            const upcomingEvents = await pool.query<UpcomingEvent>(`
                SELECT e.id, e.league_id, e.season_id, e.name, e.scheduled_at, 
                       e.track_name, e.track_config,
                       dc.pre_race_reminder_hours as reminder_hours
                FROM events e
                JOIN licenses l ON l.season_id = e.season_id AND l.status = 'active'
                JOIN league_discord_configs dc ON dc.league_id = e.league_id AND dc.is_enabled = true
                LEFT JOIN scheduled_reminders sr ON sr.event_id = e.id AND sr.reminder_type = 'pre_race'
                WHERE e.started_at IS NULL
                  AND e.scheduled_at > NOW()
                  AND e.scheduled_at <= NOW() + (dc.pre_race_reminder_hours || ' hours')::interval
                  AND sr.id IS NULL
                ORDER BY e.scheduled_at ASC
                LIMIT 10
            `);

            if (upcomingEvents.rows.length === 0) {
                return;
            }

            console.log(`Found ${upcomingEvents.rows.length} events needing reminders`);

            const discordService = getDiscordService();

            for (const event of upcomingEvents.rows) {
                try {
                    // Build event object for Discord service
                    const eventObj = {
                        id: event.id,
                        leagueId: event.league_id,
                        seasonId: event.season_id,
                        seriesId: '', // Not needed for reminder
                        name: event.name,
                        scheduledAt: event.scheduled_at,
                        trackName: event.track_name ?? undefined,
                        trackConfig: event.track_config ?? undefined,
                        createdAt: new Date()
                    };

                    // Send the reminder
                    await discordService.sendPreRaceReminder(eventObj);

                    // Log that reminder was sent
                    await pool.query(
                        `INSERT INTO scheduled_reminders (event_id, reminder_type, scheduled_for, sent_at)
                         VALUES ($1, 'pre_race', $2, NOW())`,
                        [event.id, event.scheduled_at]
                    );

                    console.log(`✓ Sent pre-race reminder for: ${event.name}`);
                } catch (err) {
                    console.error(`Failed to send reminder for event ${event.id}:`, err);
                }
            }
        } catch (err) {
            console.error('Scheduler check failed:', err);
        }
    }

    /**
     * Check for expired licenses and send season-end notifications
     */
    async checkExpiredLicenses(): Promise<void> {
        try {
            // Find licenses that just expired (within last hour)
            const expiredLicenses = await pool.query(`
                SELECT l.id, l.league_id, l.season_id, s.name as season_name
                FROM licenses l
                JOIN seasons s ON s.id = l.season_id
                LEFT JOIN discord_notifications dn ON dn.league_id = l.league_id 
                    AND dn.notification_type = 'season_ended'
                    AND dn.created_at > l.expires_at - INTERVAL '1 hour'
                WHERE l.status = 'expired'
                  AND l.expires_at > NOW() - INTERVAL '1 hour'
                  AND l.expires_at <= NOW()
                  AND dn.id IS NULL
            `);

            if (expiredLicenses.rows.length === 0) {
                return;
            }

            const discordService = getDiscordService();

            for (const license of expiredLicenses.rows) {
                await discordService.sendSeasonEnded(
                    license.league_id,
                    license.season_id,
                    license.season_name
                );
                console.log(`✓ Sent season-end notification for: ${license.season_name}`);
            }
        } catch (err) {
            console.error('License expiry check failed:', err);
        }
    }

    /**
     * Cleanup old data (run daily)
     */
    async cleanupOldData(): Promise<void> {
        try {
            // Clean up old notifications (older than 90 days)
            await pool.query(`
                DELETE FROM discord_notifications WHERE created_at < NOW() - INTERVAL '90 days'
            `);

            // Clean up old audit logs (older than 1 year)
            await pool.query(`
                DELETE FROM scoring_audit_log WHERE created_at < NOW() - INTERVAL '1 year'
            `);

            console.log('✓ Cleanup completed');
        } catch (err) {
            console.error('Cleanup failed:', err);
        }
    }
}

// Singleton
let schedulerService: SchedulerService | null = null;

export function getSchedulerService(): SchedulerService {
    if (!schedulerService) {
        schedulerService = new SchedulerService();
    }
    return schedulerService;
}

/**
 * Initialize scheduler on server start
 */
export function initScheduler(): void {
    const scheduler = getSchedulerService();
    scheduler.start();
}
