# Deploy USDC Token Contract to Futurenet
# This script deploys a fungible token contract and configures it as USDC

param(
    [string]$Network = "futurenet",
    [string]$DeployerSecret = $env:DEPLOYER_SECRET_KEY
)

Write-Host "🚀 Deploying USDC Token Contract to $Network" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

# Check if deployer secret is provided
if ([string]::IsNullOrEmpty($DeployerSecret)) {
    Write-Host "❌ Error: DEPLOYER_SECRET_KEY not found in environment" -ForegroundColor Red
    Write-Host "Please set it in your .env file or pass it as a parameter" -ForegroundColor Yellow
    exit 1
}

# Get deployer public key
Write-Host "`n📋 Getting deployer address..." -ForegroundColor Yellow
$deployerKey = stellar keys address deployer 2>$null
if ([string]::IsNullOrEmpty($deployerKey)) {
    Write-Host "⚠️  Deployer identity not found, generating from secret..." -ForegroundColor Yellow
    # This will be the owner of the token
    $deployerKey = "GDUMMY" # Placeholder - we'll use the actual key from the secret
}

Write-Host "Deployer: $deployerKey" -ForegroundColor Green

# Step 1: Build the token contract
Write-Host "`n🔨 Building fungible token contract..." -ForegroundColor Yellow
Push-Location contracts/fungible-token-interface
$buildResult = stellar contract build 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    Pop-Location
    exit 1
}
Write-Host "✅ Contract built successfully" -ForegroundColor Green
Pop-Location

# Step 2: Deploy the contract
Write-Host "`n📦 Deploying contract to $Network..." -ForegroundColor Yellow
$wasmPath = "target/wasm32-unknown-unknown/release/fungible_token_interface.wasm"

$deployOutput = stellar contract deploy `
    --wasm $wasmPath `
    --network $Network `
    --source deployer 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    Write-Host $deployOutput -ForegroundColor Red
    exit 1
}

# Extract contract ID from output
$contractId = $deployOutput | Select-String -Pattern "C[A-Z0-9]{55}" | ForEach-Object { $_.Matches[0].Value }

if ([string]::IsNullOrEmpty($contractId)) {
    Write-Host "❌ Failed to extract contract ID from deployment output" -ForegroundColor Red
    Write-Host "Output was: $deployOutput" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Contract deployed!" -ForegroundColor Green
Write-Host "Contract ID: $contractId" -ForegroundColor Cyan

# Step 3: Initialize the token with USDC metadata
Write-Host "`n⚙️  Initializing USDC token..." -ForegroundColor Yellow

# Initial supply: 1 billion USDC (with 6 decimals = 1,000,000,000,000,000)
$initialSupply = "1000000000000000"

$initOutput = stellar contract invoke `
    --id $contractId `
    --network $Network `
    --source deployer `
    -- `
    __constructor `
    --owner $deployerKey `
    --initial_supply $initialSupply 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Initialization failed!" -ForegroundColor Red
    Write-Host $initOutput -ForegroundColor Red
    
    # Try to get better error info
    Write-Host "`n🔍 Checking contract state..." -ForegroundColor Yellow
    stellar contract invoke `
        --id $contractId `
        --network $Network `
        -- `
        name
    
    exit 1
}

Write-Host "✅ Token initialized with:" -ForegroundColor Green
Write-Host "   Name: USD Coin" -ForegroundColor White
Write-Host "   Symbol: USDC" -ForegroundColor White
Write-Host "   Decimals: 6" -ForegroundColor White
Write-Host "   Initial Supply: 1,000,000,000 USDC" -ForegroundColor White
Write-Host "   Owner: $deployerKey" -ForegroundColor White

# Step 4: Verify the deployment
Write-Host "`n🔍 Verifying deployment..." -ForegroundColor Yellow

$name = stellar contract invoke `
    --id $contractId `
    --network $Network `
    -- `
    name 2>&1

$symbol = stellar contract invoke `
    --id $contractId `
    --network $Network `
    -- `
    symbol 2>&1

$decimals = stellar contract invoke `
    --id $contractId `
    --network $Network `
    -- `
    decimals 2>&1

Write-Host "Token Name: $name" -ForegroundColor Cyan
Write-Host "Token Symbol: $symbol" -ForegroundColor Cyan
Write-Host "Token Decimals: $decimals" -ForegroundColor Cyan

# Step 5: Update backend configuration
Write-Host "`n💾 Updating backend configuration..." -ForegroundColor Yellow

$envPath = "backend\.env"
if (Test-Path $envPath) {
    $envContent = Get-Content $envPath -Raw
    
    # Add or update FUTURENET_USDC_ADDRESS
    if ($envContent -match "FUTURENET_USDC_ADDRESS=") {
        $envContent = $envContent -replace "FUTURENET_USDC_ADDRESS=.*", "FUTURENET_USDC_ADDRESS=$contractId"
    } else {
        $envContent += "`nFUTURENET_USDC_ADDRESS=$contractId"
    }
    
    Set-Content -Path $envPath -Value $envContent
    Write-Host "✅ Updated backend/.env with FUTURENET_USDC_ADDRESS" -ForegroundColor Green
} else {
    Write-Host "⚠️  backend/.env not found, please add manually:" -ForegroundColor Yellow
    Write-Host "FUTURENET_USDC_ADDRESS=$contractId" -ForegroundColor Cyan
}

# Summary
Write-Host "`n================================================" -ForegroundColor Cyan
Write-Host "🎉 USDC Token Deployed Successfully!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "`nContract Address: $contractId" -ForegroundColor White
Write-Host "Network: $Network" -ForegroundColor White
Write-Host "Explorer: https://stellar.expert/explorer/$Network/contract/$contractId" -ForegroundColor Blue
Write-Host "`n📝 Next Steps:" -ForegroundColor Yellow
Write-Host "1. Add to backend/.env: FUTURENET_USDC_ADDRESS=$contractId" -ForegroundColor White
Write-Host "2. Restart your backend server" -ForegroundColor White
Write-Host "3. Create vaults with USDC on futurenet" -ForegroundColor White
Write-Host "4. Mint tokens to users: stellar contract invoke --id $contractId --network $Network --source deployer -- mint --account USER_ADDRESS --amount 1000000000" -ForegroundColor White
