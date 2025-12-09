// =====================================================================
// Incident Panel Component
// Displays detected incidents for steward review
// =====================================================================

import { useIncidentStore } from '../../stores/incident.store';
import { formatIncidentType, formatSeverity, formatContactType } from '@controlbox/common';
import type { IncidentEvent } from '@controlbox/common';

export function IncidentPanel() {
    const { incidents, selectedIncident, selectIncident } = useIncidentStore();

    // Get pending incidents first, then others
    const sortedIncidents = [...incidents].sort((a, b) => {
        // Pending first
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        // Then by time (most recent first)
        return b.sessionTimeMs - a.sessionTimeMs;
    });

    const pendingCount = incidents.filter(i => i.status === 'pending').length;

    return (
        <div className="card h-full flex flex-col">
            <div className="card-header">
                <h3 className="font-semibold text-white">Incidents</h3>
                <span className={`badge ${pendingCount > 0 ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-slate-700 text-slate-300'}`}>
                    {pendingCount} pending
                </span>
            </div>

            <div className="flex-1 overflow-y-auto">
                {sortedIncidents.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                        <p>No incidents detected</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-700/50">
                        {sortedIncidents.map(incident => (
                            <IncidentItem
                                key={incident.id}
                                incident={incident}
                                isSelected={selectedIncident?.id === incident.id}
                                onSelect={() => selectIncident(incident)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

interface IncidentItemProps {
    incident: IncidentEvent;
    isSelected: boolean;
    onSelect: () => void;
}

function IncidentItem({ incident, isSelected, onSelect }: IncidentItemProps) {
    const severityColors: Record<string, string> = {
        light: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
        medium: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
        heavy: 'bg-red-500/20 text-red-400 border-red-500/30',
    };

    const statusColors: Record<string, string> = {
        pending: 'bg-blue-500/20 text-blue-400',
        reviewing: 'bg-purple-500/20 text-purple-400',
        penalty_issued: 'bg-red-500/20 text-red-400',
        no_action: 'bg-green-500/20 text-green-400',
        dismissed: 'bg-slate-500/20 text-slate-400',
    };

    return (
        <button
            onClick={onSelect}
            className={`w-full text-left px-4 py-3 transition-colors hover:bg-slate-700/30 ${isSelected ? 'bg-primary-500/10 border-l-2 border-primary-500' : ''
                }`}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                    {/* Type and severity */}
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`badge border ${severityColors[incident.severity]}`}>
                            {formatSeverity(incident.severity).toUpperCase()}
                        </span>
                        <span className="font-medium text-white">
                            {formatIncidentType(incident.type)}
                        </span>
                    </div>

                    {/* Contact type if applicable */}
                    {incident.contactType && (
                        <p className="text-sm text-slate-400 mb-1">
                            {formatContactType(incident.contactType)}
                        </p>
                    )}

                    {/* Drivers involved */}
                    <div className="flex flex-wrap gap-1 mt-2">
                        {incident.involvedDrivers.slice(0, 3).map(driver => (
                            <span
                                key={driver.driverId}
                                className={`text-xs px-2 py-0.5 rounded ${driver.role === 'aggressor'
                                        ? 'bg-red-500/20 text-red-300'
                                        : driver.role === 'victim'
                                            ? 'bg-green-500/20 text-green-300'
                                            : 'bg-slate-600/50 text-slate-300'
                                    }`}
                            >
                                #{driver.carNumber} {driver.driverName.split(' ').pop()}
                                {driver.faultProbability && (
                                    <span className="ml-1 opacity-75">
                                        ({Math.round(driver.faultProbability * 100)}%)
                                    </span>
                                )}
                            </span>
                        ))}
                        {incident.involvedDrivers.length > 3 && (
                            <span className="text-xs text-slate-500">
                                +{incident.involvedDrivers.length - 3} more
                            </span>
                        )}
                    </div>
                </div>

                {/* Status and lap */}
                <div className="flex flex-col items-end gap-1">
                    <span className={`badge ${statusColors[incident.status] || 'bg-slate-600'}`}>
                        {incident.status.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-slate-500">
                        Lap {incident.lapNumber}
                    </span>
                </div>
            </div>

            {/* AI recommendation if available */}
            {incident.aiAnalysis && (
                <div className="mt-2 p-2 bg-slate-800/50 rounded text-xs">
                    <span className="text-slate-400">AI: </span>
                    <span className="text-primary-400">
                        {incident.aiAnalysis.recommendation}
                    </span>
                    <span className="text-slate-500 ml-1">
                        ({Math.round(incident.aiAnalysis.confidence * 100)}% conf)
                    </span>
                </div>
            )}
        </button>
    );
}
