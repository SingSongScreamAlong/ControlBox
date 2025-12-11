// =====================================================================
// ControlBox Standalone Server (No DB required)
// A lightweight server for relay agent testing
// =====================================================================

import { createServer } from 'http';
import { Server, Socket } from 'socket.io';

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || 'localhost';

console.log('🏎️  ControlBox Standalone Server Starting...');
console.log(`   Mode: Standalone (no database)`);
console.log(`   Port: ${PORT}`);

// Create HTTP server
const httpServer = createServer((req, res) => {
    // Simple health check endpoint
    if (req.url === '/api/health' || req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', mode: 'standalone' }));
        return;
    }

    // Default response
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
        <html>
            <head><title>ControlBox Server</title></head>
            <body style="font-family: Arial, sans-serif; padding: 40px; background: #1a1a2e; color: #eee;">
                <h1>🏎️ ControlBox Server</h1>
                <p>Socket.IO server is running and ready for connections.</p>
                <p>Mode: <strong>Standalone</strong></p>
                <p>Port: <strong>${PORT}</strong></p>
            </body>
        </html>
    `);
});

// Initialize Socket.IO
const io = new Server(httpServer, {
    cors: {
        origin: '*',
        credentials: true,
    },
    transports: ['websocket', 'polling'],
});

// Track connected clients
let relayClient: Socket | null = null;
const dashboardClients: Set<string> = new Set();

io.on('connection', (socket: Socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // =====================================================================
    // Relay Agent Events (from Python iRacing relay)
    // =====================================================================

    socket.on('session_metadata', (data: unknown) => {
        console.log(`📊 Session metadata received`);
        relayClient = socket;
        // Broadcast to all dashboard clients
        socket.broadcast.emit('session:metadata', data);
    });

    socket.on('telemetry', (data: unknown) => {
        // Broadcast to all dashboard clients (don't log - too noisy)
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

    socket.on('room:join', (data: { sessionId: string }) => {
        const roomName = `session:${data.sessionId}`;
        socket.join(roomName);
        dashboardClients.add(socket.id);
        console.log(`   Dashboard ${socket.id} joined room ${roomName}`);
        socket.emit('room:joined', { sessionId: data.sessionId });
    });

    socket.on('room:leave', (data: { sessionId: string }) => {
        const roomName = `session:${data.sessionId}`;
        socket.leave(roomName);
        console.log(`   Dashboard ${socket.id} left room ${roomName}`);
    });

    socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected: ${socket.id}`);
        dashboardClients.delete(socket.id);
        if (relayClient?.id === socket.id) {
            relayClient = null;
            console.log('   ⚠️ Relay agent disconnected');
        }
    });
});

// Start listening
httpServer.listen(PORT, HOST, () => {
    console.log(`🚀 ControlBox server running at http://${HOST}:${PORT}`);
    console.log(`   Health check: http://${HOST}:${PORT}/api/health`);
    console.log('');
    console.log('   Waiting for relay agent to connect...');
});

// Graceful shutdown
const shutdown = () => {
    console.log('\n🛑 Shutting down...');
    httpServer.close(() => {
        process.exit(0);
    });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
