# Deploy Mock Staking Pool to Stellar Testnet

Write-Host "Deploying Mock Staking Pool..." -ForegroundColor Cyan

# Load environment variables from .env file if it exists
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match '^([^#].+?)=(.*)$') {
            [Environment]::SetEnvironmentVariable($matches[1], $matches[2])
        }
    }
}

# Check required environment variables
$SOURCE_ACCOUNT = $env:DEPLOYER_SECRET_KEY
$NETWORK = if ($env:NETWORK) { $env:NETWORK } else { "testnet" }

if (-not $SOURCE_ACCOUNT) {
    Write-Host "Error: DEPLOYER_SECRET_KEY not found in .env" -ForegroundColor Red
    Write-Host "`nPlease create a .env file with:" -ForegroundColor Yellow
    Write-Host "DEPLOYER_SECRET_KEY=<your-secret-key>" -ForegroundColor Yellow
    exit 1
}

$WASM_PATH = "target/wasm32-unknown-unknown/release/mock_staking_pool.optimized.wasm"

Write-Host "Deploying contract..." -ForegroundColor Yellow

# Deploy the contract
$deployOutput = stellar contract deploy `
    --wasm $WASM_PATH `
    --source $SOURCE_ACCOUNT `
    --network $NETWORK 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error deploying contract:" -ForegroundColor Red
    Write-Host $deployOutput
    exit 1
}

$STAKING_POOL_ID = $deployOutput | Select-String -Pattern "^C[A-Z0-9]{55}$" | ForEach-Object { $_.Matches[0].Value }

if (-not $STAKING_POOL_ID) {
    Write-Host "Error: Could not extract contract ID from deployment output" -ForegroundColor Red
    Write-Host "Output was:" -ForegroundColor Red
    Write-Host $deployOutput
    exit 1
}

Write-Host "`n✓ Mock Staking Pool deployed!" -ForegroundColor Green
Write-Host "Contract ID: $STAKING_POOL_ID" -ForegroundColor Cyan

# Get XLM token address from DEX_ADDRESSES.env
$xlmAddress = $null
if (Test-Path "DEX_ADDRESSES.env") {
    $content = Get-Content "DEX_ADDRESSES.env" | Where-Object { $_ -match '^XLM_ADDRESS=' }
    if ($content) {
        $xlmAddress = $content -replace '^XLM_ADDRESS=', ''
        Write-Host "XLM Token Address (from DEX_ADDRESSES.env): $xlmAddress" -ForegroundColor Cyan
    }
}

if (-not $xlmAddress) {
    # Default XLM address for testnet
    $xlmAddress = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"
    Write-Host "Using default XLM Token Address: $xlmAddress" -ForegroundColor Cyan
}

Write-Host "`nInitializing staking pool with XLM token..." -ForegroundColor Yellow

# Initialize the staking pool
$initOutput = stellar contract invoke `
    --id $STAKING_POOL_ID `
    --source $SOURCE_ACCOUNT `
    --network $NETWORK `
    -- `
    initialize `
    --token $xlmAddress 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error initializing staking pool:" -ForegroundColor Red
    Write-Host $initOutput
    exit 1
}

Write-Host "✓ Staking pool initialized!" -ForegroundColor Green

# Save the address to a file
$outputContent = @"
# Mock Staking Pool Deployment
# Network: $NETWORK
# Deployed: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

STAKING_POOL_ADDRESS=$STAKING_POOL_ID
XLM_TOKEN_ADDRESS=$xlmAddress

# To use this in your vault deployment:
# 1. Copy the STAKING_POOL_ADDRESS above
# 2. Update backend/src/services/vaultDeploymentService.ts line 539
# 3. Redeploy your vault with the new staking pool address
"@

$outputContent | Out-File -FilePath "MOCK_STAKING_POOL.env" -Encoding UTF8

Write-Host "`n✓ Deployment information saved to MOCK_STAKING_POOL.env" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Copy the STAKING_POOL_ADDRESS: $STAKING_POOL_ID" -ForegroundColor White
Write-Host "2. Update backend/src/services/vaultDeploymentService.ts (line 539)" -ForegroundColor White
Write-Host "3. Redeploy your vault to use the new staking pool" -ForegroundColor White
Write-Host "`nThe mock staking pool accepts XLM deposits with a 1:1 staking ratio." -ForegroundColor Cyan
