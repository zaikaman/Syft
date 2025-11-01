# Update existing vault contracts with new WASM that fixes rebalance authorization

$ErrorActionPreference = "Stop"

Write-Host "🔄 Updating existing vaults with fixed WASM..." -ForegroundColor Cyan

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

# 1. Install the new vault WASM and get the hash
Write-Host "`n📦 Installing fixed vault WASM..." -ForegroundColor Yellow
$wasmPath = "target\wasm32-unknown-unknown\release\syft_vault.wasm"

if (-not (Test-Path $wasmPath)) {
    Write-Host "❌ WASM file not found at: $wasmPath" -ForegroundColor Red
    Write-Host "   Run: cargo build --target wasm32-unknown-unknown --release --package syft-vault" -ForegroundColor Yellow
    exit 1
}

Write-Host "   Using WASM: $wasmPath" -ForegroundColor Gray

# Install WASM and capture the hash
$installOutput = stellar contract install `
    --wasm $wasmPath `
    --network $NETWORK `
    --source $DEPLOYER_SECRET 2>&1

# Extract WASM hash from output (it's the last 64-char hex string line)
$wasmHash = ""
foreach ($line in $installOutput) {
    if ($line -match '^[a-f0-9]{64}$') {
        $wasmHash = $line.Trim()
    }
}

if (-not $wasmHash) {
    Write-Host "❌ Could not extract WASM hash from install output" -ForegroundColor Red
    Write-Host "Output was:" -ForegroundColor Yellow
    $installOutput | ForEach-Object { Write-Host $_ }
    exit 1
}

Write-Host "✅ WASM installed with hash: $wasmHash" -ForegroundColor Green

# 2. Get list of vault contract IDs that need updating
Write-Host "`n📋 Getting vault contracts to update..." -ForegroundColor Yellow

# These are the vault contract IDs from your error logs
$vaultIds = @(
    "CCMHVUDYIO3H2L2NQKFLXZXRI3ANX6XCPKCRXH6JKJ66HOITSODKRQB3",
    "CAXUYNPTIXSJQORW35ULBRPNP6WD6SXHJOLZEYGPRCOAXT2IGRPCSSBW"
)

Write-Host "   Found $($vaultIds.Count) vaults to update" -ForegroundColor Gray

# 3. Update each vault contract
foreach ($vaultId in $vaultIds) {
    Write-Host "`n🔧 Updating vault: $vaultId" -ForegroundColor Yellow
    
    try {
        $updateOutput = stellar contract invoke `
            --id $vaultId `
            --network $NETWORK `
            --source $DEPLOYER_SECRET `
            -- `
            update_contract `
            --new_wasm_hash $wasmHash 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ Successfully updated vault" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  Update failed (might not have update_contract method):" -ForegroundColor Yellow
            Write-Host "   $updateOutput" -ForegroundColor Gray
        }
    } catch {
        Write-Host "   ⚠️  Error updating vault: $_" -ForegroundColor Yellow
    }
}

Write-Host "`n📝 Summary:" -ForegroundColor Cyan
Write-Host "   New WASM Hash: $wasmHash" -ForegroundColor White
Write-Host "`n💡 Note: If vaults don't have update_contract() method," -ForegroundColor Yellow
Write-Host "   you'll need to re-deploy them with the new WASM or" -ForegroundColor Yellow
Write-Host "   update the backend to use the new WASM hash." -ForegroundColor Yellow

Write-Host "`n✅ Done!" -ForegroundColor Green
