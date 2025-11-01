# Update Vault Factory with Fixed WASM (slippage calculation fix)

$ErrorActionPreference = "Stop"

Write-Host "🔄 Updating Vault Factory with fixed vault WASM..." -ForegroundColor Cyan

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
$FACTORY_ADDRESS = $env:VAULT_FACTORY_CONTRACT_ID
$NETWORK = "testnet"

if (-not $DEPLOYER_SECRET) {
    Write-Host "❌ DEPLOYER_SECRET_KEY not found in .env" -ForegroundColor Red
    exit 1
}

if (-not $FACTORY_ADDRESS) {
    Write-Host "❌ VAULT_FACTORY_CONTRACT_ID not found in .env" -ForegroundColor Red
    exit 1
}

# The new WASM hash from the build output
$NEW_WASM_HASH = "b47cbf18417b866b73b122e4bb77e12a0ebed79b6d564d8bc87c57e6442d6ff1"

Write-Host "`n📦 New WASM Hash: $NEW_WASM_HASH" -ForegroundColor Yellow
Write-Host "   Factory Address: $FACTORY_ADDRESS" -ForegroundColor Gray
Write-Host "   Network: $NETWORK" -ForegroundColor Gray

# Get deployer address for authorization
$DEPLOYER_ADDRESS = stellar keys address deployer 2>$null
if (-not $DEPLOYER_ADDRESS) {
    Write-Host "❌ Could not get deployer address. Make sure 'deployer' key exists." -ForegroundColor Red
    Write-Host "   Run: stellar keys generate deployer --network $NETWORK" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n🔐 Deployer Address: $DEPLOYER_ADDRESS" -ForegroundColor Gray

# Update the factory with new WASM hash
Write-Host "`n🏭 Calling update_wasm on factory..." -ForegroundColor Yellow

$result = stellar contract invoke `
    --id $FACTORY_ADDRESS `
    --source deployer `
    --network $NETWORK `
    -- `
    update_wasm `
    --admin $DEPLOYER_ADDRESS `
    --new_wasm_hash $NEW_WASM_HASH 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to update factory:" -ForegroundColor Red
    Write-Host $result -ForegroundColor Red
    exit 1
}

Write-Host "✅ Factory updated successfully!" -ForegroundColor Green
Write-Host "`n📝 Summary:" -ForegroundColor Cyan
Write-Host "   • Fixed slippage calculation bug in rebalance logic" -ForegroundColor White
Write-Host "   • Changed from using target diff to using pool quote" -ForegroundColor White
Write-Host "   • Increased slippage tolerance from 1% to 5%" -ForegroundColor White
Write-Host "   • New vaults will use the fixed contract" -ForegroundColor White
Write-Host "`n✨ You can now create new vaults with the fixed contract!" -ForegroundColor Green
