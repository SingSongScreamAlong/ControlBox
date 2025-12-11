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

        // =====================================================================
        // Relay Agent Events (from Python iRacing relay)
        // =====================================================================

        socket.on('session_metadata', (data: unknown) => {
            console.log(`📊 Session metadata received:`, data);
            // Broadcast to all dashboard clients
            socket.broadcast.emit('session:metadata', data);
        });

        socket.on('telemetry', (data: unknown) => {
            // Don't log every telemetry frame (too noisy)
            // Broadcast to all dashboard clients in the session
            socket.broadcast.emit('telemetry:update', data);
        });

        socket.on('incident', (data: unknown) => {
            console.log(`⚠️ Incident received:`, data);
            socket.broadcast.emit('incident:new', data);
        });

        socket.on('race_event', (data: unknown) => {
            console.log(`🏁 Race event:`, data);
            socket.broadcast.emit('race:event', data);
        });

        socket.on('driver_update', (data: unknown) => {
            console.log(`👤 Driver update:`, data);
            socket.broadcast.emit('driver:update', data);
        });

        // =====================================================================
        // Dashboard Client Events
        // =====================================================================

        // Join session room
        socket.on('room:join', (data: JoinRoomMessage) => {
            const roomName = `session:${data.sessionId}`;
            socket.join(roomName);
            console.log(`   Client ${socket.id} joined room ${roomName}`);

            // Acknowledge join
            socket.emit('room:joined', { sessionId: data.sessionId });
        });

        // Leave session room
        socket.on('room:leave', (data: LeaveRoomMessage) => {
            const roomName = `session:${data.sessionId}`;
            socket.leave(roomName);
            console.log(`   Client ${socket.id} left room ${roomName}`);
        });

        // Steward action
        socket.on('steward:action', (data: unknown) => {
            console.log('   Steward action received:', data);
            // TODO: Process steward action and broadcast result
        });

        socket.on('disconnect', () => {
            console.log(`🔌 Client disconnected: ${socket.id}`);
        });
    });

    return io;
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
