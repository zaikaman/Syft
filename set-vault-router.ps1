# Set Router Address for Vault
# This enables auto-swap functionality for multi-asset vaults

$VAULT_ADDRESS = "CDZPU72JWCLCJYCMYEQZE56TT4MVM5N2HS5IBIIIWLANGUJGPLPLEXNX"
$ROUTER_ADDRESS = "CCMAPXWVZD4USEKDWRYS7DA4Y3D7E2SDMGBFJUCEXTC7VN6CUBGWPFUS"  # Soroswap Testnet Router
$NETWORK = "testnet"

Write-Host "Setting router address for vault..." -ForegroundColor Yellow
Write-Host "Vault: $VAULT_ADDRESS" -ForegroundColor Cyan
Write-Host "Router: $ROUTER_ADDRESS" -ForegroundColor Cyan
Write-Host "Network: $NETWORK" -ForegroundColor Cyan
Write-Host ""

# Execute the set_router contract method
stellar contract invoke `
  --id $VAULT_ADDRESS `
  --source-account default `
  --network $NETWORK `
  -- set_router `
  --router $ROUTER_ADDRESS

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Router address set successfully!" -ForegroundColor Green
    Write-Host "Your vault can now auto-swap between USDC and XLM" -ForegroundColor Green
} else {
    Write-Host "`n❌ Failed to set router address" -ForegroundColor Red
    Write-Host "Error code: $LASTEXITCODE" -ForegroundColor Red
}
