"""
ControlBox Relay Agent - iRacing SDK Reader
Wraps pyirsdk to provide clean access to iRacing data
"""
import logging
from typing import Optional, Dict, List, Any
from dataclasses import dataclass

try:
    import irsdk
except ImportError:
    print("ERROR: pyirsdk not installed. Run: pip install pyirsdk")
    print("NOTE: This only works on Windows with iRacing installed.")
    raise

logger = logging.getLogger(__name__)


@dataclass
class CarData:
    """Telemetry data for a single car"""
    car_id: int
    driver_id: str
    driver_name: str
    car_number: str
    car_name: str
    team_name: str
    irating: int
    safety_rating: float
    class_id: int
    class_name: str
    speed: float
    gear: int
    track_pct: float
    throttle: float
    brake: float
    steering: float
    rpm: float
    in_pit: bool
    lap: int
    position: int
    class_position: int
    incident_count: int
    last_lap_time: float
    best_lap_time: float
    # Track map coordinates (NEW)
    lat: float = 0.0           # Latitude (player car only)
    lon: float = 0.0           # Longitude (player car only)
    alt: float = 0.0           # Altitude (player car only)
    velocity_x: float = 0.0    # X velocity (m/s)
    velocity_y: float = 0.0    # Y velocity (m/s)
    velocity_z: float = 0.0    # Z velocity (m/s)
    yaw: float = 0.0           # Heading angle (radians)


@dataclass
class SessionData:
    """Session metadata"""
    session_id: str
    track_name: str
    track_config: str
    track_length: float
    session_type: str
    session_name: str
    weather_temp: float
    track_temp: float
    is_multiclass: bool
    max_drivers: int
    cautions_enabled: bool


class IRacingReader:
    """
    Reads data from iRacing via pyirsdk
    """
    
    def __init__(self):
        self.ir = irsdk.IRSDK()
        self.connected = False
        self._last_session_info = None
        self._last_incident_counts: Dict[int, int] = {}
        self._car_info_cache: Dict[int, Dict] = {}
    
    def connect(self) -> bool:
        """
        Attempt to connect to iRacing
        Returns True if connected successfully
        """
        if self.connected and self.ir.is_connected:
            return True
        
        try:
            if self.ir.startup():
                self.connected = True
                logger.info("✅ Connected to iRacing")
                self._update_car_info_cache()
                return True
            else:
                self.connected = False
                return False
        except Exception as e:
            logger.error(f"Failed to connect to iRacing: {e}")
            self.connected = False
            return False
    
    def disconnect(self):
        """Disconnect from iRacing"""
        if self.ir:
            self.ir.shutdown()
        self.connected = False
        logger.info("Disconnected from iRacing")
    
    def is_connected(self) -> bool:
        """Check if connected and session is active"""
        if not self.connected:
            return False
        if not self.ir.is_connected:
            self.connected = False
            return False
        return True
    
    def _update_car_info_cache(self):
        """Update cached driver/car info from session info"""
        try:
            drivers = self.ir['DriverInfo']['Drivers']
            self._car_info_cache = {d['CarIdx']: d for d in drivers}
        except (KeyError, TypeError):
            pass
    
    def get_session_data(self) -> Optional[SessionData]:
        """Get current session metadata"""
        if not self.is_connected():
            return None
        
        try:
            weekend_info = self.ir['WeekendInfo']
            session_info = self.ir['SessionInfo']
            
            # Get current session
            session_num = self.ir['SessionNum']
            sessions = session_info.get('Sessions', [])
            current_session = sessions[session_num] if session_num < len(sessions) else {}
            
            # Determine if multiclass
            driver_info = self.ir['DriverInfo']
            class_ids = set()
            for driver in driver_info.get('Drivers', []):
                class_ids.add(driver.get('CarClassID', 0))
            is_multiclass = len(class_ids) > 1
            
            return SessionData(
                session_id=f"{weekend_info.get('SubSessionID', 0)}",
                track_name=weekend_info.get('TrackDisplayName', 'Unknown Track'),
                track_config=weekend_info.get('TrackConfigName', ''),
                track_length=float(weekend_info.get('TrackLength', '0 km').split()[0]),
                session_type=current_session.get('SessionType', 'Practice'),
                session_name=current_session.get('SessionName', 'Session'),
                weather_temp=float(weekend_info.get('TrackAirTemp', '20 C').split()[0]),
                track_temp=float(weekend_info.get('TrackSurfaceTemp', '30 C').split()[0]),
                is_multiclass=is_multiclass,
                max_drivers=len(driver_info.get('Drivers', [])),
                cautions_enabled=weekend_info.get('WeekendOptions', {}).get('HasOpenRegistration', False)
            )
        except Exception as e:
            logger.error(f"Error getting session data: {e}")
            return None
    
    def get_all_cars(self) -> List[CarData]:
        """Get telemetry for all cars in session"""
        if not self.is_connected():
            return []
        
        cars = []
        try:
            # Get indexed arrays from telemetry
            positions = self.ir['CarIdxPosition'] or []
            class_positions = self.ir['CarIdxClassPosition'] or []
            laps = self.ir['CarIdxLap'] or []
            lap_pcts = self.ir['CarIdxLapDistPct'] or []
            on_pit = self.ir['CarIdxOnPitRoad'] or []
            last_lap_times = self.ir['CarIdxLastLapTime'] or []
            best_lap_times = self.ir['CarIdxBestLapTime'] or []
            
            # Speed, gear, etc. are only available for player car in standard telemetry
            # For other cars, we estimate from position changes
            player_car_idx = self.ir['PlayerCarIdx']
            player_speed = self.ir['Speed'] or 0
            player_gear = self.ir['Gear'] or 0
            player_throttle = self.ir['Throttle'] or 0
            player_brake = self.ir['Brake'] or 0
            player_steering = self.ir['SteeringWheelAngle'] or 0
            player_rpm = self.ir['RPM'] or 0
            
            # Coordinate data (player car only for track map)
            player_lat = self.ir['Lat'] or 0
            player_lon = self.ir['Lon'] or 0
            player_alt = self.ir['Alt'] or 0
            player_vel_x = self.ir['VelocityX'] or 0
            player_vel_y = self.ir['VelocityY'] or 0
            player_vel_z = self.ir['VelocityZ'] or 0
            player_yaw = self.ir['Yaw'] or 0
            
            for car_idx, driver_info in self._car_info_cache.items():
                if car_idx >= len(positions) or positions[car_idx] <= 0:
                    continue  # Skip cars not in session
                
                # Get incident count for this car
                incident_count = 0
                try:
                    incident_count = self.ir['CarIdxSessionFlags'][car_idx] if self.ir['CarIdxSessionFlags'] else 0
                except (IndexError, TypeError):
                    pass
                
                # Populate coordinate data for player car only
                is_player = car_idx == player_car_idx
                
                car_data = CarData(
                    car_id=car_idx,
                    driver_id=str(driver_info.get('UserID', car_idx)),
                    driver_name=driver_info.get('UserName', f'Driver {car_idx}'),
                    car_number=driver_info.get('CarNumber', str(car_idx)),
                    car_name=driver_info.get('CarScreenName', 'Unknown Car'),
                    team_name=driver_info.get('TeamName', ''),
                    irating=int(driver_info.get('IRating', 0)),
                    safety_rating=float(driver_info.get('LicString', '0.00').replace('A', '').replace('B', '').replace('C', '').replace('D', '').replace('R', '').replace(' ', '') or 0),
                    class_id=driver_info.get('CarClassID', 0),
                    class_name=driver_info.get('CarClassShortName', ''),
                    speed=player_speed if is_player else 0,
                    gear=player_gear if is_player else 0,
                    track_pct=lap_pcts[car_idx] if car_idx < len(lap_pcts) else 0,
                    throttle=player_throttle if is_player else 0,
                    brake=player_brake if is_player else 0,
                    steering=player_steering if is_player else 0,
                    rpm=player_rpm if is_player else 0,
                    in_pit=bool(on_pit[car_idx]) if car_idx < len(on_pit) else False,
                    lap=laps[car_idx] if car_idx < len(laps) else 0,
                    position=positions[car_idx] if car_idx < len(positions) else 0,
                    class_position=class_positions[car_idx] if car_idx < len(class_positions) else 0,
                    incident_count=incident_count,
                    last_lap_time=last_lap_times[car_idx] if car_idx < len(last_lap_times) else 0,
                    best_lap_time=best_lap_times[car_idx] if car_idx < len(best_lap_times) else 0,
                    # Coordinate fields (player car only)
                    lat=player_lat if is_player else 0,
                    lon=player_lon if is_player else 0,
                    alt=player_alt if is_player else 0,
                    velocity_x=player_vel_x if is_player else 0,
                    velocity_y=player_vel_y if is_player else 0,
                    velocity_z=player_vel_z if is_player else 0,
                    yaw=player_yaw if is_player else 0
                )
                cars.append(car_data)
            
        except Exception as e:
            logger.error(f"Error getting car data: {e}")
        
        return cars
    
    def get_flag_state(self) -> str:
        """Get current flag state"""
        if not self.is_connected():
            return 'green'
        
        try:
            flags = self.ir['SessionFlags']
            if flags is None:
                return 'green'
            
            # Check flags in priority order
            if flags & irsdk.Flags.checkered:
                return 'checkered'
            if flags & irsdk.Flags.white:
                return 'white'
            if flags & irsdk.Flags.red:
                return 'red'
            if flags & irsdk.Flags.caution or flags & irsdk.Flags.caution_waving:
                return 'caution'
            if flags & irsdk.Flags.yellow or flags & irsdk.Flags.yellow_waving:
                return 'yellow'
            
            return 'green'
        except Exception as e:
            logger.error(f"Error getting flag state: {e}")
            return 'green'
    
    def get_session_time(self) -> float:
        """Get session time remaining (seconds)"""
        if not self.is_connected():
            return 0
        try:
            return self.ir['SessionTimeRemain'] or 0
        except:
            return 0
    
    def get_leader_lap(self) -> int:
        """Get current lap of race leader"""
        if not self.is_connected():
            return 0
        try:
            laps = self.ir['CarIdxLap'] or []
            return max(laps) if laps else 0
        except:
            return 0
    
    def detect_incidents(self) -> List[Dict[str, Any]]:
        """
        Detect new incidents by monitoring incident count changes
        Returns list of incident events
        """
        incidents = []
        if not self.is_connected():
            return incidents
        
        try:
            cars = self.get_all_cars()
            for car in cars:
                prev_count = self._last_incident_counts.get(car.car_id, 0)
                if car.incident_count > prev_count:
                    # Incident detected!
                    incidents.append({
                        'cars': [car.car_id],
                        'car_names': [car.car_name],
                        'driver_names': [car.driver_name],
                        'lap': car.lap,
                        'track_position': car.track_pct,
                        'severity': 'med',  # Default severity
                        'incident_delta': car.incident_count - prev_count
                    })
                self._last_incident_counts[car.car_id] = car.incident_count
        except Exception as e:
            logger.error(f"Error detecting incidents: {e}")
        
        return incidents
    
    def freeze_frame(self):
        """Freeze telemetry data for consistent reads"""
        if self.is_connected():
            self.ir.freeze_var_buffer_latest()
    
    def unfreeze_frame(self):
        """Unfreeze telemetry data"""
        if self.is_connected():
            self.ir.unfreeze_var_buffer_latest()
