// =====================================================================
// Track Map Component
// Real-time visualization of car positions using telemetry coordinates
// =====================================================================

import { useMemo, useCallback, useEffect, useState } from 'react';
import { useSessionStore } from '../../stores/session.store';
import './TrackMap.css';

// Types for track shape
interface TrackPoint {
    x: number;
    y: number;
    distPct: number;
}

interface TrackBounds {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
}

interface TrackMapProps {
    /** Show corner markers */
    showCorners?: boolean;
    /** Highlight incident zones */
    incidentZones?: { lapDistPct: number; severity: 'light' | 'medium' | 'heavy' }[];
    /** Track width in meters (default: 12) */
    trackWidth?: number;
    /** Custom width */
    width?: number;
    /** Custom height */
    height?: number;
}

/**
 * Builds track centerline from timing entry positions
 * This is a simplified version - in production, would use actual telemetry coordinates
 */
function buildTrackFromDistPct(): TrackPoint[] {
    // For now, we'll simulate a track shape based on common track layouts
    // In production, this would be built from first lap telemetry X/Y coords
    const points: TrackPoint[] = [];
    const numPoints = 200;

    // Create an oval-ish track with some character
    for (let i = 0; i < numPoints; i++) {
        const pct = i / numPoints;
        const angle = pct * Math.PI * 2;

        // Add some asymmetry/character to make it look like a real track
        // Using a mix of oval and road course characteristics
        const radiusX = 150 + Math.sin(angle * 3) * 20;
        const radiusY = 100 + Math.cos(angle * 2) * 15;

        points.push({
            x: 200 + Math.cos(angle) * radiusX,
            y: 125 + Math.sin(angle) * radiusY,
            distPct: pct
        });
    }

    return points;
}

/**
 * Calculate bounding box from track points
 */
function calculateBounds(points: TrackPoint[]): TrackBounds {
    if (points.length === 0) {
        return { xMin: 0, xMax: 400, yMin: 0, yMax: 250 };
    }

    let xMin = Infinity, xMax = -Infinity;
    let yMin = Infinity, yMax = -Infinity;

    for (const pt of points) {
        xMin = Math.min(xMin, pt.x);
        xMax = Math.max(xMax, pt.x);
        yMin = Math.min(yMin, pt.y);
        yMax = Math.max(yMax, pt.y);
    }

    return { xMin, xMax, yMin, yMax };
}

/**
 * Interpolate position along track points
 */
function getPositionOnTrack(points: TrackPoint[], distPct: number): { x: number; y: number } {
    if (points.length === 0) return { x: 200, y: 125 };

    const normalizedPct = ((distPct % 1) + 1) % 1; // Ensure 0-1 range
    const targetIdx = normalizedPct * (points.length - 1);
    const idx1 = Math.floor(targetIdx);
    const idx2 = Math.min(idx1 + 1, points.length - 1);
    const t = targetIdx - idx1;

    const p1 = points[idx1];
    const p2 = points[idx2];

    return {
        x: p1.x + (p2.x - p1.x) * t,
        y: p1.y + (p2.y - p1.y) * t
    };
}

/**
 * Generate inner/outer track edges by offsetting centerline
 */
function generateTrackEdges(centerline: TrackPoint[], widthPx: number): { inner: string; outer: string } {
    if (centerline.length < 3) {
        return { inner: '', outer: '' };
    }

    const innerPoints: { x: number; y: number }[] = [];
    const outerPoints: { x: number; y: number }[] = [];
    const halfWidth = widthPx / 2;

    for (let i = 0; i < centerline.length; i++) {
        const curr = centerline[i];
        const prev = centerline[(i - 1 + centerline.length) % centerline.length];
        const next = centerline[(i + 1) % centerline.length];

        // Calculate tangent direction
        const dx = next.x - prev.x;
        const dy = next.y - prev.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;

        // Perpendicular (normal) direction
        const nx = -dy / len;
        const ny = dx / len;

        innerPoints.push({
            x: curr.x + nx * halfWidth,
            y: curr.y + ny * halfWidth
        });
        outerPoints.push({
            x: curr.x - nx * halfWidth,
            y: curr.y - ny * halfWidth
        });
    }

    // Convert to SVG path strings
    const toPath = (pts: { x: number; y: number }[]) => {
        if (pts.length === 0) return '';
        return `M ${pts[0].x},${pts[0].y} ` +
            pts.slice(1).map(p => `L ${p.x},${p.y}`).join(' ') +
            ' Z';
    };

    return {
        inner: toPath(innerPoints),
        outer: toPath(outerPoints)
    };
}

export function TrackMap({
    showCorners = true,
    incidentZones = [],
    trackWidth = 12,
    width = 400,
    height = 250
}: TrackMapProps) {
    const { currentSession, timing } = useSessionStore();
    const [trackPoints, setTrackPoints] = useState<TrackPoint[]>([]);

    // Build track shape (would use real telemetry in production)
    useEffect(() => {
        const points = buildTrackFromDistPct();
        setTrackPoints(points);
    }, [currentSession?.trackName]);

    // Calculate track bounds
    const bounds = useMemo(() => calculateBounds(trackPoints), [trackPoints]);

    // World to screen transform
    const worldToScreen = useCallback((x: number, y: number) => {
        const padding = 20;
        const scaleX = (width - padding * 2) / ((bounds.xMax - bounds.xMin) || 1);
        const scaleY = (height - padding * 2) / ((bounds.yMax - bounds.yMin) || 1);
        const scale = Math.min(scaleX, scaleY);

        const offsetX = (width - (bounds.xMax - bounds.xMin) * scale) / 2;
        const offsetY = (height - (bounds.yMax - bounds.yMin) * scale) / 2;

        return {
            x: (x - bounds.xMin) * scale + offsetX,
            y: height - ((y - bounds.yMin) * scale + offsetY) // Flip Y
        };
    }, [bounds, width, height]);

    // Generate track edges
    const trackEdges = useMemo(() => {
        if (trackPoints.length < 3) return { inner: '', outer: '' };

        // Convert track width to screen pixels
        const scale = Math.min(
            (width - 40) / ((bounds.xMax - bounds.xMin) || 1),
            (height - 40) / ((bounds.yMax - bounds.yMin) || 1)
        );
        const widthPx = trackWidth * scale * 0.3; // Scale down for visibility

        // Transform points to screen space first
        const screenPoints = trackPoints.map(pt => {
            const screen = worldToScreen(pt.x, pt.y);
            return { x: screen.x, y: screen.y, distPct: pt.distPct };
        });

        return generateTrackEdges(screenPoints, widthPx);
    }, [trackPoints, bounds, width, height, trackWidth, worldToScreen]);

    // Calculate car positions
    const carPositions = useMemo(() => {
        return timing.map((entry, idx) => {
            // Use lap progress to determine position on track
            const lapProgress = ((entry as any).lapProgress ?? (entry.lapsCompleted % 1)) || (idx * 0.05);
            const pos = getPositionOnTrack(trackPoints, lapProgress);
            const screenPos = worldToScreen(pos.x, pos.y);

            return {
                ...entry,
                screenX: screenPos.x,
                screenY: screenPos.y,
                progress: lapProgress,
                isLeader: idx === 0,
                inPit: (entry as any).inPit || false
            };
        });
    }, [timing, trackPoints, worldToScreen]);

    // Determine car colors
    const getCarColor = (position: number, inPit: boolean) => {
        if (inPit) return '#6b7280';
        if (position === 1) return '#fbbf24';
        if (position <= 3) return '#3b82f6';
        return '#ffffff';
    };

    return (
        <div className="track-map" style={{ width, height }}>
            <div className="track-map__header">
                <h3>Track Map</h3>
                <span className="track-map__name">{currentSession?.trackName || 'Unknown Track'}</span>
            </div>

            <svg viewBox={`0 0 ${width} ${height}`} className="track-map__svg">
                {/* Track surface (outer edge) */}
                {trackEdges.outer && (
                    <path
                        d={trackEdges.outer}
                        className="track-surface-outer"
                        fill="#334155"
                        stroke="none"
                    />
                )}

                {/* Track surface (inner edge - cutout for infield) */}
                {trackEdges.inner && (
                    <path
                        d={trackEdges.inner}
                        className="track-surface-inner"
                        fill="#1e293b"
                        stroke="none"
                    />
                )}

                {/* Track centerline */}
                {trackPoints.length > 2 && (
                    <path
                        d={`M ${trackPoints.map(pt => {
                            const sp = worldToScreen(pt.x, pt.y);
                            return `${sp.x},${sp.y}`;
                        }).join(' L ')} Z`}
                        stroke="rgba(255,255,255,0.15)"
                        strokeWidth="1"
                        strokeDasharray="4,4"
                        fill="none"
                    />
                )}

                {/* Incident zones */}
                {incidentZones.map((zone, idx) => {
                    const pos = getPositionOnTrack(trackPoints, zone.lapDistPct);
                    const screenPos = worldToScreen(pos.x, pos.y);
                    const color = zone.severity === 'heavy' ? '#ef4444' :
                        zone.severity === 'medium' ? '#f97316' : '#fbbf24';
                    return (
                        <circle
                            key={idx}
                            cx={screenPos.x}
                            cy={screenPos.y}
                            r="12"
                            fill={color}
                            opacity="0.4"
                            className="incident-zone pulse"
                        />
                    );
                })}

                {/* Corner markers */}
                {showCorners && [0, 0.25, 0.5, 0.75].map((pct, idx) => {
                    const pos = getPositionOnTrack(trackPoints, pct);
                    const screenPos = worldToScreen(pos.x, pos.y);
                    return (
                        <g key={idx} className="corner-marker">
                            <circle cx={screenPos.x} cy={screenPos.y} r="3" fill="#475569" />
                            <text
                                x={screenPos.x}
                                y={screenPos.y - 6}
                                className="corner-label"
                                textAnchor="middle"
                            >
                                {pct === 0 ? 'S/F' : `T${idx}`}
                            </text>
                        </g>
                    );
                })}

                {/* Car positions */}
                {carPositions.map((car, idx) => (
                    <g key={car.driverId} className="car-marker">
                        <circle
                            cx={car.screenX}
                            cy={car.screenY}
                            r={car.isLeader ? 5 : 3.5}
                            fill={getCarColor(idx + 1, car.inPit)}
                            stroke="#000"
                            strokeWidth="0.5"
                        />
                        {idx < 3 && (
                            <text
                                x={car.screenX}
                                y={car.screenY + 10}
                                className="car-number"
                                textAnchor="middle"
                            >
                                #{car.carNumber}
                            </text>
                        )}
                    </g>
                ))}

                {/* Start/Finish line */}
                {trackPoints.length > 0 && (() => {
                    const sf = getPositionOnTrack(trackPoints, 0);
                    const screenSf = worldToScreen(sf.x, sf.y);
                    return (
                        <line
                            x1={screenSf.x - 5}
                            y1={screenSf.y}
                            x2={screenSf.x + 5}
                            y2={screenSf.y}
                            stroke="#fff"
                            strokeWidth="2"
                        />
                    );
                })()}
            </svg>

            {/* Legend */}
            <div className="track-map__legend">
                <span className="legend-item">
                    <span className="dot gold"></span>
                    Leader
                </span>
                <span className="legend-item">
                    <span className="dot blue"></span>
                    Top 3
                </span>
                <span className="legend-item">
                    <span className="dot gray"></span>
                    Pit
                </span>
            </div>
        </div>
    );
}

export default TrackMap;
