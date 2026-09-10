param(
    [ValidateRange(1, 100)][int]$MaxPages = 25,
    [string]$ListingUrl
)
$ErrorActionPreference = 'Stop'
Push-Location (Split-Path $PSScriptRoot -Parent)
$previousNodeOptions = $env:NODE_OPTIONS
try {
    # Refresh the short-lived project token without overwriting .env.local.
    $env:NODE_OPTIONS = "$previousNodeOptions --use-system-ca".Trim()
    npx --yes vercel@58.1.0 env pull .vercel/.env.listing-review --yes
    if ($LASTEXITCODE -ne 0) { throw 'Vercel authentication refresh failed.' }
    if ($ListingUrl) {
        python scripts/ingest.py --review-url $ListingUrl
    } else {
        python scripts/ingest.py --discover --llm --max-review-pages $MaxPages
    }
    if ($LASTEXITCODE -ne 0) { throw 'Listing review failed.' }
} finally {
    $env:NODE_OPTIONS = $previousNodeOptions
    Pop-Location
}
