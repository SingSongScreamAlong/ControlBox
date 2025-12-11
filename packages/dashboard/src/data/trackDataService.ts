// =====================================================================
// Track Data Service
// Provides lookup for track metadata from lovely-track-data
// =====================================================================

// Type definitions for track data
export interface TrackTurn {
    name: string;
    start: number;  // percentage (0-1)
    end: number;    // percentage (0-1)
    marker?: number; // apex percentage
    number?: number;
    scale?: number;  // 1-6 (hairpin to wide)
    direction?: 0 | 1; // 0: left, 1: right
}

export interface TrackStraight {
    name: string;
    start: number;
    end: number;
    marker?: number;
}

export interface TrackSector {
    name: string;
    marker: number; // percentage where sector starts
}

export interface TrackData {
    name: string;
    trackId: string;
    country?: string;
    year?: number;
    length?: number;      // meters
    pitentry?: number;    // percentage
    pitexit?: number;     // percentage
    turn: TrackTurn[];
    straight?: TrackStraight[];
    sector: TrackSector[];
}

// Import all track files
const trackModules = import.meta.glob('./trackData/*.json', { eager: true });

// Build lookup map by trackId (normalized)
const trackDataMap = new Map<string, TrackData>();

for (const [path, module] of Object.entries(trackModules)) {
    const data = module as TrackData;
    if (data?.trackId) {
        // Store by normalized trackId (lowercase, trimmed)
        trackDataMap.set(data.trackId.toLowerCase().trim(), data);
        // Also store by filename without extension for fallback
        const filename = path.split('/').pop()?.replace('.json', '') || '';
        trackDataMap.set(filename.toLowerCase(), data);
    }
}

/**
 * Get track data by trackId or track name
 */
export function getTrackData(trackId: string): TrackData | undefined {
    const normalized = trackId.toLowerCase().trim();
    return trackDataMap.get(normalized);
}

/**
 * Find which turn a car is in based on track position
 */
export function getCurrentTurn(trackData: TrackData, trackPct: number): TrackTurn | undefined {
    return trackData.turn.find(t => trackPct >= t.start && trackPct <= t.end);
}

/**
 * Get the corner name at a track position
 */
export function getCornerName(trackId: string, trackPct: number): string | undefined {
    const data = getTrackData(trackId);
    if (!data) return undefined;

    const turn = getCurrentTurn(data, trackPct);
    return turn?.name;
}

/**
 * Check if position is in pit lane
 */
export function isInPitLane(trackData: TrackData, trackPct: number): boolean {
    if (!trackData.pitentry || !trackData.pitexit) return false;

    // Pit lane can wrap around start/finish
    if (trackData.pitentry > trackData.pitexit) {
        // Wraps around (entry is near end of lap, exit is near start)
        return trackPct >= trackData.pitentry || trackPct <= trackData.pitexit;
    }
    return trackPct >= trackData.pitentry && trackPct <= trackData.pitexit;
}

/**
 * Get current sector number (1-indexed)
 */
export function getCurrentSector(trackData: TrackData, trackPct: number): number {
    for (let i = trackData.sector.length - 1; i >= 0; i--) {
        if (trackPct >= (trackData.sector[i - 1]?.marker || 0)) {
            return i + 1;
        }
    }
    return 1;
}

/**
 * Get all available track IDs
 */
export function getAvailableTrackIds(): string[] {
    return Array.from(new Set(
        Array.from(trackDataMap.values()).map(t => t.trackId)
    ));
}

/**
 * Search tracks by name (fuzzy match)
 */
export function searchTracks(query: string): TrackData[] {
    const q = query.toLowerCase();
    return Array.from(trackDataMap.values()).filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.trackId.toLowerCase().includes(q)
    );
}

// Export number of tracks loaded
export const TRACK_COUNT = new Set(Array.from(trackDataMap.values()).map(t => t.trackId)).size;

console.log(`[TrackData] Loaded ${TRACK_COUNT} tracks from lovely-track-data`);
