// =====================================================================
// Event Types
// Post-race upload, artifacts, and reporting
// =====================================================================

/**
 * Scheduled race event within a season
 */
export interface Event {
    id: string;
    leagueId: string;
    seriesId: string;
    seasonId: string;
    name: string;
    scheduledAt: Date;
    startedAt?: Date;
    endedAt?: Date;
    trackName?: string;
    trackConfig?: string;
    sessionId?: string;
    notes?: string;
    createdAt: Date;
    updatedAt?: Date;
}

export interface CreateEventRequest {
    name: string;
    scheduledAt: string;
    trackName?: string;
    trackConfig?: string;
    notes?: string;
}

export interface UpdateEventRequest {
    name?: string;
    scheduledAt?: string;
    startedAt?: string;
    endedAt?: string;
    trackName?: string;
    trackConfig?: string;
    sessionId?: string;
    notes?: string;
}

// =====================================================================
// Event Artifacts
// =====================================================================

export type ArtifactType = 'replay' | 'results' | 'other';

export interface EventArtifact {
    id: string;
    eventId: string;
    type: ArtifactType;
    filename: string;
    storagePath: string;
    fileSizeBytes?: number;
    mimeType?: string;
    uploadedBy: string;
    processedAt?: Date;
    processingError?: string;
    metadata?: Record<string, unknown>;
    createdAt: Date;
    updatedAt?: Date;
}

export interface UploadArtifactRequest {
    type: ArtifactType;
    filename: string;
}

// =====================================================================
// Post-Race Reports
// =====================================================================

export type ReportStatus = 'pending' | 'processing' | 'ready' | 'failed';

export interface EventReport {
    id: string;
    eventId: string;
    status: ReportStatus;
    generatedBy?: string;
    summary: EventReportSummary;
    processingStartedAt?: Date;
    processingCompletedAt?: Date;
    errorMessage?: string;
    version: number;
    createdAt: Date;
    updatedAt?: Date;
}

/**
 * Structured report data - source of truth for all displays/exports
 */
export interface EventReportSummary {
    finishingOrder: DriverResult[];
    penalties: PenaltyEntry[];
    incidents: IncidentSummary[];
    statistics: RaceStatistics;
    highlights?: string[];
    notes?: string;
}

export interface DriverResult {
    position: number;
    driverId?: string;
    driverName: string;
    carNumber: string;
    carClass?: string;
    carName?: string;
    teamName?: string;
    lapsCompleted: number;
    finishStatus: FinishStatus;
    gapToLeader?: string;
    gapToNext?: string;
    positionsGained?: number;
    qualifyingPosition?: number;
    averageLapTime?: number;
    fastestLap?: number;
    fastestLapNumber?: number;
    incidentPoints?: number;
    pitStops?: number;
}

export type FinishStatus = 'finished' | 'dnf' | 'dsq' | 'dns' | 'dq';

export interface PenaltyEntry {
    driverName: string;
    carNumber: string;
    penaltyType: string;
    reason: string;
    lap?: number;
    timeApplied?: string;
    positionsLost?: number;
    issuedBy?: string;
    issuedAt?: Date;
}

export interface IncidentSummary {
    lap: number;
    timestamp?: string;
    description: string;
    driversInvolved: string[];
    severity?: 'minor' | 'moderate' | 'major';
    resultedInCaution?: boolean;
}

export interface RaceStatistics {
    totalDrivers: number;
    finishers: number;
    dnfs: number;
    dsqs: number;
    totalLaps: number;
    totalIncidents: number;
    cautions?: number;
    cautionLaps?: number;
    leadChanges?: number;
    differentLeaders?: number;
    averageFieldSize?: number;
    fastestLap?: {
        driverName: string;
        carNumber: string;
        lapTime: number;
        lapNumber: number;
    };
}

// =====================================================================
// Results Parsing
// =====================================================================

/**
 * Raw parsed results before transformation to DriverResult
 */
export interface ParsedResultsRow {
    position?: number;
    driverName?: string;
    carNumber?: string;
    carClass?: string;
    car?: string;
    team?: string;
    laps?: number;
    time?: string;
    gap?: string;
    interval?: string;
    fastLap?: string;
    avgLap?: string;
    led?: number;
    inc?: number;
    startPos?: number;
    status?: string;
    [key: string]: unknown;
}

export interface ResultsParseOptions {
    hasHeader?: boolean;
    delimiter?: string;
    positionColumn?: string;
    driverColumn?: string;
    carNumberColumn?: string;
}

// =====================================================================
// API Responses
// =====================================================================

export interface EventWithArtifacts extends Event {
    artifacts: EventArtifact[];
    report?: EventReport;
    hasReplay: boolean;
    hasResults: boolean;
}

export interface EventListResponse {
    events: Event[];
    totalCount: number;
}
