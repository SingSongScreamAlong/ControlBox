// =====================================================================
// Dashboard Simulation Mode
// Generates mock racing data for demonstration without a live server
// =====================================================================

import type { TimingEntry, IncidentEvent, Penalty, Session } from '@controlbox/common';

// Driver names for simulation
const DRIVER_POOL = [
    { name: 'Max Verstappen', number: '1' },
    { name: 'Lewis Hamilton', number: '44' },
    { name: 'Charles Leclerc', number: '16' },
    { name: 'Carlos Sainz', number: '55' },
    { name: 'Lando Norris', number: '4' },
    { name: 'Oscar Piastri', number: '81' },
    { name: 'George Russell', number: '63' },
    { name: 'Sergio Perez', number: '11' },
    { name: 'Fernando Alonso', number: '14' },
    { name: 'Lance Stroll', number: '18' },
    { name: 'Pierre Gasly', number: '10' },
    { name: 'Esteban Ocon', number: '31' },
    { name: 'Alexander Albon', number: '23' },
    { name: 'Logan Sargeant', number: '2' },
    { name: 'Yuki Tsunoda', number: '22' },
    { name: 'Daniel Ricciardo', number: '3' },
    { name: 'Valtteri Bottas', number: '77' },
    { name: 'Zhou Guanyu', number: '24' },
    { name: 'Kevin Magnussen', number: '20' },
    { name: 'Nico Hulkenberg', number: '27' },
];

const TRACKS = [
    { name: 'Daytona International Speedway', config: 'Road Course', length: 5729 },
    { name: 'Spa-Francorchamps', config: 'Grand Prix', length: 7004 },
    { name: 'Nürburgring', config: 'GP Circuit', length: 5148 },
    { name: 'Suzuka', config: 'Grand Prix', length: 5807 },
    { name: 'Monza', config: 'Grand Prix', length: 5793 },
];

const INCIDENT_TYPES = ['contact', 'off_track', 'spin', 'blocking', 'unsafe_rejoin'] as const;
const CONTACT_TYPES = ['rear_end', 'side_to_side', 'divebomb', 'punt', 'squeeze'] as const;
const SEVERITY_LEVELS = ['light', 'medium', 'heavy'] as const;

interface SimulationState {
    sessionId: string;
    session: Session;
    drivers: SimulatedDriver[];
    currentLap: number;
    sessionTimeMs: number;
    isRunning: boolean;
    intervalId: number | null;
}

interface SimulatedDriver {
    id: string;
    name: string;
    carNumber: string;
    position: number;
    gapToLeader: number;
    gapAhead: number;
    lastLapTime: number;
    bestLapTime: number;
    currentLap: number;
    incidentCount: number;
    inPit: boolean;
    isConnected: boolean;
    speed: number;
    lapProgress: number;
}

type SimulationCallback = {
    onTimingUpdate: (timing: TimingEntry[]) => void;
    onSessionUpdate: (session: Session) => void;
    onIncident: (incident: IncidentEvent) => void;
    onPenalty: (penalty: Penalty) => void;
};

class DashboardSimulator {
    private state: SimulationState | null = null;
    private callbacks: Partial<SimulationCallback> = {};
    private incidentCounter = 0;
    private penaltyCounter = 0;

    start(callbacks: Partial<SimulationCallback>): Session {
        this.callbacks = callbacks;

        const track = TRACKS[Math.floor(Math.random() * TRACKS.length)];
        const driverCount = 16 + Math.floor(Math.random() * 5); // 16-20 drivers

        const sessionId = `sim-${Date.now()}`;
        const session: Session = {
            id: sessionId,
            simType: 'iracing',
            trackName: track.name,
            trackConfig: track.config,
            trackLength: track.length,
            sessionType: 'race',
            status: 'active',
            driverCount,
            incidentCount: 0,
            penaltyCount: 0,
            scheduledLaps: 20,
            metadata: { simulation: true },
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        // Create drivers with initial positions
        const drivers: SimulatedDriver[] = DRIVER_POOL.slice(0, driverCount).map((d, i) => ({
            id: `driver-${i}`,
            name: d.name,
            carNumber: d.number,
            position: i + 1,
            gapToLeader: i * (1.5 + Math.random() * 2),
            gapAhead: i === 0 ? 0 : (1.5 + Math.random() * 2),
            lastLapTime: 90 + Math.random() * 5,
            bestLapTime: 88 + Math.random() * 3,
            currentLap: 1,
            incidentCount: 0,
            inPit: false,
            isConnected: true,
            speed: 180 + Math.random() * 30,
            lapProgress: Math.random(),
        }));

        this.state = {
            sessionId,
            session,
            drivers,
            currentLap: 1,
            sessionTimeMs: 0,
            isRunning: true,
            intervalId: null,
        };

        // Start the simulation loop
        this.state.intervalId = window.setInterval(() => this.tick(), 1000);

        // Initial timing update
        this.emitTimingUpdate();
        callbacks.onSessionUpdate?.(session);

        // Generate initial incident after 3 seconds
        setTimeout(() => this.generateIncident(), 3000);

        return session;
    }

    stop(): void {
        if (this.state?.intervalId) {
            clearInterval(this.state.intervalId);
            this.state.intervalId = null;
        }
        this.state = null;
    }

    private tick(): void {
        if (!this.state || !this.state.isRunning) return;

        this.state.sessionTimeMs += 1000;

        // Update each driver
        this.state.drivers.forEach((driver, idx) => {
            // Update lap progress
            driver.lapProgress += 0.01 + Math.random() * 0.005;

            if (driver.lapProgress >= 1) {
                driver.lapProgress = 0;
                driver.currentLap++;
                // New lap time with some variation
                driver.lastLapTime = 88 + Math.random() * 5;
                if (driver.lastLapTime < driver.bestLapTime) {
                    driver.bestLapTime = driver.lastLapTime;
                }
            }

            // Random pit stops
            if (!driver.inPit && Math.random() < 0.002) {
                driver.inPit = true;
                setTimeout(() => { driver.inPit = false; }, 20000 + Math.random() * 10000);
            }

            // Update gaps (leader pulls away slightly, battles happen)
            if (idx > 0) {
                driver.gapToLeader += (Math.random() - 0.48) * 0.2;
                driver.gapToLeader = Math.max(0.5, driver.gapToLeader);
                driver.gapAhead = driver.gapToLeader - (this.state!.drivers[idx - 1]?.gapToLeader || 0);
            }

            // Speed variation
            driver.speed = 160 + Math.random() * 50;
        });

        // Update current lap (based on leader)
        const leader = this.state.drivers[0];
        if (leader && leader.currentLap > this.state.currentLap) {
            this.state.currentLap = leader.currentLap;
            this.state.session.updatedAt = new Date();
        }

        // Random position swaps (battles)
        if (Math.random() < 0.05) {
            const idx = 1 + Math.floor(Math.random() * (this.state.drivers.length - 1));
            const driver1 = this.state.drivers[idx];
            const driver2 = this.state.drivers[idx - 1];
            if (driver1 && driver2) {
                // Swap positions
                [driver1.position, driver2.position] = [driver2.position, driver1.position];
                this.state.drivers.sort((a, b) => a.position - b.position);
            }
        }

        // Emit timing updates
        this.emitTimingUpdate();

        // Random incidents (10% chance per second = ~1 every 10 seconds)
        if (Math.random() < 0.10) {
            this.generateIncident();
        }

        // End session after 20 laps
        if (this.state.currentLap > 20) {
            this.state.session.status = 'finished';
            this.callbacks.onSessionUpdate?.(this.state.session);
            this.stop();
        }
    }

    private emitTimingUpdate(): void {
        if (!this.state) return;

        const timing: TimingEntry[] = this.state.drivers.map(d => ({
            driverId: d.id,
            driverName: d.name,
            carNumber: d.carNumber,
            carName: 'Formula 1 Car',
            position: d.position,
            classPosition: d.position,
            positionsGained: 0,
            currentLap: d.currentLap,
            lapsCompleted: d.currentLap - 1,
            lastLapTime: d.lastLapTime,
            bestLapTime: d.bestLapTime,
            gapToLeader: d.gapToLeader,
            gapAhead: d.gapAhead,
            gapBehind: 0,
            sectorTimes: [],
            bestSectors: [],
            inPit: d.inPit,
            onOutLap: false,
            pitStops: 0,
            incidentCount: d.incidentCount,
            hasRecentIncident: false,
            isConnected: d.isConnected,
            lastUpdate: Date.now(),
        }));

        this.callbacks.onTimingUpdate?.(timing);
    }

    private generateIncident(): void {
        if (!this.state) return;

        const type = INCIDENT_TYPES[Math.floor(Math.random() * INCIDENT_TYPES.length)];
        const severity = SEVERITY_LEVELS[Math.floor(Math.random() * SEVERITY_LEVELS.length)];

        // Pick 1-2 drivers for the incident
        const driverCount = type === 'contact' ? 2 : 1;
        const shuffled = [...this.state.drivers].sort(() => Math.random() - 0.5);
        const involved = shuffled.slice(0, driverCount);

        // Increment incident counts
        involved.forEach(d => d.incidentCount++);
        this.state.session.incidentCount++;
        this.incidentCounter++;

        const incident: IncidentEvent = {
            id: `incident-${this.incidentCounter}`,
            sessionId: this.state.sessionId,
            type,
            contactType: type === 'contact'
                ? CONTACT_TYPES[Math.floor(Math.random() * CONTACT_TYPES.length)]
                : undefined,
            severity,
            severityScore: severity === 'heavy' ? 70 + Math.random() * 30
                : severity === 'medium' ? 40 + Math.random() * 30
                    : 10 + Math.random() * 30,
            lapNumber: this.state.currentLap,
            sessionTimeMs: this.state.sessionTimeMs,
            trackPosition: Math.random(),
            cornerName: `Turn ${1 + Math.floor(Math.random() * 12)}`,
            involvedDrivers: involved.map((d, i) => ({
                driverId: d.id,
                driverName: d.name,
                carNumber: d.carNumber,
                role: i === 0 ? 'aggressor' : 'victim',
                faultProbability: i === 0 ? 0.6 + Math.random() * 0.3 : 0.1 + Math.random() * 0.2,
            })),
            aiAnalysis: {
                recommendation: severity === 'heavy' ? 'penalty_recommended'
                    : severity === 'medium' ? 'investigate'
                        : 'no_fault',
                confidence: 0.7 + Math.random() * 0.25,
                reasoning: `Detected ${type} incident involving ${involved.map(d => d.name).join(' and ')}. Severity assessed as ${severity}.`,
                faultAttribution: Object.fromEntries(involved.map((d, i) => [d.id, i === 0 ? 0.7 : 0.3])),
                patterns: [],
                modelId: 'simulation-v1',
                analyzedAt: new Date(),
            },
            status: 'pending',
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        this.callbacks.onIncident?.(incident);

        // Sometimes generate a penalty proposal for serious incidents
        if (severity === 'heavy' || (severity === 'medium' && Math.random() < 0.5)) {
            setTimeout(() => this.generatePenalty(incident, involved[0]), 2000 + Math.random() * 3000);
        }
    }

    private generatePenalty(incident: IncidentEvent, driver: SimulatedDriver): void {
        if (!this.state) return;

        this.penaltyCounter++;
        this.state.session.penaltyCount++;

        const penaltyTypes = ['time_penalty', 'warning', 'drive_through'] as const;
        const type = penaltyTypes[Math.floor(Math.random() * penaltyTypes.length)];

        const penalty: Penalty = {
            id: `penalty-${this.penaltyCounter}`,
            sessionId: this.state.sessionId,
            incidentId: incident.id,
            driverId: driver.id,
            driverName: driver.name,
            carNumber: driver.carNumber,
            type,
            value: type === 'time_penalty' ? `${5 + Math.floor(Math.random() * 3) * 5}` : '',
            severity: incident.severity as 'light' | 'medium' | 'heavy',
            rationale: `Penalty for ${incident.type} at ${incident.cornerName}. AI confidence: ${Math.round((incident.aiAnalysis?.confidence || 0.7) * 100)}%`,
            evidenceBundle: {
                incident: { id: incident.id, type: incident.type },
                aiAnalysisSummary: incident.aiAnalysis?.reasoning,
                aiConfidence: incident.aiAnalysis?.confidence,
            },
            status: 'proposed',
            proposedBy: 'system',
            proposedAt: new Date(),
            isAppealed: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        this.callbacks.onPenalty?.(penalty);
    }
}

// Singleton instance
export const dashboardSimulator = new DashboardSimulator();
