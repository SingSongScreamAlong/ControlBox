; =====================================================================
; ControlBox Relay Agent - NSIS Installer Script
; Creates professional Windows installer
; =====================================================================

!include "MUI2.nsh"
!include "FileFunc.nsh"

; General
Name "ControlBox Relay Agent"
OutFile "ControlBox-Relay-Setup.exe"
InstallDir "$PROGRAMFILES\ControlBox\Relay Agent"
InstallDirRegKey HKLM "Software\ControlBox\Relay" "Install_Dir"
RequestExecutionLevel admin

; Version info
!define VERSION "0.1.0"
!define PUBLISHER "OkBoxBox"
!define WEBSITE "https://okboxbox.com"

VIProductVersion "${VERSION}.0"
VIAddVersionKey "ProductName" "ControlBox Relay Agent"
VIAddVersionKey "CompanyName" "${PUBLISHER}"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "ProductVersion" "${VERSION}"
VIAddVersionKey "FileDescription" "iRacing Telemetry Relay for ControlBox"
VIAddVersionKey "LegalCopyright" "© 2024 ${PUBLISHER}"

; Interface settings
!define MUI_ABORTWARNING
!define MUI_ICON "controlbox.ico"
!define MUI_UNICON "controlbox.ico"
!define MUI_WELCOMEFINISHPAGE_BITMAP "installer-banner.bmp"

; Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "LICENSE.txt"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; Languages
!insertmacro MUI_LANGUAGE "English"

; Installation Section
Section "Install"
    SetOutPath $INSTDIR
    
    ; Main executable
    File "ControlBox-Relay.exe"
    File "README.md"
    
    ; Create config file with default settings
    FileOpen $0 "$INSTDIR\config.yaml" w
    FileWrite $0 "# ControlBox Relay Configuration$\r$\n"
    FileWrite $0 "cloud_url: https://coral-app-x988a.ondigitalocean.app$\r$\n"
    FileWrite $0 "poll_rate_hz: 10$\r$\n"
    FileWrite $0 "log_level: INFO$\r$\n"
    FileClose $0
    
    ; Create Start Menu shortcuts
    CreateDirectory "$SMPROGRAMS\ControlBox"
    CreateShortcut "$SMPROGRAMS\ControlBox\ControlBox Relay.lnk" "$INSTDIR\ControlBox-Relay.exe"
    CreateShortcut "$SMPROGRAMS\ControlBox\Uninstall Relay.lnk" "$INSTDIR\Uninstall.exe"
    
    ; Create Desktop shortcut
    CreateShortcut "$DESKTOP\ControlBox Relay.lnk" "$INSTDIR\ControlBox-Relay.exe"
    
    ; Write uninstaller
    WriteUninstaller "$INSTDIR\Uninstall.exe"
    
    ; Write registry keys for Add/Remove Programs
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\ControlBoxRelay" "DisplayName" "ControlBox Relay Agent"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\ControlBoxRelay" "UninstallString" '"$INSTDIR\Uninstall.exe"'
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\ControlBoxRelay" "InstallLocation" "$INSTDIR"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\ControlBoxRelay" "DisplayIcon" "$INSTDIR\ControlBox-Relay.exe"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\ControlBoxRelay" "Publisher" "${PUBLISHER}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\ControlBoxRelay" "DisplayVersion" "${VERSION}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\ControlBoxRelay" "URLInfoAbout" "${WEBSITE}"
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\ControlBoxRelay" "NoModify" 1
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\ControlBoxRelay" "NoRepair" 1
    
    ; Get installed size
    ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
    IntFmt $0 "0x%08X" $0
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\ControlBoxRelay" "EstimatedSize" "$0"
    
    ; Save install directory
    WriteRegStr HKLM "Software\ControlBox\Relay" "Install_Dir" "$INSTDIR"
SectionEnd

; Uninstaller Section
Section "Uninstall"
    ; Remove files
    Delete "$INSTDIR\ControlBox-Relay.exe"
    Delete "$INSTDIR\README.md"
    Delete "$INSTDIR\config.yaml"
    Delete "$INSTDIR\Uninstall.exe"
    
    ; Remove shortcuts
    Delete "$SMPROGRAMS\ControlBox\ControlBox Relay.lnk"
    Delete "$SMPROGRAMS\ControlBox\Uninstall Relay.lnk"
    RMDir "$SMPROGRAMS\ControlBox"
    Delete "$DESKTOP\ControlBox Relay.lnk"
    
    ; Remove directories
    RMDir "$INSTDIR"
    
    ; Remove registry keys
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\ControlBoxRelay"
    DeleteRegKey HKLM "Software\ControlBox\Relay"
SectionEnd
