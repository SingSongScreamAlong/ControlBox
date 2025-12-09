// =====================================================================
// Broadcast Overlay Components
// OBS-ready overlays for streaming
// =====================================================================

import { useState, useEffect } from 'react';
import { useSessionStore } from '../../stores/session.store';
import { useIncidentStore } from '../../stores/incident.store';
import './BroadcastOverlay.css';

interface OverlayProps {
    theme?: 'dark' | 'light';
    showBackground?: boolean;
}

/**
 * Live Timing Overlay
 * Shows current positions and gaps
 */
export function TimingOverlay({ theme = 'dark', showBackground = true }: OverlayProps) {
    const { currentSession, timing } = useSessionStore();

    // Sort timing entries by position (using index as position proxy)
    const topEntries = timing.slice(0, 10);

    // Get session name from the session object
    const sessionName = currentSession?.sessionType?.toUpperCase() || 'RACE';

    return (
        <div className={`overlay timing-overlay ${theme} ${showBackground ? 'with-bg' : ''}`}>
            <div className="overlay-header">
                <span className="session-name">{sessionName}</span>
                <span className="lap-counter">LIVE</span>
            </div>
            <div className="timing-list">
                {topEntries.map((entry, idx) => (
                    <div key={entry.driverId} className={`timing-row ${idx < 3 ? 'top-3' : ''}`}>
                        <span className="position">{idx + 1}</span>
                        <span className="car-number">#{entry.carNumber || '??'}</span>
                        <span className="driver-name">{entry.driverName || 'Unknown'}</span>
                        <span className="gap">
                            {idx === 0 ? 'LEADER' : `+${entry.gapToLeader?.toFixed(1) || '--'}`}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

/**
 * Incident Alert Overlay
 * Shows recent incidents for broadcast
 */
export function IncidentOverlay({ theme = 'dark', showBackground = true }: OverlayProps) {
    const { incidents } = useIncidentStore();
    const [visible, setVisible] = useState(false);
    const [currentIncident, setCurrentIncident] = useState<typeof incidents[0] | null>(null);

    // Show latest incident for 10 seconds
    useEffect(() => {
        const latestIncident = incidents[0];
        if (latestIncident && latestIncident.id !== currentIncident?.id) {
            setCurrentIncident(latestIncident);
            setVisible(true);
            const timer = setTimeout(() => setVisible(false), 10000);
            return () => clearTimeout(timer);
        }
    }, [incidents, currentIncident]);

    if (!visible || !currentIncident) return null;

    return (
        <div className={`overlay incident-overlay ${theme} ${showBackground ? 'with-bg' : ''}`}>
            <div className="incident-header">
                <span className="incident-icon">⚠️</span>
                <span className="incident-title">INCIDENT</span>
            </div>
            <div className="incident-body">
                <p className="incident-type">{currentIncident.type.replace('_', ' ').toUpperCase()}</p>
                <p className="incident-lap">Lap {currentIncident.lapNumber}</p>
                <p className="incident-drivers">
                    {currentIncident.involvedDrivers?.map((d: { carNumber: string }) => `#${d.carNumber}`).join(' vs ')}
                </p>
            </div>
            <div className="incident-footer">
                <span className={`severity severity-${currentIncident.severity}`}>
                    {currentIncident.severity.toUpperCase()}
                </span>
                <span className="status">Under Review</span>
            </div>
        </div>
    );
}

/**
 * Penalty Alert Overlay
 * Shows penalty announcements
 */
export function PenaltyOverlay({ theme = 'dark', showBackground = true }: OverlayProps) {
    const { penalties } = useIncidentStore();
    const [visible, setVisible] = useState(false);
    const [currentPenalty, setCurrentPenalty] = useState<typeof penalties[0] | null>(null);

    // Show latest applied penalty for 8 seconds
    useEffect(() => {
        const latestPenalty = penalties.find(p => p.status === 'applied');
        if (latestPenalty && latestPenalty.id !== currentPenalty?.id) {
            setCurrentPenalty(latestPenalty);
            setVisible(true);
            const timer = setTimeout(() => setVisible(false), 8000);
            return () => clearTimeout(timer);
        }
    }, [penalties, currentPenalty]);

    if (!visible || !currentPenalty) return null;

    return (
        <div className={`overlay penalty-overlay ${theme} ${showBackground ? 'with-bg' : ''}`}>
            <div className="penalty-header">
                <span className="penalty-icon">⚖️</span>
                <span className="penalty-title">STEWARD DECISION</span>
            </div>
            <div className="penalty-body">
                <p className="car-info">CAR #{currentPenalty.carNumber}</p>
                <p className="penalty-type">{currentPenalty.type.replace('_', ' ').toUpperCase()}</p>
                {currentPenalty.value && (
                    <p className="penalty-value">{currentPenalty.value}</p>
                )}
            </div>
            <div className="penalty-reason">
                {currentPenalty.rationale}
            </div>
        </div>
    );
}

/**
 * Race Control Message Overlay
 * Shows race control messages
 */
export function RaceControlOverlay({ theme = 'dark', showBackground = true }: OverlayProps) {
    const [message, setMessage] = useState<string | null>(null);
    const [visible, setVisible] = useState(false);

    // Expose to window for external control
    useEffect(() => {
        const showMessage = (msg: string, duration = 5000) => {
            setMessage(msg);
            setVisible(true);
            setTimeout(() => setVisible(false), duration);
        };

        (window as unknown as Record<string, unknown>).showRaceControlMessage = showMessage;
        return () => {
            delete (window as unknown as Record<string, unknown>).showRaceControlMessage;
        };
    }, []);

    if (!visible || !message) return null;

    return (
        <div className={`overlay race-control-overlay ${theme} ${showBackground ? 'with-bg' : ''}`}>
            <div className="rc-header">RACE CONTROL</div>
            <div className="rc-message">{message}</div>
        </div>
    );
}
