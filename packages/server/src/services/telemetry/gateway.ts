// =====================================================================
// Telemetry Gateway
// Ingests and normalizes telemetry from simulator relay agents
// =====================================================================

import { EventEmitter } from 'events';
import type {
    TelemetryFrame,
    TelemetryIngestRequest,
    SessionState
} from '@controlbox/common';

export interface TelemetryGatewayEvents {
    'frame': (frame: TelemetryFrame) => void;
    'session:start': (state: SessionState) => void;
    'session:end': (sessionId: string) => void;
    'error': (error: Error) => void;
}

export class TelemetryGateway extends EventEmitter {
    private isRunning = false;
    private frameCount = 0;
    private lastFrameTime = 0;
    private currentSessionId: string | null = null;

    constructor() {
        super();
    }

    /**
     * Start the gateway to accept telemetry
     */
    start(): void {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log('📡 Telemetry Gateway started');
    }

    /**
     * Stop the gateway
     */
    stop(): void {
        if (!this.isRunning) return;
        this.isRunning = false;
        this.currentSessionId = null;
        console.log('📡 Telemetry Gateway stopped');
    }

    /**
     * Ingest a telemetry frame from a relay agent
     */
    ingest(request: TelemetryIngestRequest): void {
        if (!this.isRunning) {
            console.warn('Telemetry Gateway not running, ignoring frame');
            return;
        }

        try {
            const { frame } = request;

            // Detect session changes
            if (this.currentSessionId !== frame.session.sessionId) {
                if (this.currentSessionId) {
                    this.emit('session:end', this.currentSessionId);
                }
                this.currentSessionId = frame.session.sessionId;
                this.emit('session:start', frame.session);
            }

            // Update stats
            this.frameCount++;
            this.lastFrameTime = Date.now();

            // Emit the normalized frame
            this.emit('frame', frame);

        } catch (error) {
            this.emit('error', error instanceof Error ? error : new Error(String(error)));
        }
    }

    /**
     * Get gateway status
     */
    getStatus(): GatewayStatus {
        return {
            isRunning: this.isRunning,
            frameCount: this.frameCount,
            lastFrameTime: this.lastFrameTime,
            currentSessionId: this.currentSessionId,
            fps: this.calculateFps(),
        };
    }

    private calculateFps(): number {
        // Simple FPS estimation (would need a sliding window for accuracy)
        if (!this.lastFrameTime) return 0;
        const elapsed = Date.now() - this.lastFrameTime;
        if (elapsed > 5000) return 0; // Consider stale if no frame in 5s
        return 60; // Placeholder - would calculate from frame timestamps
    }
}

export interface GatewayStatus {
    isRunning: boolean;
    frameCount: number;
    lastFrameTime: number;
    currentSessionId: string | null;
    fps: number;
}

// Singleton instance
let gatewayInstance: TelemetryGateway | null = null;

export function getTelemetryGateway(): TelemetryGateway {
    if (!gatewayInstance) {
        gatewayInstance = new TelemetryGateway();
    }
    return gatewayInstance;
}
