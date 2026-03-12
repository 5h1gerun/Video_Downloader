param(
    [string]$PythonPath = "",
    [string]$CondaEnvName = "Cbot",
    [string]$IconPath = "app_icon.ico",
    [string]$AppName = "Video_Downloader",
    [string]$EntryPoint = "src/main.py",
    [switch]$Clean,
    [switch]$OneDir,
    [switch]$InstallMissing,
    [switch]$IncludeElectron,
    [switch]$BundleElectronRuntime,
    [switch]$BundleFFmpeg,
    [string]$FFmpegPath = "",
    [switch]$ExportToElectronBackend
)

$ErrorActionPreference = "Stop"

function Resolve-PythonPath {
    param(
        [string]$Preferred,
        [string]$PreferredCondaEnv
    )

    if ($Preferred) {
        if (-not (Test-Path -LiteralPath $Preferred)) {
            throw "PythonPath not found: $Preferred"
        }
        return (Resolve-Path -LiteralPath $Preferred).Path
    }

    if ($env:DL_EXE_PYTHON -and (Test-Path -LiteralPath $env:DL_EXE_PYTHON)) {
        return (Resolve-Path -LiteralPath $env:DL_EXE_PYTHON).Path
    }

    if ($PreferredCondaEnv) {
        $userHome = [Environment]::GetFolderPath("UserProfile")
        $condaRoots = @(
            (Join-Path $userHome "miniconda3"),
            (Join-Path $userHome "anaconda3")
        )
        foreach ($root in $condaRoots) {
            $envPython = Join-Path $root ("envs\" + $PreferredCondaEnv + "\python.exe")
            if (Test-Path -LiteralPath $envPython) {
                return (Resolve-Path -LiteralPath $envPython).Path
            }
        }
    }

    if ($env:CONDA_PREFIX) {
        $condaPython = Join-Path $env:CONDA_PREFIX "python.exe"
        if (Test-Path -LiteralPath $condaPython) {
            return (Resolve-Path -LiteralPath $condaPython).Path
        }
    }

    $venvPython = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
    if (Test-Path -LiteralPath $venvPython) {
        return (Resolve-Path -LiteralPath $venvPython).Path
    }

    $candidates = @()
    $cmd = Get-Command python -ErrorAction SilentlyContinue
    if ($cmd) {
        $candidates += $cmd.Path
    }

    $wherePython = & where.exe python 2>$null
    foreach ($line in $wherePython) {
        if ($line -and (Test-Path -LiteralPath $line)) {
            $candidates += $line
        }
    }

    foreach ($candidate in ($candidates | Select-Object -Unique)) {
        if ($candidate -notmatch "WindowsApps\\python\.exe$") {
            return $candidate
        }
    }

    throw "No usable python.exe found. Use -PythonPath or set DL_EXE_PYTHON."
}

function Test-PythonPackage {
    param(
        [string]$PythonExe,
        [string]$ModuleName
    )

    & $PythonExe -c "import importlib.util,sys;sys.exit(0 if importlib.util.find_spec('$ModuleName') else 1)" *> $null
    return $LASTEXITCODE -eq 0
}

function Install-PythonPackages {
    param(
        [string]$PythonExe,
        [string[]]$Packages
    )

    if (-not $Packages -or $Packages.Count -eq 0) {
        return
    }

    Write-Host "[info] Installing missing packages: $($Packages -join ', ')"
    & $PythonExe -m pip install @Packages
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to install required packages."
    }
}

function Resolve-FFmpegSource {
    param([string]$PreferredPath)

    $rawCandidates = @()
    if ($PreferredPath) {
        $rawCandidates += $PreferredPath
    }
    if ($env:FFMPEG_LOCATION) {
        $rawCandidates += $env:FFMPEG_LOCATION
    }
    if ($env:FFMPEG_PATH) {
        $rawCandidates += $env:FFMPEG_PATH
    }

    $cmd = Get-Command ffmpeg -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Path) {
        $rawCandidates += $cmd.Path
    }
    $whereFfmpeg = & where.exe ffmpeg 2>$null
    foreach ($line in $whereFfmpeg) {
        if ($line) {
            $rawCandidates += $line
        }
    }

    foreach ($raw in ($rawCandidates | Select-Object -Unique)) {
        if (-not $raw -or -not (Test-Path -LiteralPath $raw)) {
            continue
        }

        $resolved = (Resolve-Path -LiteralPath $raw).Path
        $item = Get-Item -LiteralPath $resolved

        if ($item.PSIsContainer) {
            if (Test-Path -LiteralPath (Join-Path $resolved "ffmpeg.exe")) {
                $binDir = $resolved
            } elseif (Test-Path -LiteralPath (Join-Path $resolved "bin\\ffmpeg.exe")) {
                $binDir = Join-Path $resolved "bin"
            } else {
                continue
            }
        } else {
            if ($item.Name.ToLower() -ne "ffmpeg.exe") {
                continue
            }
            $binDir = $item.DirectoryName
        }

        if ([IO.Path]::GetFileName($binDir).ToLower() -eq "bin") {
            $rootDir = Split-Path -Parent $binDir
        } else {
            $rootDir = $binDir
        }

        return [pscustomobject]@{
            BinDir  = $binDir
            RootDir = $rootDir
        }
    }

    return $null
}

function Copy-FFmpegBundle {
    param(
        [string]$OutputPath,
        [bool]$IsOneDir,
        [string]$BinDir,
        [string]$RootDir
    )

    if ($IsOneDir) {
        $bundleRoot = Join-Path $OutputPath "ffmpeg"
    } else {
        $bundleRoot = Join-Path (Split-Path -Parent $OutputPath) "ffmpeg"
    }

    $binTarget = Join-Path $bundleRoot "bin"
    if (-not (Test-Path -LiteralPath $binTarget)) {
        New-Item -ItemType Directory -Path $binTarget -Force | Out-Null
    }

    Copy-Item -LiteralPath (Join-Path $BinDir "*") -Destination $binTarget -Recurse -Force

    $licensesDir = Join-Path $RootDir "licenses"
    if (Test-Path -LiteralPath $licensesDir) {
        $licensesTarget = Join-Path $bundleRoot "licenses"
        if (Test-Path -LiteralPath $licensesTarget) {
            Remove-Item -LiteralPath $licensesTarget -Recurse -Force
        }
        Copy-Item -LiteralPath $licensesDir -Destination $licensesTarget -Recurse
    }

    return $bundleRoot
}

Push-Location $PSScriptRoot
try {
    $pythonExe = Resolve-PythonPath -Preferred $PythonPath -PreferredCondaEnv $CondaEnvName
    Write-Host "[info] Using Python: $pythonExe"

    if (-not (Test-Path -LiteralPath $EntryPoint)) {
        throw "Entry point not found: $EntryPoint"
    }

    $missingModules = @()
    foreach ($module in @("yt_dlp", "PyInstaller")) {
        if (-not (Test-PythonPackage -PythonExe $pythonExe -ModuleName $module)) {
            $missingModules += $module
        }
    }

    if ($missingModules.Count -gt 0) {
        if ($InstallMissing) {
            $packages = @()
            if ($missingModules -contains "yt_dlp") {
                $packages += "yt-dlp"
            }
            if ($missingModules -contains "PyInstaller") {
                $packages += "pyinstaller"
            }
            Install-PythonPackages -PythonExe $pythonExe -Packages $packages
        } else {
            throw "Missing modules in selected Python: $($missingModules -join ', '). Re-run with -InstallMissing or use a Python env that has these modules."
        }
    }

    $null = & $pythonExe -m PyInstaller --version
    if ($LASTEXITCODE -ne 0) {
        throw "PyInstaller is not available after dependency check."
    }

    if ($Clean) {
        foreach ($path in @("build", "dist", "$AppName.spec")) {
            if (Test-Path -LiteralPath $path) {
                Remove-Item -LiteralPath $path -Recurse -Force
            }
        }
    }

    if ($BundleElectronRuntime) {
        $IncludeElectron = $true
        $electronDir = Join-Path $PSScriptRoot "electron"
        if (-not (Test-Path -LiteralPath (Join-Path $electronDir "package.json"))) {
            throw "electron/package.json not found: $electronDir"
        }
        $nodeModules = Join-Path $electronDir "node_modules"
        if (-not (Test-Path -LiteralPath $nodeModules)) {
            $npm = (Get-Command npm.cmd -ErrorAction SilentlyContinue)
            if (-not $npm) {
                $npm = (Get-Command npm -ErrorAction SilentlyContinue)
            }
            if (-not $npm) {
                throw "npm not found. Install Node.js or pre-install electron/node_modules."
            }
            Write-Host "[info] Installing Electron dependencies for bundling..."
            & $npm.Source install --prefix $electronDir
            if ($LASTEXITCODE -ne 0) {
                throw "npm install failed for electron runtime bundling."
            }
        }
    }

    $args = @(
        "-m", "PyInstaller",
        "--noconfirm",
        "--name", $AppName,
        $EntryPoint
    )

    if ($OneDir) {
        $args += "--onedir"
        Write-Host "[info] Build mode: onedir (portable folder)"
    } else {
        $args += "--onefile"
        Write-Host "[info] Build mode: onefile"
    }

    # yt-dlp and networking backends are dynamically imported in some paths.
    $collectTargets = @("yt_dlp", "requests", "urllib3", "certifi", "mutagen", "brotli", "websockets", "Cryptodome")
    foreach ($module in $collectTargets) {
        if (Test-PythonPackage -PythonExe $pythonExe -ModuleName $module) {
            $args += @("--collect-all", $module)
        }
    }

    if ($IconPath) {
        if (-not (Test-Path -LiteralPath $IconPath)) {
            throw "Icon file not found: $IconPath"
        }
        $resolvedIconPath = (Resolve-Path -LiteralPath $IconPath).Path
        $args += @("--icon", $resolvedIconPath)
        Write-Host "[info] Icon: $resolvedIconPath"
    } else {
        Write-Host "[info] Icon: none"
    }

    if ($IncludeElectron) {
        $electronDir = Join-Path $PSScriptRoot "electron"
        if (-not (Test-Path -LiteralPath (Join-Path $electronDir "package.json"))) {
            throw "electron/package.json not found: $electronDir"
        }
        $args += @("--add-data", "$electronDir;electron")
        Write-Host "[info] Include Electron files: $electronDir"
    }

    & $pythonExe @args
    if ($LASTEXITCODE -ne 0) {
        throw "PyInstaller failed with exit code $LASTEXITCODE."
    }

    if ($OneDir) {
        $outputPath = Join-Path $PSScriptRoot ("dist\" + $AppName)
    } else {
        $outputPath = Join-Path $PSScriptRoot ("dist\" + $AppName + ".exe")
    }

    if (-not (Test-Path -LiteralPath $outputPath)) {
        throw "Build finished but output not found: $outputPath"
    }

    $bundledFfmpegPath = $null
    if ($BundleFFmpeg) {
        $ffmpegSource = Resolve-FFmpegSource -PreferredPath $FFmpegPath
        if (-not $ffmpegSource) {
            throw "ffmpeg not found. Specify -FFmpegPath or set FFMPEG_LOCATION/FFMPEG_PATH."
        }
        $bundledFfmpegPath = Copy-FFmpegBundle -OutputPath $outputPath -IsOneDir:$OneDir -BinDir $ffmpegSource.BinDir -RootDir $ffmpegSource.RootDir
        Write-Host "[done] Bundled ffmpeg: $bundledFfmpegPath"
    }

    if ($ExportToElectronBackend) {
        $electronBackendDir = Join-Path $PSScriptRoot "electron\backend"
        if (-not (Test-Path -LiteralPath $electronBackendDir)) {
            New-Item -ItemType Directory -Path $electronBackendDir | Out-Null
        }

        if ($OneDir) {
            $targetPath = Join-Path $electronBackendDir $AppName
            if (Test-Path -LiteralPath $targetPath) {
                Remove-Item -LiteralPath $targetPath -Recurse -Force
            }
            Copy-Item -LiteralPath $outputPath -Destination $targetPath -Recurse
            Write-Host "[done] Exported backend folder: $targetPath"
        } else {
            $targetPath = Join-Path $electronBackendDir ($AppName + ".exe")
            Copy-Item -LiteralPath $outputPath -Destination $targetPath -Force
            Write-Host "[done] Exported backend exe: $targetPath"

            if ($bundledFfmpegPath -and (Test-Path -LiteralPath $bundledFfmpegPath)) {
                $ffmpegTarget = Join-Path $electronBackendDir "ffmpeg"
                if (Test-Path -LiteralPath $ffmpegTarget) {
                    Remove-Item -LiteralPath $ffmpegTarget -Recurse -Force
                }
                Copy-Item -LiteralPath $bundledFfmpegPath -Destination $ffmpegTarget -Recurse
                Write-Host "[done] Exported ffmpeg bundle: $ffmpegTarget"
            }
        }
    }

    Write-Host "[done] Build complete: $outputPath"
}
finally {
    Pop-Location
}
