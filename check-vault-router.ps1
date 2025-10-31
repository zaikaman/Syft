# Check if Vault has Router Configured

$VAULT_ADDRESS = "CBCT2QHYXI2CKUGEDWX5FVNISYBHIBHIN47YYVB33WLI4HYFAAIK4XG2"
$NETWORK = "testnet"

Write-Host "Checking vault configuration..." -ForegroundColor Yellow
Write-Host "Vault: $VAULT_ADDRESS" -ForegroundColor Cyan
Write-Host ""

# Get vault config
stellar contract invoke `
  --id $VAULT_ADDRESS `
  --source-account default `
  --network $NETWORK `
  -- get_config
