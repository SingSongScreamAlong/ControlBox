// =====================================================================
// Session Manager
// Tracks active sessions and manages driver rosters
// =====================================================================

import { EventEmitter } from 'events';
import type {
    Session,
    SessionDriver,
    SessionState,
    DriverTelemetry,
    TelemetryFrame
} from '@controlbox/common';
import { SessionRepository } from '../../db/repositories/session.repo.js';

export interface SessionManagerEvents {
    'session:created': (session: Session) => void;
    'session:updated': (session: Session) => void;
    'session:ended': (session: Session) => void;
    'driver:joined': (driver: SessionDriver) => void;
    'driver:left': (driver: SessionDriver) => void;
}

interface ActiveSession {
    session: Session;
    drivers: Map<string, SessionDriver>;
    lastUpdate: number;
}

export class SessionManager extends EventEmitter {
    private activeSessions: Map<string, ActiveSession> = new Map();
    private sessionRepo: SessionRepository;

    constructor() {
        super();
        this.sessionRepo = new SessionRepository();
    }

    /**
     * Handle a new session starting
     */
    async handleSessionStart(state: SessionState, simType: 'iracing' | 'acc' | 'rf2' = 'iracing'): Promise<Session> {
        // Check if session already exists
        const existing = this.activeSessions.get(state.sessionId);
        if (existing) {
            return existing.session;
        }

        // Create new session in database
        // Map session type to supported types
        const sessionTypeMap: Record<string, 'practice' | 'qualifying' | 'race' | 'warmup'> = {
            'race': 'race',
            'practice': 'practice',
            'qualifying': 'qualifying',
            'warmup': 'warmup',
            'lone_qualify': 'qualifying',
            'open_qualify': 'qualifying',
        };
        const mappedSessionType = sessionTypeMap[state.sessionType] || 'practice';

        const session = await this.sessionRepo.create({
            externalId: state.sessionId,
            simType,
            trackName: 'Unknown', // Would come from extended session data
            sessionType: mappedSessionType,
        });

        // Track in memory
        this.activeSessions.set(state.sessionId, {
            session,
            drivers: new Map(),
            lastUpdate: Date.now(),
        });

        console.log(`📋 Session started: ${session.id} (${state.sessionType})`);
        this.emit('session:created', session);

        return session;
    }

    /**
     * Handle session ending
     */
    async handleSessionEnd(externalId: string): Promise<void> {
        const active = this.activeSessions.get(externalId);
        if (!active) return;

        // Update session status
        const updated = await this.sessionRepo.update(active.session.id, {
            status: 'finished',
            endedAt: new Date().toISOString(),
        });

        if (updated) {
            console.log(`🏁 Session ended: ${active.session.id}`);
            this.emit('session:ended', updated);
        }

        this.activeSessions.delete(externalId);
    }

    /**
     * Process a telemetry frame to update session state
     */
    processFrame(frame: TelemetryFrame): void {
        const active = this.activeSessions.get(frame.session.sessionId);
        if (!active) return;

        active.lastUpdate = Date.now();

        // Update driver roster
        for (const driverTelemetry of frame.drivers) {
            this.updateDriver(active, driverTelemetry);
        }
    }

    private updateDriver(active: ActiveSession, telemetry: DriverTelemetry): void {
        const existing = active.drivers.get(telemetry.driverId);

        if (!existing) {
            // New driver joined
            const driver: SessionDriver = {
                id: `${active.session.id}-${telemetry.driverId}`,
                sessionId: active.session.id,
                driverId: telemetry.driverId,
                driverName: telemetry.driverName,
                carNumber: telemetry.carNumber,
                carName: '', // Would come from extended data
                joinedAt: new Date(),
                isActive: true,
            };

            active.drivers.set(telemetry.driverId, driver);
            this.emit('driver:joined', driver);
        }
    }

    /**
     * Get active session by external ID
     */
    getActiveSession(externalId: string): Session | null {
        return this.activeSessions.get(externalId)?.session ?? null;
    }

    /**
     * Get all active sessions
     */
    getAllActiveSessions(): Session[] {
        return Array.from(this.activeSessions.values()).map(a => a.session);
    }

    /**
     * Get drivers for an active session
     */
    getSessionDrivers(externalId: string): SessionDriver[] {
        const active = this.activeSessions.get(externalId);
        if (!active) return [];
        return Array.from(active.drivers.values());
    }
}

// Singleton instance
let managerInstance: SessionManager | null = null;

export function getSessionManager(): SessionManager {
    if (!managerInstance) {
        managerInstance = new SessionManager();
    }
    return managerInstance;
}
