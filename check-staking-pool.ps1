# Check Mock Staking Pool Positions
# This script queries the mock staking pool directly without using the backend

$STAKING_POOL = "CDLZVYS4GWBUKQAJYX5DFXUH4N2NVPW6QQZNSG6GJUMU4LQYPVCQLKFK"
$NETWORK = "testnet"

Write-Host "=== Mock Staking Pool Info ===" -ForegroundColor Cyan
Write-Host "Contract: $STAKING_POOL`n" -ForegroundColor Gray

# 1. Get total staked
Write-Host "1. Total Staked in Pool:" -ForegroundColor Yellow
$totalStaked = stellar contract invoke `
    --id $STAKING_POOL `
    --source deployer `
    --network $NETWORK `
    -- get_total_staked 2>&1 | Select-String -Pattern "^\d+" | ForEach-Object { $_.Matches[0].Value }

if ($totalStaked) {
    $totalStakedXLM = [decimal]$totalStaked / 10000000
    Write-Host "   $totalStaked stroops ($totalStakedXLM XLM)" -ForegroundColor Green
} else {
    Write-Host "   0 (no stakes yet)" -ForegroundColor Gray
}

# 2. Get staking rate
Write-Host "`n2. Staking Rate (1.0 = 1:1 ratio):" -ForegroundColor Yellow
$rate = stellar contract invoke `
    --id $STAKING_POOL `
    --source deployer `
    --network $NETWORK `
    -- get_staking_rate 2>&1 | Select-String -Pattern "^\d+" | ForEach-Object { $_.Matches[0].Value }

if ($rate) {
    $rateDecimal = [decimal]$rate / 1000000
    Write-Host "   $rate ($rateDecimal)" -ForegroundColor Green
} else {
    Write-Host "   Error getting rate" -ForegroundColor Red
}

# 3. Get token address
Write-Host "`n3. Token Being Staked:" -ForegroundColor Yellow
$token = stellar contract invoke `
    --id $STAKING_POOL `
    --source deployer `
    --network $NETWORK `
    -- get_token 2>&1 | Select-String -Pattern "^C[A-Z0-9]{55}$" | ForEach-Object { $_.Matches[0].Value }

if ($token) {
    Write-Host "   $token" -ForegroundColor Green
    Write-Host "   (XLM token)" -ForegroundColor Gray
} else {
    Write-Host "   Error getting token" -ForegroundColor Red
}

# 4. Check specific user stake (vault address)
Write-Host "`n4. Check Specific Address Stake:" -ForegroundColor Yellow
$vaultAddress = Read-Host "   Enter address to check (press Enter to skip)"

if ($vaultAddress -and $vaultAddress.Length -gt 0) {
    Write-Host "   Checking $vaultAddress..." -ForegroundColor Gray
    
    $userStake = stellar contract invoke `
        --id $STAKING_POOL `
        --source deployer `
        --network $NETWORK `
        -- get_user_stake `
        --user $vaultAddress 2>&1 | Select-String -Pattern "^\d+" | ForEach-Object { $_.Matches[0].Value }
    
    if ($userStake) {
        $userStakeXLM = [decimal]$userStake / 10000000
        Write-Host "   Staked: $userStake stroops ($userStakeXLM XLM)" -ForegroundColor Green
    } else {
        Write-Host "   No stake found for this address" -ForegroundColor Gray
    }
}

Write-Host "`n=== Explorer Link ===" -ForegroundColor Cyan
Write-Host "https://stellar.expert/explorer/testnet/contract/$STAKING_POOL" -ForegroundColor Blue

Write-Host "`n=== Quick Commands ===" -ForegroundColor Cyan
Write-Host "Check total staked:" -ForegroundColor Yellow
Write-Host "  stellar contract invoke --id $STAKING_POOL --source deployer --network testnet -- get_total_staked`n" -ForegroundColor Gray

Write-Host "Check user stake:" -ForegroundColor Yellow
Write-Host "  stellar contract invoke --id $STAKING_POOL --source deployer --network testnet -- get_user_stake --user <ADDRESS>`n" -ForegroundColor Gray

Write-Host "Check staking rate:" -ForegroundColor Yellow
Write-Host "  stellar contract invoke --id $STAKING_POOL --source deployer --network testnet -- get_staking_rate`n" -ForegroundColor Gray
