# Update Factory with New Vault WASM Hash

$NEW_WASM_HASH = "ecc8cb9c36d2af79ed88424a2fa630fa8de14c5a2a3075a3fad214c1523a2ad4"
$FACTORY_ID = "CCODOMK6HSVVKX7FP2CCUVL7VKKOYCO3AJPWC5C656RP4FXGFPWU3YM2"
$NETWORK = "testnet"

Write-Host "Updating factory with new vault WASM hash..." -ForegroundColor Cyan
Write-Host "Factory: $FACTORY_ID" -ForegroundColor Gray
Write-Host "New WASM Hash: $NEW_WASM_HASH`n" -ForegroundColor Gray

# Try to update the WASM hash
Write-Host "Attempting to call update_wasm..." -ForegroundColor Yellow

$result = stellar contract invoke `
    --id $FACTORY_ID `
    --source deployer `
    --network $NETWORK `
    -- `
    update_wasm `
    --new_wasm_hash $NEW_WASM_HASH 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Factory updated successfully!" -ForegroundColor Green
    Write-Host "New vaults will now use WASM: $NEW_WASM_HASH" -ForegroundColor Cyan
} else {
    Write-Host "`n❌ Update failed!" -ForegroundColor Red
    Write-Host "Error: $result" -ForegroundColor Red
    Write-Host "`nThe factory might not have an update_vault_wasm function." -ForegroundColor Yellow
    Write-Host "You'll need to deploy a NEW factory with the new WASM hash." -ForegroundColor Yellow
}
