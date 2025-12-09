// =====================================================================
// Discord Store
// State management for Discord integration
// =====================================================================

import { create } from 'zustand';
import { getAuthHeader } from './auth.store';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface DiscordConfig {
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
}

interface DiscordNotification {
    id: string;
    notificationType: string;
    channelId: string;
    messageContent: string;
    sentAt?: string;
    errorMessage?: string;
    createdAt: string;
}

interface DiscordState {
    config: DiscordConfig | null;
    notifications: DiscordNotification[];
    botInviteUrl: string | null;
    isLoading: boolean;
    isTesting: boolean;
    error: string | null;
    testResult: { success: boolean; message: string } | null;

    // Actions
    fetchConfig: (leagueId: string) => Promise<void>;
    updateConfig: (leagueId: string, data: Partial<DiscordConfig>) => Promise<void>;
    sendTestMessage: (leagueId: string, channelId: string) => Promise<void>;
    fetchNotifications: (leagueId: string) => Promise<void>;
    clearTestResult: () => void;
}

export const useDiscordStore = create<DiscordState>((set) => ({
    config: null,
    notifications: [],
    botInviteUrl: null,
    isLoading: false,
    isTesting: false,
    error: null,
    testResult: null,

    fetchConfig: async (leagueId: string) => {
        set({ isLoading: true, error: null });
        try {
            const response = await fetch(`${API_BASE}/api/leagues/${leagueId}/discord`, {
                headers: getAuthHeader()
            });
            const data = await response.json();

            if (data.success) {
                set({
                    config: data.data.config,
                    botInviteUrl: data.data.botInviteUrl,
                    isLoading: false
                });
            } else {
                set({ error: data.error?.message || 'Failed to fetch config', isLoading: false });
            }
        } catch (err) {
            set({ error: 'Network error', isLoading: false });
        }
    },

    updateConfig: async (leagueId: string, configData: Partial<DiscordConfig>) => {
        set({ isLoading: true, error: null });
        try {
            const response = await fetch(`${API_BASE}/api/leagues/${leagueId}/discord`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader()
                },
                body: JSON.stringify(configData)
            });
            const data = await response.json();

            if (data.success) {
                set({ config: data.data, isLoading: false });
            } else {
                set({ error: data.error?.message || 'Failed to update config', isLoading: false });
            }
        } catch (err) {
            set({ error: 'Network error', isLoading: false });
        }
    },

    sendTestMessage: async (leagueId: string, channelId: string) => {
        set({ isTesting: true, testResult: null });
        try {
            const response = await fetch(`${API_BASE}/api/leagues/${leagueId}/discord/test`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader()
                },
                body: JSON.stringify({ channelId })
            });
            const data = await response.json();

            if (data.success) {
                set({
                    isTesting: false,
                    testResult: { success: true, message: 'Test message sent successfully!' }
                });
            } else {
                set({
                    isTesting: false,
                    testResult: { success: false, message: data.error?.message || 'Failed to send test message' }
                });
            }
        } catch (err) {
            set({
                isTesting: false,
                testResult: { success: false, message: 'Network error' }
            });
        }
    },

    fetchNotifications: async (leagueId: string) => {
        try {
            const response = await fetch(`${API_BASE}/api/leagues/${leagueId}/discord/logs`, {
                headers: getAuthHeader()
            });
            const data = await response.json();

            if (data.success) {
                set({ notifications: data.data });
            }
        } catch (err) {
            console.error('Failed to fetch notifications:', err);
        }
    },

    clearTestResult: () => set({ testResult: null })
}));
