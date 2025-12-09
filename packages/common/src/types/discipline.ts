// =====================================================================
// Discipline Type Definitions
// Racing discipline categories, profiles, and configuration
// =====================================================================

import type { SeverityLevel } from './incident.js';

// ========================
// Discipline Categories
// ========================

/**
 * Racing discipline categories
 * Used to determine rulebook behavior and UI presentation
 */
export type DisciplineCategory =
    | 'oval'        // Short track, intermediate, superspeedway
    | 'road'        // Road course sprint racing
    | 'dirtOval'    // Dirt oval racing
    | 'dirtRoad'    // Dirt road / rallycross
    | 'endurance'   // Multi-class endurance (IMSA/WEC style)
    | 'openWheel';  // Open-wheel racing (Indy/F1 style)

/**
 * Track surface types
 */
export type TrackSurface = 'paved' | 'dirt' | 'mixed';

/**
 * Track configuration details
 */
export interface TrackConfiguration {
    /** Track length in meters */
    length: number;
    /** Number of corners */
    corners: number;
    /** Track surface type */
    surface: TrackSurface;
    /** Is this a night session */
    isNight?: boolean;
    /** Weather conditions */
    weather?: WeatherConditions;
}

export interface WeatherConditions {
    /** Ambient temperature in Celsius */
    ambientTemp: number;
    /** Track temperature in Celsius */
    trackTemp: number;
    /** Precipitation level (0-1) */
    precipitation: number;
    /** Track state description */
    trackState: 'dry' | 'damp' | 'wet' | 'flooded';
}

// ========================
// Discipline Profiles
// ========================

/**
 * Complete discipline profile configuration
 * Defines behavior for a specific racing discipline
 */
export interface DisciplineProfile {
    /** Unique profile identifier */
    id: string;
    /** Profile display name */
    name: string;
    /** Associated discipline category */
    category: DisciplineCategory;
    /** Profile description */
    description?: string;

    /** Caution/yellow flag rules */
    cautionRules: CautionConfiguration;
    /** Penalty behavior model */
    penaltyModel: PenaltyModelConfiguration;
    /** Incident severity thresholds */
    incidentThresholds: SeverityThresholds;
    /** Discipline-specific special rules */
    specialRules: SpecialRulesConfiguration;

    /** Is this the default profile for the category */
    isDefault: boolean;
    /** Profile version */
    version: string;
    /** Profile metadata */
    metadata?: Record<string, unknown>;

    createdAt: Date;
    updatedAt: Date;
}

// ========================
// Caution Configuration
// ========================

/**
 * Caution/Yellow flag behavior configuration
 */
export interface CautionConfiguration {
    /** Full-course yellow allowed */
    fullCourseEnabled: boolean;
    /** Local yellow zones allowed */
    localYellowEnabled: boolean;
    /** Slow zones allowed (endurance) */
    slowZonesEnabled: boolean;
    /** Safety car available */
    safetyCarEnabled: boolean;

    /** Minimum severity to trigger caution */
    triggerThreshold: SeverityLevel;
    /** Auto-restart behavior after caution */
    autoRestart: boolean;
    /** Restart formation type */
    restartType: 'single_file' | 'double_file' | 'standing';

    // Oval/Stock car specific
    /** Lucky dog rule enabled */
    luckyDogEnabled?: boolean;
    /** Wave around rule enabled */
    waveAroundEnabled?: boolean;
    /** Pit road open/closed during caution */
    pitRoadClosedOnYellow?: boolean;
    /** Laps before going green */
    cautionLaps?: number;

    // Endurance specific
    /** Slow zone speed limit (km/h) */
    slowZoneSpeedLimit?: number;
    /** Slow zone minimum duration (seconds) */
    slowZoneMinDuration?: number;
}

/**
 * Restart formation options
 */
export interface RestartConfiguration {
    /** Formation type */
    type: 'single_file' | 'double_file' | 'standing';
    /** Zone where restart occurs */
    zone: 'start_finish' | 'backstretch' | 'custom';
    /** Custom restart position (0-1 track position) */
    customPosition?: number;
}

// ========================
// Penalty Model
// ========================

/**
 * Penalty behavior configuration based on discipline
 */
export interface PenaltyModelConfiguration {
    /** Overall penalty strictness (0-1, higher = stricter) */
    strictness: number;
    /** Contact tolerance (0-1, higher = more forgiving) */
    contactTolerance: number;

    /** Available penalty types for this discipline */
    availablePenalties: PenaltyTypeConfig[];
    /** Default penalty for racing incidents */
    racingIncidentDefault: 'no_action' | 'warning' | 'investigate';

    /** Time penalty options (in seconds) */
    timePenaltyOptions: number[];
    /** Grid penalty options (positions) */
    gridPenaltyOptions: number[];

    // Discipline-specific modifiers
    /** Lap 1 incident forgiveness multiplier */
    lap1ForgivenessFactor?: number;
    /** Multi-class contact forgiveness */
    multiClassForgiveness?: number;
    /** Weather condition modifiers */
    weatherModifiers?: WeatherPenaltyModifiers;
}

export interface PenaltyTypeConfig {
    type: string;
    displayName: string;
    isEnabled: boolean;
    defaultValue?: string;
}

export interface WeatherPenaltyModifiers {
    /** Modifier for wet conditions (multiplied to base penalty) */
    wet: number;
    /** Modifier for damp conditions */
    damp: number;
    /** Modifier for night sessions */
    night: number;
}

// ========================
// Severity Thresholds
// ========================

/**
 * Incident severity classification thresholds
 */
export interface SeverityThresholds {
    /** Speed differential for light contact (km/h) */
    lightContactSpeedDelta: number;
    /** Speed differential for medium contact (km/h) */
    mediumContactSpeedDelta: number;
    /** Speed differential for heavy contact (km/h) */
    heavyContactSpeedDelta: number;

    /** Overlap percentage threshold for divebomb */
    divebombOverlapThreshold: number;
    /** Closing speed considered dangerous (km/h) */
    dangerousClosingSpeed: number;

    /** Off-track excursion considered minor (meters) */
    minorOffTrackDistance: number;
    /** Spin duration considered minor (seconds) */
    minorSpinDuration: number;

    // Discipline-specific thresholds
    /** Track limit violations before penalty (road/endurance) */
    trackLimitWarningCount?: number;
    /** Unsafe rejoin speed threshold (km/h) */
    unsafeRejoinSpeedThreshold?: number;
}

// ========================
// Special Rules
// ========================

/**
 * Discipline-specific special rules
 */
export interface SpecialRulesConfiguration {
    // Track limits (road/endurance)
    /** Track limits enforcement enabled */
    trackLimitsEnabled?: boolean;
    /** Track limit violation threshold */
    trackLimitThreshold?: number;
    /** Lap time deletion for track limits */
    trackLimitLapDeletion?: boolean;

    // Multi-class (endurance)
    /** Multi-class rules enabled */
    multiClassEnabled?: boolean;
    /** Prototype must yield during blue flag */
    blueFlagEnforcement?: boolean;
    /** Slower class yielding rules */
    classYieldingRules?: ClassYieldingConfiguration;

    // Driver swaps (endurance)
    /** Driver swap rules enabled */
    driverSwapEnabled?: boolean;
    /** Minimum stint time (seconds) */
    minStintTime?: number;
    /** Maximum stint time (seconds) */
    maxStintTime?: number;
    /** Maximum driving time per driver (seconds) */
    maxDrivingTimePerDriver?: number;

    // Pit lane (all)
    /** Pit lane speed limit enforced */
    pitLaneSpeedLimitEnabled?: boolean;
    /** Pit lane speed limit (km/h) */
    pitLaneSpeedLimit?: number;
    /** Unsafe release detection enabled */
    unsafeReleaseEnabled?: boolean;

    // Open-wheel specific
    /** Wing damage assessment enabled */
    wingDamageAssessment?: boolean;
    /** Front wing contact penalty enabled */
    frontWingContactPenalty?: boolean;

    // Oval specific
    /** Bump drafting allowed */
    bumpDraftingAllowed?: boolean;
    /** Side drafting allowed */
    sideDraftingAllowed?: boolean;

    // Dirt specific
    /** Slide contact tolerance */
    slideContactTolerance?: number;
    /** Roost (debris) damage consideration */
    roostDamageEnabled?: boolean;
}

export interface ClassYieldingConfiguration {
    /** Number of corner rule (car ahead has right of way after X corners) */
    cornerRule: number;
    /** Blue flag laps before penalty */
    blueFlagLaps: number;
    /** Faster class has responsibility percentage */
    fasterClassResponsibility: number;
}

// ========================
// Profile Templates
// ========================

/**
 * Built-in profile template identifiers
 */
export type BuiltInProfile =
    | 'oval_default'
    | 'oval_superspeedway'
    | 'oval_short_track'
    | 'road_default'
    | 'road_sprint'
    | 'dirt_oval_default'
    | 'dirt_road_default'
    | 'endurance_default'
    | 'endurance_multiclass'
    | 'open_wheel_default'
    | 'open_wheel_strict';

/**
 * Profile creation request
 */
export interface CreateProfileRequest {
    name: string;
    category: DisciplineCategory;
    description?: string;
    cautionRules: CautionConfiguration;
    penaltyModel: PenaltyModelConfiguration;
    incidentThresholds: SeverityThresholds;
    specialRules?: SpecialRulesConfiguration;
    isDefault?: boolean;
    version?: string;
}

/**
 * Profile update request
 */
export interface UpdateProfileRequest {
    name?: string;
    description?: string;
    cautionRules?: Partial<CautionConfiguration>;
    penaltyModel?: Partial<PenaltyModelConfiguration>;
    incidentThresholds?: Partial<SeverityThresholds>;
    specialRules?: Partial<SpecialRulesConfiguration>;
    isDefault?: boolean;
    version?: string;
}
