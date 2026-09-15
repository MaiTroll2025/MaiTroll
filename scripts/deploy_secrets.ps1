# Deploys server-side secrets from .env to Supabase Edge Functions.
# Reads secret values from the local .env file at runtime so no secrets are hardcoded here.

$projectRef = "gejtbllazzighxwxudyu"
$envFile = ".env"

# Server-side secrets to deploy.
# Excludes VITE_ (client-side) vars and non-secret config like URLs/keys used by the browser.
$secretKeys = @(
    "SUPABASE_SERVICE_ROLE_KEY",
    "LIVEKIT_API_SECRET",
    "MUX_TOKEN_SECRET",
    "AGORA_APP_CERTIFICATE",
    "PAYPAL_CLIENT_SECRET",
    "VAPID_PUBLIC_KEY",
    "VAPID_PRIVATE_KEY",
    "MAI_CITY_PROMO_SECRET",
    "PRINTFUL_API_KEY"
)

# Load .env into a lookup table.
$envVars = @{}
Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
        $idx = $line.IndexOf("=")
        $key = $line.Substring(0, $idx).Trim()
        $val = $line.Substring($idx + 1).Trim()
        $envVars[$key] = $val
    }
}

$success = 0
$failed = 0

foreach ($key in $secretKeys) {
    if ($envVars.ContainsKey($key)) {
        Write-Host "Deploying $key..."
        $result = supabase functions secrets set "$key=$($envVars[$key])" --project-ref $projectRef --yes 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  OK: $key"
            $success++
        } else {
            Write-Host "  FAILED: $key"
            Write-Host $result
            $failed++
        }
    } else {
        Write-Host "  SKIP: $key not found in .env"
    }
}

Write-Host "Secrets deployment complete: $success succeeded, $failed failed"
