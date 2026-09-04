[CmdletBinding()]
param(
    [Parameter()]
    [string]$RepositoryRoot = (Join-Path $PSScriptRoot '..'),

    [Parameter()]
    [string]$SourceFile,

    [Parameter()]
    [string]$NodePath = 'node',

    [Parameter()]
    [string]$PythonPath = 'python',

    [Parameter()]
    [ValidateRange(1, 30)]
    [int]$PollSeconds = 5,

    [Parameter()]
    [ValidateRange(1, 10)]
    [int]$StableSamples = 3,

    [Parameter()]
    [ValidateRange(1, 10)]
    [int]$StableIntervalSeconds = 1,

    [Parameter()]
    [ValidateRange(10, 600)]
    [int]$StableTimeoutSeconds = 120,

    [Parameter()]
    [ValidateRange(1, 30)]
    [int]$DebounceSeconds = 3,

    [Parameter()]
    [switch]$ProcessCurrent
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repository = [System.IO.Path]::GetFullPath((Resolve-Path -LiteralPath $RepositoryRoot).Path)
$sourceCandidate = if ($SourceFile) { $SourceFile } else { Join-Path $repository '..\resumenes.json' }
$target = [System.IO.Path]::GetFullPath((Resolve-Path -LiteralPath $sourceCandidate).Path)
$automation = [System.IO.Path]::GetFullPath((Join-Path $repository 'scripts\resumenes-json-automation.mjs'))

if (-not (Test-Path -LiteralPath $target -PathType Leaf)) {
    throw "No existe el archivo vigilado: $target"
}
if (-not (Test-Path -LiteralPath $automation -PathType Leaf)) {
    throw "No existe el ejecutor de la automatización: $automation"
}

$resolvedNode = (Get-Command $NodePath -ErrorAction Stop).Source
$resolvedPython = (Get-Command $PythonPath -ErrorAction Stop).Source
$localStateBase = if ($env:LOCALAPPDATA) {
    $env:LOCALAPPDATA
} else {
    Join-Path $env:USERPROFILE 'AppData\Local'
}
$stateRoot = Join-Path $localStateBase 'ResumenesTrials\resumenes-json-automation'
$reportRoot = Join-Path $stateRoot 'reports'
$statePath = Join-Path $stateRoot 'watch-state.json'
New-Item -ItemType Directory -Path $reportRoot -Force | Out-Null

function Get-FileSha256 {
    param([Parameter(Mandatory)][string]$LiteralPath)

    $stream = [System.IO.File]::Open(
        $LiteralPath,
        [System.IO.FileMode]::Open,
        [System.IO.FileAccess]::Read,
        [System.IO.FileShare]::ReadWrite -bor [System.IO.FileShare]::Delete
    )
    try {
        $algorithm = [System.Security.Cryptography.SHA256]::Create()
        try {
            return ([System.BitConverter]::ToString($algorithm.ComputeHash($stream))).Replace('-', '').ToLowerInvariant()
        } finally {
            $algorithm.Dispose()
        }
    } finally {
        $stream.Dispose()
    }
}

function Wait-ResumenesFileStable {
    $deadline = [DateTimeOffset]::UtcNow.AddSeconds($StableTimeoutSeconds)
    $lastSignature = $null
    $equalSamples = 0

    while ([DateTimeOffset]::UtcNow -lt $deadline) {
        try {
            $item = Get-Item -LiteralPath $target -ErrorAction Stop
            $hash = Get-FileSha256 -LiteralPath $target
            $signature = '{0}|{1}|{2}' -f $item.Length, $item.LastWriteTimeUtc.Ticks, $hash
            if ($signature -eq $lastSignature) {
                $equalSamples += 1
            } else {
                $lastSignature = $signature
                $equalSamples = 1
            }
            if ($equalSamples -ge $StableSamples) {
                return $hash
            }
        } catch [System.IO.IOException] {
            $lastSignature = $null
            $equalSamples = 0
        } catch [System.UnauthorizedAccessException] {
            $lastSignature = $null
            $equalSamples = 0
        } catch [System.Management.Automation.ItemNotFoundException] {
            $lastSignature = $null
            $equalSamples = 0
        }
        Start-Sleep -Seconds $StableIntervalSeconds
    }
    throw "OneDrive no dejó resumenes.json estable durante $StableTimeoutSeconds segundos. No se leyó ni se subió el archivo."
}

function Save-WatchState {
    param([Parameter(Mandatory)][string]$Sha256)

    $state = [ordered]@{
        version = 1
        target = $target
        last_sha256 = $Sha256
        updated_at = [DateTimeOffset]::UtcNow.ToString('o')
    }
    $temporaryState = "$statePath.tmp"
    $state | ConvertTo-Json | Set-Content -LiteralPath $temporaryState -Encoding UTF8
    Move-Item -LiteralPath $temporaryState -Destination $statePath -Force
}

function Read-WatchState {
    if (-not (Test-Path -LiteralPath $statePath -PathType Leaf)) {
        return $null
    }
    try {
        $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
        if ($state.version -ne 1 -or $state.target -ne $target -or -not $state.last_sha256) {
            return $null
        }
        return [string]$state.last_sha256
    } catch {
        return $null
    }
}

function Invoke-ResumenesAutomation {
    param([Parameter(Mandatory)][string]$StableSha256)

    Write-Host "Cambio estable confirmado en resumenes.json (SHA-256 $StableSha256)."
    & $resolvedNode $automation --repo $repository --file $target --python-path $resolvedPython --state-dir $stateRoot --report-dir $reportRoot
    $automationExitCode = $LASTEXITCODE

    if ($automationExitCode -eq 0) {
        Save-WatchState -Sha256 $StableSha256
        Write-Host 'Automatización finalizada sin bloqueos.'
        return $true
    }
    if ($automationExitCode -eq 2) {
        Save-WatchState -Sha256 $StableSha256
        Write-Warning "La subida fue bloqueada por una regla de seguridad. Consulte el reporte en $reportRoot."
        return $true
    }

    Write-Warning "La ejecución terminó con un error transitorio (código $automationExitCode). Se volverá a intentar si el archivo sigue pendiente."
    return $false
}

$mutexKeyBytes = [System.Text.Encoding]::UTF8.GetBytes($target.ToLowerInvariant())
$mutexHash = [System.Security.Cryptography.SHA256]::Create()
try {
    $mutexKey = ([System.BitConverter]::ToString($mutexHash.ComputeHash($mutexKeyBytes))).Replace('-', '').Substring(0, 20)
} finally {
    $mutexHash.Dispose()
}
$mutex = [System.Threading.Mutex]::new($false, "Local\ResumenesTrialsJsonWatcher_$mutexKey")
if (-not $mutex.WaitOne(0)) {
    $mutex.Dispose()
    throw 'Ya existe un watcher activo para este resumenes.json.'
}

$watcher = $null
$subscriptions = @()
try {
    $initialSha = Wait-ResumenesFileStable
    $lastHandledSha = Read-WatchState
    if (-not $lastHandledSha) {
        if ($ProcessCurrent) {
            $lastHandledSha = ''
        } else {
            Save-WatchState -Sha256 $initialSha
            $lastHandledSha = $initialSha
            Write-Host 'Estado inicial guardado. El primer arranque no crea ramas ni PR.'
        }
    }
    if ($initialSha -ne $lastHandledSha) {
        if (Invoke-ResumenesAutomation -StableSha256 $initialSha) {
            $lastHandledSha = $initialSha
        }
    }

    $watcher = [System.IO.FileSystemWatcher]::new((Split-Path -Parent $target), 'resumenes.json')
    $watcher.IncludeSubdirectories = $false
    $watcher.NotifyFilter = [System.IO.NotifyFilters]::LastWrite -bor
        [System.IO.NotifyFilters]::Size -bor
        [System.IO.NotifyFilters]::FileName -bor
        [System.IO.NotifyFilters]::CreationTime
    $watcher.EnableRaisingEvents = $true

    $sourcePrefix = "ResumenesTrialsJsonWatcher.$PID"
    foreach ($eventName in @('Changed', 'Created', 'Renamed')) {
        $sourceIdentifier = "$sourcePrefix.$eventName"
        $subscriptions += Register-ObjectEvent -InputObject $watcher -EventName $eventName -SourceIdentifier $sourceIdentifier
    }

    Write-Host "Vigilando exclusivamente $target"
    Write-Host 'Presione Ctrl+C para detener el watcher.'
    $retryNotBefore = [DateTimeOffset]::MinValue

    while ($true) {
        $event = Wait-Event -Timeout $PollSeconds
        if ($event) {
            Remove-Event -EventIdentifier $event.EventIdentifier -ErrorAction SilentlyContinue
            $quietSince = [DateTimeOffset]::UtcNow
            while (([DateTimeOffset]::UtcNow - $quietSince).TotalSeconds -lt $DebounceSeconds) {
                Start-Sleep -Milliseconds 250
                $queued = @(Get-Event | Where-Object { $_.SourceIdentifier -like "$sourcePrefix.*" })
                if ($queued.Count -gt 0) {
                    foreach ($queuedEvent in $queued) {
                        Remove-Event -EventIdentifier $queuedEvent.EventIdentifier -ErrorAction SilentlyContinue
                    }
                    $quietSince = [DateTimeOffset]::UtcNow
                }
            }
        }

        if ([DateTimeOffset]::UtcNow -lt $retryNotBefore) {
            continue
        }

        try {
            $candidateSha = Wait-ResumenesFileStable
            if ($candidateSha -eq $lastHandledSha) {
                continue
            }
            if (Invoke-ResumenesAutomation -StableSha256 $candidateSha) {
                $lastHandledSha = $candidateSha
                $retryNotBefore = [DateTimeOffset]::MinValue
            } else {
                $retryNotBefore = [DateTimeOffset]::UtcNow.AddMinutes(1)
            }
        } catch {
            Write-Warning $_.Exception.Message
            $retryNotBefore = [DateTimeOffset]::UtcNow.AddMinutes(1)
        }
    }
} finally {
    foreach ($subscription in $subscriptions) {
        Unregister-Event -SubscriptionId $subscription.Id -ErrorAction SilentlyContinue
    }
    Get-Event | Where-Object { $_.SourceIdentifier -like "ResumenesTrialsJsonWatcher.$PID.*" } |
        Remove-Event -ErrorAction SilentlyContinue
    if ($watcher) {
        $watcher.EnableRaisingEvents = $false
        $watcher.Dispose()
    }
    $mutex.ReleaseMutex()
    $mutex.Dispose()
}
