// =====================================================================
// Session Store
// Zustand store for session state management
// =====================================================================

import { create } from 'zustand';
import type { Session, SessionDriver, TimingEntry } from '@controlbox/common';
import { socketClient } from '../lib/socket-client';

interface SessionState {
    // Current session
    currentSession: Session | null;
    drivers: SessionDriver[];
    timing: TimingEntry[];

    // Connection
    isConnected: boolean;
    connectionStatus: 'connected' | 'connecting' | 'disconnected';
    connectionError: string | null;

    // Actions
    setCurrentSession: (session: Session | null) => void;
    setDrivers: (drivers: SessionDriver[]) => void;
    updateTiming: (timing: TimingEntry[]) => void;
    updateDriverTiming: (driverId: string, entry: Partial<TimingEntry>) => void;
    connect: () => void;
    disconnect: () => void;
    joinSession: (sessionId: string) => void;
    leaveSession: () => void;
    initializeListeners: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
    // Initial state
    currentSession: null,
    drivers: [],
    timing: [],
    isConnected: false,
    connectionStatus: 'disconnected' as const,
    connectionError: null,

    // Actions
    setCurrentSession: (session) => set({ currentSession: session }),

    setDrivers: (drivers) => set({ drivers }),

    updateTiming: (timing) => set({ timing }),

    updateDriverTiming: (driverId, entry) => {
        const timing = get().timing;
        const index = timing.findIndex(t => t.driverId === driverId);

        if (index >= 0) {
            const updated = [...timing];
            updated[index] = { ...updated[index], ...entry };
            set({ timing: updated });
        } else {
            set({ timing: [...timing, { driverId, ...entry } as TimingEntry] });
        }
    },

    connect: () => {
        socketClient.on('onConnect', () => {
            set({ isConnected: true, connectionError: null });
        });

        socketClient.on('onDisconnect', () => {
            set({ isConnected: false });
        });

        socketClient.on('onTimingUpdate', (message) => {
            if (message.sessionId === get().currentSession?.id && message.timing) {
                set({ timing: message.timing.entries || [] });
            }
        });

        socketClient.on('onSessionState', (_message) => {
            // Session state updates - drivers would come from REST API
            // This event is for state changes like pause/resume/end
        });

        socketClient.connect();
    },

    disconnect: () => {
        socketClient.disconnect();
        set({ isConnected: false, currentSession: null, drivers: [], timing: [] });
    },

    joinSession: (sessionId) => {
        socketClient.joinSession(sessionId);
    },

    leaveSession: () => {
        const session = get().currentSession;
        if (session) {
            socketClient.leaveSession(session.id);
        }
        set({ currentSession: null, drivers: [], timing: [] });
    },

    initializeListeners: () => {
        socketClient.on('onConnect', () => {
            set({ isConnected: true, connectionStatus: 'connected', connectionError: null });
        });

        socketClient.on('onDisconnect', () => {
            set({ isConnected: false, connectionStatus: 'disconnected' });
        });

        socketClient.on('onTimingUpdate', (message) => {
            if (message.sessionId === get().currentSession?.id && message.timing) {
                set({ timing: message.timing.entries || [] });
            }
        });

        socketClient.on('onSessionState', (_message) => {
            // Session state updates - handled separately
        });
    },
}));
