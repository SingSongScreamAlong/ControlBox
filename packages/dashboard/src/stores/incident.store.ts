// =====================================================================
// Incident Store
// Zustand store for incident state management
// =====================================================================

import { create } from 'zustand';
import type { IncidentEvent, Penalty } from '@controlbox/common';
import { socketClient } from '../lib/socket-client';

interface IncidentState {
    // Incidents
    incidents: IncidentEvent[];
    selectedIncident: IncidentEvent | null;

    // Penalties
    penalties: Penalty[];
    pendingPenalties: Penalty[];

    // Filters
    filters: {
        sessionId?: string;
        type?: string;
        severity?: string;
        status?: string;
    };

    // Actions
    setIncidents: (incidents: IncidentEvent[]) => void;
    addIncident: (incident: IncidentEvent) => void;
    updateIncident: (incident: IncidentEvent) => void;
    selectIncident: (incident: IncidentEvent | null) => void;

    setPenalties: (penalties: Penalty[]) => void;
    addPenalty: (penalty: Penalty) => void;
    setPendingPenalties: (penalties: Penalty[]) => void;
    addPendingPenalty: (penalty: Penalty) => void;
    removePendingPenalty: (penaltyId: string) => void;
    approvePenalty: (penaltyId: string) => void;
    rejectPenalty: (penaltyId: string) => void;

    setFilters: (filters: IncidentState['filters']) => void;

    // Steward actions
    resolveIncident: (incidentId: string, action: 'penalty' | 'warning' | 'no_action' | 'dismiss') => void;
    addStewardNote: (incidentId: string, note: string) => void;

    initializeListeners: () => void;
}

export const useIncidentStore = create<IncidentState>((set, get) => ({
    // Initial state
    incidents: [],
    selectedIncident: null,
    penalties: [],
    pendingPenalties: [],
    filters: {},

    // Actions
    setIncidents: (incidents) => set({ incidents }),

    addIncident: (incident) => {
        const incidents = get().incidents;
        // Add to front of list (most recent first)
        set({ incidents: [incident, ...incidents] });
    },

    updateIncident: (incident) => {
        const incidents = get().incidents;
        const index = incidents.findIndex(i => i.id === incident.id);
        if (index >= 0) {
            const updated = [...incidents];
            updated[index] = incident;
            set({ incidents: updated });
        }
    },

    selectIncident: (incident) => set({ selectedIncident: incident }),

    setPenalties: (penalties) => set({ penalties }),

    addPenalty: (penalty) => {
        const penalties = get().penalties;
        set({ penalties: [...penalties, penalty] });
    },

    setPendingPenalties: (penalties) => set({ pendingPenalties: penalties }),

    addPendingPenalty: (penalty) => {
        const penalties = get().pendingPenalties;
        set({ pendingPenalties: [...penalties, penalty] });
    },

    removePendingPenalty: (penaltyId) => {
        const penalties = get().pendingPenalties;
        set({ pendingPenalties: penalties.filter(p => p.id !== penaltyId) });
    },

    approvePenalty: (penaltyId) => {
        const pendingPenalties = get().pendingPenalties;
        const penalty = pendingPenalties.find(p => p.id === penaltyId);
        if (penalty) {
            // Move from pending to penalties with approved status
            const updatedPenalty = { ...penalty, status: 'approved' as const };
            get().removePendingPenalty(penaltyId);
            get().addPenalty(updatedPenalty);

            // Emit WebSocket event to server
            socketClient.sendStewardAction({
                sessionId: penalty.sessionId,
                incidentId: penalty.incidentId,
                action: 'approve',
                penaltyType: penalty.type,
                penaltyValue: penalty.value,
                notes: `Penalty ${penaltyId} approved`
            });
        }
    },

    rejectPenalty: (penaltyId) => {
        const pendingPenalties = get().pendingPenalties;
        const penalty = pendingPenalties.find(p => p.id === penaltyId);
        if (penalty) {
            // Move from pending to penalties with rejected status
            const updatedPenalty = { ...penalty, status: 'rejected' as const };
            get().removePendingPenalty(penaltyId);
            get().addPenalty(updatedPenalty);

            // Emit WebSocket event to server
            socketClient.sendStewardAction({
                sessionId: penalty.sessionId,
                incidentId: penalty.incidentId,
                action: 'reject',
                notes: `Penalty ${penaltyId} rejected`
            });
        }
    },

    setFilters: (filters) => set({ filters }),

    resolveIncident: (incidentId, action) => {
        const incidents = get().incidents;
        const incident = incidents.find(i => i.id === incidentId);
        if (!incident) return;

        // Determine new status based on action
        const statusMap: Record<string, IncidentEvent['status']> = {
            penalty: 'reviewed',
            warning: 'reviewed',
            no_action: 'reviewed',
            dismiss: 'dismissed',
        };

        // Update incident status
        const updatedIncident: IncidentEvent = {
            ...incident,
            status: statusMap[action],
            updatedAt: new Date(),
        };
        get().updateIncident(updatedIncident);

        // If issuing a penalty or warning, create a penalty entry
        if (action === 'penalty' || action === 'warning') {
            const aggressor = incident.involvedDrivers.find(d => d.role === 'aggressor')
                || incident.involvedDrivers[0];

            if (aggressor) {
                const penalty: Penalty = {
                    id: `penalty-${Date.now()}`,
                    sessionId: incident.sessionId,
                    incidentId: incident.id,
                    driverId: aggressor.driverId,
                    driverName: aggressor.driverName,
                    carNumber: aggressor.carNumber,
                    type: action === 'warning' ? 'warning' : 'time_penalty',
                    value: action === 'warning' ? '' : '5 seconds',
                    severity: incident.severity,
                    rationale: `${action === 'warning' ? 'Warning' : 'Penalty'} issued for ${incident.type} at Lap ${incident.lapNumber}.`,
                    evidenceBundle: {
                        incident: { id: incident.id, type: incident.type },
                    },
                    status: 'approved',
                    proposedBy: 'steward',
                    proposedAt: new Date(),
                    approvedAt: new Date(),
                    isAppealed: false,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                };
                get().addPenalty(penalty);
            }
        }

        // Clear selection
        set({ selectedIncident: null });
    },

    addStewardNote: (incidentId, note) => {
        const incidents = get().incidents;
        const incident = incidents.find(i => i.id === incidentId);
        if (!incident) return;

        const existingNotes = incident.stewardNotes || '';
        const timestamp = new Date().toLocaleTimeString();
        const newNote = existingNotes
            ? `${existingNotes}\n[${timestamp}] ${note}`
            : `[${timestamp}] ${note}`;

        const updatedIncident: IncidentEvent = {
            ...incident,
            stewardNotes: newNote,
            updatedAt: new Date(),
        };
        get().updateIncident(updatedIncident);

        // Update selected incident if it's the same one
        if (get().selectedIncident?.id === incidentId) {
            set({ selectedIncident: updatedIncident });
        }
    },

    initializeListeners: () => {
        socketClient.on('onIncidentNew', (message) => {
            get().addIncident(message.incident);
        });

        socketClient.on('onIncidentUpdated', (message) => {
            get().updateIncident(message.incident);
        });

        socketClient.on('onPenaltyProposed', (message) => {
            get().addPendingPenalty(message.penalty);
        });

        socketClient.on('onPenaltyApproved', (message) => {
            get().removePendingPenalty(message.penalty.id);
        });
    },
}));
