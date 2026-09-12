; Vision Bridge (Tauri) — installer script.
;
; Tauri's own NSIS bundler could not be used: it insists on downloading its
; NSIS + plugin toolchain from GitHub and every attempt ends in a proxy 502,
; after which it wipes and retries forever. The app itself is a single 3.2 MB
; executable, so an installer is genuinely trivial to write — this does the
; same job electron-builder's NSIS target does for the Electron build, which
; keeps the two installer sizes comparable.
;
; Build: makensis /DAPP_EXE=<path> /DOUT_FILE=<path> /DICON_FILE=<path> installer.nsi

Unicode true
SetCompressor /SOLID lzma
SetCompressorDictSize 64

!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "LogicLib.nsh"

!define PRODUCT_NAME "Vision Bridge (Tauri)"
!define PRODUCT_VERSION "0.1.0"
!define PRODUCT_PUBLISHER "Vision Bridge Team"
!define PRODUCT_DESCRIPTION "Intelligent Desktop Translator with AI Pipelines"
!define APP_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\VisionBridgeTauri"
!define APP_EXE_INSTALLED "vision-bridge.exe"

!ifndef APP_EXE
  !define APP_EXE "..\..\..\target\release\vision-bridge.exe"
!endif
!ifndef OUT_FILE
  !define OUT_FILE "..\..\..\target\release\bundle\nsis\Vision Bridge (Tauri) Setup 0.1.0.exe"
!endif
!ifndef ICON_FILE
  !define ICON_FILE "..\..\icons\icon.ico"
!endif

Name "${PRODUCT_NAME}"
OutFile "${OUT_FILE}"
InstallDir "$LOCALAPPDATA\Programs\Vision Bridge (Tauri)"
InstallDirRegKey HKCU "Software\VisionBridgeTauri" "InstallDir"
RequestExecutionLevel user
ShowInstDetails hide
ShowUninstDetails hide

VIProductVersion "0.1.0.0"
VIAddVersionKey "ProductName" "${PRODUCT_NAME}"
VIAddVersionKey "ProductVersion" "${PRODUCT_VERSION}"
VIAddVersionKey "CompanyName" "${PRODUCT_PUBLISHER}"
VIAddVersionKey "FileDescription" "${PRODUCT_DESCRIPTION} (Tauri build)"
VIAddVersionKey "FileVersion" "${PRODUCT_VERSION}"
VIAddVersionKey "LegalCopyright" "© ${PRODUCT_PUBLISHER}"

!define MUI_ABORTWARNING
!define MUI_ICON "${ICON_FILE}"
!define MUI_UNICON "${ICON_FILE}"
!define MUI_FINISHPAGE_RUN "$INSTDIR\${APP_EXE_INSTALLED}"
!define MUI_FINISHPAGE_RUN_TEXT "运行 Vision Bridge"

!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "SimpChinese"
!insertmacro MUI_LANGUAGE "English"

Section "Vision Bridge" SecMain
  SetOutPath "$INSTDIR"
  File "/oname=${APP_EXE_INSTALLED}" "${APP_EXE}"

  WriteUninstaller "$INSTDIR\uninstall.exe"

  CreateShortCut "$SMPROGRAMS\${PRODUCT_NAME}.lnk" "$INSTDIR\${APP_EXE_INSTALLED}" "" "$INSTDIR\${APP_EXE_INSTALLED}" 0
  CreateShortCut "$DESKTOP\${PRODUCT_NAME}.lnk" "$INSTDIR\${APP_EXE_INSTALLED}" "" "$INSTDIR\${APP_EXE_INSTALLED}" 0

  WriteRegStr HKCU "Software\VisionBridgeTauri" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "${APP_KEY}" "DisplayName" "${PRODUCT_NAME}"
  WriteRegStr HKCU "${APP_KEY}" "DisplayVersion" "${PRODUCT_VERSION}"
  WriteRegStr HKCU "${APP_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"
  WriteRegStr HKCU "${APP_KEY}" "DisplayIcon" "$INSTDIR\${APP_EXE_INSTALLED}"
  WriteRegStr HKCU "${APP_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${APP_KEY}" "UninstallString" '"$INSTDIR\uninstall.exe"'
  WriteRegStr HKCU "${APP_KEY}" "QuietUninstallString" '"$INSTDIR\uninstall.exe" /S'
  WriteRegDWORD HKCU "${APP_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${APP_KEY}" "NoRepair" 1

  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKCU "${APP_KEY}" "EstimatedSize" "$0"
SectionEnd

Section "Uninstall"
  Delete "$INSTDIR\${APP_EXE_INSTALLED}"
  Delete "$INSTDIR\uninstall.exe"
  RMDir "$INSTDIR"

  Delete "$SMPROGRAMS\${PRODUCT_NAME}.lnk"
  Delete "$DESKTOP\${PRODUCT_NAME}.lnk"

  DeleteRegKey HKCU "${APP_KEY}"
  DeleteRegKey HKCU "Software\VisionBridgeTauri"
SectionEnd
