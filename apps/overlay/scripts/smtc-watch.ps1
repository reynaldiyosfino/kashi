# Persistent SMTC poller for the Kashi overlay. Prints one JSON array per tick.
# PowerShell 5.1 cannot call AsTask(IAsyncOperation) without a generic method.
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Runtime.WindowsRuntime | Out-Null
$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
$asTaskGeneric = [System.WindowsRuntimeSystemExtensions].GetMethods() |
  Where-Object {
    $_.Name -eq 'AsTask' -and
    $_.IsGenericMethod -and
    $_.GetParameters().Count -eq 1
  } |
  Select-Object -First 1
if (-not $asTaskGeneric) { throw 'AsTask generic not found' }

function Await-WinRt($op, [type]$resultType) {
  if ($null -eq $op) { return $null }
  $asTask = $asTaskGeneric.MakeGenericMethod($resultType)
  $netTask = $asTask.Invoke($null, @($op))
  if (-not $netTask.Wait(1500)) { return $null }
  return $netTask.Result
}

$mgrType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]
$propsType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties]

while ($true) {
  try {
    $mgr = Await-WinRt ($mgrType::RequestAsync()) $mgrType
    $rows = @()
    if ($mgr) {
      foreach ($s in $mgr.GetSessions()) {
        $info = Await-WinRt ($s.TryGetMediaPropertiesAsync()) $propsType
        $tl = $s.GetTimelineProperties()
        $pb = $s.GetPlaybackInfo()
        $status = ''
        if ($pb) { $status = [string]$pb.PlaybackStatus }
        $pos = 0; $dur = 0
        if ($tl) {
          $pos = [int]$tl.Position.TotalMilliseconds
          $dur = [int]$tl.EndTime.TotalMilliseconds
        }
        $rows += [pscustomobject]@{
          appId = [string]$s.SourceAppUserModelId
          title = [string]$(if ($info) { $info.Title } else { '' })
          artist = [string]$(if ($info) { $info.Artist } else { '' })
          album = [string]$(if ($info) { $info.AlbumTitle } else { '' })
          status = $status
          positionMs = $pos
          durationMs = $dur
        }
      }
    }
    $json = @($rows) | ConvertTo-Json -Compress -Depth 4
    if (-not $json) { $json = '[]' }
    if ($json.StartsWith('{')) { $json = '[' + $json + ']' }
    [Console]::Out.WriteLine($json)
    [Console]::Out.Flush()
  } catch {
    [Console]::Error.WriteLine(('smtc: ' + $_.Exception.Message))
    [Console]::Out.WriteLine('[]')
    [Console]::Out.Flush()
  }
  Start-Sleep -Milliseconds 400
}
