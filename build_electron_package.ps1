param(
    [string]$PythonPath = "",
    [string]$CondaEnvName = "Cbot",
    [string]$IconPath = "C:\Users\sasak\Downloads\DL_exe\app_icon.ico",
    [bool]$BundleFFmpeg = $true,
    [string]$FFmpegPath = "",
    [bool]$InstallMissing = $true,
    [switch]$Clean
)

$ErrorActionPreference = "Stop"

Push-Location $PSScriptRoot
try {
    $npm = (Get-Command npm.cmd -ErrorAction SilentlyContinue)
    if (-not $npm) {
        $npm = (Get-Command npm -ErrorAction SilentlyContinue)
    }
    if (-not $npm) {
        throw "npm not found. Install Node.js first."
    }

    $buildExeArgs = @(
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-File", ".\build_exe.ps1",
        "-CondaEnvName", $CondaEnvName,
        "-OneDir",
        "-ExportToElectronBackend"
    )

    if ($PythonPath) {
        $buildExeArgs += @("-PythonPath", $PythonPath)
    }
    if ($IconPath) {
        $buildExeArgs += @("-IconPath", $IconPath)
    }
    if ($InstallMissing) {
        $buildExeArgs += "-InstallMissing"
    }
    if ($BundleFFmpeg) {
        $buildExeArgs += "-BundleFFmpeg"
    }
    if ($FFmpegPath) {
        $buildExeArgs += @("-FFmpegPath", $FFmpegPath)
    }
    if ($Clean) {
        $buildExeArgs += "-Clean"
    }

    Write-Host "[step] Build backend for Electron packaging..."
    & powershell @buildExeArgs
    if ($LASTEXITCODE -ne 0) {
        throw "Backend build failed."
    }

    Push-Location (Join-Path $PSScriptRoot "electron")
    try {
        Write-Host "[step] Install Electron dependencies..."
        & $npm.Source install
        if ($LASTEXITCODE -ne 0) {
            throw "npm install failed."
        }

        Write-Host "[step] Build Electron installer (nsis)..."
        & $npm.Source run dist:win
        if ($LASTEXITCODE -ne 0) {
            throw "electron-builder failed."
        }
    }
    finally {
        Pop-Location
    }

    Write-Host "[done] Package artifacts: electron\release"
}
finally {
    Pop-Location
}
