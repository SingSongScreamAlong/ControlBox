// =====================================================================
// Audit Log Page
// View all system audit events
// =====================================================================

import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/auth.store';

interface AuditEntry {
    id: string;
    actorId?: string;
    actorName?: string;
    actorEmail?: string;
    action: string;
    entityType: string;
    entityId?: string;
    description?: string;
    createdAt: string;
}

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function AuditLogPage() {
    const { accessToken } = useAuthStore();
    const [entries, setEntries] = useState<AuditEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState({
        entityType: '',
        action: ''
    });

    useEffect(() => {
        fetchAuditLog();
    }, []);

    const fetchAuditLog = async () => {
        try {
            const params = new URLSearchParams();
            if (filter.entityType) params.set('entityType', filter.entityType);
            if (filter.action) params.set('action', filter.action);

            const res = await fetch(`${API_BASE}/api/audit?${params}`, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            const data = await res.json();
            if (data.success) {
                setEntries(data.data);
            }
        } catch (err) {
            console.error('Failed to fetch audit log:', err);
        } finally {
            setLoading(false);
        }
    };

    const getActionColor = (action: string) => {
        if (action.includes('delete') || action.includes('revoked')) return 'text-red-400';
        if (action.includes('create') || action.includes('issued')) return 'text-green-400';
        if (action.includes('update')) return 'text-blue-400';
        if (action.includes('login') || action.includes('logout')) return 'text-purple-400';
        return 'text-slate-400';
    };

    const formatAction = (action: string) => {
        return action.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-slate-400">Loading audit log...</div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white">Audit Log</h1>
                    <p className="text-slate-400 mt-1">Complete history of all system actions</p>
                </div>
                <button
                    onClick={fetchAuditLog}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
                >
                    Refresh
                </button>
            </div>

            {/* Filters */}
            <div className="flex gap-4 mb-6">
                <select
                    value={filter.entityType}
                    onChange={(e) => setFilter(f => ({ ...f, entityType: e.target.value }))}
                    className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                >
                    <option value="">All Entity Types</option>
                    <option value="incident">Incidents</option>
                    <option value="penalty">Penalties</option>
                    <option value="protest">Protests</option>
                    <option value="rulebook">Rulebooks</option>
                    <option value="session">Sessions</option>
                </select>
                <select
                    value={filter.action}
                    onChange={(e) => setFilter(f => ({ ...f, action: e.target.value }))}
                    className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                >
                    <option value="">All Actions</option>
                    <option value="create">Create</option>
                    <option value="update">Update</option>
                    <option value="delete">Delete</option>
                    <option value="penalty_issued">Penalty Issued</option>
                    <option value="protest_submitted">Protest Submitted</option>
                    <option value="vote_cast">Vote Cast</option>
                </select>
                <button
                    onClick={fetchAuditLog}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg"
                >
                    Apply Filters
                </button>
            </div>

            {/* Audit Entries */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-slate-700/50">
                        <tr>
                            <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Time</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Actor</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Action</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Entity</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Description</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                        {entries.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                                    No audit entries found
                                </td>
                            </tr>
                        ) : (
                            entries.map(entry => (
                                <tr key={entry.id} className="hover:bg-slate-700/30">
                                    <td className="px-4 py-3 text-sm text-slate-400 whitespace-nowrap">
                                        {new Date(entry.createdAt).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-white">
                                        {entry.actorName || entry.actorEmail || 'System'}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`text-sm font-medium ${getActionColor(entry.action)}`}>
                                            {formatAction(entry.action)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-300">
                                        <span className="capitalize">{entry.entityType}</span>
                                        {entry.entityId && (
                                            <span className="text-slate-500 ml-1">
                                                ({entry.entityId.slice(0, 8)}...)
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-400 max-w-xs truncate">
                                        {entry.description || '—'}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
