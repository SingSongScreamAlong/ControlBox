// =====================================================================
// Track Map Component
// Real-time visualization of car positions on track
// =====================================================================

import { useMemo } from 'react';
import { useSessionStore } from '../../stores/session.store';
import './TrackMap.css';

// Pre-defined track SVG paths for common tracks
// These are simplified representations - real tracks would use actual GPS data
const TRACK_PATHS: Record<string, { path: string; length: number; corners: { at: number; name: string }[] }> = {
    // Oval tracks - simple ellipse
    'daytona': {
        path: 'M 200,50 C 350,50 350,200 200,200 C 50,200 50,50 200,50 Z',
        length: 4000,
        corners: [
            { at: 0.00, name: 'Start/Finish' },
            { at: 0.25, name: 'Turn 1' },
            { at: 0.50, name: 'Backstretch' },
            { at: 0.75, name: 'Turn 3' }
        ]
    },
    'talladega': {
        path: 'M 200,30 C 380,30 380,220 200,220 C 20,220 20,30 200,30 Z',
        length: 4280,
        corners: [
            { at: 0.00, name: 'Start/Finish' },
            { at: 0.25, name: 'Turn 1' },
            { at: 0.50, name: 'Backstretch' },
            { at: 0.75, name: 'Turn 3' }
        ]
    },
    // Road courses - more complex paths
    'spa': {
        path: 'M 50,200 L 100,180 L 180,120 L 200,80 L 150,50 L 100,60 L 80,100 L 120,140 L 200,130 L 280,100 L 350,80 L 370,120 L 350,180 L 280,200 L 200,220 L 100,210 Z',
        length: 7004,
        corners: [
            { at: 0.00, name: 'La Source' },
            { at: 0.15, name: 'Eau Rouge' },
            { at: 0.25, name: 'Raidillon' },
            { at: 0.40, name: 'Les Combes' },
            { at: 0.55, name: 'Stavelot' },
            { at: 0.70, name: 'Blanchimont' },
            { at: 0.85, name: 'Bus Stop' }
        ]
    },
    'nurburgring': {
        path: 'M 60,180 L 120,150 L 180,120 L 220,80 L 280,60 L 340,80 L 360,140 L 340,200 L 280,220 L 200,210 L 120,200 Z',
        length: 5148,
        corners: [
            { at: 0.00, name: 'Turn 1' },
            { at: 0.20, name: 'Mercedes Arena' },
            { at: 0.40, name: 'Veedol-Schikane' },
            { at: 0.60, name: 'Coca-Cola Kurve' },
            { at: 0.80, name: 'Schumacher-S' }
        ]
    },
    // Default generic track
    'default': {
        path: 'M 100,200 L 150,100 L 250,80 L 350,100 L 350,180 L 280,200 L 200,180 L 150,200 Z',
        length: 3500,
        corners: [
            { at: 0.00, name: 'Start' },
            { at: 0.33, name: 'T1' },
            { at: 0.66, name: 'T2' }
        ]
    }
};

interface TrackMapProps {
    /** Show corner markers */
    showCorners?: boolean;
    /** Show sector zones */
    showSectors?: boolean;
    /** Highlight incident zones */
    incidentZones?: { lapDistPct: number; severity: 'light' | 'medium' | 'heavy' }[];
    /** Show flag status on map */
    showFlags?: boolean;
    /** Custom width */
    width?: number;
    /** Custom height */
    height?: number;
}

export function TrackMap({
    showCorners = true,
    showSectors: _showSectors = true,
    incidentZones = [],
    showFlags: _showFlags = true,
    width = 400,
    height = 250
}: TrackMapProps) {
    const { currentSession, timing } = useSessionStore();

    // Get track path based on track name
    const trackConfig = useMemo(() => {
        if (!currentSession?.trackName) return TRACK_PATHS.default;

        const trackKey = currentSession.trackName.toLowerCase().replace(/\s+/g, '');
        for (const [key, config] of Object.entries(TRACK_PATHS)) {
            if (trackKey.includes(key)) return config;
        }
        return TRACK_PATHS.default;
    }, [currentSession?.trackName]);

    // Calculate car positions along the track path
    const carPositions = useMemo(() => {
        return timing.map((entry, idx) => {
            // Use lap progress if available, otherwise estimate from position
            const progress = ((entry as any).lapProgress ?? (entry.lapsCompleted % 1)) || (idx * 0.05);

            // Get position along path (0.0 to 1.0)
            const pos = progress % 1;

            // Calculate x,y position on SVG path
            // For simplicity, we'll use the path approximation
            const bounds = { x1: 50, y1: 30, x2: 370, y2: 220 };
            const angle = pos * Math.PI * 2;
            const x = bounds.x1 + ((bounds.x2 - bounds.x1) / 2) + Math.cos(angle - Math.PI / 2) * ((bounds.x2 - bounds.x1) / 2 - 20);
            const y = bounds.y1 + ((bounds.y2 - bounds.y1) / 2) + Math.sin(angle - Math.PI / 2) * ((bounds.y2 - bounds.y1) / 2 - 20);

            return {
                ...entry,
                x,
                y,
                progress: pos,
                isLeader: idx === 0,
                inPit: entry.inPit
            };
        });
    }, [timing]);

    // Determine helmet colors by position
    const getCarColor = (position: number, inPit: boolean) => {
        if (inPit) return '#6b7280'; // Gray for pit
        if (position === 1) return '#fbbf24'; // Gold for leader
        if (position <= 3) return '#3b82f6'; // Blue for podium
        return '#ffffff'; // White for others
    };

    return (
        <div className="track-map" style={{ width, height }}>
            <div className="track-map__header">
                <h3>Track Map</h3>
                <span className="track-map__name">{currentSession?.trackName || 'Unknown Track'}</span>
            </div>

            <svg viewBox="0 0 400 250" className="track-map__svg">
                {/* Track surface background */}
                <path
                    d={trackConfig.path}
                    className="track-surface"
                    strokeWidth="16"
                    fill="none"
                />

                {/* Track line (white dashed center) */}
                <path
                    d={trackConfig.path}
                    className="track-line"
                    strokeWidth="2"
                    strokeDasharray="4,4"
                    fill="none"
                />

                {/* Incident zones */}
                {incidentZones.map((zone, idx) => {
                    const angle = zone.lapDistPct * Math.PI * 2;
                    const x = 200 + Math.cos(angle - Math.PI / 2) * 120;
                    const y = 125 + Math.sin(angle - Math.PI / 2) * 75;
                    const color = zone.severity === 'heavy' ? '#ef4444' :
                        zone.severity === 'medium' ? '#f97316' : '#fbbf24';
                    return (
                        <circle
                            key={idx}
                            cx={x}
                            cy={y}
                            r="15"
                            fill={color}
                            opacity="0.3"
                            className="incident-zone pulse"
                        />
                    );
                })}

                {/* Corner markers */}
                {showCorners && trackConfig.corners.map((corner, idx) => {
                    const angle = corner.at * Math.PI * 2;
                    const x = 200 + Math.cos(angle - Math.PI / 2) * 140;
                    const y = 125 + Math.sin(angle - Math.PI / 2) * 90;
                    return (
                        <g key={idx} className="corner-marker">
                            <circle cx={x} cy={y} r="4" fill="#475569" />
                            <text
                                x={x}
                                y={y - 8}
                                className="corner-label"
                                textAnchor="middle"
                            >
                                {corner.name}
                            </text>
                        </g>
                    );
                })}

                {/* Car positions */}
                {carPositions.map((car, idx) => (
                    <g key={car.driverId} className="car-marker">
                        {/* Car dot */}
                        <circle
                            cx={car.x}
                            cy={car.y}
                            r={car.isLeader ? 6 : 4}
                            fill={getCarColor(idx + 1, car.inPit)}
                            stroke="#000"
                            strokeWidth="1"
                        />
                        {/* Car number (for top 3 only) */}
                        {idx < 3 && (
                            <text
                                x={car.x}
                                y={car.y + 12}
                                className="car-number"
                                textAnchor="middle"
                            >
                                #{car.carNumber}
                            </text>
                        )}
                    </g>
                ))}

                {/* Start/Finish line */}
                <line
                    x1="100"
                    y1="193"
                    x2="100"
                    y2="207"
                    stroke="#fff"
                    strokeWidth="3"
                />
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
