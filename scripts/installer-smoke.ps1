$ErrorActionPreference = 'Stop'
$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Set-Location -LiteralPath $workspace
$registryRoots = @(
    'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall',
    'HKCU:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall',
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall',
    'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall'
)
foreach ($registryRoot in $registryRoots) {
    if (Test-Path -LiteralPath $registryRoot) {
        $existing = Get-ChildItem -LiteralPath $registryRoot | Get-ItemProperty | Where-Object { $_.DisplayName -like '*BardForge*' }
        if ($existing) { throw 'An existing BardForge installation must not be modified by this test.' }
    }
}
if (Get-Process -Name 'BardForge Studio' -ErrorAction SilentlyContinue) { throw 'Close BardForge before running installer tests.' }
$testRoot = Join-Path $workspace ('tmp\installer-' + [guid]::NewGuid().ToString('N'))
$installDir = [IO.Path]::GetFullPath((Join-Path $testRoot 'BardForge Studio'))
if (-not $installDir.StartsWith($workspace + '\tmp\')) { throw 'Unsafe test install path' }
New-Item -ItemType Directory -Path (Join-Path $testRoot 'temp') -Force | Out-Null
$env:TEMP = Join-Path $testRoot 'temp'
$env:TMP = $env:TEMP
$version = (Get-Content package.json -Raw | ConvertFrom-Json).version
$installer = Join-Path $workspace "build\BardForge-Studio-Setup-$version.exe"
$uninstaller = Join-Path $installDir 'Uninstall BardForge Studio.exe'
function Get-Sha256([string] $filePath) {
    $stream = [IO.File]::OpenRead($filePath)
    $hash = [Security.Cryptography.SHA256]::Create()
    try { return [BitConverter]::ToString($hash.ComputeHash($stream)) }
    finally { $stream.Dispose(); $hash.Dispose() }
}
try {
    $process = Start-Process -FilePath $installer -ArgumentList @('/S', '/currentuser', '--no-desktop-shortcut', "/D=$installDir") -WindowStyle Hidden -PassThru -Wait
    if ($process.ExitCode -ne 0) { throw "Installer failed: $($process.ExitCode)" }
    foreach ($file in @('BardForge Studio.exe', 'resources\app.asar', 'snapshot_blob.bin', 'v8_context_snapshot.bin', 'resources.pak')) {
        $expected = Get-Sha256 (Join-Path $workspace "build\win-unpacked\$file")
        $actual = Get-Sha256 (Join-Path $installDir $file)
        if ($expected -ne $actual) { throw "Installed file differs: $file" }
    }
    $env:BARDFORGE_TEST_EXE = Join-Path $installDir 'BardForge Studio.exe'
    & node scripts/desktop-smoke.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Installed application smoke test failed' }
    Write-Output 'PASS: real NSIS installation, installed file integrity, playback and scene persistence.'
} finally {
    # Uninstall only the new installation inside this workspace, never a user installation.
    if ((Test-Path -LiteralPath $uninstaller) -and $installDir.StartsWith($workspace + '\tmp\')) {
        $process = Start-Process -FilePath $uninstaller -ArgumentList @('/S', '/currentuser', "_?=$installDir") -WindowStyle Hidden -PassThru -Wait
        if ($process.ExitCode -ne 0 -or (Test-Path -LiteralPath (Join-Path $installDir 'BardForge Studio.exe'))) { throw 'Test uninstallation failed' }
        Write-Output 'PASS: NSIS uninstallation removed the test application.'
    }
}
