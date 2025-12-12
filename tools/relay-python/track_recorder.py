"""
Track Shape Recorder
Records actual track layouts from iRacing coordinate data.
Creates extended track shape files compatible with lovely-track-data.
"""

import os
import json
import math
import logging
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, asdict
from pathlib import Path

logger = logging.getLogger(__name__)

@dataclass
class TrackPoint:
    """A single point on the track centerline"""
    x: float
    y: float
    distPct: float
    alt: Optional[float] = None


@dataclass
class TrackBounds:
    """Bounding box for track coordinates"""
    xMin: float
    xMax: float
    yMin: float
    yMax: float


class TrackRecorder:
    """
    Records track shape from iRacing coordinate data.
    
    Usage:
        recorder = TrackRecorder("tracks/")
        
        # Check if shape exists
        if not recorder.has_shape(track_id):
            recorder.start_recording(track_id, track_name)
            
            # During lap, add points
            recorder.add_point(lat, lon, alt, distPct)
            
            # When lap completes
            if recorder.is_lap_complete():
                recorder.finish_recording()
    """
    
    POINTS_PER_LAP = 200  # Target number of points
    MIN_POINTS = 50       # Minimum points for valid shape
    
    def __init__(self, shapes_dir: str = "track_shapes"):
        self.shapes_dir = Path(shapes_dir)
        self.shapes_dir.mkdir(parents=True, exist_ok=True)
        
        # Recording state
        self.is_recording = False
        self.current_track_id: Optional[str] = None
        self.current_track_name: Optional[str] = None
        self.points: List[TrackPoint] = []
        self.last_dist_pct: float = 0
        self.sample_interval: float = 1.0 / self.POINTS_PER_LAP
        self.next_sample_pct: float = 0
        
        # Reference point for coordinate conversion
        self.ref_lat: Optional[float] = None
        self.ref_lon: Optional[float] = None
    
    def has_shape(self, track_id: str) -> bool:
        """Check if a shape file exists for this track"""
        shape_file = self._get_shape_path(track_id)
        return shape_file.exists()
    
    def load_shape(self, track_id: str) -> Optional[Dict[str, Any]]:
        """Load existing shape file"""
        shape_file = self._get_shape_path(track_id)
        if not shape_file.exists():
            return None
        
        try:
            with open(shape_file, 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load shape for {track_id}: {e}")
            return None
    
    def start_recording(self, track_id: str, track_name: str, track_config: str = ""):
        """Start recording a new track shape"""
        if self.is_recording:
            logger.warning("Already recording - stopping previous recording")
            self._reset_recording()
        
        self.is_recording = True
        self.current_track_id = self._normalize_track_id(track_id, track_config)
        self.current_track_name = track_name
        self.points = []
        self.last_dist_pct = 0
        self.next_sample_pct = 0
        self.ref_lat = None
        self.ref_lon = None
        
        logger.info(f"🎬 Started recording track shape: {self.current_track_id}")
    
    def add_point(self, lat: float, lon: float, alt: float, dist_pct: float) -> bool:
        """
        Add a point to the recording.
        
        Args:
            lat: Latitude (or X position from iRacing)
            lon: Longitude (or Z position from iRacing, inverted)
            alt: Altitude (Y position)
            dist_pct: Track distance percentage (0.0 to 1.0)
            
        Returns:
            True if point was added, False if skipped
        """
        if not self.is_recording:
            return False
        
        # Set reference point on first sample
        if self.ref_lat is None:
            self.ref_lat = lat
            self.ref_lon = lon
        
        # Sample at regular intervals around the track
        if dist_pct >= self.next_sample_pct or len(self.points) == 0:
            # Convert to local XY coordinates (meters from reference)
            x, y = self._latlon_to_xy(lat, lon)
            
            point = TrackPoint(
                x=round(x, 2),
                y=round(y, 2),
                distPct=round(dist_pct, 4),
                alt=round(alt, 2) if alt else None
            )
            self.points.append(point)
            
            self.next_sample_pct = dist_pct + self.sample_interval
            self.last_dist_pct = dist_pct
            return True
        
        self.last_dist_pct = dist_pct
        return False
    
    def is_lap_complete(self) -> bool:
        """Check if we've completed a full lap"""
        if not self.is_recording:
            return False
        
        # Lap is complete when distPct wraps from high to low
        return len(self.points) >= self.MIN_POINTS and self.last_dist_pct < 0.05 and len(self.points) > 100
    
    def finish_recording(self) -> Optional[str]:
        """
        Finish recording and save the track shape.
        
        Returns:
            Path to saved file, or None if failed
        """
        if not self.is_recording or not self.current_track_id:
            logger.warning("Not recording - nothing to finish")
            return None
        
        if len(self.points) < self.MIN_POINTS:
            logger.warning(f"Not enough points ({len(self.points)}) - need at least {self.MIN_POINTS}")
            self._reset_recording()
            return None
        
        try:
            # Process points
            centerline = self._process_centerline()
            bounds = self._calculate_bounds(centerline)
            
            # Build shape data
            shape_data = {
                "name": self.current_track_name,
                "trackId": self.current_track_id,
                "centerline": [asdict(p) for p in centerline],
                "bounds": asdict(bounds),
                "pointCount": len(centerline),
                "capturedBy": "ControlBox Relay"
            }
            
            # Save to file
            shape_file = self._get_shape_path(self.current_track_id)
            with open(shape_file, 'w') as f:
                json.dump(shape_data, f, indent=2)
            
            logger.info(f"✅ Saved track shape: {shape_file} ({len(centerline)} points)")
            
            self._reset_recording()
            return str(shape_file)
            
        except Exception as e:
            logger.error(f"Failed to save track shape: {e}")
            self._reset_recording()
            return None
    
    def cancel_recording(self):
        """Cancel current recording without saving"""
        if self.is_recording:
            logger.info(f"❌ Cancelled recording for {self.current_track_id}")
        self._reset_recording()
    
    def get_recording_status(self) -> Dict[str, Any]:
        """Get current recording status"""
        return {
            "isRecording": self.is_recording,
            "trackId": self.current_track_id,
            "pointCount": len(self.points),
            "lastDistPct": self.last_dist_pct,
            "progress": f"{int(self.last_dist_pct * 100)}%"
        }
    
    # --- Private Methods ---
    
    def _get_shape_path(self, track_id: str) -> Path:
        """Get the path for a track shape file"""
        return self.shapes_dir / f"{track_id}.shape.json"
    
    def _normalize_track_id(self, track_id: str, track_config: str = "") -> str:
        """Normalize track ID to a consistent format"""
        normalized = track_id.lower().strip()
        normalized = normalized.replace(" ", "-")
        normalized = normalized.replace("_", "-")
        
        if track_config:
            config_norm = track_config.lower().strip().replace(" ", "-")
            normalized = f"{normalized}-{config_norm}"
        
        return normalized
    
    def _latlon_to_xy(self, lat: float, lon: float) -> Tuple[float, float]:
        """
        Convert lat/lon to local XY coordinates.
        
        Note: iRacing actually provides world coordinates in meters,
        not true lat/lon. We just need to offset from reference.
        """
        if self.ref_lat is None or self.ref_lon is None:
            return 0, 0
        
        # Simple offset from reference point
        x = lat - self.ref_lat
        y = lon - self.ref_lon
        
        return x, y
    
    def _process_centerline(self) -> List[TrackPoint]:
        """Process raw points into a clean centerline"""
        if not self.points:
            return []
        
        # Sort by distPct to ensure proper order
        sorted_points = sorted(self.points, key=lambda p: p.distPct)
        
        # Remove duplicates (same distPct)
        unique_points = []
        last_pct = -1
        for p in sorted_points:
            if p.distPct != last_pct:
                unique_points.append(p)
                last_pct = p.distPct
        
        # Apply simple smoothing (moving average)
        smoothed = self._smooth_points(unique_points, window=3)
        
        return smoothed
    
    def _smooth_points(self, points: List[TrackPoint], window: int = 3) -> List[TrackPoint]:
        """Apply moving average smoothing to points"""
        if len(points) < window:
            return points
        
        smoothed = []
        half_window = window // 2
        
        for i, point in enumerate(points):
            # Gather neighbors (wrap around for closed track)
            x_sum = 0
            y_sum = 0
            count = 0
            
            for j in range(-half_window, half_window + 1):
                idx = (i + j) % len(points)
                x_sum += points[idx].x
                y_sum += points[idx].y
                count += 1
            
            smoothed.append(TrackPoint(
                x=round(x_sum / count, 2),
                y=round(y_sum / count, 2),
                distPct=point.distPct,
                alt=point.alt
            ))
        
        return smoothed
    
    def _calculate_bounds(self, points: List[TrackPoint]) -> TrackBounds:
        """Calculate bounding box for points"""
        if not points:
            return TrackBounds(0, 100, 0, 100)
        
        xs = [p.x for p in points]
        ys = [p.y for p in points]
        
        return TrackBounds(
            xMin=round(min(xs), 2),
            xMax=round(max(xs), 2),
            yMin=round(min(ys), 2),
            yMax=round(max(ys), 2)
        )
    
    def _reset_recording(self):
        """Reset all recording state"""
        self.is_recording = False
        self.current_track_id = None
        self.current_track_name = None
        self.points = []
        self.last_dist_pct = 0
        self.next_sample_pct = 0
        self.ref_lat = None
        self.ref_lon = None
