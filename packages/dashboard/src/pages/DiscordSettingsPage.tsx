// =====================================================================
// Discord Settings Page
// League Discord integration configuration
// =====================================================================

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useDiscordStore } from '../stores/discord.store';

export function DiscordSettingsPage() {
    const { leagueId } = useParams<{ leagueId: string }>();
    const {
        config,
        notifications,
        botInviteUrl,
        isLoading,
        isTesting,
        error,
        testResult,
        fetchConfig,
        updateConfig,
        sendTestMessage,
        fetchNotifications,
        clearTestResult
    } = useDiscordStore();

    // Form state
    const [discordGuildId, setDiscordGuildId] = useState('');
    const [announcementsChannelId, setAnnouncementsChannelId] = useState('');
    const [resultsChannelId, setResultsChannelId] = useState('');
    const [raceControlChannelId, setRaceControlChannelId] = useState('');
    const [stewardChannelId, setStewardChannelId] = useState('');
    const [preRaceReminderHours, setPreRaceReminderHours] = useState(2);
    const [isEnabled, setIsEnabled] = useState(true);
    const [testChannelId, setTestChannelId] = useState('');

    useEffect(() => {
        if (leagueId) {
            fetchConfig(leagueId);
            fetchNotifications(leagueId);
        }
    }, [leagueId, fetchConfig, fetchNotifications]);

    useEffect(() => {
        if (config) {
            setDiscordGuildId(config.discordGuildId || '');
            setAnnouncementsChannelId(config.announcementsChannelId || '');
            setResultsChannelId(config.resultsChannelId || '');
            setRaceControlChannelId(config.raceControlChannelId || '');
            setStewardChannelId(config.stewardChannelId || '');
            setPreRaceReminderHours(config.preRaceReminderHours || 2);
            setIsEnabled(config.isEnabled);
        }
    }, [config]);

    const handleSave = async () => {
        if (!leagueId) return;
        await updateConfig(leagueId, {
            discordGuildId,
            announcementsChannelId: announcementsChannelId || undefined,
            resultsChannelId: resultsChannelId || undefined,
            raceControlChannelId: raceControlChannelId || undefined,
            stewardChannelId: stewardChannelId || undefined,
            preRaceReminderHours,
            isEnabled
        });
    };

    const handleTest = async () => {
        if (!leagueId || !testChannelId) return;
        clearTestResult();
        await sendTestMessage(leagueId, testChannelId);
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    };

    if (isLoading && !config) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-white">Discord Integration</h1>
                <p className="text-slate-400">Configure Discord notifications for your league</p>
            </div>

            {error && (
                <div className="p-4 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400">
                    {error}
                </div>
            )}

            {/* Bot Invite */}
            {botInviteUrl && (
                <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-white font-medium">Add ControlBox Bot to Your Server</h3>
                            <p className="text-sm text-slate-400">First, invite the bot to your Discord server</p>
                        </div>
                        <a
                            href={botInviteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                        >
                            Invite Bot
                        </a>
                    </div>
                </div>
            )}

            {/* Configuration Form */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Configuration</h2>

                <div className="space-y-4">
                    {/* Enable Toggle */}
                    <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg">
                        <div>
                            <p className="text-white font-medium">Enable Discord Notifications</p>
                            <p className="text-sm text-slate-400">Turn on/off all Discord notifications</p>
                        </div>
                        <button
                            onClick={() => setIsEnabled(!isEnabled)}
                            className={`relative w-12 h-6 rounded-full transition-colors ${isEnabled ? 'bg-green-500' : 'bg-slate-600'}`}
                        >
                            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${isEnabled ? 'left-7' : 'left-1'}`} />
                        </button>
                    </div>

                    {/* Guild ID */}
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Discord Server (Guild) ID *</label>
                        <input
                            type="text"
                            value={discordGuildId}
                            onChange={e => setDiscordGuildId(e.target.value)}
                            placeholder="123456789012345678"
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            Enable Developer Mode in Discord, right-click your server → Copy ID
                        </p>
                    </div>

                    {/* Channel IDs */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Announcements Channel</label>
                            <input
                                type="text"
                                value={announcementsChannelId}
                                onChange={e => setAnnouncementsChannelId(e.target.value)}
                                placeholder="Channel ID"
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white"
                            />
                            <p className="text-xs text-slate-500 mt-1">Pre-race reminders</p>
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Results Channel</label>
                            <input
                                type="text"
                                value={resultsChannelId}
                                onChange={e => setResultsChannelId(e.target.value)}
                                placeholder="Channel ID"
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white"
                            />
                            <p className="text-xs text-slate-500 mt-1">Post-race reports</p>
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Race Control Channel</label>
                            <input
                                type="text"
                                value={raceControlChannelId}
                                onChange={e => setRaceControlChannelId(e.target.value)}
                                placeholder="Channel ID"
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white"
                            />
                            <p className="text-xs text-slate-500 mt-1">Session start notifications</p>
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Steward Channel</label>
                            <input
                                type="text"
                                value={stewardChannelId}
                                onChange={e => setStewardChannelId(e.target.value)}
                                placeholder="Channel ID"
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white"
                            />
                            <p className="text-xs text-slate-500 mt-1">Penalty decisions</p>
                        </div>
                    </div>

                    {/* Reminder Hours */}
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Pre-Race Reminder</label>
                        <select
                            value={preRaceReminderHours}
                            onChange={e => setPreRaceReminderHours(Number(e.target.value))}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white"
                        >
                            <option value={1}>1 hour before</option>
                            <option value={2}>2 hours before</option>
                            <option value={3}>3 hours before</option>
                            <option value={6}>6 hours before</option>
                            <option value={12}>12 hours before</option>
                            <option value={24}>24 hours before</option>
                        </select>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={isLoading || !discordGuildId}
                        className="w-full px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50"
                    >
                        {isLoading ? 'Saving...' : 'Save Configuration'}
                    </button>
                </div>
            </div>

            {/* Test Message */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Test Connection</h2>

                <div className="flex gap-3">
                    <input
                        type="text"
                        value={testChannelId}
                        onChange={e => setTestChannelId(e.target.value)}
                        placeholder="Channel ID to test"
                        className="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white"
                    />
                    <button
                        onClick={handleTest}
                        disabled={isTesting || !testChannelId}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg disabled:opacity-50"
                    >
                        {isTesting ? 'Sending...' : 'Send Test'}
                    </button>
                </div>

                {testResult && (
                    <div className={`mt-3 p-3 rounded-lg ${testResult.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {testResult.message}
                    </div>
                )}
            </div>

            {/* Notification Log */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Recent Notifications</h2>

                {notifications.length === 0 ? (
                    <p className="text-slate-500">No notifications sent yet.</p>
                ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {notifications.slice(0, 20).map(notif => (
                            <div
                                key={notif.id}
                                className={`p-3 rounded-lg ${notif.errorMessage ? 'bg-red-500/10' : 'bg-slate-700/30'}`}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-medium text-slate-300 capitalize">
                                        {notif.notificationType.replace(/_/g, ' ')}
                                    </span>
                                    <span className="text-xs text-slate-500">
                                        {notif.sentAt ? formatDate(notif.sentAt) : formatDate(notif.createdAt)}
                                    </span>
                                </div>
                                <p className="text-sm text-slate-400 truncate">{notif.messageContent}</p>
                                {notif.errorMessage && (
                                    <p className="text-xs text-red-400 mt-1">{notif.errorMessage}</p>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
