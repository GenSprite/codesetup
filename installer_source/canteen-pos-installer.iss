; Canteen POS System Installer Script
; Inno Setup 6.5.4
; Updated for portable Node.js and unified setup batch

#define MyAppName "Canteen POS System"
#define MyAppVersion "1.0"
#define MyAppPublisher "Group 5"
#define MyAppURL "https://github.com/yourgroup/canteen-pos"
#define MyAppExeName "setup_and_start.bat"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\CanteenPOS
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
OutputDir=C:\installer_source
OutputBaseFilename=CanteenPOS_Setup
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; Include your portable Node.js folder
Source: "C:\installer_source\node-v22.20.0-win-x64\*"; DestDir: "{app}\node"; Flags: ignoreversion recursesubdirs createallsubdirs

; Include MariaDB portable
Source: "C:\installer_source\mariadb\*"; DestDir: "{app}\mariadb"; Flags: ignoreversion recursesubdirs createallsubdirs

; Include your Canteen POS Application
Source: "C:\installer_source\canteen-pos\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "node_modules"

; Unified setup + start batch file
Source: "C:\installer_source\start-server.bat"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
; Run the unified setup & start script after installation
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[UninstallRun]
; Stop MariaDB if running
Filename: "taskkill"; Parameters: "/F /IM mysqld.exe"; Flags: runhidden
