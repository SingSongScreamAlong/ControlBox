// =====================================================================
// Discord Integration Types
// Outbound-only notifications for active licensed seasons
// =====================================================================

/**
 * Discord configuration for a league
 * League owner manually configures after adding bot to server
 */
export interface LeagueDiscordConfig {
    id: string;
    leagueId: string;
    discordGuildId: string;
    announcementsChannelId?: string;
    resultsChannelId?: string;
    raceControlChannelId?: string;
    stewardChannelId?: string;
    isEnabled: boolean;
    preRaceReminderHours: number;
    botNickname?: string;
    webhookUrl?: string;
    createdAt: Date;
    updatedAt?: Date;
}

export interface UpdateDiscordConfigRequest {
    discordGuildId?: string;
    announcementsChannelId?: string;
    resultsChannelId?: string;
    raceControlChannelId?: string;
    stewardChannelId?: string;
    isEnabled?: boolean;
    preRaceReminderHours?: number;
    botNickname?: string;
    webhookUrl?: string;
}

// =====================================================================
// Notification Types
// =====================================================================

export type DiscordNotificationType =
    | 'pre_race_reminder'
    | 'session_started'
    | 'report_published'
    | 'penalty_finalized'
    | 'season_ended'
    | 'test_message';

export interface DiscordNotification {
    id: string;
    leagueId: string;
    eventId?: string;
    notificationType: DiscordNotificationType;
    channelId: string;
    messageContent: string;
    discordMessageId?: string;
    sentAt?: Date;
    errorMessage?: string;
    retryCount: number;
    createdAt: Date;
}

// =====================================================================
// Notification Payloads
// =====================================================================

export interface PreRaceReminderPayload {
    eventName: string;
    scheduledAt: Date;
    trackName?: string;
    hoursUntilStart: number;
}

export interface SessionStartedPayload {
    eventName: string;
    trackName?: string;
    controlBoxUrl: string;
}

export interface ReportPublishedPayload {
    eventName: string;
    topFinishers: Array<{
        position: number;
        driverName: string;
        carNumber: string;
    }>;
    totalDrivers: number;
    totalIncidents: number;
    reportUrl: string;
}

export interface PenaltyFinalizedPayload {
    eventName: string;
    driverName: string;
    carNumber: string;
    penaltyType: string;
    reason: string;
    lap?: number;
    turn?: string;
}

export interface SeasonEndedPayload {
    seasonName: string;
    seriesName: string;
}

// =====================================================================
// API Responses
// =====================================================================

export interface DiscordConfigResponse {
    config: LeagueDiscordConfig | null;
    botInviteUrl: string;
}

export interface DiscordNotificationLogResponse {
    notifications: DiscordNotification[];
    totalCount: number;
}

export interface TestNotificationResult {
    success: boolean;
    channelId: string;
    messageId?: string;
    error?: string;
}
