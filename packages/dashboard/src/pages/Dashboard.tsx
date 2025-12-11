// =====================================================================
// Dashboard Page
// Main overview of the race control system
// =====================================================================

import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSessionStore } from '../stores/session.store';
import { useIncidentStore } from '../stores/incident.store';
import { TrackMap } from '../components/session/TrackMap';

export function Dashboard() {
    const { currentSession, connectionStatus, connect } = useSessionStore();
    const { incidents, penalties } = useIncidentStore();

    // Connect to WebSocket on mount
    useEffect(() => {
        connect();
    }, [connect]);

    // Calculate stats
    const pendingIncidents = incidents.filter(i => i.status === 'pending').length;
    const pendingPenalties = penalties.filter(p => p.status === 'proposed').length;
    const activeSessions = currentSession ? 1 : 0;

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white">Dashboard</h2>
                    <p className="text-slate-400">Welcome to ControlBox Race Control</p>
                </div>
                <div className="flex items-center gap-3">
                    <ConnectionStatus status={connectionStatus} />
                    <Link to="/session/demo" className="btn btn-primary">
                        Launch Demo Session
                    </Link>
                </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Active Sessions"
                    value={String(activeSessions)}
                    icon="🏎️"
                    color="primary"
                />
                <StatCard
                    title="Pending Incidents"
                    value={String(pendingIncidents)}
                    icon="⚠️"
                    color="amber"
                />
                <StatCard
                    title="Pending Penalties"
                    value={String(pendingPenalties)}
                    icon="🚩"
                    color="red"
                />
                <StatCard
                    title="Total Incidents"
                    value={String(incidents.length)}
                    icon="📊"
                    color="green"
                />
            </div>

            {/* Quick actions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Current Session Card */}
                <div className="lg:col-span-2 card">
                    <div className="card-header">
                        <h3 className="font-semibold text-white">Current Session</h3>
                    </div>
                    <div className="card-body">
                        {currentSession ? (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="text-lg font-semibold text-white">
                                            {currentSession.trackName}
                                        </h4>
                                        <p className="text-slate-400">
                                            {currentSession.sessionType.charAt(0).toUpperCase() +
                                                currentSession.sessionType.slice(1)} Session
                                        </p>
                                    </div>
                                    <Link
                                        to={`/session/${currentSession.id}`}
                                        className="btn btn-primary"
                                    >
                                        Open Session
                                    </Link>
                                </div>
                                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-700">
                                    <div>
                                        <p className="text-slate-400 text-sm">Drivers</p>
                                        <p className="text-xl font-bold text-white">
                                            {currentSession.driverCount}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-slate-400 text-sm">Incidents</p>
                                        <p className="text-xl font-bold text-white">
                                            {currentSession.incidentCount}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-slate-400 text-sm">Penalties</p>
                                        <p className="text-xl font-bold text-white">
                                            {currentSession.penaltyCount}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-slate-400">
                                <p>No active session</p>
                                <p className="text-sm mt-1">
                                    Start a new session or connect to a running race
                                </p>
                                <Link
                                    to="/session/demo"
                                    className="btn btn-secondary mt-4 inline-block"
                                >
                                    Launch Demo
                                </Link>
                            </div>
                        )}
                    </div>
                </div>

                {/* Track Map - show when session active */}
                {currentSession && (
                    <div className="card">
                        <TrackMap
                            showCorners={true}
                            incidentZones={incidents.slice(0, 5).map(i => ({
                                lapDistPct: (i.lapNumber || 0) % 100 / 100,
                                severity: i.severity as 'light' | 'medium' | 'heavy'
                            }))}
                        />
                    </div>
                )}

                {/* Quick Links */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="font-semibold text-white">Quick Links</h3>
                    </div>
                    <div className="card-body p-0">
                        <nav className="divide-y divide-slate-700/50">
                            <QuickLink
                                to="/incidents"
                                label="View All Incidents"
                                badge={incidents.length > 0 ? String(incidents.length) : undefined}
                            />
                            <QuickLink
                                to="/rulebooks"
                                label="Manage Rulebooks"
                            />
                            <QuickLink
                                to="/reports"
                                label="Session Reports"
                            />
                        </nav>
                    </div>
                </div>
            </div>

            {/* Recent Incidents */}
            {incidents.length > 0 && (
                <div className="card">
                    <div className="card-header">
                        <h3 className="font-semibold text-white">Recent Incidents</h3>
                        <Link to="/incidents" className="text-sm text-primary-400 hover:text-primary-300">
                            View all →
                        </Link>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="text-left text-slate-400 text-xs uppercase tracking-wider border-b border-slate-700/50">
                                    <th className="px-4 py-3">Lap</th>
                                    <th className="px-4 py-3">Type</th>
                                    <th className="px-4 py-3">Drivers</th>
                                    <th className="px-4 py-3">Severity</th>
                                    <th className="px-4 py-3">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {incidents.slice(0, 5).map(incident => (
                                    <tr key={incident.id} className="table-row">
                                        <td className="px-4 py-3 text-white">
                                            {incident.lapNumber}
                                        </td>
                                        <td className="px-4 py-3 text-slate-300">
                                            {incident.type}
                                        </td>
                                        <td className="px-4 py-3 text-slate-300">
                                            {incident.involvedDrivers.map(d => d.carNumber).join(', ')}
                                        </td>
                                        <td className="px-4 py-3">
                                            <SeverityBadge severity={incident.severity} />
                                        </td>
                                        <td className="px-4 py-3">
                                            <StatusBadge status={incident.status} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

// --- Helper Components ---

interface StatCardProps {
    title: string;
    value: string;
    icon: string;
    color: 'primary' | 'amber' | 'red' | 'green';
}

function StatCard({ title, value, icon, color }: StatCardProps) {
    const colorClasses = {
        primary: 'from-primary-500/20 to-primary-600/10 border-primary-500/30',
        amber: 'from-amber-500/20 to-amber-600/10 border-amber-500/30',
        red: 'from-red-500/20 to-red-600/10 border-red-500/30',
        green: 'from-green-500/20 to-green-600/10 border-green-500/30',
    };

    return (
        <div className={`card bg-gradient-to-br ${colorClasses[color]} p-4`}>
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-slate-400 text-sm">{title}</p>
                    <p className="text-3xl font-bold text-white mt-1">{value}</p>
                </div>
                <span className="text-3xl opacity-80">{icon}</span>
            </div>
        </div>
    );
}

function ConnectionStatus({ status }: { status: 'connected' | 'connecting' | 'disconnected' }) {
    const statusConfig = {
        connected: { color: 'bg-green-500', label: 'Connected' },
        connecting: { color: 'bg-amber-500 animate-pulse', label: 'Connecting...' },
        disconnected: { color: 'bg-red-500', label: 'Disconnected' },
    };

    const config = statusConfig[status];

    return (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800">
            <span className={`w-2 h-2 rounded-full ${config.color}`} />
            <span className="text-sm text-slate-300">{config.label}</span>
        </div>
    );
}

function QuickLink({ to, label, badge }: { to: string; label: string; badge?: string }) {
    return (
        <Link
            to={to}
            className="flex items-center justify-between px-4 py-3 hover:bg-slate-700/30 transition-colors"
        >
            <span className="text-slate-200">{label}</span>
            {badge && (
                <span className="badge bg-primary-500/20 text-primary-400">{badge}</span>
            )}
        </Link>
    );
}

function SeverityBadge({ severity }: { severity: string }) {
    const colors: Record<string, string> = {
        light: 'bg-amber-500/20 text-amber-400',
        medium: 'bg-orange-500/20 text-orange-400',
        heavy: 'bg-red-500/20 text-red-400',
    };
    return (
        <span className={`badge ${colors[severity] || 'bg-slate-600'}`}>
            {severity}
        </span>
    );
}

function StatusBadge({ status }: { status: string }) {
    const colors: Record<string, string> = {
        pending: 'bg-blue-500/20 text-blue-400',
        under_review: 'bg-purple-500/20 text-purple-400',
        reviewed: 'bg-green-500/20 text-green-400',
        dismissed: 'bg-slate-500/20 text-slate-400',
        escalated: 'bg-red-500/20 text-red-400',
    };
    return (
        <span className={`badge ${colors[status] || 'bg-slate-600'}`}>
            {status.replace('_', ' ')}
        </span>
    );
}
