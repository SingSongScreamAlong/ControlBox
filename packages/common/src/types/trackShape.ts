// =====================================================================
// Track Shape Type Definitions
// Defines track outline geometry for map visualization
// =====================================================================

/**
 * A point on the track with coordinates and distance percentage
 */
export interface TrackPoint {
    /** X coordinate in track-local space (meters) */
    x: number;
    /** Y coordinate in track-local space (meters) */
    y: number;
    /** Distance percentage around track (0.0 - 1.0) */
    distPct: number;
    /** Optional altitude (meters) */
    alt?: number;
}

/**
 * Complete track shape geometry
 */
export interface TrackShape {
    /** Track identifier (iRacing track ID) */
    trackId: string;
    /** Human-readable track name */
    trackName: string;
    /** Track configuration (e.g., "Grand Prix", "National") */
    trackConfig?: string;

    /** Centerline points (built from telemetry or loaded from file) */
    centerline: TrackPoint[];

    /** Inner edge points (offset from centerline) */
    innerEdge?: TrackPoint[];
    /** Outer edge points (offset from centerline) */
    outerEdge?: TrackPoint[];

    /** Track width in meters */
    width: number;
    /** Track length in meters */
    length: number;

    /** Bounding box for scaling */
    bounds: {
        xMin: number;
        xMax: number;
        yMin: number;
        yMax: number;
    };

    /** Rotation angle for optimal display (degrees) */
    rotation?: number;

    /** Named corners/sectors */
    corners?: TrackCorner[];

    /** Pit lane entry/exit positions */
    pitLane?: {
        entryPct: number;
        exitPct: number;
    };
}

/**
 * Named corner on the track
 */
export interface TrackCorner {
    /** Corner name (e.g., "Eau Rouge", "Turn 1") */
    name: string;
    /** Position around track (0.0 - 1.0) */
    distPct: number;
    /** Corner number (1-indexed) */
    number?: number;
    /** Corner type */
    type?: 'left' | 'right' | 'hairpin' | 'chicane' | 'straight';
}

/**
 * Request to build track shape from telemetry
 */
export interface BuildTrackShapeRequest {
    trackId: string;
    trackName: string;
    trackConfig?: string;
    /** Array of [x, y, distPct] tuples from first lap */
    points: [number, number, number][];
    /** Track width in meters (default: 12) */
    width?: number;
}

/**
 * Track width presets by category (meters)
 */
export const TRACK_WIDTH_DEFAULTS: Record<string, number> = {
    f1: 14,
    nascar_oval: 20,
    nascar_road: 12,
    indycar: 14,
    imsa: 12,
    gt3: 12,
    road_course: 12,
    oval: 18,
    short_oval: 15,
    dirt_oval: 15,
    street_circuit: 10,
    default: 12
};
