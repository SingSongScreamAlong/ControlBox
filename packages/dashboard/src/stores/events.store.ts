// =====================================================================
// Events Store
// State management for scheduled events
// =====================================================================

import { create } from 'zustand';
import { getAuthHeader } from './auth.store';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface Event {
    id: string;
    leagueId: string;
    seriesId: string;
    seasonId: string;
    name: string;
    scheduledAt: string;
    startedAt?: string;
    endedAt?: string;
    trackName?: string;
    trackConfig?: string;
    sessionId?: string;
    notes?: string;
    createdAt: string;
}

interface EventArtifact {
    id: string;
    eventId: string;
    type: 'replay' | 'results' | 'other';
    filename: string;
    storagePath: string;
    fileSizeBytes?: number;
    uploadedBy: string;
    createdAt: string;
}

interface EventReport {
    id: string;
    eventId: string;
    status: 'pending' | 'processing' | 'ready' | 'failed';
    summary?: EventReportSummary;
    createdAt: string;
}

interface EventReportSummary {
    finishingOrder: DriverResult[];
    penalties: PenaltyEntry[];
    statistics: RaceStatistics;
}

interface DriverResult {
    position: number;
    driverName: string;
    carNumber: string;
    carClass?: string;
    lapsCompleted: number;
    finishStatus: string;
    gapToLeader?: string;
}

interface PenaltyEntry {
    driverName: string;
    carNumber: string;
    penaltyType: string;
    reason: string;
}

interface RaceStatistics {
    totalDrivers: number;
    finishers: number;
    dnfs: number;
    totalIncidents: number;
}

interface EventWithDetails extends Event {
    artifacts: EventArtifact[];
    report?: EventReport;
    hasReplay: boolean;
    hasResults: boolean;
}

interface EventsState {
    events: Event[];
    currentEvent: EventWithDetails | null;
    isLoading: boolean;
    error: string | null;

    // Actions
    fetchEvents: (seasonId: string) => Promise<void>;
    fetchEvent: (eventId: string) => Promise<void>;
    createEvent: (seasonId: string, data: CreateEventData) => Promise<Event | null>;
    updateEvent: (eventId: string, data: Partial<CreateEventData>) => Promise<void>;
    startEvent: (eventId: string) => Promise<void>;
    endEvent: (eventId: string) => Promise<void>;
    deleteEvent: (eventId: string) => Promise<void>;
    generateReport: (eventId: string) => Promise<void>;
    clearError: () => void;
}

interface CreateEventData {
    name: string;
    scheduledAt: string;
    trackName?: string;
    trackConfig?: string;
    notes?: string;
}

export const useEventsStore = create<EventsState>((set, get) => ({
    events: [],
    currentEvent: null,
    isLoading: false,
    error: null,

    fetchEvents: async (seasonId: string) => {
        set({ isLoading: true, error: null });
        try {
            const response = await fetch(`${API_BASE}/api/seasons/${seasonId}/events`, {
                headers: getAuthHeader()
            });
            const data = await response.json();

            if (data.success) {
                set({ events: data.data, isLoading: false });
            } else {
                set({ error: data.error?.message || 'Failed to fetch events', isLoading: false });
            }
        } catch (err) {
            set({ error: 'Network error', isLoading: false });
        }
    },

    fetchEvent: async (eventId: string) => {
        set({ isLoading: true, error: null });
        try {
            const response = await fetch(`${API_BASE}/api/events/${eventId}`, {
                headers: getAuthHeader()
            });
            const data = await response.json();

            if (data.success) {
                set({ currentEvent: data.data, isLoading: false });
            } else {
                set({ error: data.error?.message || 'Failed to fetch event', isLoading: false });
            }
        } catch (err) {
            set({ error: 'Network error', isLoading: false });
        }
    },

    createEvent: async (seasonId: string, eventData: CreateEventData) => {
        set({ isLoading: true, error: null });
        try {
            const response = await fetch(`${API_BASE}/api/seasons/${seasonId}/events`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader()
                },
                body: JSON.stringify(eventData)
            });
            const data = await response.json();

            if (data.success) {
                set(state => ({
                    events: [...state.events, data.data],
                    isLoading: false
                }));
                return data.data;
            } else {
                set({ error: data.error?.message || 'Failed to create event', isLoading: false });
                return null;
            }
        } catch (err) {
            set({ error: 'Network error', isLoading: false });
            return null;
        }
    },

    updateEvent: async (eventId: string, eventData: Partial<CreateEventData>) => {
        try {
            const response = await fetch(`${API_BASE}/api/events/${eventId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader()
                },
                body: JSON.stringify(eventData)
            });
            const data = await response.json();

            if (data.success) {
                set(state => ({
                    events: state.events.map(e => e.id === eventId ? data.data : e),
                    currentEvent: state.currentEvent?.id === eventId
                        ? { ...state.currentEvent, ...data.data }
                        : state.currentEvent
                }));
            }
        } catch (err) {
            set({ error: 'Network error' });
        }
    },

    startEvent: async (eventId: string) => {
        try {
            const response = await fetch(`${API_BASE}/api/events/${eventId}/start`, {
                method: 'POST',
                headers: getAuthHeader()
            });
            const data = await response.json();

            if (data.success) {
                await get().fetchEvent(eventId);
            }
        } catch (err) {
            set({ error: 'Failed to start event' });
        }
    },

    endEvent: async (eventId: string) => {
        try {
            const response = await fetch(`${API_BASE}/api/events/${eventId}/end`, {
                method: 'POST',
                headers: getAuthHeader()
            });
            const data = await response.json();

            if (data.success) {
                await get().fetchEvent(eventId);
            }
        } catch (err) {
            set({ error: 'Failed to end event' });
        }
    },

    deleteEvent: async (eventId: string) => {
        try {
            const response = await fetch(`${API_BASE}/api/events/${eventId}`, {
                method: 'DELETE',
                headers: getAuthHeader()
            });
            const data = await response.json();

            if (data.success) {
                set(state => ({
                    events: state.events.filter(e => e.id !== eventId),
                    currentEvent: state.currentEvent?.id === eventId ? null : state.currentEvent
                }));
            }
        } catch (err) {
            set({ error: 'Failed to delete event' });
        }
    },

    generateReport: async (eventId: string) => {
        try {
            const response = await fetch(`${API_BASE}/api/events/${eventId}/report/generate`, {
                method: 'POST',
                headers: getAuthHeader()
            });
            const data = await response.json();

            if (data.success) {
                await get().fetchEvent(eventId);
            }
        } catch (err) {
            set({ error: 'Failed to generate report' });
        }
    },

    clearError: () => set({ error: null })
}));
