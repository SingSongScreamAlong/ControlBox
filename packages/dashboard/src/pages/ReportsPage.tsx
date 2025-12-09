// =====================================================================
// Reports Page
// Generate and export session reports
// =====================================================================

import { useState } from 'react';
import { useReportsStore, generateReport, exportReportJSON, exportReportCSV, SessionReport } from '../stores/reports.store';
import { useSessionStore } from '../stores/session.store';
import { useIncidentStore } from '../stores/incident.store';
import { formatIncidentType, formatPenaltyType } from '@controlbox/common';

export function ReportsPage() {
    const { reports, selectedReport, addReport, selectReport, deleteReport, isGenerating, setGenerating } = useReportsStore();
    const { currentSession } = useSessionStore();
    const { incidents, penalties } = useIncidentStore();

    const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');

    const handleGenerateReport = () => {
        if (!currentSession) return;

        setGenerating(true);

        // Simulate async generation
        setTimeout(() => {
            const report = generateReport(currentSession, incidents, penalties);
            addReport(report);
            setGenerating(false);
        }, 500);
    };

    const handleExport = () => {
        if (!selectedReport) return;

        const content = exportFormat === 'json'
            ? exportReportJSON(selectedReport)
            : exportReportCSV(selectedReport);

        const blob = new Blob([content], {
            type: exportFormat === 'json' ? 'application/json' : 'text/csv'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `controlbox-report-${selectedReport.id}.${exportFormat}`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="h-full flex flex-col space-y-6 p-6 overflow-y-auto">
            {/* Page header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white">Reports</h2>
                    <p className="text-slate-400">Generate and export session reports</p>
                </div>
            </div>

            {/* Generate Report Card */}
            <div className="card">
                <div className="card-header">
                    <h3 className="font-semibold text-white">Generate Report</h3>
                </div>
                <div className="card-body">
                    {currentSession ? (
                        <div className="flex items-center gap-4">
                            <div className="flex-1">
                                <p className="text-white font-medium">{currentSession.trackName}</p>
                                <p className="text-sm text-slate-400">
                                    {currentSession.sessionType} • {incidents.length} incidents • {penalties.length} penalties
                                </p>
                            </div>
                            <button
                                onClick={handleGenerateReport}
                                disabled={isGenerating}
                                className="btn btn-primary"
                            >
                                {isGenerating ? 'Generating...' : 'Generate Report'}
                            </button>
                        </div>
                    ) : (
                        <div className="text-center py-4 text-slate-400">
                            <p>No active session</p>
                            <p className="text-sm mt-1">Start a simulation or connect to a race to generate reports</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Reports Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
                {/* Report List */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="font-semibold text-white">Reports</h3>
                        <span className="badge bg-slate-700">{reports.length}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto divide-y divide-slate-700/50">
                        {reports.length > 0 ? (
                            reports.map((report) => (
                                <ReportListItem
                                    key={report.id}
                                    report={report}
                                    isSelected={selectedReport?.id === report.id}
                                    onClick={() => selectReport(report)}
                                    onDelete={() => deleteReport(report.id)}
                                />
                            ))
                        ) : (
                            <div className="text-center py-12 text-slate-400">
                                <p>No reports generated</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Report Detail */}
                <div className="lg:col-span-2">
                    {selectedReport ? (
                        <ReportDetail
                            report={selectedReport}
                            exportFormat={exportFormat}
                            onFormatChange={setExportFormat}
                            onExport={handleExport}
                        />
                    ) : (
                        <div className="card h-full flex items-center justify-center">
                            <div className="text-center text-slate-400">
                                <div className="text-6xl mb-4">📊</div>
                                <h3 className="text-xl font-semibold text-white">Select a Report</h3>
                                <p className="mt-2">Choose a report from the list to view details</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// --- Sub-components ---

function ReportListItem({
    report,
    isSelected,
    onClick,
    onDelete,
}: {
    report: SessionReport;
    isSelected: boolean;
    onClick: () => void;
    onDelete: () => void;
}) {
    return (
        <div
            onClick={onClick}
            className={`p-4 cursor-pointer transition-colors ${isSelected ? 'bg-primary-500/10' : 'hover:bg-slate-700/30'
                }`}
        >
            <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                    <p className="font-medium text-white truncate">
                        {report.session.trackName}
                    </p>
                    <p className="text-sm text-slate-400">
                        {report.generatedAt.toLocaleDateString()} {report.generatedAt.toLocaleTimeString()}
                    </p>
                </div>
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    className="text-slate-500 hover:text-red-400 p-1"
                >
                    ✕
                </button>
            </div>
            <div className="flex gap-2 mt-2">
                <span className="badge bg-slate-700 text-slate-300">
                    {report.statistics.totalIncidents} incidents
                </span>
                <span className="badge bg-slate-700 text-slate-300">
                    {report.statistics.totalPenalties} penalties
                </span>
            </div>
        </div>
    );
}

function ReportDetail({
    report,
    exportFormat,
    onFormatChange,
    onExport,
}: {
    report: SessionReport;
    exportFormat: 'json' | 'csv';
    onFormatChange: (format: 'json' | 'csv') => void;
    onExport: () => void;
}) {
    return (
        <div className="card h-full flex flex-col">
            <div className="card-header">
                <div>
                    <h3 className="font-semibold text-white">{report.session.trackName}</h3>
                    <p className="text-sm text-slate-400">
                        Generated {report.generatedAt.toLocaleString()}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        className="input w-24"
                        value={exportFormat}
                        onChange={(e) => onFormatChange(e.target.value as 'json' | 'csv')}
                    >
                        <option value="json">JSON</option>
                        <option value="csv">CSV</option>
                    </select>
                    <button onClick={onExport} className="btn btn-primary">
                        Export
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Summary Stats */}
                <div>
                    <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
                        Summary
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard label="Drivers" value={report.statistics.totalDrivers} />
                        <StatCard label="Laps" value={report.statistics.totalLaps} />
                        <StatCard label="Incidents" value={report.statistics.totalIncidents} color="amber" />
                        <StatCard label="Penalties" value={report.statistics.totalPenalties} color="red" />
                    </div>
                </div>

                {/* Incidents by Type */}
                <div>
                    <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
                        Incidents by Type
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {Object.entries(report.statistics.incidentsByType).map(([type, count]) => (
                            <div key={type} className="bg-slate-800/50 rounded-lg p-3">
                                <div className="text-slate-400 text-sm capitalize">{formatIncidentType(type as any)}</div>
                                <div className="text-2xl font-bold text-white">{count}</div>
                            </div>
                        ))}
                        {Object.keys(report.statistics.incidentsByType).length === 0 && (
                            <p className="text-slate-500 col-span-full">No incidents</p>
                        )}
                    </div>
                </div>

                {/* Incidents by Severity */}
                <div>
                    <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
                        Incidents by Severity
                    </h4>
                    <div className="flex gap-4">
                        {(['light', 'medium', 'heavy'] as const).map((sev) => (
                            <div key={sev} className="flex-1 bg-slate-800/50 rounded-lg p-3 text-center">
                                <div className={`text-3xl font-bold ${sev === 'light' ? 'text-amber-400' :
                                    sev === 'medium' ? 'text-orange-400' : 'text-red-400'
                                    }`}>
                                    {report.statistics.incidentsBySeverity[sev] || 0}
                                </div>
                                <div className="text-slate-400 text-sm capitalize">{sev}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Penalties by Type */}
                {report.statistics.totalPenalties > 0 && (
                    <div>
                        <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
                            Penalties by Type
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {Object.entries(report.statistics.penaltiesByType).map(([type, count]) => (
                                <div key={type} className="bg-slate-800/50 rounded-lg p-3">
                                    <div className="text-slate-400 text-sm">{formatPenaltyType(type as any)}</div>
                                    <div className="text-2xl font-bold text-white">{count}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Driver Highlights */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {report.statistics.mostIncidentDriver && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                            <div className="text-red-400 text-sm">Most Incidents</div>
                            <div className="text-xl font-bold text-white">
                                {report.statistics.mostIncidentDriver.name}
                            </div>
                            <div className="text-slate-400">
                                {report.statistics.mostIncidentDriver.count} incidents
                            </div>
                        </div>
                    )}
                    {report.statistics.cleanestDriver && report.statistics.cleanestDriver.count === 0 && (
                        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                            <div className="text-green-400 text-sm">Cleanest Driver</div>
                            <div className="text-xl font-bold text-white">
                                {report.statistics.cleanestDriver.name}
                            </div>
                            <div className="text-slate-400">
                                No incidents
                            </div>
                        </div>
                    )}
                </div>

                {/* Incident List Preview */}
                {report.incidents.length > 0 && (
                    <div>
                        <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
                            All Incidents ({report.incidents.length})
                        </h4>
                        <div className="bg-slate-800/30 rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-slate-400 border-b border-slate-700">
                                        <th className="px-4 py-2">Lap</th>
                                        <th className="px-4 py-2">Type</th>
                                        <th className="px-4 py-2">Severity</th>
                                        <th className="px-4 py-2">Drivers</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {report.incidents.slice(0, 10).map((inc) => (
                                        <tr key={inc.id} className="border-b border-slate-700/50">
                                            <td className="px-4 py-2 text-white">{inc.lapNumber}</td>
                                            <td className="px-4 py-2 text-slate-300">{formatIncidentType(inc.type)}</td>
                                            <td className="px-4 py-2">
                                                <span className={`badge ${inc.severity === 'heavy' ? 'bg-red-500/20 text-red-400' :
                                                    inc.severity === 'medium' ? 'bg-orange-500/20 text-orange-400' :
                                                        'bg-amber-500/20 text-amber-400'
                                                    }`}>
                                                    {inc.severity}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 text-slate-300">
                                                {inc.involvedDrivers.map(d => d.driverName).join(', ')}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {report.incidents.length > 10 && (
                                <div className="px-4 py-2 text-center text-slate-500 text-sm">
                                    + {report.incidents.length - 10} more incidents
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function StatCard({
    label,
    value,
    color = 'white'
}: {
    label: string;
    value: number;
    color?: 'white' | 'amber' | 'red' | 'green';
}) {
    const colorClasses = {
        white: 'text-white',
        amber: 'text-amber-400',
        red: 'text-red-400',
        green: 'text-green-400',
    };

    return (
        <div className="bg-slate-800/50 rounded-lg p-4">
            <div className={`text-3xl font-bold ${colorClasses[color]}`}>{value}</div>
            <div className="text-slate-400 text-sm">{label}</div>
        </div>
    );
}
