// =====================================================================
// Reports Store
// State management for session reports
// =====================================================================

import { create } from 'zustand';
import type { Session, IncidentEvent, Penalty } from '@controlbox/common';

export interface SessionReport {
    id: string;
    session: Session;
    incidents: IncidentEvent[];
    penalties: Penalty[];
    statistics: ReportStatistics;
    generatedAt: Date;
}

export interface ReportStatistics {
    totalDrivers: number;
    totalLaps: number;
    totalIncidents: number;
    incidentsByType: Record<string, number>;
    incidentsBySeverity: Record<string, number>;
    totalPenalties: number;
    penaltiesByType: Record<string, number>;
    mostIncidentDriver: { name: string; count: number } | null;
    cleanestDriver: { name: string; count: number } | null;
}

interface ReportsState {
    reports: SessionReport[];
    selectedReport: SessionReport | null;
    isGenerating: boolean;

    addReport: (report: SessionReport) => void;
    selectReport: (report: SessionReport | null) => void;
    deleteReport: (id: string) => void;
    setGenerating: (generating: boolean) => void;
}

export const useReportsStore = create<ReportsState>((set) => ({
    reports: [],
    selectedReport: null,
    isGenerating: false,

    addReport: (report) => set((state) => ({
        reports: [report, ...state.reports],
        selectedReport: report,
    })),

    selectReport: (report) => set({ selectedReport: report }),

    deleteReport: (id) => set((state) => ({
        reports: state.reports.filter((r) => r.id !== id),
        selectedReport: state.selectedReport?.id === id ? null : state.selectedReport,
    })),

    setGenerating: (generating) => set({ isGenerating: generating }),
}));

// Generate a report from session data
export function generateReport(
    session: Session,
    incidents: IncidentEvent[],
    penalties: Penalty[]
): SessionReport {
    // Calculate incident counts by type
    const incidentsByType: Record<string, number> = {};
    const incidentsBySeverity: Record<string, number> = {};
    const driverIncidents: Record<string, { name: string; count: number }> = {};

    incidents.forEach((incident) => {
        incidentsByType[incident.type] = (incidentsByType[incident.type] || 0) + 1;
        incidentsBySeverity[incident.severity] = (incidentsBySeverity[incident.severity] || 0) + 1;

        incident.involvedDrivers.forEach((driver) => {
            if (!driverIncidents[driver.driverId]) {
                driverIncidents[driver.driverId] = { name: driver.driverName, count: 0 };
            }
            driverIncidents[driver.driverId].count++;
        });
    });

    // Find most/least incident drivers
    const driverList = Object.values(driverIncidents);
    const mostIncidentDriver = driverList.length > 0
        ? driverList.reduce((a, b) => a.count > b.count ? a : b)
        : null;
    const cleanestDriver = driverList.length > 0
        ? driverList.reduce((a, b) => a.count < b.count ? a : b)
        : null;

    // Penalty counts
    const penaltiesByType: Record<string, number> = {};
    penalties.forEach((penalty) => {
        penaltiesByType[penalty.type] = (penaltiesByType[penalty.type] || 0) + 1;
    });

    const statistics: ReportStatistics = {
        totalDrivers: session.driverCount,
        totalLaps: session.scheduledLaps || 0,
        totalIncidents: incidents.length,
        incidentsByType,
        incidentsBySeverity,
        totalPenalties: penalties.length,
        penaltiesByType,
        mostIncidentDriver,
        cleanestDriver,
    };

    return {
        id: `report-${Date.now()}`,
        session,
        incidents,
        penalties,
        statistics,
        generatedAt: new Date(),
    };
}

// Export report to JSON
export function exportReportJSON(report: SessionReport): string {
    return JSON.stringify(report, null, 2);
}

// Export report to CSV
export function exportReportCSV(report: SessionReport): string {
    const lines: string[] = [];

    // Header
    lines.push('ControlBox Session Report');
    lines.push(`Session: ${report.session.trackName}`);
    lines.push(`Generated: ${report.generatedAt.toISOString()}`);
    lines.push('');

    // Summary
    lines.push('=== SUMMARY ===');
    lines.push(`Total Drivers,${report.statistics.totalDrivers}`);
    lines.push(`Total Incidents,${report.statistics.totalIncidents}`);
    lines.push(`Total Penalties,${report.statistics.totalPenalties}`);
    lines.push('');

    // Incidents
    lines.push('=== INCIDENTS ===');
    lines.push('Lap,Type,Severity,Drivers,Status');
    report.incidents.forEach((inc) => {
        lines.push(`${inc.lapNumber},${inc.type},${inc.severity},"${inc.involvedDrivers.map(d => d.driverName).join('; ')}",${inc.status}`);
    });
    lines.push('');

    // Penalties
    lines.push('=== PENALTIES ===');
    lines.push('Driver,Type,Value,Status');
    report.penalties.forEach((pen) => {
        lines.push(`${pen.driverName},${pen.type},${pen.value || 'N/A'},${pen.status}`);
    });

    return lines.join('\n');
}
