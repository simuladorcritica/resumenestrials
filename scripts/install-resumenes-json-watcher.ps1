[CmdletBinding(SupportsShouldProcess)]
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
    [string]$TaskName = 'ResumenesTrials-ResumenesJson-Watcher',

    [Parameter()]
    [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ($Uninstall) {
    $existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if (-not $existing) {
        Write-Host "La tarea $TaskName no está instalada."
        return
    }
    if ($PSCmdlet.ShouldProcess($TaskName, 'Eliminar tarea programada local')) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Host "Tarea $TaskName eliminada."
    }
    return
}

$repository = [System.IO.Path]::GetFullPath((Resolve-Path -LiteralPath $RepositoryRoot).Path)
$watcher = [System.IO.Path]::GetFullPath((Join-Path $repository 'scripts\watch-resumenes-json.ps1'))
$sourceCandidate = if ($SourceFile) { $SourceFile } else { Join-Path $repository '..\resumenes.json' }
$target = [System.IO.Path]::GetFullPath((Resolve-Path -LiteralPath $sourceCandidate).Path)

if (-not (Test-Path -LiteralPath $watcher -PathType Leaf)) {
    throw "No existe el watcher: $watcher"
}
if (-not (Test-Path -LiteralPath $target -PathType Leaf)) {
    throw "No existe el archivo vigilado: $target"
}

$node = (Get-Command $NodePath -ErrorAction Stop).Source
$python = (Get-Command $PythonPath -ErrorAction Stop).Source
$null = & $python -c 'import PIL'
if ($LASTEXITCODE -ne 0) {
    throw 'Python debe disponer de Pillow para ejecutar la generación completa previa al PR.'
}
$null = Get-Command git -ErrorAction Stop
$gh = Get-Command gh -ErrorAction SilentlyContinue
if (-not $gh) {
    throw 'GitHub CLI (gh) es obligatorio para abrir el PR. Instálelo y ejecute gh auth login antes de registrar la tarea.'
}
$authCheck = Start-Process -FilePath $gh.Source -ArgumentList 'auth','status','--hostname','github.com' -WindowStyle Hidden -Wait -PassThru
if ($authCheck.ExitCode -ne 0) {
    throw 'GitHub CLI no tiene una sesión válida para github.com. Ejecute gh auth login.'
}

$shell = (Get-Command pwsh -ErrorAction SilentlyContinue).Source
if (-not $shell) {
    $shell = (Get-Command powershell.exe -ErrorAction Stop).Source
}

$arguments = '-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass ' +
    "-File `"$watcher`" -RepositoryRoot `"$repository`" -SourceFile `"$target`" -NodePath `"$node`" -PythonPath `"$python`""
$action = New-ScheduledTaskAction -Execute $shell -Argument $arguments -WorkingDirectory $repository
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
$task = New-ScheduledTask -Action $action -Trigger $trigger -Settings $settings -Principal $principal

if ($PSCmdlet.ShouldProcess($TaskName, 'Registrar watcher local al iniciar sesión')) {
    Register-ScheduledTask -TaskName $TaskName -InputObject $task -Force | Out-Null
    Write-Host "Tarea $TaskName instalada. Vigilará exclusivamente $target al iniciar sesión."
    Write-Host 'El primer arranque guarda una línea base y no crea ramas ni PR.'
}
