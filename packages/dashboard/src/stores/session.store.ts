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
            set({ isConnected: true, connectionStatus: 'connected', connectionError: null });
        });

        socketClient.on('onDisconnect', () => {
            set({ isConnected: false, connectionStatus: 'disconnected' });
        });

        // Handle session:active - auto-create session when relay connects
        socketClient.on('onSessionActive', (message) => {
            console.log('📡 Session active:', message.trackName);

            // Create a session object from the broadcast
            const session: Session = {
                id: message.sessionId,
                externalId: message.sessionId,
                simType: 'iracing',
                trackName: message.trackName,
                sessionType: (message.sessionType || 'race') as 'practice' | 'qualifying' | 'race' | 'warmup',
                status: 'active',
                incidentCount: 0,
                penaltyCount: 0,
                driverCount: 0,
                metadata: {},
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            set({ currentSession: session });
        });

        // Handle timing updates - always update if we have any session
        socketClient.on('onTimingUpdate', (message) => {
            const current = get().currentSession;
            // Accept timing if session matches OR if we don't have a session yet (auto-join mode)
            if (!current || message.sessionId === current.id) {
                set({ timing: message.timing?.entries || [] });

                // Also extract drivers from timing
                const drivers: SessionDriver[] = (message.timing?.entries || []).map(entry => ({
                    id: entry.driverId,
                    sessionId: message.sessionId,
                    driverId: entry.driverId,
                    driverName: entry.driverName || 'Unknown',
                    carNumber: entry.carNumber || '??',
                    carName: '',
                    irating: 0,
                    safetyRating: 0,
                    isActive: true,
                    joinedAt: new Date(),
                }));
                set({ drivers });
            }
        });

        socketClient.on('onSessionState', (_message) => {
            // Session state updates - handled separately
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
        // Listeners are set up in connect() - this is for backward compatibility
    },
}));

