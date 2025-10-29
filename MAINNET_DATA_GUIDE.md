# Getting Live Mainnet Data for Backtesting

## 🎯 Overview

Your backtest system now automatically fetches **real production data from Stellar mainnet** as a fallback when testnet has no data. Here's how it works and how to get even more data.

---

## 📊 Current Implementation (Automatic)

### Data Source Priority
The system already implements smart fallback:

```
1. Current Network (Testnet/Futurenet) 
   ↓ if no data
2. **Mainnet Fallback** ← Real production data! ✅
   ↓ if no data  
3. Mock Data (last resort)
```

### What You're Already Getting

✅ **Mainnet XLM/USDC Data**: Working perfectly (you saw 30 price points fetched)
✅ **Automatic Fallback**: No configuration needed
✅ **Real Trade History**: Actual market data from Stellar mainnet

---

## 🚀 How to Get More/Better Mainnet Data

### Option 1: Use Mainnet Directly (Best for Production)

Instead of running backtests on testnet, connect to mainnet:

```typescript
// In your environment or config
STELLAR_NETWORK=mainnet
STELLAR_HORIZON_URL=https://horizon.stellar.org
STELLAR_RPC_URL=https://soroban-rpc.stellar.org
```

**Benefits:**
- Direct access to all mainnet trading history
- No fallback needed - immediate data access
- Most accurate for production strategies

**Considerations:**
- Need real XLM for transactions (if testing live)
- More suitable for view-only backtesting

---

### Option 2: Stellar Expert API (Advanced Historical Data)

For more detailed historical data, you can integrate with Stellar Expert:

```bash
# Example: Get XLM/USDC trades from last 30 days
curl "https://api.stellar.expert/explorer/public/trade?asset=USDC-GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN&quote=XLM-native&limit=200"
```

**To integrate this into your system:**

1. Create a new function in `historicalDataService.ts`:

```typescript
async function fetchFromStellarExpert(
  assetCode: string,
  assetIssuer: string,
  startTime: string,
  endTime: string
): Promise<PricePoint[]> {
  const response = await fetch(
    `https://api.stellar.expert/explorer/public/trade?` +
    `asset=${assetCode}-${assetIssuer}&` +
    `quote=XLM-native&` +
    `limit=1000`
  );
  const data = await response.json();
  
  // Transform to PricePoint format
  return data.map(trade => ({
    timestamp: new Date(trade.ts).toISOString(),
    price: trade.price,
    volume: trade.amount,
    // ... etc
  }));
}
```

2. Add it to the fallback chain before mock data

---

### Option 3: Horizon API Advanced Queries

Get more granular mainnet data by tweaking the query parameters:

```typescript
// In historicalDataService.ts, modify the mainnet fallback:

const mainnetAggregations = await mainnetServer
  .tradeAggregation(baseAsset, counterAsset, start, end, resolutionMs, 0)
  .limit(200)  // ← Increase this! Max is 200 per call
  .order('desc') // Get most recent first
  .call();

// For larger datasets, implement pagination:
let allRecords = [];
let currentCursor = '';

while (allRecords.length < 1000) {
  const page = await mainnetServer
    .tradeAggregation(baseAsset, counterAsset, start, end, resolutionMs, 0)
    .limit(200)
    .cursor(currentCursor)
    .call();
    
  allRecords = [...allRecords, ...page.records];
  
  if (page.records.length < 200) break; // No more data
  currentCursor = page.records[page.records.length - 1].paging_token;
}
```

---

### Option 4: Fork Testing with Real State (Recommended for Complex Strategies)

For the most accurate backtesting, use Soroban fork testing:

#### Step 1: Create Mainnet Snapshot

```bash
# Install Stellar CLI
cargo install --locked stellar-cli

# Take a snapshot of mainnet state at specific ledger
stellar snapshot create \
  --network mainnet \
  --ledger 50000000 \
  my_mainnet_snapshot.json
```

#### Step 2: Use Snapshot in Tests

```rust
use soroban_sdk::{Env, testutils::Ledger};
use std::fs;

#[test]
fn test_vault_with_real_mainnet_state() {
    // Load mainnet snapshot
    let snapshot = fs::read("my_mainnet_snapshot.json").unwrap();
    let env = Env::from_ledger_snapshot(&snapshot);
    
    // Your contract already has real DEX liquidity, real token balances, etc.
    // Test vault strategies against REAL market conditions
    let vault = VaultClient::new(&env, &vault_contract_id);
    vault.rebalance();
    
    // Assert against real outcomes
}
```

**Why This is Powerful:**
- ✅ Real DEX liquidity pools
- ✅ Real token balances and reserves
- ✅ Real price ratios
- ✅ Deterministic - same state every test
- ✅ Fast - local execution
- ✅ Free - no network fees

---

## 📈 Understanding the Data You're Already Getting

### Current Mainnet Fallback Output

```
[Historical Data] No data on current network for XLM/USDC
[Historical Data] Attempting to fetch from mainnet as fallback...
[Historical Data] ✓ Successfully fetched 30 price points from mainnet
```

**What this means:**
- 30 data points = 30 time intervals (e.g., 30 days if daily resolution)
- **Real production data** from actual XLM/USDC trades on mainnet
- Accurate prices, volumes, highs/lows from real market activity

### Why USDC/USDC Shows Mock Data

```
[Historical Data] No data on current network for USDC/USDC
[Historical Data] No data available from mainnet either.
```

This is expected! **USDC/USDC is 1:1 always** - there's no "trading" of USDC against itself. The system correctly falls back to mock data (which should just be 1.0 for stablecoin pairs).

---

## 🎯 Recommended Approach for Syft

### For Development/Testing (Current Setup) ✅
- Keep automatic mainnet fallback (already working!)
- Great for quick backtests on testnet
- Real data when available, mock data when needed

### For Production Users (Future Enhancement)
1. **Offer Network Selection**: Let users choose testnet or mainnet
2. **Premium Mainnet Backtests**: More accurate, uses real data
3. **Fork Testing API**: Provide fork testing as a service
4. **Historical Data Cache**: Cache mainnet data to reduce API calls

---

## 🔧 Quick Wins to Improve Current System

### 1. Increase Data Points
```typescript
// In historicalDataService.ts, line ~140
.limit(200)  // Already at max per page

// Add pagination for more data:
// See "Option 3" above
```

### 2. Add More Asset Pairs
The system already handles any asset pair automatically! Just make sure you're using:
- Valid asset codes
- Correct issuers (use Circle's official USDC issuer for USDC)

### 3. Better Resolution Options
```typescript
// Frontend already supports: 'hour', 'day', 'week'
// For finer granularity, add:
'5min': 300000,    // 5 minutes
'15min': 900000,   // 15 minutes  
'4hour': 14400000, // 4 hours
```

---

## 📚 Resources

- **Horizon API Docs**: https://developers.stellar.org/docs/data/horizon/api-reference
- **Stellar Expert API**: https://stellar.expert/explorer/public
- **Fork Testing Guide**: https://developers.stellar.org/docs/smart-contracts/guides/testing/fork-testing
- **Trade Aggregations**: https://developers.stellar.org/docs/data/horizon/api-reference/aggregations/trade-aggregations

---

## ✅ Summary

**You're already getting mainnet data automatically!** 🎉

The system works exactly as designed:
- Tries testnet first (no data usually)
- Falls back to mainnet (gets real production data)
- Only uses mock data as absolute last resort

For even better results, consider implementing fork testing or direct mainnet connection for production users.
