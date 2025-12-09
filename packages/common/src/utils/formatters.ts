// =====================================================================
// Formatters
// Utility functions for formatting data for display
// =====================================================================

import type { SeverityLevel } from '../types/incident.js';
import type { PenaltyType } from '../types/rulebook.js';
import { SEVERITY_LABELS, SEVERITY_ICONS } from '../constants/severity-levels.js';
import { INCIDENT_TYPE_LABELS, CONTACT_TYPE_LABELS } from '../constants/incident-codes.js';

/**
 * Format lap time from seconds to mm:ss.xxx
 */
export function formatLapTime(seconds: number | null | undefined): string {
    if (seconds === null || seconds === undefined || seconds <= 0) {
        return '--:--.---';
    }

    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;

    return `${mins}:${secs.toFixed(3).padStart(6, '0')}`;
}

/**
 * Format gap time (delta) with + or - prefix
 */
export function formatGap(seconds: number | null | undefined): string {
    if (seconds === null || seconds === undefined) {
        return '---';
    }

    const prefix = seconds >= 0 ? '+' : '';

    if (Math.abs(seconds) >= 60) {
        return `${prefix}${formatLapTime(Math.abs(seconds))}`;
    }

    return `${prefix}${seconds.toFixed(3)}`;
}

/**
 * Format gap time in seconds to mm:ss.xxx or s.xxx
 */
export function formatGapTime(seconds: number): string {
    if (seconds >= 60) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toFixed(3).padStart(6, '0')}`;
    }
    return seconds.toFixed(3);
}

/**
 * Format session time from milliseconds to readable format
 */
export function formatSessionTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Format track position (0-1) to percentage string
 */
export function formatTrackPosition(position: number): string {
    return `${(position * 100).toFixed(1)}%`;
}

/**
 * Format speed from m/s to km/h or mph
 */
export function formatSpeed(mps: number, unit: 'kmh' | 'mph' = 'kmh'): string {
    const speed = unit === 'kmh' ? mps * 3.6 : mps * 2.237;
    return `${speed.toFixed(0)} ${unit === 'kmh' ? 'km/h' : 'mph'}`;
}

/**
 * Format incident type for display
 */
export function formatIncidentType(type: string): string {
    return INCIDENT_TYPE_LABELS[type] ?? type;
}

/**
 * Format contact type for display
 */
export function formatContactType(type: string): string {
    return CONTACT_TYPE_LABELS[type] ?? type;
}

/**
 * Format severity level for display
 */
export function formatSeverity(severity: SeverityLevel, includeIcon = false): string {
    const label = SEVERITY_LABELS[severity] ?? severity;
    if (includeIcon) {
        return `${SEVERITY_ICONS[severity]} ${label}`;
    }
    return label;
}

/**
 * Format severity score as colored badge text
 */
export function formatSeverityScore(score: number): string {
    return `${score.toFixed(0)}/100`;
}

/**
 * Format penalty type for display
 */
export function formatPenaltyType(type: PenaltyType): string {
    const labels: Record<PenaltyType, string> = {
        warning: 'Warning',
        reprimand: 'Reprimand',
        time_penalty: 'Time Penalty',
        position_penalty: 'Position Penalty',
        drive_through: 'Drive Through',
        stop_go: 'Stop & Go',
        disqualification: 'Disqualification',
        grid_penalty: 'Grid Penalty',
        points_deduction: 'Points Deduction',
        race_ban: 'Race Ban',
        custom: 'Custom',
    };
    return labels[type] ?? type;
}

/**
 * Format confidence score as percentage
 */
export function formatConfidence(confidence: number): string {
    return `${(confidence * 100).toFixed(1)}%`;
}

/**
 * Format date/time for display
 */
export function formatDateTime(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const defaultOptions: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    };
    return d.toLocaleString('en-US', { ...defaultOptions, ...options });
}

/**
 * Format relative time (e.g., "5 minutes ago")
 */
export function formatRelativeTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin} min ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return formatDateTime(d, { month: 'short', day: 'numeric' });
}

/**
 * Truncate a string with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength - 3) + '...';
}

/**
 * Format driver name (handle long names)
 */
export function formatDriverName(name: string, maxLength = 25): string {
    return truncate(name, maxLength);
}

/**
 * Format car number with leading zeros
 */
export function formatCarNumber(number: string | number, padLength = 2): string {
    return String(number).padStart(padLength, '0');
}
