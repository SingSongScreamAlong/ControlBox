// =====================================================================
// Event Detector
// Monitors telemetry for incident triggers
// =====================================================================

import { EventEmitter } from 'events';
import type {
    TelemetryFrame,
    DriverTelemetry,
    IncidentTrigger,
    IncidentTriggerType
} from '@controlbox/common';

export interface EventDetectorEvents {
    'incident:trigger': (trigger: IncidentTrigger) => void;
}

interface DriverState {
    driverId: string;
    lastPosition: number;
    lastSpeed: number;
    lastYaw: number;
    incidentCount: number;
    onTrack: boolean;
    lastUpdate: number;
    history: DriverTelemetry[];
}

const HISTORY_SIZE = 300; // ~5 seconds at 60fps
const SPIN_THRESHOLD = 1.5; // radians of yaw change
const SPEED_LOSS_THRESHOLD = 0.6; // 60% speed loss
const MIN_SPEED_FOR_SPIN = 20; // m/s

export class EventDetector extends EventEmitter {
    private driverStates: Map<string, DriverState> = new Map();
    private currentSessionId: string | null = null;

    constructor() {
        super();
    }

    /**
     * Process a telemetry frame and detect incidents
     */
    processFrame(frame: TelemetryFrame): IncidentTrigger[] {
        const triggers: IncidentTrigger[] = [];

        // Update session tracking
        if (this.currentSessionId !== frame.session.sessionId) {
            this.driverStates.clear();
            this.currentSessionId = frame.session.sessionId;
        }

        for (const driver of frame.drivers) {
            const state = this.getOrCreateState(driver);
            const detected = this.analyzeDriver(driver, state, frame);
            triggers.push(...detected);
            this.updateState(state, driver);
        }

        // Emit triggers
        for (const trigger of triggers) {
            this.emit('incident:trigger', trigger);
        }

        return triggers;
    }

    private getOrCreateState(driver: DriverTelemetry): DriverState {
        let state = this.driverStates.get(driver.driverId);
        if (!state) {
            state = {
                driverId: driver.driverId,
                lastPosition: driver.lapDistPct,
                lastSpeed: driver.speed,
                lastYaw: driver.yaw,
                incidentCount: driver.incidentCount,
                onTrack: driver.onTrack,
                lastUpdate: Date.now(),
                history: [],
            };
            this.driverStates.set(driver.driverId, state);
        }
        return state;
    }

    private updateState(state: DriverState, driver: DriverTelemetry): void {
        state.lastPosition = driver.lapDistPct;
        state.lastSpeed = driver.speed;
        state.lastYaw = driver.yaw;
        state.incidentCount = driver.incidentCount;
        state.onTrack = driver.onTrack;
        state.lastUpdate = Date.now();

        // Maintain history buffer
        state.history.push(driver);
        if (state.history.length > HISTORY_SIZE) {
            state.history.shift();
        }
    }

    private analyzeDriver(
        driver: DriverTelemetry,
        state: DriverState,
        frame: TelemetryFrame
    ): IncidentTrigger[] {
        const triggers: IncidentTrigger[] = [];
        const nearbyDrivers = this.findNearbyDrivers(driver, frame.drivers);

        // 1. Check for incident count increase (iRacing reports incidents)
        if (driver.incidentCount > state.incidentCount) {
            triggers.push(this.createTrigger(
                'incident_count_increase',
                driver,
                frame,
                nearbyDrivers,
                {
                    previousCount: state.incidentCount,
                    newCount: driver.incidentCount,
                    delta: driver.incidentCount - state.incidentCount,
                }
            ));
        }

        // 2. Check for off-track
        if (!driver.onTrack && state.onTrack) {
            triggers.push(this.createTrigger(
                'off_track_detected',
                driver,
                frame,
                nearbyDrivers,
                { previousOnTrack: true }
            ));
        }

        // 3. Check for spin (rapid yaw change while moving)
        if (driver.speed > MIN_SPEED_FOR_SPIN) {
            const yawDelta = Math.abs(this.normalizeAngle(driver.yaw - state.lastYaw));
            if (yawDelta > SPIN_THRESHOLD) {
                triggers.push(this.createTrigger(
                    'spin_detected',
                    driver,
                    frame,
                    nearbyDrivers,
                    { yawDelta, speed: driver.speed }
                ));
            }
        }

        // 4. Check for sudden deceleration (potential contact)
        const speedRatio = state.lastSpeed > 0 ? driver.speed / state.lastSpeed : 1;
        if (speedRatio < SPEED_LOSS_THRESHOLD && state.lastSpeed > 30) {
            triggers.push(this.createTrigger(
                'sudden_deceleration',
                driver,
                frame,
                nearbyDrivers,
                {
                    previousSpeed: state.lastSpeed,
                    currentSpeed: driver.speed,
                    speedLoss: 1 - speedRatio,
                }
            ));
        }

        return triggers;
    }

    private findNearbyDrivers(
        driver: DriverTelemetry,
        allDrivers: DriverTelemetry[]
    ): string[] {
        const PROXIMITY_THRESHOLD = 0.02; // 2% of track

        return allDrivers
            .filter(d => {
                if (d.driverId === driver.driverId) return false;
                const dist = Math.abs(d.lapDistPct - driver.lapDistPct);
                // Handle wraparound
                const adjustedDist = Math.min(dist, 1 - dist);
                return adjustedDist < PROXIMITY_THRESHOLD;
            })
            .map(d => d.driverId);
    }

    private createTrigger(
        type: IncidentTriggerType,
        driver: DriverTelemetry,
        frame: TelemetryFrame,
        nearbyDrivers: string[],
        data: Record<string, unknown>
    ): IncidentTrigger {
        return {
            type,
            timestamp: frame.timestamp,
            sessionTimeMs: frame.sessionTimeMs,
            primaryDriverId: driver.driverId,
            nearbyDriverIds: nearbyDrivers,
            triggerData: {
                ...data,
                lapNumber: driver.lapNumber,
                trackPosition: driver.lapDistPct,
                speed: driver.speed,
            },
        };
    }

    private normalizeAngle(angle: number): number {
        while (angle > Math.PI) angle -= 2 * Math.PI;
        while (angle < -Math.PI) angle += 2 * Math.PI;
        return angle;
    }

    /**
     * Get driver telemetry history for analysis
     */
    getDriverHistory(driverId: string): DriverTelemetry[] {
        return this.driverStates.get(driverId)?.history ?? [];
    }

    /**
     * Clear all state
     */
    reset(): void {
        this.driverStates.clear();
        this.currentSessionId = null;
    }
}

// Singleton instance
let detectorInstance: EventDetector | null = null;

export function getEventDetector(): EventDetector {
    if (!detectorInstance) {
        detectorInstance = new EventDetector();
    }
    return detectorInstance;
}
