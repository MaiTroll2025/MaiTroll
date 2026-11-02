param(
    [ValidateSet('doctor', 'devices', 'install', 'reset', 'launch', 'capture')]
    [string]$Action = 'doctor',
    [string]$Serial,
    [string]$ApkPath = 'android\app\build\outputs\apk\debug\app-debug.apk',
    [string]$LogDirectory = 'artifacts\android-logcat',
    [switch]$ClearBuffer
)

$ErrorActionPreference = 'Stop'
$packageName = 'com.maitroll.app'

function Find-Adb {
    $candidates = @()
    foreach ($sdkRoot in @($env:ANDROID_SDK_ROOT, $env:ANDROID_HOME, (Join-Path $env:LOCALAPPDATA 'Android\Sdk'))) {
        if ($sdkRoot) {
            $candidates += Join-Path $sdkRoot 'platform-tools\adb.exe'
        }
    }

    foreach ($candidate in $candidates) {
        if (Test-Path $candidate) {
            return $candidate
        }
    }

    $adbCommand = Get-Command adb.exe -ErrorAction SilentlyContinue
    if ($adbCommand) {
        return $adbCommand.Source
    }

    throw 'adb.exe was not found. Install Android SDK Platform-Tools or set ANDROID_SDK_ROOT.'
}

function Invoke-Adb {
    param([string[]]$Arguments)

    & $script:adbPath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "adb failed with exit code $LASTEXITCODE."
    }
}

function Get-TargetSerial {
    if ($Serial) {
        $deviceLines = & $script:adbPath devices
        if ($LASTEXITCODE -ne 0) {
            throw 'Could not query adb devices.'
        }
        if (-not ($deviceLines | Select-String -Pattern ("^{0}\s+device$" -f [regex]::Escape($Serial)))) {
            throw "Device '$Serial' is not connected and online. Run the devices action."
        }
        return $Serial
    }

    $deviceLines = & $script:adbPath devices
    if ($LASTEXITCODE -ne 0) {
        throw 'Could not query adb devices.'
    }

    $onlineDevices = @($deviceLines | Where-Object { $_ -match '^\S+\s+device$' } | ForEach-Object { ($_ -split '\s+')[0] })
    if ($onlineDevices.Count -eq 0) {
        throw 'No online Android device or emulator found. Start an AVD, then run the devices action.'
    }
    if ($onlineDevices.Count -gt 1) {
        throw 'More than one device is online. Pass -Serial with the desired adb device ID.'
    }
    return $onlineDevices[0]
}

$script:adbPath = Find-Adb

if ($Action -eq 'doctor') {
    Write-Output "adb: $script:adbPath"
    Invoke-Adb -Arguments @('version')
    Invoke-Adb -Arguments @('devices', '-l')
    exit 0
}

if ($Action -eq 'devices') {
    Invoke-Adb -Arguments @('devices', '-l')
    exit 0
}

$targetSerial = Get-TargetSerial

switch ($Action) {
    'install' {
        $resolvedApk = Resolve-Path -LiteralPath $ApkPath -ErrorAction Stop
        Invoke-Adb -Arguments @('-s', $targetSerial, 'install', '-r', $resolvedApk.Path)
    }
    'reset' {
        Write-Warning "This clears all app data and sign-in state for $packageName, then resets notification permission."
        Invoke-Adb -Arguments @('-s', $targetSerial, 'shell', 'pm', 'clear', $packageName)
        Invoke-Adb -Arguments @('-s', $targetSerial, 'shell', 'pm', 'revoke', $packageName, 'android.permission.POST_NOTIFICATIONS')
        Invoke-Adb -Arguments @('-s', $targetSerial, 'shell', 'pm', 'clear-permission-flags', $packageName, 'android.permission.POST_NOTIFICATIONS', 'user-set', 'user-fixed')
    }
    'launch' {
        Invoke-Adb -Arguments @('-s', $targetSerial, 'shell', 'monkey', '-p', $packageName, '1')
    }
    'capture' {
        $resolvedLogDirectory = [System.IO.Path]::GetFullPath($LogDirectory)
        New-Item -ItemType Directory -Force -Path $resolvedLogDirectory | Out-Null
        $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        $logPath = Join-Path $resolvedLogDirectory "maitroll-$timestamp.log"

        if ($ClearBuffer) {
            Invoke-Adb -Arguments @('-s', $targetSerial, 'logcat', '-c')
        }

        Write-Output "Capturing all Android log buffers to $logPath"
        Write-Output 'Reproduce the issue; press Ctrl+C to stop recording.'
        & $script:adbPath -s $targetSerial logcat -b all -v threadtime 2>&1 |
            Tee-Object -FilePath $logPath
    }
}
