"""
ControlBox Relay Agent - Cloud Client
Socket.IO client for connecting to ControlBox Cloud
"""
import logging
import time
from typing import Callable, Optional, Dict, Any
import socketio

import config

logger = logging.getLogger(__name__)


class ControlBoxClient:
    """
    Socket.IO client for communicating with ControlBox Cloud
    """
    
    def __init__(self, url: str = None):
        self.url = url or config.CLOUD_URL
        self.sio = socketio.Client(
            reconnection=True,
            reconnection_attempts=10,
            reconnection_delay=1,
            reconnection_delay_max=30,
            logger=False,
            engineio_logger=False
        )
        self.connected = False
        self.session_id: Optional[str] = None
        
        # Set up event handlers
        self._setup_handlers()
    
    def _setup_handlers(self):
        """Set up Socket.IO event handlers"""
        
        @self.sio.event
        def connect():
            self.connected = True
            logger.info(f"✅ Connected to ControlBox Cloud at {self.url}")
        
        @self.sio.event
        def disconnect():
            self.connected = False
            logger.warning("⚠️ Disconnected from ControlBox Cloud")
        
        @self.sio.event
        def connect_error(error):
            logger.error(f"❌ Connection error: {error}")
        
        @self.sio.on('recommendation')
        def on_recommendation(data):
            logger.info(f"📥 RECOMMENDATION: {data.get('action')} - {data.get('details')}")
            logger.info(f"   Confidence: {data.get('confidence', 0) * 100:.0f}%")
        
        @self.sio.on('profile_loaded')
        def on_profile_loaded(data):
            logger.info(f"📖 Profile loaded: {data.get('profileName')} [{data.get('category')}]")
        
        @self.sio.on('ack')
        def on_ack(data):
            logger.debug(f"   ✓ {data.get('originalType')} acknowledged")
        
        @self.sio.on('steward_command')
        def on_steward_command(data):
            logger.info(f"⚡ STEWARD COMMAND: {data.get('command')}")
            logger.info(f"   Reason: {data.get('reason')}")
            # TODO: Implement command execution in iRacing
    
    def connect(self) -> bool:
        """
        Connect to ControlBox Cloud
        Returns True if connected successfully
        """
        if self.connected:
            return True
        
        try:
            logger.info(f"🔌 Connecting to ControlBox Cloud at {self.url}...")
            self.sio.connect(
                self.url,
                transports=['websocket'],
                wait=True,
                wait_timeout=10
            )
            return self.connected
        except Exception as e:
            logger.error(f"Failed to connect: {e}")
            return False
    
    def disconnect(self):
        """Disconnect from ControlBox Cloud"""
        if self.sio.connected:
            self.sio.disconnect()
        self.connected = False
        logger.info("🔌 Disconnected from ControlBox Cloud")
    
    def is_connected(self) -> bool:
        """Check if connected"""
        return self.connected and self.sio.connected
    
    def emit(self, event: str, data: Dict[str, Any]):
        """
        Emit an event to ControlBox Cloud
        """
        if not self.is_connected():
            logger.warning(f"Cannot emit {event}: not connected")
            return False
        
        try:
            self.sio.emit(event, data)
            logger.debug(f"📤 Sent {event}")
            return True
        except Exception as e:
            logger.error(f"Failed to emit {event}: {e}")
            return False
    
    def send_session_metadata(self, metadata: Dict[str, Any]):
        """Send session metadata message"""
        self.session_id = metadata.get('sessionId')
        return self.emit('session_metadata', metadata)
    
    def send_telemetry(self, telemetry: Dict[str, Any]):
        """Send telemetry snapshot"""
        return self.emit('telemetry', telemetry)
    
    def send_race_event(self, event: Dict[str, Any]):
        """Send race event (flag change, etc.)"""
        return self.emit('race_event', event)
    
    def send_incident(self, incident: Dict[str, Any]):
        """Send incident report"""
        return self.emit('incident', incident)
    
    def send_driver_update(self, update: Dict[str, Any]):
        """Send driver join/leave update"""
        return self.emit('driver_update', update)
    
    def wait(self, seconds: float = 0.1):
        """
        Wait while processing events
        Use this in the main loop to allow receiving events
        """
        self.sio.sleep(seconds)
