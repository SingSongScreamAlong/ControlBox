// =====================================================================
// Recommendation Panel Component
// Displays AI-generated recommendations for incidents
// =====================================================================

import { useState } from 'react';
import { useIncidentStore } from '../../stores/incident.store';
import { useAdvisorStore } from '../../stores/advisor.store';
import { AdvisorPanel } from '../AdvisorPanel';
import { AdvisorChip } from '../AdvisorChip';

interface RecommendationPanelProps {
    sessionId?: string;
}

export function RecommendationPanel({ sessionId }: RecommendationPanelProps) {
    const { incidents } = useIncidentStore();
    const store = useAdvisorStore();
    const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'pending' | 'reviewed'>('pending');

    // Filter incidents that need recommendations
    const filteredIncidents = incidents.filter(inc => {
        if (sessionId && inc.sessionId !== sessionId) return false;
        if (filter === 'pending') return inc.status === 'pending' || inc.status === 'under_review';
        if (filter === 'reviewed') return inc.status === 'reviewed' || inc.status === 'dismissed';
        return true;
    });

    // Get recommendations count
    const pendingCount = incidents.filter(inc =>
        inc.status === 'pending' || inc.status === 'under_review'
    ).length;

    const handleGetRecommendations = async (incidentId: string) => {
        await store.fetchAdvice(incidentId);
        setSelectedIncidentId(incidentId);
    };

    return (
        <div className="card h-full flex flex-col">
            <div className="card-header">
                <div className="flex items-center gap-2">
                    <span className="text-lg">📋</span>
                    <h3 className="font-semibold text-white">Steward Recommendations</h3>
                </div>
                <span className={`badge ${pendingCount > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-300'}`}>
                    {pendingCount} pending
                </span>
            </div>

            {/* Filter tabs */}
            <div className="px-4 py-2 border-b border-slate-700/50 flex gap-2">
                {(['pending', 'reviewed', 'all'] as const).map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-3 py-1 rounded-lg text-sm transition-colors ${filter === f
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                ))}
            </div>

            {/* Selected incident advisor panel */}
            {selectedIncidentId && store.adviceByIncidentId[selectedIncidentId] && (
                <div className="p-4 border-b border-slate-700 bg-slate-800/50">
                    <AdvisorPanel
                        incidentId={selectedIncidentId}
                        onClose={() => setSelectedIncidentId(null)}
                    />
                </div>
            )}

            {/* Incident list */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-700/30">
                {filteredIncidents.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                        <p>No {filter === 'all' ? '' : filter} incidents</p>
                    </div>
                ) : (
                    filteredIncidents.map(incident => {
                        const hasAdvice = !!store.adviceByIncidentId[incident.id];
                        const loading = store.isLoading(incident.id);

                        return (
                            <div
                                key={incident.id}
                                className={`px-4 py-3 ${selectedIncidentId === incident.id ? 'bg-blue-500/10' : ''}`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`badge ${incident.severity === 'heavy' ? 'bg-red-500/20 text-red-400' :
                                                incident.severity === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                                                    'bg-green-500/20 text-green-400'
                                                }`}>
                                                {incident.severity}
                                            </span>
                                            <span className="badge bg-slate-600 text-slate-300">
                                                {incident.status.replace('_', ' ')}
                                            </span>
                                            {hasAdvice && (
                                                <AdvisorChip
                                                    incidentId={incident.id}
                                                    onClick={() => handleGetRecommendations(incident.id)}
                                                    size="small"
                                                />
                                            )}
                                        </div>
                                        <p className="text-sm text-white font-medium">
                                            Lap {incident.lapNumber} — {incident.type.replace('_', ' ')}
                                        </p>
                                        <p className="text-xs text-slate-400 mt-1">
                                            {incident.involvedDrivers?.map((d: { carNumber: string }) => `#${d.carNumber}`).join(' vs ') || 'Unknown'}
                                        </p>
                                        {hasAdvice && store.hasWarnings(incident.id) && (
                                            <p className="text-xs text-amber-400 mt-1">⚠️ Advisor flagged concerns</p>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => handleGetRecommendations(incident.id)}
                                        disabled={loading}
                                        className="px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-sm"
                                    >
                                        {hasAdvice ? 'View' : 'Get'} Advice
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
