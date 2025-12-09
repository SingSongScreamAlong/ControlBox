// =====================================================================
// Incident Detail Modal
// Detailed view of a single incident for steward decisions
// =====================================================================

import { useState } from 'react';
import type { IncidentEvent } from '@controlbox/common';
import { formatIncidentType, formatSeverity, formatContactType, formatSessionTime } from '@controlbox/common';
import { AdvisorPanel } from '../AdvisorPanel';
import { AdvisorChip } from '../AdvisorChip';

interface IncidentDetailProps {
    incident: IncidentEvent;
    onClose: () => void;
    onAction: (action: 'penalty' | 'warning' | 'no_action' | 'dismiss') => void;
    onAddNote?: (note: string) => void;
}

export function IncidentDetail({ incident, onClose, onAction, onAddNote }: IncidentDetailProps) {
    const [noteInput, setNoteInput] = useState('');
    const [showAdvisor, setShowAdvisor] = useState(false);

    const severityColors: Record<string, string> = {
        light: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
        medium: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
        heavy: 'bg-red-500/20 text-red-400 border-red-500/30',
    };

    const handleAddNote = () => {
        if (noteInput.trim() && onAddNote) {
            onAddNote(noteInput.trim());
            setNoteInput('');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-slate-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden border border-slate-700">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            Incident Review
                            <AdvisorChip incidentId={incident.id} onClick={() => setShowAdvisor(!showAdvisor)} />
                        </h2>
                        <p className="text-sm text-slate-400">
                            Lap {incident.lapNumber} • {formatSessionTime(incident.sessionTimeMs)}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-lg bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[60vh]">
                    {/* Type and Severity */}
                    <div className="flex items-center gap-3 mb-6">
                        <span className={`badge border text-lg px-3 py-1 ${severityColors[incident.severity]}`}>
                            {formatSeverity(incident.severity)}
                        </span>
                        <span className="text-xl font-semibold text-white">
                            {formatIncidentType(incident.type)}
                        </span>
                        {incident.contactType && (
                            <span className="text-slate-400">
                                — {formatContactType(incident.contactType)}
                            </span>
                        )}
                    </div>

                    {/* Severity Score Bar */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-slate-400">Severity Score</span>
                            <span className="font-mono font-bold text-white">{incident.severityScore}/100</span>
                        </div>
                        <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all ${incident.severityScore > 66 ? 'bg-red-500' :
                                    incident.severityScore > 33 ? 'bg-orange-500' : 'bg-amber-500'
                                    }`}
                                style={{ width: `${incident.severityScore}%` }}
                            />
                        </div>
                    </div>

                    {/* Steward Advisor Panel - Collapsible */}
                    {showAdvisor && (
                        <div className="mb-6">
                            <AdvisorPanel
                                incidentId={incident.id}
                                onClose={() => setShowAdvisor(false)}
                            />
                        </div>
                    )}

                    {/* Advisor Toggle Button */}
                    {!showAdvisor && (
                        <div className="mb-6">
                            <button
                                onClick={() => setShowAdvisor(true)}
                                className="w-full py-3 px-4 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-lg text-blue-300 hover:bg-blue-600/30 transition-all flex items-center justify-center gap-2"
                            >
                                <span>🤖</span>
                                <span>Get Steward Advisor Recommendations</span>
                            </button>
                        </div>
                    )}

                    {/* Involved Drivers */}
                    <div className="mb-6">
                        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
                            Involved Drivers
                        </h3>
                        <div className="space-y-2">
                            {incident.involvedDrivers.map(driver => (
                                <div
                                    key={driver.driverId}
                                    className={`p-3 rounded-lg flex items-center justify-between ${driver.role === 'aggressor' ? 'bg-red-500/10 border border-red-500/30' :
                                        driver.role === 'victim' ? 'bg-green-500/10 border border-green-500/30' :
                                            'bg-slate-700/50'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="font-mono font-bold text-lg text-white">
                                            #{driver.carNumber}
                                        </span>
                                        <span className="text-white">{driver.driverName}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {driver.faultProbability !== undefined && (
                                            <div className="text-right">
                                                <div className="text-sm text-slate-400">Fault</div>
                                                <div className={`font-bold ${driver.faultProbability > 0.5 ? 'text-red-400' : 'text-slate-300'
                                                    }`}>
                                                    {Math.round(driver.faultProbability * 100)}%
                                                </div>
                                            </div>
                                        )}
                                        <span className={`badge ${driver.role === 'aggressor' ? 'bg-red-500/30 text-red-300' :
                                            driver.role === 'victim' ? 'bg-green-500/30 text-green-300' :
                                                'bg-slate-600 text-slate-300'
                                            }`}>
                                            {driver.role}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* AI Analysis */}
                    {incident.aiAnalysis && (
                        <div className="mb-6 p-4 bg-primary-500/10 border border-primary-500/30 rounded-lg">
                            <h3 className="text-sm font-semibold text-primary-400 uppercase tracking-wider mb-2">
                                AI Analysis
                            </h3>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-lg font-semibold text-white capitalize">
                                    {incident.aiAnalysis.recommendation.replace('_', ' ')}
                                </span>
                                <span className="text-primary-400 font-mono">
                                    {Math.round(incident.aiAnalysis.confidence * 100)}% confidence
                                </span>
                            </div>
                            {incident.aiAnalysis.reasoning && (
                                <p className="text-slate-300 text-sm">{incident.aiAnalysis.reasoning}</p>
                            )}
                        </div>
                    )}

                    {/* Steward Notes */}
                    <div className="mb-6">
                        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">
                            Steward Notes
                        </h3>
                        {incident.stewardNotes ? (
                            <pre className="text-slate-300 bg-slate-700/50 p-3 rounded-lg whitespace-pre-wrap font-sans text-sm mb-3">
                                {incident.stewardNotes}
                            </pre>
                        ) : (
                            <p className="text-slate-500 text-sm mb-3">No notes yet</p>
                        )}
                        {onAddNote && (
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={noteInput}
                                    onChange={(e) => setNoteInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                                    placeholder="Add a note..."
                                    className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-primary-500"
                                />
                                <button
                                    onClick={handleAddNote}
                                    disabled={!noteInput.trim()}
                                    className="px-4 py-2 bg-primary-600 hover:bg-primary-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                                >
                                    Add
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="px-6 py-4 border-t border-slate-700 bg-slate-800/80">
                    <div className="flex items-center justify-end gap-3">
                        <button
                            onClick={() => onAction('dismiss')}
                            className="btn btn-secondary"
                        >
                            Dismiss
                        </button>
                        <button
                            onClick={() => onAction('no_action')}
                            className="btn bg-slate-600 hover:bg-slate-500 text-white"
                        >
                            No Action
                        </button>
                        <button
                            onClick={() => onAction('warning')}
                            className="btn bg-amber-600 hover:bg-amber-500 text-white"
                        >
                            Warning
                        </button>
                        <button
                            onClick={() => onAction('penalty')}
                            className="btn btn-danger"
                        >
                            Issue Penalty
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

