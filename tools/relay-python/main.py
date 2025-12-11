#!/usr/bin/env python3
"""
ControlBox Relay Agent - Main Entry Point
Connects iRacing to ControlBox Cloud for real-time race control

Usage:
    python main.py [--url CLOUD_URL]

Environment Variables:
    CONTROLBOX_CLOUD_URL - ControlBox Cloud WebSocket URL
    POLL_RATE_HZ - Telemetry polling rate (default: 10)
    LOG_LEVEL - Logging level (default: INFO)
"""
import argparse
import logging
import signal
import sys
import time
from typing import Optional

import config
from iracing_reader import IRacingReader
from controlbox_client import ControlBoxClient
from data_mapper import (
    map_session_metadata,
    map_telemetry_snapshot,
    map_race_event,
    map_incident
)

# ========================
# Logging Setup
# ========================

logging.basicConfig(
    level=getattr(logging, config.LOG_LEVEL),
    format='%(asctime)s | %(levelname)-8s | %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)


# ========================
# Main Relay Agent
# ========================

class RelayAgent:
    """
    Main relay agent that bridges iRacing and ControlBox Cloud
    """
    
    def __init__(self, cloud_url: str = None):
        self.ir_reader = IRacingReader()
        self.cloud_client = ControlBoxClient(cloud_url)
        self.running = False
        self.session_id: Optional[str] = None
        self.last_flag_state: str = 'green'
        self.discipline_category: str = 'road'
        
        # Stats
        self.telemetry_count = 0
        self.incident_count = 0
        self.start_time = 0
    
    def start(self):
        """Start the relay agent"""
        self.running = True
        self.start_time = time.time()
        
        print("╔════════════════════════════════════════════════════════════╗")
        print("║         ControlBox Relay Agent v1.0.0                      ║")
        print("║         Real iRacing → ControlBox Cloud Bridge             ║")
        print("╚════════════════════════════════════════════════════════════╝")
        print()
        
        # Connect to cloud
        if not self.cloud_client.connect():
            logger.error("Failed to connect to ControlBox Cloud. Exiting.")
            return
        
        # Main loop
        try:
            self._main_loop()
        except KeyboardInterrupt:
            logger.info("Shutdown requested...")
        finally:
            self.stop()
    
    def stop(self):
        """Stop the relay agent"""
        self.running = False
        self.ir_reader.disconnect()
        self.cloud_client.disconnect()
        
        # Print stats
        elapsed = time.time() - self.start_time
        print()
        print("═" * 50)
        print(f"Session Stats:")
        print(f"  Runtime: {elapsed:.1f}s")
        print(f"  Telemetry frames sent: {self.telemetry_count}")
        print(f"  Incidents detected: {self.incident_count}")
        print("═" * 50)
    
    def _main_loop(self):
        """Main polling loop"""
        logger.info("Waiting for iRacing...")
        
        session_sent = False
        
        while self.running:
            # Try to connect to iRacing
            if not self.ir_reader.is_connected():
                if self.ir_reader.connect():
                    session_sent = False  # Reset for new connection
                else:
                    # Not connected, wait and retry
                    self.cloud_client.wait(1.0)
                    continue
            
            # Freeze telemetry frame for consistent reads
            self.ir_reader.freeze_frame()
            
            try:
                # Send session metadata on first connect
                if not session_sent:
                    self._send_session_metadata()
                    session_sent = True
                
                # Check flag state changes
                self._check_flag_state()
                
                # Detect and report incidents
                self._check_incidents()
                
                # Send telemetry
                self._send_telemetry()
                
            finally:
                self.ir_reader.unfreeze_frame()
            
            # Wait for next poll interval
            self.cloud_client.wait(config.POLL_INTERVAL)
    
    def _send_session_metadata(self):
        """Send session metadata to cloud"""
        session = self.ir_reader.get_session_data()
        if not session:
            logger.warning("Could not read session data")
            return
        
        self.session_id = session.session_id
        metadata = map_session_metadata(session, config.RELAY_ID)
        self.discipline_category = metadata['category']
        
        logger.info(f"📋 Session: {session.track_name} [{session.session_type}]")
        logger.info(f"   Category: {self.discipline_category}")
        logger.info(f"   Multi-class: {session.is_multiclass}")
        
        self.cloud_client.send_session_metadata(metadata)
    
    def _check_flag_state(self):
        """Check for flag state changes and send race events"""
        flag_state = self.ir_reader.get_flag_state()
        
        if flag_state != self.last_flag_state:
            logger.info(f"🏁 Flag: {self.last_flag_state} → {flag_state}")
            
            event = map_race_event(
                self.session_id,
                flag_state,
                self.ir_reader.get_leader_lap(),
                self.ir_reader.get_session_time()
            )
            self.cloud_client.send_race_event(event)
            self.last_flag_state = flag_state
    
    def _check_incidents(self):
        """Check for and report incidents"""
        incidents = self.ir_reader.detect_incidents()
        
        for incident_data in incidents:
            logger.warning(f"⚠️ Incident detected: {incident_data['driver_names']}")
            
            incident = map_incident(
                self.session_id,
                incident_data,
                self.discipline_category
            )
            self.cloud_client.send_incident(incident)
            self.incident_count += 1
    
    def _send_telemetry(self):
        """Send telemetry snapshot"""
        cars = self.ir_reader.get_all_cars()
        
        if not cars:
            return
        
        telemetry = map_telemetry_snapshot(self.session_id, cars)
        self.cloud_client.send_telemetry(telemetry)
        self.telemetry_count += 1
        
        if config.LOG_TELEMETRY:
            logger.debug(f"📊 Telemetry: {len(cars)} cars")


# ========================
# Entry Point
# ========================

def main():
    parser = argparse.ArgumentParser(
        description='ControlBox Relay Agent - Bridge iRacing to ControlBox Cloud'
    )
    parser.add_argument(
        '--url',
        default=config.CLOUD_URL,
        help=f'ControlBox Cloud URL (default: {config.CLOUD_URL})'
    )
    parser.add_argument(
        '--rate',
        type=int,
        default=config.POLL_RATE_HZ,
        help=f'Telemetry poll rate in Hz (default: {config.POLL_RATE_HZ})'
    )
    parser.add_argument(
        '-v', '--verbose',
        action='store_true',
        help='Enable verbose logging'
    )
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    if args.rate:
        config.POLL_RATE_HZ = args.rate
        config.POLL_INTERVAL = 1.0 / args.rate
    
    # Create and start agent
    agent = RelayAgent(args.url)
    
    # Handle signals
    def signal_handler(sig, frame):
        logger.info("Received shutdown signal")
        agent.stop()
        sys.exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Start
    agent.start()


if __name__ == '__main__':
    main()
