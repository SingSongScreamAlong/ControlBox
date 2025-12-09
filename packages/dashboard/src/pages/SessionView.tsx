// =====================================================================
// Session View Page
// Live race control view for an active session
// =====================================================================

import { useParams } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { useSessionStore } from '../stores/session.store';
import { useIncidentStore } from '../stores/incident.store';
import { SessionHeader } from '../components/session/SessionHeader';
import { LiveTiming } from '../components/timing/LiveTiming';
import { IncidentPanel } from '../components/incidents/IncidentPanel';
import { IncidentDetail } from '../components/incidents/IncidentDetail';
import { PenaltyPanel } from '../components/penalties/PenaltyPanel';
import { dashboardSimulator } from '../lib/simulation';

export function SessionView() {
    const { sessionId } = useParams<{ sessionId: string }>();
    const simulatorRef = useRef<boolean>(false);

    const {
        setCurrentSession,
        updateTiming,
        setDrivers,
    } = useSessionStore();

    const {
        selectedIncident,
        selectIncident,
        addIncident,
        addPendingPenalty,
        resolveIncident,
        addStewardNote,
    } = useIncidentStore();

    const [showIncidentModal, setShowIncidentModal] = useState(false);
    const [isSimulating, setIsSimulating] = useState(false);

    // Start simulation for demo mode
    useEffect(() => {
        // Only start simulation once and only for demo session
        if (sessionId === 'demo' && !simulatorRef.current) {
            simulatorRef.current = true;
            setIsSimulating(true);

            const session = dashboardSimulator.start({
                onTimingUpdate: (timing) => {
                    updateTiming(timing);
                    // Also update drivers list from timing
                    setDrivers(timing.map(t => ({
                        id: `driver-${t.driverId}`,
                        sessionId: sessionId,
                        driverId: t.driverId,
                        driverName: t.driverName,
                        carNumber: t.carNumber,
                        carName: t.carName,
                        joinedAt: new Date(),
                        isActive: t.isConnected,
                    })));
                },
                onSessionUpdate: (sess) => {
                    setCurrentSession(sess);
                },
                onIncident: (incident) => {
                    addIncident(incident);
                },
                onPenalty: (penalty) => {
                    addPendingPenalty(penalty);
                },
            });

            setCurrentSession(session);
        }

        return () => {
            if (simulatorRef.current) {
                dashboardSimulator.stop();
                simulatorRef.current = false;
                setIsSimulating(false);
            }
        };
    }, [sessionId, setCurrentSession, updateTiming, setDrivers, addIncident, addPendingPenalty]);

    // Handle incident selection
    useEffect(() => {
        if (selectedIncident) {
            setShowIncidentModal(true);
        }
    }, [selectedIncident]);

    const handleCloseIncidentModal = () => {
        setShowIncidentModal(false);
        selectIncident(null);
    };

    const handleIncidentAction = (action: 'penalty' | 'warning' | 'no_action' | 'dismiss') => {
        if (selectedIncident) {
            resolveIncident(selectedIncident.id, action);
        }
        setShowIncidentModal(false);
    };

    const handleAddNote = (note: string) => {
        if (selectedIncident) {
            addStewardNote(selectedIncident.id, note);
        }
    };

    return (
        <div className="h-full flex flex-col">
            {/* Session Header */}
            <SessionHeader />

            {/* Simulation indicator */}
            {isSimulating && (
                <div className="bg-purple-500/20 border-b border-purple-500/30 px-6 py-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                    <span className="text-purple-300 text-sm font-medium">
                        Simulation Mode — Live data is being generated for demonstration
                    </span>
                </div>
            )}

            {/* Main Content */}
            <div className="flex-1 p-6 overflow-hidden">
                <div className="h-full grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Live Timing - 2 columns */}
                    <div className="lg:col-span-2 overflow-auto">
                        <LiveTiming />
                    </div>

                    {/* Incident Panel - 1 column */}
                    <div className="overflow-auto">
                        <IncidentPanel />
                    </div>

                    {/* Penalty Panel - 1 column */}
                    <div className="overflow-auto">
                        <PenaltyPanel />
                    </div>
                </div>
            </div>

            {/* Incident Detail Modal */}
            {showIncidentModal && selectedIncident && (
                <IncidentDetail
                    incident={selectedIncident}
                    onClose={handleCloseIncidentModal}
                    onAction={handleIncidentAction}
                    onAddNote={handleAddNote}
                />
            )}
        </div>
    );
}
