$ErrorActionPreference = "Stop"
$demo = Split-Path $PSScriptRoot -Parent
$mdPath = Join-Path $demo "yuqi_reason_tags_merged_v1_1_with_flag.md"
$outPath = Join-Path $demo "mock-data\overdue_reason_tags.yaml"

function Escape-Yaml([string]$s) {
    if ($null -eq $s) { return '""' }
    $t = $s.Replace('\', '\\').Replace('"', '\"')
    return '"' + $t + '"'
}

$lines = Get-Content $mdPath -Encoding UTF8
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine('version: "1.1"')
[void]$sb.AppendLine('source: yuqi_reason_tags_merged_v1_1_with_flag.md')
[void]$sb.AppendLine('tags:')

$count = 0
foreach ($line in $lines) {
    if (-not $line.StartsWith('|')) { continue }
    $cells = ($line -split '\|') | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' }
    if ($cells.Count -lt 11) { continue }
    if ($cells[0] -match '^:?-+$') { continue }
    if ($cells[1] -notmatch '^[A-Z][A-Z0-9_]+$') { continue }

    $kwList = ($cells[3] -split ',') | ForEach-Object { $_.Trim() } | Where-Object { $_ }
    $rt = if ($cells[10] -eq 'Y') { 'true' } else { 'false' }
    $ri = $cells[6]
    if ($ri -eq '--') { $ri = 'mid' }

    [void]$sb.AppendLine('  - category: ' + $cells[0])
    [void]$sb.AppendLine('    code: ' + $cells[1])
    [void]$sb.AppendLine('    name: ' + $cells[2])
    [void]$sb.AppendLine('    keywords:')
    foreach ($kw in $kwList) {
        [void]$sb.AppendLine('      - ' + $kw)
    }
    [void]$sb.AppendLine('    dpd_hint: ' + $cells[4])
    [void]$sb.AppendLine('    loan_purpose: ' + $cells[5])
    [void]$sb.AppendLine('    risk_intensity: ' + $ri)
    [void]$sb.AppendLine('    script_open: ' + (Escape-Yaml $cells[7]))
    [void]$sb.AppendLine('    script_empathy: ' + (Escape-Yaml $cells[8]))
    [void]$sb.AppendLine('    script_solution: ' + (Escape-Yaml $cells[9]))
    [void]$sb.AppendLine('    realtime_priority: ' + $rt)
    $count++
}

$utf8 = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($outPath, $sb.ToString(), $utf8)
Write-Host ('Wrote ' + $count + ' tags')
