# Check if vault has staked tokens
$vaultId = "vault_1761969985536_sjvfsrdv1"  # Replace with your vault ID
$baseUrl = "http://localhost:3001"

Write-Host "`n🔍 Checking staking position for vault: $vaultId`n" -ForegroundColor Cyan

# Get staking positions
$response = Invoke-RestMethod -Uri "$baseUrl/api/vaults/$vaultId/positions/staking" -Method Get

if ($response.success -and $response.data -and $response.data.Count -gt 0) {
    Write-Host "✅ VAULT HAS STAKING POSITIONS!" -ForegroundColor Green
    Write-Host "`nStaking Details:" -ForegroundColor Yellow
    foreach ($position in $response.data) {
        Write-Host "  Staking Pool: $($position.staking_pool)" -ForegroundColor White
        Write-Host "  Staked Amount: $($position.staked_amount)" -ForegroundColor White
        Write-Host "  ST Token Amount: $($position.st_token_amount)" -ForegroundColor White
        Write-Host "  Timestamp: $($position.timestamp)" -ForegroundColor Gray
        Write-Host ""
    }
} else {
    Write-Host "❌ No staking positions found yet" -ForegroundColor Red
    Write-Host "   Vault might not have staked yet. Wait for the next rebalance cycle (~60s)" -ForegroundColor Yellow
}

# Also check vault state from contract
Write-Host "`n🔍 Checking vault contract state...`n" -ForegroundColor Cyan
try {
    $vaultInfo = Invoke-RestMethod -Uri "$baseUrl/api/vaults/$vaultId" -Method Get
    if ($vaultInfo.success) {
        $vault = $vaultInfo.data
        Write-Host "Vault Balance:" -ForegroundColor Yellow
        Write-Host "  Total: $($vault.total_value_locked)" -ForegroundColor White
        
        if ($vault.config.rules) {
            Write-Host "`nVault Rules:" -ForegroundColor Yellow
            foreach ($rule in $vault.config.rules) {
                Write-Host "  Action: $($rule.action)" -ForegroundColor White
                Write-Host "  Condition: $($rule.condition_type)" -ForegroundColor White
                Write-Host "  Threshold: $($rule.threshold)s" -ForegroundColor White
                Write-Host "  Target Allocation: $($rule.target_allocation)" -ForegroundColor White
                Write-Host ""
            }
        }
    }
} catch {
    Write-Host "Error fetching vault info: $_" -ForegroundColor Red
}

Write-Host "`n💡 Tip: Run this script every minute to see when staking happens!`n" -ForegroundColor Cyan
