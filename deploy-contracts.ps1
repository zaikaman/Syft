# Deploy or Update Vault Contracts

$ErrorActionPreference = "Stop"

Write-Host "🚀 Vault Contract Deployment Script" -ForegroundColor Cyan
Write-Host "===================================`n" -ForegroundColor Cyan

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
# Allow network to be passed as environment variable, default to futurenet
$NETWORK = if ($env:NETWORK) { $env:NETWORK } else { "testnet" }

# Force new factory deployment (comment this out to use update_wasm instead)
$FORCE_NEW_FACTORY = $true

# Get network-specific factory address
if ($NETWORK -eq "futurenet") {
    $EXISTING_FACTORY = if ($FORCE_NEW_FACTORY) { $null } else { $env:VAULT_FACTORY_CONTRACT_ID_FUTURENET }
} elseif ($NETWORK -eq "mainnet" -or $NETWORK -eq "public") {
    $EXISTING_FACTORY = if ($FORCE_NEW_FACTORY) { $null } else { $env:VAULT_FACTORY_CONTRACT_ID_MAINNET }
} else {
    $EXISTING_FACTORY = if ($FORCE_NEW_FACTORY) { $null } else { $env:VAULT_FACTORY_CONTRACT_ID }
}

if (-not $DEPLOYER_SECRET) {
    Write-Host "❌ DEPLOYER_SECRET_KEY not found in .env" -ForegroundColor Red
    exit 1
}

# Get deployer address
$DEPLOYER_ADDRESS = stellar keys address $DEPLOYER_SECRET 2>$null
if ($LASTEXITCODE -ne 0) {
    # Try as named identity
    $DEPLOYER_ADDRESS = stellar keys address deployer 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Could not get deployer address" -ForegroundColor Red
        exit 1
    }
}

Write-Host "👤 Deployer: $DEPLOYER_ADDRESS`n" -ForegroundColor Gray

# Step 1: Install Vault WASM
Write-Host "📦 Step 1: Installing Vault WASM..." -ForegroundColor Yellow
$vaultWasmPath = "target\wasm32v1-none\release\syft_vault.wasm"

if (-not (Test-Path $vaultWasmPath)) {
    Write-Host "   ⚠️  WASM not found, building..." -ForegroundColor Yellow
    stellar contract build --package syft-vault
}

$vaultWasmHash = stellar contract install `
    --wasm $vaultWasmPath `
    --network $NETWORK `
    --source $DEPLOYER_SECRET 2>&1 | Select-String -Pattern "^[A-Fa-f0-9]{64}$" | ForEach-Object { $_.Matches[0].Value }

if (-not $vaultWasmHash) {
    Write-Host "❌ Failed to install vault WASM" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Vault WASM Hash: $vaultWasmHash`n" -ForegroundColor Green

# Step 2: Deploy or Update Factory
if ($EXISTING_FACTORY) {
    Write-Host "🏭 Step 2: Updating existing factory..." -ForegroundColor Yellow
    Write-Host "   Factory Address: $EXISTING_FACTORY" -ForegroundColor Gray
    
    # Call update_wasm on existing factory
    $updateResult = stellar contract invoke `
        --id $EXISTING_FACTORY `
        --network $NETWORK `
        --source $DEPLOYER_SECRET `
        -- update_wasm `
        --admin $DEPLOYER_ADDRESS `
        --new_wasm_hash $vaultWasmHash 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to update factory:" -ForegroundColor Red
        Write-Host $updateResult -ForegroundColor Red
        Write-Host "`n   💡 Factory might not support update_wasm. Deploy new factory instead." -ForegroundColor Yellow
        exit 1
    }
    
    Write-Host "✅ Factory updated successfully`n" -ForegroundColor Green
    $FACTORY_ADDRESS = $EXISTING_FACTORY
} else {
    Write-Host "🏭 Step 2: Deploying new factory..." -ForegroundColor Yellow
    
    # Install factory WASM
    $factoryWasmPath = "target\wasm32v1-none\release\vault_factory.wasm"
    
    if (-not (Test-Path $factoryWasmPath)) {
        Write-Host "   ⚠️  Factory WASM not found, building..." -ForegroundColor Yellow
        stellar contract build --package vault-factory
    }
    
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
}

# Step 3: Update .env
Write-Host "💾 Step 3: Updating .env..." -ForegroundColor Yellow

$envContent = Get-Content .env
$updated = $false

# Determine which env variable to update based on network
$envVarName = if ($NETWORK -eq "futurenet") {
    "VAULT_FACTORY_CONTRACT_ID_FUTURENET"
} elseif ($NETWORK -eq "mainnet" -or $NETWORK -eq "public") {
    "VAULT_FACTORY_CONTRACT_ID_MAINNET"
} else {
    "VAULT_FACTORY_CONTRACT_ID"
}

# Update the appropriate factory contract ID
if ($envContent -match "$envVarName=") {
    $envContent = $envContent -replace "$envVarName=.*", "$envVarName=$FACTORY_ADDRESS"
} else {
    $envContent += "`n$envVarName=$FACTORY_ADDRESS"
}

Set-Content .env $envContent
Write-Host "✅ .env updated ($envVarName)`n" -ForegroundColor Green

# Summary
Write-Host "═══════════════════════════════════" -ForegroundColor Cyan
Write-Host "🎉 Deployment Complete!" -ForegroundColor Green
Write-Host "═══════════════════════════════════" -ForegroundColor Cyan
Write-Host "Network:          $NETWORK" -ForegroundColor White
Write-Host "Vault WASM Hash:  $vaultWasmHash" -ForegroundColor White
Write-Host "Factory Address:  $FACTORY_ADDRESS" -ForegroundColor White
Write-Host "`n📝 Next Steps:" -ForegroundColor Cyan
Write-Host "   1. Restart your backend server" -ForegroundColor White
Write-Host "   2. Create a new vault to test deposit/withdraw" -ForegroundColor White
Write-Host "`nView factory on explorer:" -ForegroundColor Cyan
$explorerUrl = "https://stellar.expert/explorer/$NETWORK/contract/$FACTORY_ADDRESS"
Write-Host "   $explorerUrl" -ForegroundColor Blue
Write-Host ""
