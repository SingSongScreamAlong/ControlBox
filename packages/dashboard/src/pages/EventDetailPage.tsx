// =====================================================================
// Event Detail Page
// Single event view with artifacts and report
// =====================================================================

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useEventsStore } from '../stores/events.store';

export function EventDetailPage() {
    const { eventId } = useParams<{ eventId: string }>();
    const {
        currentEvent,
        isLoading,
        error,
        fetchEvent,
        startEvent,
        endEvent,
        generateReport
    } = useEventsStore();
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);

    useEffect(() => {
        if (eventId) {
            fetchEvent(eventId);
        }
    }, [eventId, fetchEvent]);

    const handleGenerateReport = async () => {
        if (!eventId) return;
        setIsGeneratingReport(true);
        await generateReport(eventId);
        setIsGeneratingReport(false);
    };

    if (isLoading || !currentEvent) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    const getStatusBadge = () => {
        if (currentEvent.endedAt) {
            return <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">Completed</span>;
        }
        if (currentEvent.startedAt) {
            return <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm animate-pulse">In Progress</span>;
        }
        return <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm">Scheduled</span>;
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    };

    return (
        <div className="space-y-6">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-slate-400">
                <Link to="/events" className="hover:text-white transition-colors">Events</Link>
                <span>/</span>
                <span className="text-white">{currentEvent.name}</span>
            </div>

            {error && (
                <div className="p-4 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400">
                    {error}
                </div>
            )}

            {/* Header */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <h1 className="text-2xl font-bold text-white">{currentEvent.name}</h1>
                            {getStatusBadge()}
                        </div>
                        <div className="space-y-1 text-slate-400">
                            <p>📅 {formatDate(currentEvent.scheduledAt)}</p>
                            {currentEvent.trackName && (
                                <p>🏁 {currentEvent.trackName} {currentEvent.trackConfig && `(${currentEvent.trackConfig})`}</p>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-2">
                        {!currentEvent.startedAt && !currentEvent.endedAt && (
                            <button
                                onClick={() => eventId && startEvent(eventId)}
                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                            >
                                Start Event
                            </button>
                        )}
                        {currentEvent.startedAt && !currentEvent.endedAt && (
                            <button
                                onClick={() => eventId && endEvent(eventId)}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                            >
                                End Event
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Artifacts Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Replay Upload */}
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
                    <h2 className="text-lg font-semibold text-white mb-4">Replay File</h2>
                    {currentEvent.hasReplay ? (
                        <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                            <span className="text-green-400 text-2xl">✓</span>
                            <div>
                                <p className="text-white font-medium">Replay Uploaded</p>
                                <p className="text-sm text-slate-400">
                                    {currentEvent.artifacts.find(a => a.type === 'replay')?.filename}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center">
                            <p className="text-slate-400 mb-2">No replay uploaded</p>
                            <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm">
                                Upload Replay
                            </button>
                        </div>
                    )}
                </div>

                {/* Results Upload */}
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
                    <h2 className="text-lg font-semibold text-white mb-4">Results File</h2>
                    {currentEvent.hasResults ? (
                        <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                            <span className="text-green-400 text-2xl">✓</span>
                            <div>
                                <p className="text-white font-medium">Results Uploaded</p>
                                <p className="text-sm text-slate-400">
                                    {currentEvent.artifacts.find(a => a.type === 'results')?.filename}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center">
                            <p className="text-slate-400 mb-2">No results uploaded</p>
                            <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm">
                                Upload Results
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Report Section */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-white">Race Report</h2>
                    {currentEvent.hasResults && (
                        <button
                            onClick={handleGenerateReport}
                            disabled={isGeneratingReport}
                            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm disabled:opacity-50"
                        >
                            {isGeneratingReport ? 'Generating...' : currentEvent.report ? 'Regenerate Report' : 'Generate Report'}
                        </button>
                    )}
                </div>

                {currentEvent.report ? (
                    <div className="space-y-4">
                        {/* Report Status */}
                        <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${currentEvent.report.status === 'ready' ? 'bg-green-500' :
                                    currentEvent.report.status === 'processing' ? 'bg-yellow-500 animate-pulse' :
                                        currentEvent.report.status === 'failed' ? 'bg-red-500' : 'bg-slate-500'
                                }`} />
                            <span className="text-slate-300 capitalize">{currentEvent.report.status}</span>
                        </div>

                        {/* Report Summary */}
                        {currentEvent.report.status === 'ready' && currentEvent.report.summary && (
                            <>
                                {/* Stats */}
                                <div className="grid grid-cols-4 gap-4">
                                    <div className="bg-slate-700/50 rounded-lg p-4 text-center">
                                        <p className="text-2xl font-bold text-white">{currentEvent.report.summary.statistics.totalDrivers}</p>
                                        <p className="text-sm text-slate-400">Drivers</p>
                                    </div>
                                    <div className="bg-slate-700/50 rounded-lg p-4 text-center">
                                        <p className="text-2xl font-bold text-green-400">{currentEvent.report.summary.statistics.finishers}</p>
                                        <p className="text-sm text-slate-400">Finishers</p>
                                    </div>
                                    <div className="bg-slate-700/50 rounded-lg p-4 text-center">
                                        <p className="text-2xl font-bold text-red-400">{currentEvent.report.summary.statistics.dnfs}</p>
                                        <p className="text-sm text-slate-400">DNFs</p>
                                    </div>
                                    <div className="bg-slate-700/50 rounded-lg p-4 text-center">
                                        <p className="text-2xl font-bold text-yellow-400">{currentEvent.report.summary.statistics.totalIncidents}</p>
                                        <p className="text-sm text-slate-400">Incidents</p>
                                    </div>
                                </div>

                                {/* Results Table */}
                                {currentEvent.report.summary.finishingOrder.length > 0 && (
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="border-b border-slate-600">
                                                    <th className="text-left py-2 px-3 text-sm text-slate-400">Pos</th>
                                                    <th className="text-left py-2 px-3 text-sm text-slate-400">Driver</th>
                                                    <th className="text-left py-2 px-3 text-sm text-slate-400">Car #</th>
                                                    <th className="text-left py-2 px-3 text-sm text-slate-400">Laps</th>
                                                    <th className="text-left py-2 px-3 text-sm text-slate-400">Gap</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {currentEvent.report.summary.finishingOrder.slice(0, 10).map((driver, idx) => (
                                                    <tr key={idx} className="border-b border-slate-700/50">
                                                        <td className="py-2 px-3 text-white font-medium">{driver.position}</td>
                                                        <td className="py-2 px-3 text-white">{driver.driverName}</td>
                                                        <td className="py-2 px-3 text-slate-300">#{driver.carNumber}</td>
                                                        <td className="py-2 px-3 text-slate-300">{driver.lapsCompleted}</td>
                                                        <td className="py-2 px-3 text-slate-400">{driver.gapToLeader || '—'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* Export Buttons */}
                                <div className="flex gap-2 pt-4">
                                    <a
                                        href={`/api/events/${eventId}/report/export`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm"
                                    >
                                        Export JSON
                                    </a>
                                    <a
                                        href={`/api/events/${eventId}/report/export/csv`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm"
                                    >
                                        Export CSV
                                    </a>
                                </div>
                            </>
                        )}
                    </div>
                ) : (
                    <p className="text-slate-500">
                        {currentEvent.hasResults
                            ? 'Click "Generate Report" to create the race report.'
                            : 'Upload results first to generate a report.'}
                    </p>
                )}
            </div>
        </div>
    );
}
