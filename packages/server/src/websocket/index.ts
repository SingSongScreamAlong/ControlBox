// =====================================================================
// WebSocket Server
// =====================================================================

import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import type {
    JoinRoomMessage,
    LeaveRoomMessage,
    TimingUpdateMessage,
    IncidentNewMessage,
    PenaltyProposedMessage,
    SessionStateMessage
} from '@controlbox/common';
import { config } from '../config/index.js';

let io: Server;


// Track active sessions for dashboard clients
const activeSessions: Map<string, {
    sessionId: string;
    trackName: string;
    sessionType: string;
    drivers: Map<string, { driverId: string; driverName: string; carNumber: string; lapDistPct: number }>;
    lastUpdate: number;
}> = new Map();

export function initializeWebSocket(httpServer: HttpServer): Server {
    io = new Server(httpServer, {
        cors: {
            origin: config.corsOrigins,
            credentials: true,
        },
        transports: ['websocket', 'polling'],
    });

    io.on('connection', (socket: Socket) => {
        console.log(`🔌 Client connected: ${socket.id}`);

        // Join session room (for dashboard clients)
        socket.on('room:join', (data: JoinRoomMessage) => {
            const roomName = `session:${data.sessionId}`;
            socket.join(roomName);
            console.log(`   Dashboard client ${socket.id} joined room ${roomName}`);

            // Send current session state if available
            const session = activeSessions.get(data.sessionId);
            if (session) {
                socket.emit('session:state', {
                    sessionId: data.sessionId,
                    trackName: session.trackName,
                    sessionType: session.sessionType,
                    status: 'active'
                });
            }

            socket.emit('room:joined', { sessionId: data.sessionId });
        });

        // Leave session room
        socket.on('room:leave', (data: LeaveRoomMessage) => {
            const roomName = `session:${data.sessionId}`;
            socket.leave(roomName);
            console.log(`   Client ${socket.id} left room ${roomName}`);
        });

        // =====================================================================
        // RELAY AGENT HANDLERS - Receive telemetry from iRacing relay
        // =====================================================================

        // Session metadata from relay (sent when session starts)
        socket.on('session_metadata', (data: {
            sessionId: string;
            trackName: string;
            trackConfig?: string;
            sessionType: string;
            simType?: string;
        }) => {
            console.log(`📡 Session metadata received: ${data.trackName} [${data.sessionType}]`);

            // Store/update session
            activeSessions.set(data.sessionId, {
                sessionId: data.sessionId,
                trackName: data.trackName,
                sessionType: data.sessionType,
                drivers: new Map(),
                lastUpdate: Date.now()
            });

            // Join relay to session room
            socket.join(`session:${data.sessionId}`);

            // Broadcast session start to all connected clients
            io.emit('session:active', {
                sessionId: data.sessionId,
                trackName: data.trackName,
                sessionType: data.sessionType
            });

            socket.emit('ack', { originalType: 'session_metadata', success: true });
        });

        // Telemetry snapshot from relay
        socket.on('telemetry', (data: {
            sessionId: string;
            sessionTimeMs?: number;
            drivers?: Array<{
                driverId: string;
                driverName: string;
                carNumber: string;
                position?: number;
                lapNumber?: number;
                lapDistPct: number;
                speed?: number;
                lastLapTime?: number;
                bestLapTime?: number;
                gapToLeader?: number;
                incidentCount?: number;
            }>;
        }) => {
            const session = activeSessions.get(data.sessionId);
            if (!session) {
                // Auto-create session if we get telemetry without metadata
                activeSessions.set(data.sessionId, {
                    sessionId: data.sessionId,
                    trackName: 'Unknown Track',
                    sessionType: 'race',
                    drivers: new Map(),
                    lastUpdate: Date.now()
                });
            }

            // Update session data
            const activeSession = activeSessions.get(data.sessionId)!;
            activeSession.lastUpdate = Date.now();

            // Update drivers
            if (data.drivers) {
                for (const driver of data.drivers) {
                    activeSession.drivers.set(driver.driverId, {
                        driverId: driver.driverId,
                        driverName: driver.driverName,
                        carNumber: driver.carNumber,
                        lapDistPct: driver.lapDistPct
                    });
                }
            }

            // Broadcast timing update to dashboard clients in this session room
            const timingEntries = data.drivers?.map((d, idx) => ({
                driverId: d.driverId,
                driverName: d.driverName,
                carNumber: d.carNumber,
                position: d.position ?? idx + 1,
                lapNumber: d.lapNumber ?? 0,
                lastLapTime: d.lastLapTime,
                bestLapTime: d.bestLapTime,
                gapToLeader: d.gapToLeader,
                lapDistPct: d.lapDistPct,
                speed: d.speed
            })) ?? [];

            io.to(`session:${data.sessionId}`).emit('timing:update', {
                sessionId: data.sessionId,
                sessionTimeMs: data.sessionTimeMs ?? Date.now(),
                timing: { entries: timingEntries }
            });
        });

        // Incident detected by relay
        socket.on('incident', (data: {
            sessionId: string;
            type: string;
            driverId: string;
            driverName?: string;
            carNumber?: string;
            lapNumber?: number;
            trackPosition?: number;
            severity?: string;
            incidentCount?: number;
        }) => {
            console.log(`🚨 Incident received: ${data.type} - ${data.driverName || data.driverId}`);

            // Broadcast to dashboard
            io.to(`session:${data.sessionId}`).emit('incident:new', {
                sessionId: data.sessionId,
                incident: {
                    id: `inc-${Date.now()}`,
                    type: data.type,
                    severity: data.severity ?? 'medium',
                    lapNumber: data.lapNumber ?? 0,
                    sessionTimeMs: Date.now(),
                    trackPosition: data.trackPosition ?? 0,
                    involvedDrivers: [{
                        driverId: data.driverId,
                        driverName: data.driverName ?? 'Unknown',
                        carNumber: data.carNumber ?? '??',
                        role: 'involved'
                    }],
                    status: 'pending'
                }
            });

            socket.emit('ack', { originalType: 'incident', success: true });
        });

        // Race event from relay (flags, etc.)
        socket.on('race_event', (data: {
            sessionId: string;
            eventType: string;
            data?: Record<string, unknown>;
        }) => {
            console.log(`🏁 Race event: ${data.eventType}`);
            io.to(`session:${data.sessionId}`).emit('race:event', data);
            socket.emit('ack', { originalType: 'race_event', success: true });
        });

        // Steward action from dashboard
        socket.on('steward:action', (data: unknown) => {
            console.log('   Steward action received:', data);
            // TODO: Process steward action and broadcast result
        });

        socket.on('disconnect', () => {
            console.log(`🔌 Client disconnected: ${socket.id}`);
        });
    });

    // Periodically clean up stale sessions
    setInterval(() => {
        const now = Date.now();
        for (const [sessionId, session] of activeSessions) {
            if (now - session.lastUpdate > 60000) { // 1 minute timeout
                console.log(`   Cleaning up stale session: ${sessionId}`);
                activeSessions.delete(sessionId);
            }
        }
    }, 30000);

    return io;
}

// Get list of active sessions (for REST API)
export function getActiveSessions() {
    return Array.from(activeSessions.values()).map(s => ({
        sessionId: s.sessionId,
        trackName: s.trackName,
        sessionType: s.sessionType,
        driverCount: s.drivers.size,
        lastUpdate: s.lastUpdate
    }));
}

export function getIO(): Server {
    if (!io) {
        throw new Error('WebSocket server not initialized');
    }
    return io;
}

// Broadcast functions

export function broadcastTimingUpdate(message: TimingUpdateMessage): void {
    if (!io) return;
    io.to(`session:${message.sessionId}`).emit('timing:update', message);
}

export function broadcastNewIncident(message: IncidentNewMessage): void {
    if (!io) return;
    io.to(`session:${message.sessionId}`).emit('incident:new', message);
}

export function broadcastIncidentUpdated(message: IncidentNewMessage): void {
    if (!io) return;
    io.to(`session:${message.sessionId}`).emit('incident:updated', message);
}

export function broadcastPenaltyProposed(message: PenaltyProposedMessage): void {
    if (!io) return;
    io.to(`session:${message.sessionId}`).emit('penalty:proposed', message);
}

export function broadcastPenaltyApproved(message: PenaltyProposedMessage): void {
    if (!io) return;
    io.to(`session:${message.sessionId}`).emit('penalty:approved', message);
}

export function broadcastSessionState(message: SessionStateMessage): void {
    if (!io) return;
    io.to(`session:${message.sessionId}`).emit('session:state', message);
}
