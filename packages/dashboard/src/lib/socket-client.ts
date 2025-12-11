// =====================================================================
// WebSocket Client
// Real-time connection to the ControlBox server
// =====================================================================

import { io, Socket } from 'socket.io-client';
import type {
    TimingUpdateMessage,
    IncidentNewMessage,
    PenaltyProposedMessage,
    SessionStateMessage,
} from '@controlbox/common';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// Extended event for active session broadcast
interface SessionActiveMessage {
    sessionId: string;
    trackName: string;
    sessionType: string;
}

interface SocketClientEvents {
    onConnect: () => void;
    onDisconnect: () => void;
    onTimingUpdate: (message: TimingUpdateMessage) => void;
    onIncidentNew: (message: IncidentNewMessage) => void;
    onIncidentUpdated: (message: IncidentNewMessage) => void;
    onPenaltyProposed: (message: PenaltyProposedMessage) => void;
    onPenaltyApproved: (message: PenaltyProposedMessage) => void;
    onSessionState: (message: SessionStateMessage) => void;
    onSessionActive: (message: SessionActiveMessage) => void;
}

class SocketClient {
    private socket: Socket | null = null;
    private status: ConnectionStatus = 'disconnected';
    private currentSessionId: string | null = null;
    private listeners: Partial<SocketClientEvents> = {};

    connect(url: string = ''): void {
        if (this.socket?.connected) return;

        this.status = 'connecting';

        this.socket = io(url || window.location.origin, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
        });

        this.socket.on('connect', () => {
            console.log('🔌 Connected to ControlBox server');
            this.status = 'connected';
            this.listeners.onConnect?.();

            // Rejoin session if we had one
            if (this.currentSessionId) {
                this.joinSession(this.currentSessionId);
            }
        });

        this.socket.on('disconnect', () => {
            console.log('🔌 Disconnected from server');
            this.status = 'disconnected';
            this.listeners.onDisconnect?.();
        });

        this.socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            this.status = 'error';
        });

        // Session active broadcast - auto-join when relay sends session
        this.socket.on('session:active', (message: SessionActiveMessage) => {
            console.log(`📡 Active session detected: ${message.trackName} [${message.sessionType}]`);

            // Auto-join the session room
            if (!this.currentSessionId) {
                this.joinSession(message.sessionId);
            }

            this.listeners.onSessionActive?.(message);
        });

        // Event listeners
        this.socket.on('timing:update', (message: TimingUpdateMessage) => {
            this.listeners.onTimingUpdate?.(message);
        });

        this.socket.on('incident:new', (message: IncidentNewMessage) => {
            this.listeners.onIncidentNew?.(message);
        });

        this.socket.on('incident:updated', (message: IncidentNewMessage) => {
            this.listeners.onIncidentUpdated?.(message);
        });

        this.socket.on('penalty:proposed', (message: PenaltyProposedMessage) => {
            this.listeners.onPenaltyProposed?.(message);
        });

        this.socket.on('penalty:approved', (message: PenaltyProposedMessage) => {
            this.listeners.onPenaltyApproved?.(message);
        });

        this.socket.on('session:state', (message: SessionStateMessage) => {
            this.listeners.onSessionState?.(message);
        });
    }

    disconnect(): void {
        if (this.currentSessionId) {
            this.leaveSession(this.currentSessionId);
        }
        this.socket?.disconnect();
        this.socket = null;
        this.status = 'disconnected';
    }

    joinSession(sessionId: string): void {
        if (!this.socket?.connected) return;

        this.currentSessionId = sessionId;
        this.socket.emit('room:join', { sessionId });
        console.log(`📡 Joined session room: ${sessionId}`);
    }

    leaveSession(sessionId: string): void {
        if (!this.socket?.connected) return;

        this.socket.emit('room:leave', { sessionId });
        this.currentSessionId = null;
        console.log(`📡 Left session room: ${sessionId}`);
    }

    sendStewardAction(action: unknown): void {
        if (!this.socket?.connected) return;
        this.socket.emit('steward:action', action);
    }

    on<K extends keyof SocketClientEvents>(
        event: K,
        callback: SocketClientEvents[K]
    ): void {
        this.listeners[event] = callback;
    }

    off<K extends keyof SocketClientEvents>(event: K): void {
        delete this.listeners[event];
    }

    getStatus(): ConnectionStatus {
        return this.status;
    }

    getCurrentSessionId(): string | null {
        return this.currentSessionId;
    }
}

// Singleton instance
export const socketClient = new SocketClient();
