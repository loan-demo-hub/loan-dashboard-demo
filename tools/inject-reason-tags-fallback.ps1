$ErrorActionPreference = "Stop"
$demo = Split-Path $PSScriptRoot -Parent
$yamlPath = Join-Path $demo "mock-data\overdue_reason_tags.yaml"
$fallbackPath = Join-Path $demo "js\yamlFallback.js"

$yaml = [System.IO.File]::ReadAllText($yamlPath, [System.Text.UTF8Encoding]::new($false))
$escaped = $yaml.Replace('\', '\\').Replace('`', '\`').Replace('${', '\${')

$content = [System.IO.File]::ReadAllText($fallbackPath, [System.Text.UTF8Encoding]::new($false))
$key = '"mock-data/overdue_reason_tags.yaml"'

if ($content -match [regex]::Escape($key)) {
    Write-Host "Fallback entry already exists, skipping inject"
    exit 0
}

$insert = "`n  $key" + ': `' + $escaped + '`,'
$content = $content -replace '\};\s*$', ($insert + "`n};")
$utf8 = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($fallbackPath, $content, $utf8)
Write-Host "Injected overdue_reason_tags.yaml into yamlFallback.js"
