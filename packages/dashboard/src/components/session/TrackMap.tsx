// =====================================================================
// Track Map Component
// Real-time visualization of car positions with corner/pit/sector overlays
// Uses lovely-track-data for track metadata
// =====================================================================

import { useMemo, useCallback, useEffect, useState } from 'react';
import { useSessionStore } from '../../stores/session.store';
import { getTrackData, TrackData, TrackTurn } from '../../data/trackDataService';
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
    showCorners?: boolean;
    showSectors?: boolean;
    showPitLane?: boolean;
    incidentZones?: { lapDistPct: number; severity: 'light' | 'medium' | 'heavy' }[];
    trackWidth?: number;
    width?: number;
    height?: number;
}

function buildTrackFromDistPct(): TrackPoint[] {
    const points: TrackPoint[] = [];
    const numPoints = 200;

    for (let i = 0; i < numPoints; i++) {
        const pct = i / numPoints;
        const angle = pct * Math.PI * 2;
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

function calculateBounds(points: TrackPoint[]): TrackBounds {
    if (points.length === 0) return { xMin: 0, xMax: 400, yMin: 0, yMax: 250 };
    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
    for (const pt of points) {
        xMin = Math.min(xMin, pt.x);
        xMax = Math.max(xMax, pt.x);
        yMin = Math.min(yMin, pt.y);
        yMax = Math.max(yMax, pt.y);
    }
    return { xMin, xMax, yMin, yMax };
}

function getPositionOnTrack(points: TrackPoint[], distPct: number): { x: number; y: number } {
    if (points.length === 0) return { x: 200, y: 125 };
    const normalizedPct = ((distPct % 1) + 1) % 1;
    const targetIdx = normalizedPct * (points.length - 1);
    const idx1 = Math.floor(targetIdx);
    const idx2 = Math.min(idx1 + 1, points.length - 1);
    const t = targetIdx - idx1;
    const p1 = points[idx1];
    const p2 = points[idx2];
    return { x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t };
}

function generateTrackEdges(centerline: TrackPoint[], widthPx: number): { inner: string; outer: string } {
    if (centerline.length < 3) return { inner: '', outer: '' };
    const innerPoints: { x: number; y: number }[] = [];
    const outerPoints: { x: number; y: number }[] = [];
    const halfWidth = widthPx / 2;

    for (let i = 0; i < centerline.length; i++) {
        const curr = centerline[i];
        const prev = centerline[(i - 1 + centerline.length) % centerline.length];
        const next = centerline[(i + 1) % centerline.length];
        const dx = next.x - prev.x;
        const dy = next.y - prev.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        innerPoints.push({ x: curr.x + nx * halfWidth, y: curr.y + ny * halfWidth });
        outerPoints.push({ x: curr.x - nx * halfWidth, y: curr.y - ny * halfWidth });
    }

    const toPath = (pts: { x: number; y: number }[]) => {
        if (pts.length === 0) return '';
        return `M ${pts[0].x},${pts[0].y} ` + pts.slice(1).map(p => `L ${p.x},${p.y}`).join(' ') + ' Z';
    };

    return { inner: toPath(innerPoints), outer: toPath(outerPoints) };
}

export function TrackMap({
    showCorners = true,
    showSectors = true,
    showPitLane = true,
    incidentZones = [],
    trackWidth = 12,
    width = 400,
    height = 250
}: TrackMapProps) {
    const { currentSession, timing } = useSessionStore();
    const [trackPoints, setTrackPoints] = useState<TrackPoint[]>([]);
    const [trackData, setTrackData] = useState<TrackData | null>(null);
    const [hoveredTurn, setHoveredTurn] = useState<TrackTurn | null>(null);

    // Load track data when session changes
    useEffect(() => {
        // Try to find track data by various name formats
        const trackName = currentSession?.trackName?.toLowerCase() || '';
        const trackConfig = currentSession?.trackConfig?.toLowerCase() || '';

        // Try different combinations to find the track
        const possibleIds = [
            `${trackName}-${trackConfig}`.replace(/\s+/g, '-'),
            trackName.replace(/\s+/g, '-'),
            trackName.split(' ')[0] + '-gp',
            trackName.split(' ')[0]
        ];

        let foundData: TrackData | null = null;
        for (const id of possibleIds) {
            const data = getTrackData(id);
            if (data) {
                foundData = data;
                setTrackData(data);
                console.log(`[TrackMap] Loaded track data for: ${data.name}`);
                break;
            }
        }

        // Use centerline from track data if available, otherwise generate fallback
        if (foundData?.centerline && foundData.centerline.length > 0) {
            console.log(`[TrackMap] Using real centerline: ${foundData.centerline.length} points`);
            setTrackPoints(foundData.centerline as TrackPoint[]);
        } else {
            // Fallback to generated oval
            const points = buildTrackFromDistPct();
            setTrackPoints(points);
        }
    }, [currentSession?.trackName, currentSession?.trackConfig]);

    const bounds = useMemo(() => calculateBounds(trackPoints), [trackPoints]);

    const worldToScreen = useCallback((x: number, y: number) => {
        const padding = 20;
        const scaleX = (width - padding * 2) / ((bounds.xMax - bounds.xMin) || 1);
        const scaleY = (height - padding * 2) / ((bounds.yMax - bounds.yMin) || 1);
        const scale = Math.min(scaleX, scaleY);
        const offsetX = (width - (bounds.xMax - bounds.xMin) * scale) / 2;
        const offsetY = (height - (bounds.yMax - bounds.yMin) * scale) / 2;
        return {
            x: (x - bounds.xMin) * scale + offsetX,
            y: height - ((y - bounds.yMin) * scale + offsetY)
        };
    }, [bounds, width, height]);

    const trackEdges = useMemo(() => {
        if (trackPoints.length < 3) return { inner: '', outer: '' };
        const scale = Math.min(
            (width - 40) / ((bounds.xMax - bounds.xMin) || 1),
            (height - 40) / ((bounds.yMax - bounds.yMin) || 1)
        );
        const widthPx = trackWidth * scale * 0.3;
        const screenPoints = trackPoints.map(pt => {
            const screen = worldToScreen(pt.x, pt.y);
            return { x: screen.x, y: screen.y, distPct: pt.distPct };
        });
        return generateTrackEdges(screenPoints, widthPx);
    }, [trackPoints, bounds, width, height, trackWidth, worldToScreen]);

    const carPositions = useMemo(() => {
        return timing.map((entry, idx) => {
            // Use lapDistPct from timing entries (sent by relay via server)
            const lapDistPct = (entry as any).lapDistPct ?? (entry as any).lapProgress ?? 0;
            const pos = getPositionOnTrack(trackPoints, lapDistPct);
            const screenPos = worldToScreen(pos.x, pos.y);

            // Check if in a turn
            const currentTurn = trackData?.turn.find(t => lapDistPct >= t.start && lapDistPct <= t.end);

            return {
                ...entry,
                screenX: screenPos.x,
                screenY: screenPos.y,
                progress: lapDistPct,
                isLeader: idx === 0,
                inPit: (entry as any).inPit || false,
                currentTurn: currentTurn?.name
            };
        });
    }, [timing, trackPoints, worldToScreen, trackData]);

    const getCarColor = (position: number, inPit: boolean) => {
        if (inPit) return '#6b7280';
        if (position === 1) return '#fbbf24';
        if (position <= 3) return '#3b82f6';
        return '#ffffff';
    };

    // Get pit lane position
    const pitEntry = trackData?.pitentry ? getPositionOnTrack(trackPoints, trackData.pitentry) : null;
    const pitExit = trackData?.pitexit ? getPositionOnTrack(trackPoints, trackData.pitexit) : null;

    return (
        <div className="track-map" style={{ width, height }}>
            <div className="track-map__header">
                <h3>Track Map</h3>
                <span className="track-map__name">
                    {trackData?.name || currentSession?.trackName || 'Unknown Track'}
                </span>
            </div>

            <svg viewBox={`0 0 ${width} ${height}`} className="track-map__svg">
                {/* Track surface */}
                {trackEdges.outer && (
                    <path d={trackEdges.outer} className="track-surface-outer" fill="#334155" stroke="none" />
                )}
                {trackEdges.inner && (
                    <path d={trackEdges.inner} className="track-surface-inner" fill="#1e293b" stroke="none" />
                )}

                {/* Sector boundaries */}
                {showSectors && trackData?.sector.map((sector, idx) => {
                    const pos = getPositionOnTrack(trackPoints, sector.marker);
                    const screenPos = worldToScreen(pos.x, pos.y);
                    return (
                        <g key={`sector-${idx}`} className="sector-marker">
                            <line
                                x1={screenPos.x - 8}
                                y1={screenPos.y}
                                x2={screenPos.x + 8}
                                y2={screenPos.y}
                                stroke="#22c55e"
                                strokeWidth="2"
                                strokeDasharray="3,2"
                            />
                            <text
                                x={screenPos.x}
                                y={screenPos.y - 8}
                                className="sector-label"
                                textAnchor="middle"
                                fill="#22c55e"
                                fontSize="8"
                            >
                                S{sector.name}
                            </text>
                        </g>
                    );
                })}

                {/* Pit entry/exit markers */}
                {showPitLane && pitEntry && (
                    <g className="pit-marker">
                        <circle
                            cx={worldToScreen(pitEntry.x, pitEntry.y).x}
                            cy={worldToScreen(pitEntry.x, pitEntry.y).y}
                            r="4"
                            fill="#f97316"
                            stroke="#fff"
                            strokeWidth="1"
                        />
                        <text
                            x={worldToScreen(pitEntry.x, pitEntry.y).x}
                            y={worldToScreen(pitEntry.x, pitEntry.y).y - 8}
                            className="pit-label"
                            textAnchor="middle"
                            fill="#f97316"
                            fontSize="7"
                        >
                            PIT IN
                        </text>
                    </g>
                )}
                {showPitLane && pitExit && (
                    <g className="pit-marker">
                        <circle
                            cx={worldToScreen(pitExit.x, pitExit.y).x}
                            cy={worldToScreen(pitExit.x, pitExit.y).y}
                            r="4"
                            fill="#22c55e"
                            stroke="#fff"
                            strokeWidth="1"
                        />
                        <text
                            x={worldToScreen(pitExit.x, pitExit.y).x}
                            y={worldToScreen(pitExit.x, pitExit.y).y - 8}
                            className="pit-label"
                            textAnchor="middle"
                            fill="#22c55e"
                            fontSize="7"
                        >
                            PIT OUT
                        </text>
                    </g>
                )}

                {/* Corner markers with names from track data */}
                {showCorners && trackData?.turn.slice(0, 15).map((turn, idx) => {
                    const markerPos = turn.marker ?? (turn.start + turn.end) / 2;
                    const pos = getPositionOnTrack(trackPoints, markerPos);
                    const screenPos = worldToScreen(pos.x, pos.y);
                    const isHovered = hoveredTurn?.name === turn.name;

                    return (
                        <g
                            key={`turn-${idx}`}
                            className={`corner-marker ${isHovered ? 'hovered' : ''}`}
                            onMouseEnter={() => setHoveredTurn(turn)}
                            onMouseLeave={() => setHoveredTurn(null)}
                            style={{ cursor: 'pointer' }}
                        >
                            <circle
                                cx={screenPos.x}
                                cy={screenPos.y}
                                r={isHovered ? 5 : 3}
                                fill={isHovered ? '#3b82f6' : '#475569'}
                            />
                            <text
                                x={screenPos.x}
                                y={screenPos.y - 6}
                                className="corner-label"
                                textAnchor="middle"
                                fill={isHovered ? '#fff' : '#94a3b8'}
                                fontSize={isHovered ? 9 : 7}
                                fontWeight={isHovered ? 'bold' : 'normal'}
                            >
                                {turn.name.length > 10 ? `T${idx + 1}` : turn.name}
                            </text>
                        </g>
                    );
                })}

                {/* Fallback corner markers if no track data */}
                {showCorners && !trackData && [0, 0.25, 0.5, 0.75].map((pct, idx) => {
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

            {/* Hovered turn info */}
            {hoveredTurn && (
                <div className="track-map__turn-info">
                    <strong>{hoveredTurn.name}</strong>
                    <span>({Math.round((hoveredTurn.marker ?? hoveredTurn.start) * 100)}%)</span>
                </div>
            )}

            {/* Legend */}
            <div className="track-map__legend">
                <span className="legend-item"><span className="dot gold"></span>Leader</span>
                <span className="legend-item"><span className="dot blue"></span>Top 3</span>
                <span className="legend-item"><span className="dot gray"></span>Pit</span>
                {trackData && (
                    <span className="legend-item track-count">
                        {trackData.turn.length} corners
                    </span>
                )}
            </div>
        </div>
    );
}

export default TrackMap;
