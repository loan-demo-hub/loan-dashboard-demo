# 本地静态服务 + LongCat API 代理（无需 Python / Node）
# 用法:
#   $env:LONGCAT_API_KEY = "你的密钥"
#   powershell -ExecutionPolicy Bypass -File server.ps1
# 或双击 start-server.bat

$ErrorActionPreference = "Stop"
$Port = if ($env:PORT) { [int]$env:PORT } else { 8765 }
$Root = $PSScriptRoot
$LongCatOpenAiUrl = "https://api.longcat.chat/openai/v1/chat/completions"
$LongCatAnthropicUrl = "https://api.longcat.chat/anthropic/v1/messages"
$EnvApiKey = $env:LONGCAT_API_KEY

function Add-CorsHeaders([System.Net.HttpListenerResponse]$Response) {
    $Response.Headers["Access-Control-Allow-Origin"] = "*"
    $Response.Headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    $Response.Headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
}

function Send-JsonResponse([System.Net.HttpListenerResponse]$Response, [int]$StatusCode, [object]$Payload) {
    Add-CorsHeaders $Response
    $json = $Payload | ConvertTo-Json -Depth 6 -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    $Response.StatusCode = $StatusCode
    $Response.ContentType = "application/json; charset=utf-8"
    $Response.ContentLength64 = $bytes.Length
    $Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $Response.OutputStream.Close()
}

function Get-MimeType([string]$Path) {
    switch ([IO.Path]::GetExtension($Path).ToLower()) {
        ".html" { return "text/html; charset=utf-8" }
        ".css"  { return "text/css; charset=utf-8" }
        ".js"   { return "application/javascript; charset=utf-8" }
        ".yaml" { return "text/yaml; charset=utf-8" }
        ".yml"  { return "text/yaml; charset=utf-8" }
        ".json" { return "application/json; charset=utf-8" }
        ".svg"  { return "image/svg+xml" }
        ".png"  { return "image/png" }
        default { return "application/octet-stream" }
    }
}

function Invoke-UpstreamPost([string]$Url, [string]$Body, [string]$Auth, [hashtable]$ExtraHeaders) {
    $request = [System.Net.HttpWebRequest]::Create($Url)
    $request.Method = "POST"
    $request.ContentType = "application/json; charset=utf-8"
    $request.Timeout = 120000
    $request.Headers.Add("Authorization", $Auth)

    if ($ExtraHeaders) {
        foreach ($key in $ExtraHeaders.Keys) {
            $request.Headers.Add($key, $ExtraHeaders[$key])
        }
    }

    $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($Body)
    $request.ContentLength = $bodyBytes.Length
    $reqStream = $request.GetRequestStream()
    $reqStream.Write($bodyBytes, 0, $bodyBytes.Length)
    $reqStream.Close()

    try {
        $response = $request.GetResponse()
        $reader = New-Object System.IO.StreamReader($response.GetResponseStream(), [System.Text.Encoding]::UTF8)
        $text = $reader.ReadToEnd()
        $reader.Close()
        $response.Close()
        return @{ StatusCode = [int]$response.StatusCode; Body = $text }
    } catch [System.Net.WebException] {
        $http = $_.Exception.Response
        if ($http) {
            $reader = New-Object System.IO.StreamReader($http.GetResponseStream(), [System.Text.Encoding]::UTF8)
            $text = $reader.ReadToEnd()
            $reader.Close()
            return @{ StatusCode = [int]$http.StatusCode; Body = $text }
        }
        throw
    }
}

function Write-UpstreamResponse([System.Net.HttpListenerResponse]$Response, [int]$StatusCode, [string]$Body) {
    if ([string]::IsNullOrEmpty($Body)) { $Body = "{}" }
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Body)
    Add-CorsHeaders $Response
    $Response.StatusCode = $StatusCode
    $Response.ContentType = "application/json; charset=utf-8"
    $Response.ContentLength64 = $bytes.Length
    $Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $Response.OutputStream.Close()
}

function Proxy-LongCat([System.Net.HttpListenerContext]$Context, [string]$UpstreamUrl, [hashtable]$ExtraHeaders) {
    $Request = $Context.Request
    $Response = $Context.Response

    $reader = New-Object System.IO.StreamReader($Request.InputStream, [System.Text.Encoding]::UTF8)
    $body = $reader.ReadToEnd()
    $reader.Close()

    $auth = $Request.Headers["Authorization"]
    if (-not $auth -and $EnvApiKey) {
        $auth = "Bearer $EnvApiKey"
    }

    if (-not $auth) {
        Send-JsonResponse $Response 401 @{ error = @{ message = "Missing API Key. Set LONGCAT_API_KEY or enter key in UI." } }
        return
    }

    try {
        $result = Invoke-UpstreamPost -Url $UpstreamUrl -Body $body -Auth $auth -ExtraHeaders $ExtraHeaders
        Write-UpstreamResponse -Response $Response -StatusCode $result.StatusCode -Body $result.Body
    } catch {
        Send-JsonResponse $Response 502 @{ error = @{ message = $_.Exception.Message } }
    }
}

function Serve-Static([System.Net.HttpListenerContext]$Context) {
    $Response = $Context.Response
    $path = $Context.Request.Url.LocalPath
    if ($path -eq "/") { $path = "/index.html" }

    $relative = $path.TrimStart("/") -replace "/", [IO.Path]::DirectorySeparatorChar
    $file = [IO.Path]::GetFullPath((Join-Path $Root $relative))

    if (-not $file.StartsWith($Root, [StringComparison]::OrdinalIgnoreCase)) {
        $Response.StatusCode = 403
        $Response.Close()
        return
    }

    if (Test-Path $file -PathType Leaf) {
        $bytes = [IO.File]::ReadAllBytes($file)
        Add-CorsHeaders $Response
        $Response.StatusCode = 200
        $Response.ContentType = Get-MimeType $file
        $Response.ContentLength64 = $bytes.Length
        $Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
        $Response.StatusCode = 404
    }
    $Response.OutputStream.Close()
}

function Test-ServerAlive([int]$CheckPort) {
    try {
        $resp = Invoke-WebRequest -Uri "http://127.0.0.1:$CheckPort/" -UseBasicParsing -TimeoutSec 2
        return $resp.StatusCode -eq 200
    } catch {
        return $false
    }
}

function Start-ListenerOnPort([int]$StartPort) {
    for ($p = $StartPort; $p -lt ($StartPort + 10); $p++) {
        if (Test-ServerAlive $p) {
            Write-Host ""
            Write-Host "Server is already running." -ForegroundColor Yellow
            Write-Host "  Open: http://127.0.0.1:$p"
            Write-Host "  Close the other server window (Ctrl+C) before starting again."
            Write-Host ""
            exit 0
        }

        $listener = New-Object System.Net.HttpListener
        $listener.Prefixes.Add("http://127.0.0.1:$p/")
        try {
            $listener.Start()
            return @{ Listener = $listener; Port = $p }
        } catch {
            $listener.Close()
        }
    }

    Write-Host ""
    Write-Host "Cannot bind ports $StartPort-$($StartPort + 9)." -ForegroundColor Red
    Write-Host "Close other server windows, wait a few seconds, then retry."
    Write-Host ""
    exit 1
}

$started = Start-ListenerOnPort $Port
$listener = $started.Listener
$Port = $started.Port

$keyHint = if ($EnvApiKey) { "configured" } else { "not set (enter key in UI)" }
Write-Host ""
Write-Host "Loan dashboard server started" -ForegroundColor Green
Write-Host "  Page:  http://127.0.0.1:$Port"
Write-Host "  Proxy: http://127.0.0.1:$Port/api/longcat/v1/chat/completions"
Write-Host "         http://127.0.0.1:$Port/api/longcat/v1/messages"
Write-Host "  LONGCAT_API_KEY: $keyHint"
Write-Host "  Press Ctrl+C to stop"
Write-Host ""

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $method = $context.Request.HttpMethod
        $path = $context.Request.Url.LocalPath

        if ($method -eq "OPTIONS") {
            Add-CorsHeaders $context.Response
            $context.Response.StatusCode = 204
            $context.Response.Close()
            continue
        }

        if ($method -eq "POST" -and $path -eq "/api/longcat/v1/chat/completions") {
            Proxy-LongCat $context $LongCatOpenAiUrl $null
            continue
        }

        if ($method -eq "POST" -and $path -eq "/api/longcat/v1/messages") {
            Proxy-LongCat $context $LongCatAnthropicUrl @{ "anthropic-version" = "2023-06-01" }
            continue
        }

        if ($method -eq "GET") {
            Serve-Static $context
            continue
        }

        $context.Response.StatusCode = 405
        $context.Response.Close()
    }
} finally {
    $listener.Stop()
}
