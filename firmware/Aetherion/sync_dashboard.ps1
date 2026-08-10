# Sync Dashboard to LittleFS data folder
# Run this whenever dashboard files are updated before uploading to ESP32
$dashboard = "C:\Users\gavis\Documents\Arduino\aerogyro\dashboard"
$data = "C:\Users\gavis\Documents\Arduino\aerogyro\firmware\Aetherion\data"

if (-Not (Test-Path $data)) {
    New-Item -ItemType Directory -Path $data -Force | Out-Null
}

Copy-Item -Path "$dashboard\*" -Destination $data -Recurse -Force
Write-Host "Dashboard files synced to data/ directory"
