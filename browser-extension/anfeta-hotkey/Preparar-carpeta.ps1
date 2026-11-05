# Copies only this extension into a permanent per-user folder. No browser settings changed.
$ErrorActionPreference = 'Stop'
$destination = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'ANFETA\Extension'))
$source = [IO.Path]::GetFullPath($PSScriptRoot)
$files = @('manifest.json','service-worker.js','options.html','options.js','whatsapp-sync.js','README.md')
foreach ($name in $files) {
  $item = Get-Item -LiteralPath (Join-Path $source $name)
  if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Source links are not allowed.' }
}
New-Item -ItemType Directory -Path $destination -Force | Out-Null
$dir = Get-Item -LiteralPath $destination
if ($dir.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Destination links are not allowed.' }
foreach ($name in $files) {
  $target = Join-Path $destination $name
  if (Test-Path -LiteralPath $target) {
    if ((Get-Item -LiteralPath $target).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Target links are not allowed.' }
  }
  if ($source -ne $destination) { Copy-Item -LiteralPath (Join-Path $source $name) -Destination $target -Force }
}
Write-Host "Prepared: $destination"
Write-Host 'Browser > Extensions > Load unpacked: select this folder. If already loaded from here, click Reload.'
Write-Host 'Do not delete or move this permanent folder. Configure the shortcut with Global scope.'
