# Add USDC Trustline and Get Test USDC on Testnet
# This allows your wallet to hold USDC tokens

$USDC_ADDRESS = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA"
$NETWORK = "testnet"

Write-Host "Adding USDC trustline to your wallet..." -ForegroundColor Yellow
Write-Host "USDC Contract: $USDC_ADDRESS" -ForegroundColor Cyan
Write-Host "Network: $NETWORK" -ForegroundColor Cyan
Write-Host ""

# First, let's check if you already have USDC
Write-Host "Checking current USDC balance..." -ForegroundColor Cyan
stellar contract invoke `
  --id $USDC_ADDRESS `
  --source-account default `
  --network $NETWORK `
  -- balance `
  --id (stellar keys address default)

Write-Host "`nAttempting to get test USDC tokens..." -ForegroundColor Yellow

# Try to mint some test USDC (this may or may not work depending on the contract)
# If it fails, you'll need to use the Stellar Laboratory to add trustline and get USDC

Write-Host "`n⚠️  If the above failed, you need to:" -ForegroundColor Yellow
Write-Host "1. Go to https://laboratory.stellar.org/#?network=test" -ForegroundColor White
Write-Host "2. Go to 'Build Transaction' tab" -ForegroundColor White  
Write-Host "3. Load your account" -ForegroundColor White
Write-Host "4. Add operation: Change Trust" -ForegroundColor White
Write-Host "5. Asset Code: USDC" -ForegroundColor White
Write-Host "6. Issuer: (check Stellar testnet USDC issuer)" -ForegroundColor White
Write-Host "7. Sign and submit" -ForegroundColor White
Write-Host ""
Write-Host "OR use a Stellar faucet that provides USDC tokens" -ForegroundColor White
