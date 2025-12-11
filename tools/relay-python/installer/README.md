# ControlBox Relay Agent - Installer Build Guide

## Prerequisites

1. **Windows PC** (installer must be built on Windows)
2. **Python 3.7+** with pip
3. **NSIS** - [Download from nsis.sourceforge.io](https://nsis.sourceforge.io/Download)

## Quick Build

### Step 1: Build Executable
```powershell
cd tools/relay-python
.\build.bat
```

This creates `dist/ControlBox-Relay.exe` (~50MB standalone executable)

### Step 2: Build Installer
```powershell
cd installer
.\build-installer.bat
```

This creates `ControlBox-Relay-Setup.exe` (~20MB installer)

## Output Files

| File | Description |
|------|-------------|
| `dist/ControlBox-Relay.exe` | Standalone executable (no installer) |
| `installer/ControlBox-Relay-Setup.exe` | Windows installer with shortcuts |

## What the Installer Does

1. Installs to `C:\Program Files\ControlBox\Relay Agent\`
2. Creates Start Menu shortcuts
3. Creates Desktop shortcut
4. Registers in Add/Remove Programs
5. Creates default config file

## Customization

### Change Cloud URL
Edit `ControlBox-Relay.nsi` line ~52 to change the default cloud URL.

### Add Icon
Place `controlbox.ico` in the `installer/` folder before building.

### Add Banner
Create `installer-banner.bmp` (164x314 pixels) for the installer welcome page.

## Troubleshooting

### "NSIS not found"
Ensure NSIS is installed and `makensis.exe` is in your PATH.

### "PyInstaller failed"
- Try: `pip install --upgrade pyinstaller`
- Check if antivirus is blocking the build

### Large file size
The ~50MB size is normal - it bundles Python and all dependencies.
