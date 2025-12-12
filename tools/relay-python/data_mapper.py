"""
ControlBox Relay Agent - Data Mapper
Maps iRacing data structures to ControlBox relay protocol
"""
import time
from typing import List, Dict, Any, Optional
from iracing_reader import SessionData, CarData
import config


def map_session_metadata(session: SessionData, relay_id: str) -> Dict[str, Any]:
    """
    Map iRacing session data to ControlBox SessionMetadataMessage
    """
    # Determine discipline category based on session/car info
    category = _infer_discipline_category(session)
    
    # Map session type
    session_type = config.SESSION_TYPES.get(session.session_type, 'practice')
    
    return {
        'type': 'session_metadata',
        'sessionId': session.session_id,
        'timestamp': int(time.time() * 1000),
        'trackName': session.track_name,
        'trackConfig': session.track_config if session.track_config else None,
        'category': category,
        'multiClass': session.is_multiclass,
        'cautionsEnabled': session.cautions_enabled,
        'driverSwap': category == 'endurance',
        'maxDrivers': session.max_drivers,
        'weather': {
            'ambientTemp': session.weather_temp,
            'trackTemp': session.track_temp,
            'precipitation': 0,
            'trackState': 'dry'
        },
        'leagueId': None,  # Can be set via config
        'rulebookOverrideId': None
    }


def map_telemetry_snapshot(session_id: str, cars: List[CarData]) -> Dict[str, Any]:
    """
    Map iRacing car telemetry to ControlBox TelemetrySnapshotMessage
    """
    car_snapshots = []
    
    for car in cars:
        car_snapshots.append({
            'carId': car.car_id,
            'driverId': car.driver_id,
            'speed': car.speed,
            'gear': car.gear,
            'pos': {'s': car.track_pct},
            'throttle': car.throttle,
            'brake': car.brake,
            'steering': _normalize_steering(car.steering),
            'rpm': car.rpm,
            'inPit': car.in_pit,
            'lap': car.lap,
            'position': car.position,
            'classPosition': car.class_position,
            # Track map coordinates (NEW)
            'lat': car.lat,
            'lon': car.lon,
            'alt': car.alt,
            'velocityX': car.velocity_x,
            'velocityY': car.velocity_y,
            'velocityZ': car.velocity_z,
            'yaw': car.yaw
        })
    
    return {
        'type': 'telemetry',
        'sessionId': session_id,
        'timestamp': int(time.time() * 1000),
        'cars': car_snapshots
    }


def map_race_event(
    session_id: str,
    flag_state: str,
    lap: int,
    time_remaining: float,
    session_phase: str = 'racing'
) -> Dict[str, Any]:
    """
    Map race state to ControlBox RaceEventMessage
    """
    return {
        'type': 'race_event',
        'sessionId': session_id,
        'timestamp': int(time.time() * 1000),
        'flagState': flag_state,
        'lap': lap,
        'timeRemaining': time_remaining,
        'sessionPhase': session_phase
    }


def map_incident(
    session_id: str,
    incident_data: Dict[str, Any],
    category: str = 'road'
) -> Dict[str, Any]:
    """
    Map incident detection to ControlBox IncidentMessage
    """
    # Infer incident type based on severity and context
    incident_delta = incident_data.get('incident_delta', 1)
    track_position = incident_data.get('track_position', 0)
    
    # iRacing incident points guide:
    # 1x = off-track or light wall tap
    # 2x = loss of control / spin  
    # 4x = contact with another car
    # We use delta + position to guess type
    if incident_delta >= 4:
        incident_type = 'contact'  # Car-to-car contact
    elif incident_delta >= 2:
        incident_type = 'loss_of_control'  # Spin or major off
    else:
        incident_type = 'off_track'  # 1x typically off-track
    
    # Get corner name from track percentage
    corner_num = _estimate_corner(track_position)
    corner_name = f"Turn {corner_num}"
    
    return {
        'type': incident_type,
        'sessionId': session_id,
        'timestamp': int(time.time() * 1000),
        'sessionTime': incident_data.get('sessionTime', 0),
        'lapNumber': incident_data.get('lap', 0),  # Use lapNumber for server
        'involvedCars': incident_data.get('involved_cars', []),
        'trackPosition': track_position,
        'cornerName': corner_name,
        'severity': _estimate_severity(incident_delta),
        'disciplineContext': category
    }


def map_driver_update(
    session_id: str,
    car: CarData,
    action: str = 'join'
) -> Dict[str, Any]:
    """
    Map driver information to ControlBox DriverUpdateMessage
    """
    return {
        'type': 'driver_update',
        'sessionId': session_id,
        'timestamp': int(time.time() * 1000),
        'action': action,
        'driverId': car.driver_id,
        'driverName': car.driver_name,
        'carNumber': car.car_number,
        'carName': car.car_name,
        'teamName': car.team_name,
        'irating': car.irating,
        'safetyRating': car.safety_rating
    }


# ========================
# Helper Functions
# ========================

def _infer_discipline_category(session: SessionData) -> str:
    """
    Infer racing discipline from track/session info
    """
    track_lower = session.track_name.lower()
    
    # Oval tracks
    oval_keywords = ['speedway', 'superspeedway', 'oval', 'motor speedway', 'daytona', 'talladega', 'bristol', 'martinsville']
    if any(kw in track_lower for kw in oval_keywords):
        return 'oval'
    
    # Dirt tracks
    dirt_keywords = ['dirt', 'clay', 'eldora', 'williams grove', 'knoxville']
    if any(kw in track_lower for kw in dirt_keywords):
        return 'dirt_oval'
    
    # Rally/Rallycross
    rally_keywords = ['rallycross', 'rx', 'hell']
    if any(kw in track_lower for kw in rally_keywords):
        return 'rallycross'
    
    # Default to road racing
    return 'road'


def _normalize_steering(steering_angle: float) -> float:
    """
    Normalize steering wheel angle to -1..1 range
    iRacing reports in radians, typical range is about -4 to 4
    """
    max_angle = 4.0  # Approximate max steering angle
    normalized = steering_angle / max_angle
    return max(-1.0, min(1.0, normalized))


def _estimate_corner(track_pct: float) -> int:
    """
    Estimate corner number from track position
    Assumes roughly 10-15 corners per track
    """
    return int(track_pct * 12) + 1


def _estimate_severity(incident_delta: int) -> str:
    """
    Estimate incident severity from iRacing incident count delta
    iRacing incident points:
    - 0x = clean
    - 1x = minor off-track or light contact
    - 2x = moderate contact
    - 4x = significant contact or loss of control
    """
    if incident_delta >= 4:
        return 'high'
    elif incident_delta >= 2:
        return 'med'
    else:
        return 'low'
