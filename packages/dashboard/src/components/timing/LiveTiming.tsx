// =====================================================================
// Live Timing Component
// Real-time race standings display
// =====================================================================

import { useSessionStore } from '../../stores/session.store';
import { formatLapTime } from '@controlbox/common';

/**
 * Format gap time in seconds to mm:ss.xxx or s.xxx
 */
function formatGapTime(seconds: number): string {
    if (seconds >= 60) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toFixed(3).padStart(6, '0')}`;
    }
    return seconds.toFixed(3);
}

export function LiveTiming() {
    const { timing, drivers, currentSession } = useSessionStore();

    if (!currentSession) {
        return (
            <div className="card">
                <div className="card-header">
                    <h3 className="font-semibold text-white">Live Timing</h3>
                </div>
                <div className="card-body text-center py-12 text-slate-400">
                    <p>No active session</p>
                    <p className="text-sm mt-1">Join a session to view live timing</p>
                </div>
            </div>
        );
    }

    // Sort by position
    const sortedTiming = [...timing].sort((a, b) => a.position - b.position);

    return (
        <div className="card">
            <div className="card-header">
                <h3 className="font-semibold text-white">Live Timing</h3>
                <div className="flex items-center gap-2">
                    <span className="badge bg-green-500/20 text-green-400 border border-green-500/30">
                        {currentSession.sessionType.toUpperCase()}
                    </span>
                    <span className="text-sm text-slate-400">
                        {drivers.length} drivers
                    </span>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="text-left text-slate-400 text-xs uppercase tracking-wider border-b border-slate-700/50">
                            <th className="px-4 py-3 w-12">Pos</th>
                            <th className="px-4 py-3 w-16">#</th>
                            <th className="px-4 py-3">Driver</th>
                            <th className="px-4 py-3 text-right">Gap</th>
                            <th className="px-4 py-3 text-right">Interval</th>
                            <th className="px-4 py-3 text-right">Last Lap</th>
                            <th className="px-4 py-3 text-right">Best Lap</th>
                            <th className="px-4 py-3 text-center">Laps</th>
                            <th className="px-4 py-3 text-center">Inc</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedTiming.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="text-center py-8 text-slate-400">
                                    Waiting for timing data...
                                </td>
                            </tr>
                        ) : (
                            sortedTiming.map((entry, index) => (
                                <TimingRow
                                    key={entry.driverId}
                                    entry={entry}
                                    isLeader={index === 0}
                                />
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

interface TimingRowProps {
    entry: {
        driverId: string;
        position: number;
        carNumber: string;
        driverName: string;
        gapToLeader: number;
        gapAhead: number;
        lastLapTime: number;
        bestLapTime: number;
        currentLap: number;
        incidentCount: number;
        inPit: boolean;
        isConnected: boolean;
    };
    isLeader: boolean;
}

function TimingRow({ entry, isLeader }: TimingRowProps) {
    const positionColors: Record<number, string> = {
        1: 'bg-amber-500/20 text-amber-400',
        2: 'bg-slate-400/20 text-slate-300',
        3: 'bg-orange-600/20 text-orange-400',
    };

    const posColor = positionColors[entry.position] || 'bg-slate-700/30 text-slate-400';

    return (
        <tr className="table-row">
            <td className="px-4 py-3">
                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-md font-bold text-sm ${posColor}`}>
                    {entry.position}
                </span>
            </td>
            <td className="px-4 py-3">
                <span className="font-mono font-bold text-white">
                    {entry.carNumber}
                </span>
            </td>
            <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                    <span className="font-medium text-white">{entry.driverName}</span>
                    {entry.inPit && (
                        <span className="badge bg-blue-500/20 text-blue-400 text-xs">PIT</span>
                    )}
                    {!entry.isConnected && (
                        <span className="badge bg-red-500/20 text-red-400 text-xs">OFF</span>
                    )}
                </div>
            </td>
            <td className="px-4 py-3 text-right font-mono text-sm">
                {isLeader ? (
                    <span className="text-slate-500">—</span>
                ) : (
                    <span className="text-red-400">
                        +{formatGapTime(entry.gapToLeader)}
                    </span>
                )}
            </td>
            <td className="px-4 py-3 text-right font-mono text-sm">
                {isLeader ? (
                    <span className="text-slate-500">—</span>
                ) : (
                    <span className="text-slate-300">
                        +{formatGapTime(entry.gapAhead)}
                    </span>
                )}
            </td>
            <td className="px-4 py-3 text-right font-mono text-sm text-slate-300">
                {entry.lastLapTime > 0 ? formatLapTime(entry.lastLapTime) : '—'}
            </td>
            <td className="px-4 py-3 text-right font-mono text-sm text-purple-400">
                {entry.bestLapTime > 0 ? formatLapTime(entry.bestLapTime) : '—'}
            </td>
            <td className="px-4 py-3 text-center text-slate-300">
                {entry.currentLap}
            </td>
            <td className="px-4 py-3 text-center">
                {entry.incidentCount > 0 ? (
                    <span className="badge bg-amber-500/20 text-amber-400">
                        {entry.incidentCount}x
                    </span>
                ) : (
                    <span className="text-slate-500">0x</span>
                )}
            </td>
        </tr>
    );
}
