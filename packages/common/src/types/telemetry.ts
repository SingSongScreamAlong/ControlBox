// =====================================================================
// Telemetry Message Contracts
// Defines the structure of real-time telemetry data from simulators
// =====================================================================

/**
 * Complete telemetry frame representing a snapshot of session state
 */
export interface TelemetryFrame {
    /** Unix timestamp in milliseconds */
    timestamp: number;
    /** Session elapsed time in milliseconds */
    sessionTimeMs: number;
    /** Unique frame identifier */
    frameId: number;

    /** Current session state */
    session: SessionState;
    /** Telemetry for all drivers */
    drivers: DriverTelemetry[];
    /** Current track flags */
    flags: TrackFlags;
}

/**
 * Current session state information
 */
export interface SessionState {
    /** External session identifier (e.g., iRacing session ID) */
    sessionId: string;
    /** Type of session */
    sessionType: SessionType;
    /** Current session state */
    sessionState: SessionStateValue;
    /** Remaining laps (race) or -1 if time-based */
    sessionLapsRemaining: number;
    /** Remaining time in seconds */
    sessionTimeRemaining: number;
    /** Track temperature in Celsius */
    trackTemp: number;
    /** Ambient air temperature in Celsius */
    airTemp: number;
}

export type SessionType = 'practice' | 'qualifying' | 'race' | 'warmup' | 'lone_qualify';

export type SessionStateValue =
    | 'invalid'
    | 'get_in_car'
    | 'warmup'
    | 'parade'
    | 'racing'
    | 'checkered'
    | 'cooldown';

/**
 * Individual driver telemetry data
 */
export interface DriverTelemetry {
    /** Platform-specific driver identifier */
    driverId: string;
    /** Car index in the session */
    carIdx: number;
    /** Car number displayed */
    carNumber: string;
    /** Driver display name */
    driverName: string;

    // Position
    /** Current lap number */
    lapNumber: number;
    /** Lap distance percentage (0.0 - 1.0) */
    lapDistPct: number;
    /** Overall race position */
    trackPosition: number;
    /** Class position */
    classPosition: number;

    // Motion
    /** Speed in meters per second */
    speed: number;
    /** Throttle position (0.0 - 1.0) */
    throttle: number;
    /** Brake position (0.0 - 1.0) */
    brake: number;
    /** Steering angle in radians */
    steering: number;
    /** Current gear (0 = neutral, -1 = reverse) */
    gear: number;
    /** Engine RPM */
    rpm: number;

    // World coordinates
    /** Latitude coordinate */
    lat: number;
    /** Longitude coordinate */
    lon: number;
    /** Altitude */
    alt: number;

    // Velocity vectors
    /** Velocity X component (m/s) */
    velocityX: number;
    /** Velocity Y component (m/s) */
    velocityY: number;
    /** Velocity Z component (m/s) */
    velocityZ: number;

    // Rotation
    /** Yaw angle in radians */
    yaw: number;
    /** Pitch angle in radians */
    pitch: number;
    /** Roll angle in radians */
    roll: number;

    // State flags
    /** Is the car on the racing surface */
    onTrack: boolean;
    /** Is the car in pit lane */
    inPits: boolean;
    /** Is the car on pit road */
    isOnPitRoad: boolean;
    /** Is the car off-world (disconnected/spectating) */
    isOffWorld: boolean;

    // Incident tracking
    /** Total incident points this session */
    incidentCount: number;
    /** Lap when last incident occurred */
    lastIncidentLap: number;

    // Timing
    /** Last completed lap time in seconds */
    lastLapTime: number;
    /** Best lap time this session in seconds */
    bestLapTime: number;
    /** Current lap elapsed time in seconds */
    currentLapTime: number;

    // Delta
    /** Time delta to leader in seconds */
    deltaToLeader: number;
    /** Time delta to car ahead in seconds */
    deltaToCarAhead: number;
}

/**
 * Track and driver flag states
 */
export interface TrackFlags {
    /** Global track flag */
    global: GlobalFlag;
    /** Per-sector yellow flags */
    sectors: SectorFlag[];
    /** Individual driver flags keyed by driverId */
    driverFlags: Record<string, DriverFlag>;
}

export type GlobalFlag =
    | 'none'
    | 'green'
    | 'yellow'
    | 'yellow_waving'
    | 'red'
    | 'white'
    | 'checkered'
    | 'black'
    | 'blue';

export type SectorFlag = 'none' | 'yellow';

export type DriverFlag = 'none' | 'black' | 'blue' | 'meatball' | 'repair';

/**
 * Telemetry ingestion request from relay agent
 */
export interface TelemetryIngestRequest {
    /** Source simulator type */
    simType: 'iracing' | 'acc' | 'rf2';
    /** Raw frame data */
    frame: TelemetryFrame;
    /** Relay agent version */
    relayVersion: string;
}
