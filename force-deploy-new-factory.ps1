# Force deploy a brand new factory with updated WASM

$ErrorActionPreference = "Stop"

Write-Host "🚀 Force New Factory Deployment" -ForegroundColor Cyan
Write-Host "================================`n" -ForegroundColor Cyan

# Load environment variables
if (Test-Path .env) {
    Get-Content .env | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]*?)\s*=\s*(.*?)\s*$') {
            $name = $matches[1]
            $value = $matches[2]
            [Environment]::SetEnvironmentVariable($name, $value)
        }
    }
}

$DEPLOYER_SECRET = $env:DEPLOYER_SECRET_KEY
$NETWORK = "testnet"

if (-not $DEPLOYER_SECRET) {
    Write-Host "❌ DEPLOYER_SECRET_KEY not found in .env" -ForegroundColor Red
    exit 1
}

# Get deployer address
$DEPLOYER_ADDRESS = stellar keys address $DEPLOYER_SECRET 2>$null

Write-Host "👤 Deployer: $DEPLOYER_ADDRESS" -ForegroundColor Gray
Write-Host "🌐 Network: $NETWORK`n" -ForegroundColor Gray

# Step 1: Build and install Vault WASM
Write-Host "📦 Step 1: Building and installing Vault WASM..." -ForegroundColor Yellow

stellar contract build --package syft-vault

$vaultWasmPath = "target\wasm32-unknown-unknown\release\syft_vault.wasm"

$vaultWasmHash = stellar contract install `
    --wasm $vaultWasmPath `
    --network $NETWORK `
    --source $DEPLOYER_SECRET 2>&1 | Select-String -Pattern "^[A-Fa-f0-9]{64}$" | ForEach-Object { $_.Matches[0].Value }

if (-not $vaultWasmHash) {
    Write-Host "❌ Failed to install vault WASM" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Vault WASM Hash: $vaultWasmHash`n" -ForegroundColor Green

# Step 2: Build and deploy NEW factory
Write-Host "🏭 Step 2: Deploying BRAND NEW factory..." -ForegroundColor Yellow

stellar contract build --package vault-factory

$factoryWasmPath = "target\wasm32-unknown-unknown\release\vault_factory.wasm"

# Deploy factory
$FACTORY_ADDRESS = stellar contract deploy `
    --wasm $factoryWasmPath `
    --network $NETWORK `
    --source $DEPLOYER_SECRET 2>&1 | Select-String -Pattern "^C[A-Z0-9]{55}$" | ForEach-Object { $_.Matches[0].Value }

if (-not $FACTORY_ADDRESS) {
    Write-Host "❌ Failed to deploy factory" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Factory deployed: $FACTORY_ADDRESS" -ForegroundColor Green

# Initialize factory
Write-Host "   Initializing factory..." -ForegroundColor Gray
$initResult = stellar contract invoke `
    --id $FACTORY_ADDRESS `
    --network $NETWORK `
    --source $DEPLOYER_SECRET `
    -- initialize `
    --admin $DEPLOYER_ADDRESS `
    --wasm_hash $vaultWasmHash 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to initialize factory:" -ForegroundColor Red
    Write-Host $initResult -ForegroundColor Red
    exit 1
}

Write-Host "✅ Factory initialized`n" -ForegroundColor Green

# Step 3: Update .env files
Write-Host "💾 Step 3: Updating .env files..." -ForegroundColor Yellow

# Update root .env
if (Test-Path .env) {
    $envContent = Get-Content .env
    if ($envContent -match "VAULT_FACTORY_CONTRACT_ID=") {
        $envContent = $envContent -replace "VAULT_FACTORY_CONTRACT_ID=.*", "VAULT_FACTORY_CONTRACT_ID=$FACTORY_ADDRESS"
    } else {
        $envContent += "`nVAULT_FACTORY_CONTRACT_ID=$FACTORY_ADDRESS"
    }
    Set-Content .env $envContent
    Write-Host "✅ Root .env updated" -ForegroundColor Green
}

# Update backend/.env
if (Test-Path backend\.env) {
    $backendEnvContent = Get-Content backend\.env
    if ($backendEnvContent -match "VAULT_FACTORY_CONTRACT_ID=") {
        $backendEnvContent = $backendEnvContent -replace "VAULT_FACTORY_CONTRACT_ID=.*", "VAULT_FACTORY_CONTRACT_ID=$FACTORY_ADDRESS"
    } else {
        $backendEnvContent += "`nVAULT_FACTORY_CONTRACT_ID=$FACTORY_ADDRESS"
    }
    Set-Content backend\.env $backendEnvContent
    Write-Host "✅ Backend .env updated" -ForegroundColor Green
}

Write-Host ""

# Summary
Write-Host "═══════════════════════════════════" -ForegroundColor Cyan
Write-Host "🎉 NEW Factory Deployed!" -ForegroundColor Green
Write-Host "═══════════════════════════════════" -ForegroundColor Cyan
Write-Host "Network:          $NETWORK" -ForegroundColor White
Write-Host "Vault WASM Hash:  $vaultWasmHash" -ForegroundColor White
Write-Host "Factory Address:  $FACTORY_ADDRESS" -ForegroundColor White
Write-Host "`n📝 Next Steps:" -ForegroundColor Cyan
Write-Host "   1. RESTART your backend server" -ForegroundColor Yellow
Write-Host "   2. CREATE a brand new vault" -ForegroundColor Yellow
Write-Host "   3. Test the rebalance with debug events" -ForegroundColor Yellow
Write-Host "`nView factory on explorer:" -ForegroundColor Cyan
Write-Host "   https://stellar.expert/explorer/$NETWORK/contract/$FACTORY_ADDRESS" -ForegroundColor Blue
Write-Host ""
