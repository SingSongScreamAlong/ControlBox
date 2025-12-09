// =====================================================================
// Scoring Types
// Points tables, standings, event results
// =====================================================================

/**
 * Points table configuration
 */
export interface PointsTable {
    id: string;
    seriesId: string;
    name: string;
    isDefault: boolean;
    points: Record<number, number>;  // position -> points
    classPoints?: Record<string, Record<number, number>>;  // class -> position -> points
    createdAt: Date;
    updatedAt?: Date;
}

/**
 * Bonus points configuration
 */
export type BonusPointType = 'pole' | 'laps_led' | 'most_laps_led' | 'clean_race' | 'fastest_lap';

export interface BonusPointsConfig {
    id: string;
    seriesId: string;
    type: BonusPointType;
    points: number;
    conditions?: {
        minStarters?: number;
        maxIncidents?: number;
    };
}

/**
 * Driver standing entry
 */
export interface DriverStanding {
    id: string;
    seasonId: string;
    driverId: string;
    driverName: string;
    teamId?: string;
    teamName?: string;
    carClass?: string;
    // Position
    position: number;
    classPosition?: number;
    // Stats
    points: number;
    pointsWithDrops: number;
    wins: number;
    podiums: number;
    top5s: number;
    top10s: number;
    dnfs: number;
    dsqs: number;
    lapsLed: number;
    poles: number;
    incidents: number;
    racesStarted: number;
    behindLeader: number;
    // Metadata
    iracingCustId?: string;
    updatedAt?: Date;
}

/**
 * Team standing entry
 */
export interface TeamStanding {
    id: string;
    seasonId: string;
    teamId: string;
    teamName: string;
    carClass?: string;
    position: number;
    classPosition?: number;
    points: number;
    wins: number;
    updatedAt?: Date;
}

/**
 * Event result for a driver
 */
export interface EventResult {
    id: string;
    eventId: string;
    driverId: string;
    driverName: string;
    teamId?: string;
    teamName?: string;
    carNumber?: string;
    carClass?: string;
    carName?: string;
    // Positions
    startingPosition?: number;
    finishingPosition: number;
    classStartingPosition?: number;
    classFinishingPosition?: number;
    // Race data
    lapsCompleted: number;
    lapsLed: number;
    finishStatus: 'finished' | 'dnf' | 'dsq' | 'dns' | 'dq';
    // Points
    basePoints: number;
    bonusPoints: number;
    penaltyPoints: number;
    totalPoints: number;
    isDropped: boolean;
    // Timing
    fastestLapTime?: number;
    averageLapTime?: number;
    totalTime?: string;
    gapToLeader?: string;
    // Incidents
    incidentCount: number;
}

/**
 * Drop week configuration
 */
export interface DropWeekConfig {
    id: string;
    seasonId: string;
    maxDrops: number;
    minEventsForDrops: number;
    classRules?: Record<string, { maxDrops: number }>;
}

/**
 * Scoring configuration (combined view)
 */
export interface ScoringConfig {
    pointsTable: PointsTable;
    bonuses: BonusPointsConfig[];
    dropWeeks: DropWeekConfig;
}

// API Request/Response types
export interface CreatePointsTableRequest {
    name: string;
    points: Record<number, number>;
    classPoints?: Record<string, Record<number, number>>;
    isDefault?: boolean;
}

export interface UpdatePointsTableRequest extends Partial<CreatePointsTableRequest> { }

export interface ScoreEventRequest {
    eventId: string;
    results?: EventResult[];  // Optional override
}

export interface StandingsQuery {
    seasonId: string;
    classId?: string;
    limit?: number;
    offset?: number;
}

export interface StandingsResponse {
    standings: DriverStanding[];
    totalCount: number;
    lastUpdated?: Date;
}

export interface TeamStandingsResponse {
    standings: TeamStanding[];
    totalCount: number;
    lastUpdated?: Date;
}
