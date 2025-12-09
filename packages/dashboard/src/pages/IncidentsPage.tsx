// =====================================================================
// Incidents Page
// View and manage all detected incidents
// =====================================================================

import { useEffect, useState } from 'react';
import { useIncidentStore } from '../stores/incident.store';
import { useSessionStore } from '../stores/session.store';
import { IncidentDetail } from '../components/incidents/IncidentDetail';
import { formatSessionTime, formatIncidentType, formatSeverity } from '@controlbox/common';
import type { IncidentEvent } from '@controlbox/common';

export function IncidentsPage() {
    const { incidents, selectedIncident, selectIncident, initializeListeners } = useIncidentStore();
    const { connect } = useSessionStore();
    const [showModal, setShowModal] = useState(false);

    // Filters
    const [typeFilter, setTypeFilter] = useState<string>('');
    const [severityFilter, setSeverityFilter] = useState<string>('');
    const [statusFilter, setStatusFilter] = useState<string>('');

    // Initialize WebSocket listeners
    useEffect(() => {
        connect();
        initializeListeners();
    }, [connect, initializeListeners]);

    // Open modal when incident selected
    useEffect(() => {
        if (selectedIncident) {
            setShowModal(true);
        }
    }, [selectedIncident]);

    const handleCloseModal = () => {
        setShowModal(false);
        selectIncident(null);
    };

    const handleIncidentAction = (action: 'penalty' | 'warning' | 'no_action' | 'dismiss') => {
        console.log('Incident action:', action, selectedIncident?.id);
        handleCloseModal();
    };

    // Apply filters
    const filteredIncidents = incidents.filter(incident => {
        if (typeFilter && incident.type !== typeFilter) return false;
        if (severityFilter && incident.severity !== severityFilter) return false;
        if (statusFilter && incident.status !== statusFilter) return false;
        return true;
    });

    // Sort by session time (most recent first)
    const sortedIncidents = [...filteredIncidents].sort((a, b) => b.sessionTimeMs - a.sessionTimeMs);

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white">Incidents</h2>
                    <p className="text-slate-400">Review and manage all detected incidents</p>
                </div>
                <div className="flex gap-2">
                    <select
                        className="input w-40"
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                    >
                        <option value="">All Types</option>
                        <option value="contact">Contact</option>
                        <option value="off_track">Off Track</option>
                        <option value="spin">Spin</option>
                        <option value="blocking">Blocking</option>
                        <option value="unsafe_rejoin">Unsafe Rejoin</option>
                    </select>
                    <select
                        className="input w-32"
                        value={severityFilter}
                        onChange={(e) => setSeverityFilter(e.target.value)}
                    >
                        <option value="">All Severity</option>
                        <option value="light">Light</option>
                        <option value="medium">Medium</option>
                        <option value="heavy">Heavy</option>
                    </select>
                    <select
                        className="input w-32"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="under_review">Under Review</option>
                        <option value="reviewed">Reviewed</option>
                        <option value="dismissed">Dismissed</option>
                        <option value="escalated">Escalated</option>
                    </select>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatBlock
                    label="Total"
                    value={incidents.length}
                    color="slate"
                />
                <StatBlock
                    label="Pending"
                    value={incidents.filter(i => i.status === 'pending').length}
                    color="blue"
                />
                <StatBlock
                    label="Under Review"
                    value={incidents.filter(i => i.status === 'under_review').length}
                    color="purple"
                />
                <StatBlock
                    label="Resolved"
                    value={incidents.filter(i => ['reviewed', 'dismissed', 'escalated'].includes(i.status)).length}
                    color="green"
                />
            </div>

            {/* Incidents table */}
            <div className="card">
                <div className="card-header">
                    <h3 className="font-semibold text-white">All Incidents</h3>
                    <span className="text-sm text-slate-400">
                        {sortedIncidents.length} of {incidents.length} shown
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="text-left text-slate-400 text-xs uppercase tracking-wider border-b border-slate-700/50">
                                <th className="px-4 py-3">Time</th>
                                <th className="px-4 py-3">Lap</th>
                                <th className="px-4 py-3">Type</th>
                                <th className="px-4 py-3">Drivers</th>
                                <th className="px-4 py-3">Severity</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedIncidents.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-12 text-slate-400">
                                        {incidents.length === 0
                                            ? 'No incidents found'
                                            : 'No incidents match the current filters'}
                                    </td>
                                </tr>
                            ) : (
                                sortedIncidents.map(incident => (
                                    <IncidentRow
                                        key={incident.id}
                                        incident={incident}
                                        onSelect={() => selectIncident(incident)}
                                    />
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Incident Detail Modal */}
            {showModal && selectedIncident && (
                <IncidentDetail
                    incident={selectedIncident}
                    onClose={handleCloseModal}
                    onAction={handleIncidentAction}
                />
            )}
        </div>
    );
}

// --- Helper Components ---

function StatBlock({ label, value, color }: { label: string; value: number; color: string }) {
    const colorClasses: Record<string, string> = {
        slate: 'bg-slate-700/50 text-slate-300',
        blue: 'bg-blue-500/20 text-blue-400',
        purple: 'bg-purple-500/20 text-purple-400',
        green: 'bg-green-500/20 text-green-400',
    };

    return (
        <div className={`rounded-lg p-4 ${colorClasses[color]}`}>
            <p className="text-sm opacity-80">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
        </div>
    );
}

function IncidentRow({ incident, onSelect }: { incident: IncidentEvent; onSelect: () => void }) {
    const severityColors: Record<string, string> = {
        light: 'bg-amber-500/20 text-amber-400',
        medium: 'bg-orange-500/20 text-orange-400',
        heavy: 'bg-red-500/20 text-red-400',
    };

    const statusColors: Record<string, string> = {
        pending: 'bg-blue-500/20 text-blue-400',
        under_review: 'bg-purple-500/20 text-purple-400',
        reviewed: 'bg-green-500/20 text-green-400',
        dismissed: 'bg-slate-500/20 text-slate-400',
        escalated: 'bg-red-500/20 text-red-400',
    };

    return (
        <tr className="table-row cursor-pointer" onClick={onSelect}>
            <td className="px-4 py-3 text-slate-300 font-mono text-sm">
                {formatSessionTime(incident.sessionTimeMs)}
            </td>
            <td className="px-4 py-3 text-white">
                {incident.lapNumber}
            </td>
            <td className="px-4 py-3 text-slate-300">
                {formatIncidentType(incident.type)}
            </td>
            <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
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
                            #{driver.carNumber}
                        </span>
                    ))}
                    {incident.involvedDrivers.length > 3 && (
                        <span className="text-xs text-slate-500">
                            +{incident.involvedDrivers.length - 3}
                        </span>
                    )}
                </div>
            </td>
            <td className="px-4 py-3">
                <span className={`badge ${severityColors[incident.severity]}`}>
                    {formatSeverity(incident.severity)}
                </span>
            </td>
            <td className="px-4 py-3">
                <span className={`badge ${statusColors[incident.status]}`}>
                    {incident.status.replace('_', ' ')}
                </span>
            </td>
            <td className="px-4 py-3">
                <button
                    className="btn btn-secondary py-1 px-3 text-sm"
                    onClick={(e) => {
                        e.stopPropagation();
                        onSelect();
                    }}
                >
                    Review
                </button>
            </td>
        </tr>
    );
}
