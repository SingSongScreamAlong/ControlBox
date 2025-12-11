"""
ControlBox Relay Agent - Configuration
"""
import os

# ControlBox Cloud Connection
CLOUD_URL = os.getenv('CONTROLBOX_CLOUD_URL', 'https://coral-app-x988a.ondigitalocean.app')

# Relay Identification
RELAY_ID = os.getenv('RELAY_ID', 'relay-default')
RELAY_VERSION = '1.0.0'

# Polling Configuration
POLL_RATE_HZ = int(os.getenv('POLL_RATE_HZ', '10'))  # Telemetry updates per second
POLL_INTERVAL = 1.0 / POLL_RATE_HZ

# Incident Detection Thresholds
INCIDENT_THRESHOLD = int(os.getenv('INCIDENT_THRESHOLD', '1'))  # Min incident count change to report
POSITION_JUMP_THRESHOLD = float(os.getenv('POSITION_JUMP_THRESHOLD', '0.05'))  # 5% track position jump

# Logging
LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
LOG_TELEMETRY = os.getenv('LOG_TELEMETRY', 'false').lower() == 'true'

# Session Types
SESSION_TYPES = {
    'Practice': 'practice',
    'Lone Qualify': 'qualifying',
    'Open Qualify': 'qualifying',
    'Qualify': 'qualifying',
    'Race': 'race',
    'Warmup': 'warmup',
    'Time Trial': 'practice'
}

# Flag State Mapping (iRacing SessionFlags to ControlBox)
FLAG_STATES = {
    'green': 'green',
    'checkered': 'checkered',
    'white': 'white',
    'yellow': 'yellow',
    'yellowWaving': 'yellow',
    'caution': 'caution',
    'cautionWaving': 'caution',
    'red': 'red',
    'blue': 'green',  # Blue flag doesn't change race state
    'debris': 'green',
    'crossed': 'green',
    'black': 'green',
    'disqualify': 'green',
    'repair': 'green',
    'startHidden': 'green',
    'startReady': 'green',
    'startSet': 'green',
    'startGo': 'green',
    'oneLapToGreen': 'restart',
    'greenHeld': 'green',
    'randomWaving': 'localYellow',
    'furled': 'green'
}
