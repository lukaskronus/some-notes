# --- Configuration ---
$ClientSecretsPath = "client_secrets.json"
$OutputFile = "youtube_credentials.json"
$Scopes = "https://www.googleapis.com/auth/youtube.force-ssl"
$RedirectUri = "http://localhost:8080/"

# 1. Load Client Secrets
if (-not (Test-Path $ClientSecretsPath)) {
    Write-Error "Could not find $ClientSecretsPath"
    return
}
$Secrets = Get-Content $ClientSecretsPath | ConvertFrom-Json
$ClientId = $Secrets.installed.client_id
$ClientSecret = $Secrets.installed.client_secret

# 2. Build Authorization URL
$AuthUrl = "https://accounts.google.com/o/oauth2/v2/auth?" + `
           "client_id=$ClientId&" + `
           "redirect_uri=$($RedirectUri -replace ':', '%3A' -replace '/', '%2F')&" + `
           "response_type=code&" + `
           "scope=$($Scopes -replace ':', '%3A' -replace '/', '%2F')&" + `
           "access_type=offline&prompt=consent"

# 3. Start Local Listener
$Listener = New-Object System.Net.HttpListener
$Listener.Prefixes.Add($RedirectUri)
$Listener.Start()

Write-Host "Opening browser for authentication..." -ForegroundColor Cyan
Start-Process $AuthUrl

# 4. Wait for Callback
$Context = $Listener.GetContext()
$Code = $Context.Request.QueryString["code"]

# Send 'Thank You' message to browser
$Response = $Context.Response
$ResponseString = "<html><body>Authentication successful! You can close this tab.</body></html>"
$Buffer = [System.Text.Encoding]::UTF8.GetBytes($ResponseString)
$Response.ContentLength64 = $Buffer.Length
$Response.OutputStream.Write($Buffer, 0, $Buffer.Length)
$Response.Close()
$Listener.Stop()

# 5. Exchange Code for Tokens
Write-Host "Exchanging code for tokens..." -ForegroundColor Yellow
$TokenParams = @{
    code          = $Code
    client_id     = $ClientId
    client_secret = $ClientSecret
    redirect_uri  = $RedirectUri
    grant_type    = "authorization_code"
}

$TokenResponse = Invoke-RestMethod -Method Post -Uri "https://oauth2.googleapis.com/token" -Body $TokenParams

# 6. Format and Save to youtube_credentials.json (Python Compatible Format)
$OutputJson = @{
    token           = $TokenResponse.access_token
    refresh_token   = $TokenResponse.refresh_token
    token_uri       = "https://oauth2.googleapis.com/token"
    client_id       = $ClientId
    client_secret   = $ClientSecret
    scopes          = @($Scopes)
    expiry          = (Get-Date).AddSeconds($TokenResponse.expires_in).ToString("yyyy-MM-ddTHH:mm:ssZ")
} | ConvertTo-Json

$OutputJson | Out-File -FilePath $OutputFile -Encoding utf8
Write-Host "Successfully created $OutputFile" -ForegroundColor Green
