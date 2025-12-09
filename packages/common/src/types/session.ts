// =====================================================================
// Session Type Definitions
// Defines session lifecycle, driver roster, and timing structures
// =====================================================================

import type { DisciplineCategory, WeatherConditions } from './discipline.js';

/**
 * Session status values
 */
export type SessionStatus = 'pending' | 'active' | 'paused' | 'finished' | 'abandoned';

/**
 * Complete session record
 */
export interface Session {
    /** Unique session identifier */
    id: string;
    /** External session ID from simulator */
    externalId?: string;
    /** Simulator type */
    simType: 'iracing' | 'acc' | 'rf2';

    // Track info
    /** Track name */
    trackName: string;
    /** Track configuration (e.g., "Grand Prix", "National") */
    trackConfig?: string;
    /** Track length in meters */
    trackLength?: number;

    // Session info
    /** Session type */
    sessionType: 'practice' | 'qualifying' | 'race' | 'warmup';
    /** Current session status */
    status: SessionStatus;

    // Discipline info (NEW)
    /** Racing discipline category */
    discipline?: DisciplineCategory;
    /** Loaded discipline profile ID */
    disciplineProfileId?: string;
    /** Extended session metadata from relay */
    sessionMetadata?: ExtendedSessionMetadata;

    // Timing
    /** When the session started */
    startedAt?: Date;
    /** When the session ended */
    endedAt?: Date;
    /** Total session duration in seconds */
    durationSeconds?: number;
    /** Number of laps (race) */
    scheduledLaps?: number;

    // Participants
    /** Active driver count */
    driverCount: number;
    /** Linked rulebook ID */
    rulebookId?: string;
    /** Linked league ID */
    leagueId?: string;

    // Stats
    /** Total incidents detected */
    incidentCount: number;
    /** Total penalties issued */
    penaltyCount: number;

    // Metadata
    /** Additional session metadata */
    metadata: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Extended session metadata from relay
 */
export interface ExtendedSessionMetadata {
    /** Is multi-class session */
    multiClass: boolean;
    /** Are cautions enabled in sim */
    cautionsEnabled: boolean;
    /** Is driver swap enabled (endurance) */
    driverSwapEnabled: boolean;
    /** Maximum drivers in session */
    maxDrivers: number;
    /** Weather conditions */
    weather?: WeatherConditions;
    /** League ID if known */
    leagueId?: string;
    /** Custom rulebook override ID */
    rulebookOverrideId?: string;
}

/**
 * Driver in a session
 */
export interface SessionDriver {
    /** Unique record identifier */
    id: string;
    /** Parent session ID */
    sessionId: string;
    /** Driver identifier from simulator */
    driverId: string;
    /** Display name */
    driverName: string;
    /** Car number */
    carNumber: string;
    /** Car name/model */
    carName: string;
    /** Team name if applicable */
    teamName?: string;
    /** Driver iRating (iRacing) */
    irating?: number;
    /** Safety rating (iRacing) */
    safetyRating?: number;
    /** License class */
    licenseClass?: string;
    /** When driver joined */
    joinedAt: Date;
    /** When driver left (null if still active) */
    leftAt?: Date;
    /** Is driver currently connected */
    isActive: boolean;
}

/**
 * Live timing entry for a driver
 */
export interface TimingEntry {
    /** Driver ID */
    driverId: string;
    /** Driver name */
    driverName: string;
    /** Car number */
    carNumber: string;
    /** Car name */
    carName: string;

    // Position
    /** Overall position */
    position: number;
    /** Class position */
    classPosition: number;
    /** Positions gained/lost from start */
    positionsGained: number;

    // Lap info
    /** Current lap number */
    currentLap: number;
    /** Total laps completed */
    lapsCompleted: number;

    // Timing
    /** Last lap time in seconds */
    lastLapTime: number;
    /** Best lap time in seconds */
    bestLapTime: number;
    /** Gap to leader in seconds */
    gapToLeader: number;
    /** Gap to car ahead in seconds */
    gapAhead: number;
    /** Gap to car behind in seconds */
    gapBehind: number;

    // Sector times (last lap)
    /** Sector times in seconds */
    sectorTimes: number[];
    /** Best sector times this session */
    bestSectors: number[];

    // Status
    /** Is in pit lane */
    inPit: boolean;
    /** Is on out lap */
    onOutLap: boolean;
    /** Pit stop count */
    pitStops: number;
    /** Current tire compound */
    tireCompound?: string;

    // Incidents
    /** Session incident count */
    incidentCount: number;
    /** Was involved in recent incident */
    hasRecentIncident: boolean;

    // Connection
    /** Is currently connected */
    isConnected: boolean;
    /** Last update timestamp */
    lastUpdate: number;
}

/**
 * Complete session timing data
 */
export interface SessionTiming {
    /** Session ID */
    sessionId: string;
    /** Timing entries for all drivers */
    entries: TimingEntry[];
    /** Current session phase */
    sessionState: string;
    /** Session elapsed time in seconds */
    sessionTimeElapsed: number;
    /** Session time remaining in seconds (-1 if lap-based) */
    sessionTimeRemaining: number;
    /** Laps remaining (-1 if time-based) */
    lapsRemaining: number;
    /** Current leader driver ID */
    leaderId: string;
    /** Fastest lap of session */
    fastestLap: {
        driverId: string;
        time: number;
        lap: number;
    };
    /** Update timestamp */
    timestamp: number;
}
