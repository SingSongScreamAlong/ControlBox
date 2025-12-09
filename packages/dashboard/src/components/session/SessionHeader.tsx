// =====================================================================
// Session Header Component
// Displays current session info and status
// =====================================================================

import { useSessionStore } from '../../stores/session.store';

export function SessionHeader() {
    const { currentSession, connectionStatus, drivers } = useSessionStore();

    const statusColors: Record<'connected' | 'connecting' | 'disconnected', string> = {
        connected: 'bg-green-500',
        connecting: 'bg-amber-500 animate-pulse',
        disconnected: 'bg-red-500',
    };

    if (!currentSession) {
        return (
            <div className="bg-slate-800/50 border-b border-slate-700 px-6 py-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className={`w-2.5 h-2.5 rounded-full ${statusColors[connectionStatus]}`} />
                        <span className="text-slate-400">
                            {connectionStatus === 'connected' ? 'Connected - No Active Session' :
                                connectionStatus === 'connecting' ? 'Connecting...' :
                                    'Disconnected'}
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    const sessionTypeLabels: Record<string, string> = {
        practice: 'Practice',
        qualifying: 'Qualifying',
        race: 'Race',
        warmup: 'Warmup',
        lone_practice: 'Test Session',
        lone_qualify: 'Time Trial',
    };

    return (
        <div className="bg-slate-800/50 border-b border-slate-700 px-6 py-3">
            <div className="flex items-center justify-between">
                {/* Left - Connection and Session */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${statusColors[connectionStatus]}`} />
                        <span className="text-green-400 text-sm font-medium">LIVE</span>
                    </div>

                    <div className="h-4 w-px bg-slate-700" />

                    <div>
                        <span className="text-white font-semibold">
                            {currentSession.trackName}
                        </span>
                        <span className="text-slate-400 mx-2">•</span>
                        <span className="text-slate-300">
                            {sessionTypeLabels[currentSession.sessionType] || currentSession.sessionType}
                        </span>
                    </div>
                </div>

                {/* Center - Laps/Duration */}
                <div className="flex items-center gap-6">
                    {currentSession.sessionType === 'race' && currentSession.scheduledLaps && (
                        <div className="text-center">
                            <div className="text-2xl font-mono font-bold text-white">
                                {currentSession.scheduledLaps} Laps
                            </div>
                            <div className="text-xs text-slate-500 uppercase tracking-wider">Scheduled</div>
                        </div>
                    )}

                    {currentSession.durationSeconds && currentSession.durationSeconds > 0 && (
                        <div className="text-center">
                            <div className="text-2xl font-mono font-bold text-white">
                                {Math.floor(currentSession.durationSeconds / 60)}m
                            </div>
                            <div className="text-xs text-slate-500 uppercase tracking-wider">Duration</div>
                        </div>
                    )}
                </div>

                {/* Right - Drivers and Status */}
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <div className="text-white font-medium">{drivers.length}</div>
                        <div className="text-xs text-slate-500">Drivers</div>
                    </div>

                    <div className="h-8 w-px bg-slate-700" />

                    <StatusBadge status={currentSession.status} />
                </div>
            </div>
        </div>
    );
}

interface StatusBadgeProps {
    status: string;
}

function StatusBadge({ status }: StatusBadgeProps) {
    const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
        pending: { bg: 'bg-slate-600', text: 'text-slate-300', label: 'Pending' },
        active: { bg: 'bg-green-500', text: 'text-green-400', label: 'Active' },
        paused: { bg: 'bg-amber-500', text: 'text-amber-400', label: 'Paused' },
        finished: { bg: 'bg-blue-500', text: 'text-blue-400', label: 'Finished' },
        abandoned: { bg: 'bg-red-500', text: 'text-red-400', label: 'Abandoned' },
    };

    const style = statusStyles[status] || statusStyles.pending;

    return (
        <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${style.bg}`} />
            <span className={`text-sm font-medium ${style.text}`}>{style.label}</span>
        </div>
    );
}
