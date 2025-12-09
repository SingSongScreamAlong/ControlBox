// =====================================================================
// ControlBox Relay - Test Client
// Simulates iRacing data for testing the ControlBox Cloud
// =====================================================================

import { io, Socket } from 'socket.io-client';
import type {
    SessionMetadataMessage,
    RaceEventMessage,
    IncidentMessage,
    TelemetrySnapshotMessage,
    RecommendationMessage,
    DisciplineCategory
} from '@controlbox/common';

const CLOUD_URL = process.env.CONTROLBOX_CLOUD_URL || 'http://localhost:3001';

interface RelayConfig {
    sessionId: string;
    trackName: string;
    category: DisciplineCategory;
    multiClass: boolean;
}

class TestRelay {
    private socket: Socket | null = null;
    private config: RelayConfig;
    private isConnected = false;
    private lap = 1;

    constructor(config: RelayConfig) {
        this.config = config;
    }

    /**
     * Connect to ControlBox Cloud
     */
    async connect(): Promise<void> {
        console.log(`\n🔌 Connecting to ControlBox Cloud at ${CLOUD_URL}...`);

        this.socket = io(CLOUD_URL, {
            transports: ['websocket'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });

        return new Promise((resolve, reject) => {
            this.socket!.on('connect', () => {
                this.isConnected = true;
                console.log(`✅ Connected! Socket ID: ${this.socket!.id}`);
                resolve();
            });

            this.socket!.on('connect_error', (error) => {
                console.error('❌ Connection error:', error.message);
                reject(error);
            });

            this.socket!.on('disconnect', (reason) => {
                this.isConnected = false;
                console.log(`⚠️ Disconnected: ${reason}`);
            });

            // Listen for recommendations from cloud
            this.socket!.on('recommendation', (data: RecommendationMessage) => {
                console.log('\n📥 RECOMMENDATION RECEIVED:');
                console.log(`   Type: ${data.action}`);
                console.log(`   Details: ${data.details}`);
                console.log(`   Confidence: ${(data.confidence * 100).toFixed(0)}%`);
                console.log(`   Priority: ${data.priority}`);
            });

            // Listen for profile loaded confirmation
            this.socket!.on('profile_loaded', (data: any) => {
                console.log(`\n📖 Profile loaded: ${data.profileName} [${data.category}]`);
            });

            // Listen for acknowledgments
            this.socket!.on('ack', (data: any) => {
                console.log(`   ✓ ${data.originalType} acknowledged`);
            });

            // Timeout
            setTimeout(() => {
                if (!this.isConnected) {
                    reject(new Error('Connection timeout'));
                }
            }, 5000);
        });
    }

    /**
     * Send session metadata (triggers profile loading)
     */
    sendSessionMetadata(): void {
        if (!this.socket || !this.isConnected) {
            console.error('Not connected!');
            return;
        }

        const message: SessionMetadataMessage = {
            type: 'session_metadata',
            sessionId: this.config.sessionId,
            trackName: this.config.trackName,
            category: this.config.category,
            multiClass: this.config.multiClass,
            cautionsEnabled: true,
            driverSwap: this.config.category === 'endurance',
            maxDrivers: 24,
            weather: {
                ambientTemp: 22,
                trackTemp: 35,
                precipitation: 0,
                trackState: 'dry'
            },
            timestamp: Date.now()
        };

        console.log('\n📤 Sending session metadata...');
        console.log(`   Track: ${message.trackName}`);
        console.log(`   Category: ${message.category}`);
        console.log(`   Multi-class: ${message.multiClass}`);

        this.socket.emit('session_metadata', message);
    }

    /**
     * Send a race event (flag change, lap update)
     */
    sendRaceEvent(flagState: RaceEventMessage['flagState']): void {
        if (!this.socket || !this.isConnected) return;

        const message: RaceEventMessage = {
            type: 'race_event',
            sessionId: this.config.sessionId,
            flagState,
            lap: this.lap,
            timeRemaining: 3600 - (this.lap * 90),
            sessionPhase: flagState === 'green' ? 'racing' : 'caution',
            timestamp: Date.now()
        };

        console.log(`\n📤 Race event: ${flagState} (Lap ${this.lap})`);
        this.socket.emit('race_event', message);
    }

    /**
     * Send a test incident
     */
    sendIncident(severity: 'low' | 'med' | 'high' = 'med'): void {
        if (!this.socket || !this.isConnected) return;

        const message: IncidentMessage = {
            type: 'incident',
            sessionId: this.config.sessionId,
            cars: [7, 23],
            carNames: ['Ford Mustang GT3', 'Porsche 911 GT3 R'],
            driverNames: ['Driver One', 'Driver Two'],
            lap: this.lap,
            corner: 4,
            cornerName: 'Turn 4',
            trackPosition: 0.35,
            severity,
            disciplineContext: this.config.category,
            timestamp: Date.now()
        };

        console.log(`\n📤 Incident: ${severity} severity at Turn 4`);
        console.log(`   Cars: #7 vs #23`);
        this.socket.emit('incident', message);
    }

    /**
     * Send telemetry snapshot
     */
    sendTelemetry(): void {
        if (!this.socket || !this.isConnected) return;

        const message: TelemetrySnapshotMessage = {
            type: 'telemetry',
            sessionId: this.config.sessionId,
            cars: [
                {
                    carId: 7,
                    driverId: 'driver-1',
                    speed: 245,
                    gear: 5,
                    pos: { s: 0.35 },
                    throttle: 1.0,
                    brake: 0,
                    steering: 0.1,
                    rpm: 7500,
                    inPit: false,
                    lap: this.lap,
                    position: 1,
                    classPosition: 1
                },
                {
                    carId: 23,
                    driverId: 'driver-2',
                    speed: 240,
                    gear: 5,
                    pos: { s: 0.34 },
                    throttle: 1.0,
                    brake: 0,
                    steering: 0.05,
                    rpm: 7400,
                    inPit: false,
                    lap: this.lap,
                    position: 2,
                    classPosition: 2
                }
            ],
            timestamp: Date.now()
        };

        console.log(`📤 Telemetry: ${message.cars.length} cars`);
        this.socket.emit('telemetry', message);
    }

    /**
     * Advance to next lap
     */
    nextLap(): void {
        this.lap++;
        console.log(`\n🏁 Advanced to Lap ${this.lap}`);
    }

    /**
     * Disconnect from cloud
     */
    disconnect(): void {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.isConnected = false;
            console.log('\n🔌 Disconnected from ControlBox Cloud');
        }
    }
}

// ========================
// Main Entry Point
// ========================

async function main() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║         ControlBox Relay - Test Client v0.1.0              ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    // Parse command line args
    const category = (process.argv[2] as DisciplineCategory) || 'road';
    const trackName = process.argv[3] || 'Watkins Glen';

    const config: RelayConfig = {
        sessionId: `test-session-${Date.now()}`,
        trackName,
        category,
        multiClass: category === 'endurance'
    };

    console.log(`\n📋 Test Configuration:`);
    console.log(`   Session: ${config.sessionId}`);
    console.log(`   Track: ${config.trackName}`);
    console.log(`   Category: ${config.category}`);
    console.log(`   Multi-class: ${config.multiClass}`);

    const relay = new TestRelay(config);

    try {
        // Connect
        await relay.connect();

        // Send session metadata
        await sleep(500);
        relay.sendSessionMetadata();

        // Wait for profile to load
        await sleep(1000);

        // Send race start event
        relay.sendRaceEvent('green');
        await sleep(500);

        // Send some telemetry
        relay.sendTelemetry();
        await sleep(500);

        // Simulate laps and an incident
        relay.nextLap();
        relay.sendTelemetry();
        await sleep(500);

        relay.nextLap();
        console.log('\n⚠️ Simulating incident...');
        relay.sendIncident('med');

        // Wait for recommendation
        await sleep(2000);

        // Send more telemetry after incident
        relay.sendTelemetry();
        await sleep(500);

        // Test heavy incident
        relay.nextLap();
        console.log('\n⚠️ Simulating heavy incident...');
        relay.sendIncident('high');

        // Wait for recommendations
        await sleep(3000);

        console.log('\n✅ Test sequence completed!');
        console.log('   Press Ctrl+C to exit or wait 10 seconds...');

        // Keep alive for more recommendations
        await sleep(10000);

    } catch (error) {
        console.error('Error during test:', error);
    } finally {
        relay.disconnect();
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Run
main().catch(console.error);
