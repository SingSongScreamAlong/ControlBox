// =====================================================================
// Relay Protocol Type Definitions
// Messages between ControlBox Relay and Cloud
// =====================================================================

import type { DisciplineCategory } from './discipline.js';

// ========================
// Message Base
// ========================

/**
 * Base interface for all relay messages
 */
export interface RelayMessage {
    /** Message type identifier */
    type: string;
    /** Session identifier */
    sessionId: string;
    /** Unix timestamp (milliseconds) */
    timestamp: number;
}

// ========================
// Relay → Cloud Messages
// ========================

/**
 * Session metadata sent at session start
 * Determines which rulebook profile to load
 */
export interface SessionMetadataMessage extends RelayMessage {
    type: 'session_metadata';
    /** Track name from simulator */
    trackName: string;
    /** Track configuration (e.g., "Grand Prix", "National") */
    trackConfig?: string;
    /** Racing discipline category */
    category: DisciplineCategory;
    /** Is this a multi-class session */
    multiClass: boolean;
    /** Are cautions/yellows enabled in the sim */
    cautionsEnabled: boolean;
    /** Is driver swap enabled (endurance) */
    driverSwap: boolean;
    /** Maximum drivers in session */
    maxDrivers: number;
    /** Weather conditions */
    weather: WeatherData;
    /** League ID if known */
    leagueId?: string;
    /** Custom rulebook ID override */
    rulebookOverrideId?: string;
}

export interface WeatherData {
    /** Ambient temperature (Celsius) */
    ambientTemp: number;
    /** Track temperature (Celsius) */
    trackTemp: number;
    /** Precipitation level (0-1) */
    precipitation: number;
    /** Track surface state */
    trackState: 'dry' | 'damp' | 'wet';
}

/**
 * Race state/flag change event
 */
export interface RaceEventMessage extends RelayMessage {
    type: 'race_event';
    /** Current flag state */
    flagState: 'green' | 'yellow' | 'localYellow' | 'caution' | 'red' | 'restart' | 'checkered' | 'white';
    /** Current lap number (leader) */
    lap: number;
    /** Time remaining in session (seconds, -1 if lap-based) */
    timeRemaining: number;
    /** Session phase */
    sessionPhase: 'pre_race' | 'formation' | 'racing' | 'caution' | 'restart' | 'finished';
}

/**
 * Incident detected by relay
 */
export interface IncidentMessage extends RelayMessage {
    type: 'incident';
    /** Car IDs involved */
    cars: number[];
    /** Car names for display */
    carNames?: string[];
    /** Driver names for display */
    driverNames?: string[];
    /** Lap when incident occurred */
    lap: number;
    /** Corner/sector number */
    corner: number;
    /** Corner/sector name */
    cornerName?: string;
    /** Track position (0-1) */
    trackPosition: number;
    /** Estimated severity */
    severity: 'low' | 'med' | 'high';
    /** Discipline context (may differ from session) */
    disciplineContext: DisciplineCategory;
    /** Raw incident data from sim */
    rawData?: Record<string, unknown>;
}

/**
 * Telemetry snapshot from relay
 */
export interface TelemetrySnapshotMessage extends RelayMessage {
    type: 'telemetry';
    /** Per-car telemetry data */
    cars: CarTelemetrySnapshot[];
}

export interface CarTelemetrySnapshot {
    /** Car ID in session */
    carId: number;
    /** Driver ID */
    driverId?: string;
    /** Current speed (m/s) */
    speed: number;
    /** Current gear */
    gear: number;
    /** Track position (0-1) */
    pos: { s: number };
    /** Throttle position (0-1) */
    throttle: number;
    /** Brake position (0-1) */
    brake: number;
    /** Steering angle (-1 to 1) */
    steering: number;
    /** RPM */
    rpm?: number;
    /** Is in pit lane */
    inPit: boolean;
    /** Current lap */
    lap: number;
    /** Position in class */
    classPosition?: number;
    /** Overall position */
    position?: number;
}

/**
 * Driver join/leave notification
 */
export interface DriverUpdateMessage extends RelayMessage {
    type: 'driver_update';
    /** Update type */
    action: 'join' | 'leave' | 'swap';
    /** Driver identifier */
    driverId: string;
    /** Driver display name */
    driverName: string;
    /** Car number */
    carNumber: string;
    /** Car name/model */
    carName: string;
    /** Team name */
    teamName?: string;
    /** iRating (iRacing) */
    irating?: number;
    /** Safety rating (iRacing) */
    safetyRating?: number;
}

// ========================
// Cloud → Relay Messages
// ========================

/**
 * Recommendation from cloud to relay
 */
export interface RecommendationMessage extends RelayMessage {
    type: 'recommendation';
    /** Recommendation ID */
    recommendationId: string;
    /** Action being recommended */
    action: 'localYellow' | 'globalYellow' | 'slowZone' | 'reviewIncident' | 'penalty' | 'restart' | 'noAction';
    /** Discipline context */
    disciplineContext: DisciplineCategory;
    /** Human-readable details */
    details: string;
    /** Confidence score (0-1) */
    confidence: number;
    /** Priority (1-10) */
    priority: number;
    /** Additional payload data */
    payload?: Record<string, unknown>;
}

/**
 * Acknowledgment of received message
 */
export interface AcknowledgmentMessage extends RelayMessage {
    type: 'ack';
    /** Original message type being acknowledged */
    originalType: string;
    /** Original message timestamp */
    originalTimestamp: number;
    /** Success flag */
    success: boolean;
    /** Error message if not successful */
    error?: string;
}

/**
 * Profile loaded notification
 */
export interface ProfileLoadedMessage extends RelayMessage {
    type: 'profile_loaded';
    /** Loaded profile ID */
    profileId: string;
    /** Profile name */
    profileName: string;
    /** Profile category */
    category: DisciplineCategory;
}

// ========================
// Web → Cloud → Relay Messages
// ========================

/**
 * Steward command from dashboard
 */
export interface StewardCommandMessage extends RelayMessage {
    type: 'steward_command';
    /** Command to execute */
    command: StewardCommand;
    /** Reason for command */
    reason: string;
    /** Steward ID */
    issuedBy: string;
    /** Steward name */
    issuedByName?: string;
    /** Target car ID (if applicable) */
    targetCarId?: number;
    /** Additional command payload */
    payload?: Record<string, unknown>;
}

export type StewardCommand =
    | 'throwYellow'       // Trigger full course yellow
    | 'clearYellow'       // Clear yellow flag
    | 'throwLocalYellow'  // Trigger local yellow
    | 'clearLocalYellow'  // Clear local yellow
    | 'deploySafetyCar'   // Deploy safety car
    | 'retrieveSafetyCar' // Bring safety car in
    | 'issuePenalty'      // Issue penalty to driver
    | 'setSlowZone'       // Activate slow zone
    | 'clearSlowZone'     // Deactivate slow zone
    | 'redFlag'           // Red flag session
    | 'resumeSession'     // Resume from red flag
    | 'blackFlag';        // Black flag a driver

// ========================
// Message Type Guards
// ========================

export function isSessionMetadataMessage(msg: RelayMessage): msg is SessionMetadataMessage {
    return msg.type === 'session_metadata';
}

export function isRaceEventMessage(msg: RelayMessage): msg is RaceEventMessage {
    return msg.type === 'race_event';
}

export function isIncidentMessage(msg: RelayMessage): msg is IncidentMessage {
    return msg.type === 'incident';
}

export function isTelemetrySnapshotMessage(msg: RelayMessage): msg is TelemetrySnapshotMessage {
    return msg.type === 'telemetry';
}

export function isRecommendationMessage(msg: RelayMessage): msg is RecommendationMessage {
    return msg.type === 'recommendation';
}

export function isStewardCommandMessage(msg: RelayMessage): msg is StewardCommandMessage {
    return msg.type === 'steward_command';
}

// ========================
// Relay Connection State
// ========================

/**
 * Relay connection status
 */
export interface RelayConnectionState {
    /** Is currently connected */
    connected: boolean;
    /** Last heartbeat timestamp */
    lastHeartbeat: number;
    /** Connection latency (ms) */
    latency: number;
    /** Relay version */
    relayVersion?: string;
    /** Active session ID */
    activeSessionId?: string;
    /** Connection error if any */
    error?: string;
}
