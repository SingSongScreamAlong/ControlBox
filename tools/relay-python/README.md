# ControlBox Relay Agent (Python)

Real iRacing telemetry relay that bridges iRacing simulator to ControlBox Cloud.

## ⚠️ Requirements

- **Windows PC** with iRacing installed
- **Python 3.7+**
- iRacing must be running (live session or replay)

## Installation

```powershell
# Navigate to relay directory
cd tools/relay-python

# Install dependencies
pip install -r requirements.txt
```

## Usage

### Basic Usage
```powershell
python main.py
```
This connects to the default ControlBox Cloud instance.

### Custom Cloud URL
```powershell
python main.py --url https://your-controlbox-instance.com
```

### Verbose Logging
```powershell
python main.py -v
```

### Custom Poll Rate
```powershell
python main.py --rate 20  # 20 Hz telemetry
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CONTROLBOX_CLOUD_URL` | `https://coral-app-x988a.ondigitalocean.app` | Cloud WebSocket URL |
| `POLL_RATE_HZ` | `10` | Telemetry updates per second |
| `LOG_LEVEL` | `INFO` | Logging verbosity |
| `LOG_TELEMETRY` | `false` | Log each telemetry frame |

## What It Does

1. **Connects to iRacing** via pyirsdk (Windows shared memory)
2. **Reads live telemetry** at configurable rate (default 10 Hz):
   - Car positions, speeds, gaps
   - Flag states
   - Lap times
3. **Detects incidents** by monitoring iRacing's incident counters
4. **Sends data to ControlBox Cloud** via Socket.IO WebSocket
5. **Receives recommendations** from the cloud (logged to console)

## Troubleshooting

### "pyirsdk not installed"
```powershell
pip install pyirsdk
```

### "Failed to connect to iRacing"
- Ensure iRacing is running
- Make sure you're in a session (not lobby)
- Try starting a replay if no live session available

### "Connection refused to cloud"
- Check your internet connection
- Verify the cloud URL is correct
- Check if ControlBox Cloud is deployed and running

## Development

The relay is structured as:
- `main.py` - Entry point and main loop
- `iracing_reader.py` - pyirsdk wrapper
- `data_mapper.py` - iRacing → ControlBox protocol translation
- `controlbox_client.py` - Socket.IO cloud client
- `config.py` - Configuration and constants
