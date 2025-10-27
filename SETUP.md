# 🚀 Syft DeFi Platform - Complete Setup Guide

**Last Updated**: January 2025  
**Estimated Time**: 30-45 minutes (first time)

This guide will help you set up and run the entire Syft DeFi platform from scratch. Follow each section in order.

---

## 📋 Prerequisites

Before you begin, ensure you have these installed:

### Required Tools

1. **Node.js** (v18 or higher)
   ```powershell
   node --version  # Should be v18.0.0 or higher
   ```
   Download from: https://nodejs.org/

2. **Rust & Cargo** (for Soroban smart contracts)
   ```powershell
   rustc --version  # Should be 1.70 or higher
   cargo --version
   ```
   Install from: https://rustup.rs/

3. **Stellar CLI** (for deploying contracts)
   ```powershell
   stellar --version
   ```
   Install:
   ```powershell
   cargo install --locked stellar-cli --features opt
   ```
   Documentation: https://developers.stellar.org/docs/tools/stellar-cli

4. **Git** (for version control)
   ```powershell
   git --version
   ```

5. **Python 3.8+** (for Prophet forecasting - optional)
   ```powershell
   python --version
   ```
   Only needed if using AI forecasting features.

---

## 🔑 Step 1: Get Your API Keys

You'll need accounts and API keys from several services. Here's what to set up:

### 1.1 Supabase (Required - Database)

1. Go to https://supabase.com/
2. Sign up for a free account
3. Create a new project (choose a region close to you)
4. Wait 2-3 minutes for the project to initialize
5. Go to **Project Settings** → **API**
6. Copy these values:
   - `Project URL` → This is your `SUPABASE_URL`
   - `anon public` key → This is your `SUPABASE_ANON_KEY`
   - `service_role secret` → This is your `SUPABASE_SERVICE_ROLE_KEY` ⚠️ Keep this secret!

### 1.2 OpenAI (Optional - AI Suggestions)

1. Go to https://platform.openai.com/
2. Sign up or log in
3. Go to **API Keys** section
4. Click **Create new secret key**
5. Copy the key → This is your `OPENAI_API_KEY`
6. Note: You'll need to add billing information to use the API

### 1.3 Stellar Wallets (Required - Testing)

You'll need a Stellar wallet for testing. Install one of these browser extensions:

- **Freighter** (Recommended): https://www.freighter.app/
- **Albedo**: https://albedo.link/

After installation:
1. Create a new wallet or import existing one
2. **Switch to Futurenet** in wallet settings
3. Fund your wallet with test XLM:
   - Go to https://laboratory.stellar.org/#account-creator?network=futurenet
   - Paste your wallet address
   - Click "Get Test Network Lumens"

### 1.4 Social Media APIs (Optional - Sentiment Analysis)

**Twitter/X API** (via twexapi.io):
1. Go to https://twexapi.io/
2. Sign up for an account
3. Get your API key from dashboard
4. Copy → This is your `TWEXAPI_API_KEY`

**Reddit API**:
1. Go to https://www.reddit.com/prefs/apps
2. Click "Create App" or "Create Another App"
3. Select "script" type
4. Fill in name and redirect URI (can be http://localhost)
5. Copy `client_id` and `client_secret`

---

## 🛠️ Step 2: Project Configuration

### 2.1 Clone/Navigate to Project

```powershell
cd C:\Users\ADMIN\Desktop\Syft
```

### 2.2 Configure Environment Variables

#### Root Environment (.env)

```powershell
# Copy the example file
cp .env.example .env
```

Open `.env` and update these values:

```bash
# Keep these as-is for Futurenet
PUBLIC_STELLAR_NETWORK="FUTURENET"
PUBLIC_STELLAR_NETWORK_PASSPHRASE="Test SDF Future Network ; October 2022"
PUBLIC_STELLAR_RPC_URL="https://rpc-futurenet.stellar.org"
PUBLIC_STELLAR_HORIZON_URL="https://horizon-futurenet.stellar.org"

# Update these with your Supabase values
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Update if you want AI features
OPENAI_API_KEY=sk-your_openai_key_here
OPENAI_MODEL=gpt-4-turbo-preview

# Optional: Social media APIs
TWEXAPI_API_KEY=your_twexapi_key_here
REDDIT_CLIENT_ID=your_reddit_client_id_here
REDDIT_CLIENT_SECRET=your_reddit_client_secret_here
```

#### Backend Environment (backend/.env)

```powershell
# Copy the backend example
cp backend\.env.example backend\.env
```

Open `backend/.env` and update with the same values as above (Supabase, OpenAI, etc.)

---

## 📦 Step 3: Install Dependencies

### 3.1 Install Root Dependencies

```powershell
npm install
```

### 3.2 Install Backend Dependencies

```powershell
cd backend
npm install
cd ..
```

### 3.3 Install Frontend Dependencies

```powershell
cd frontend
npm install
cd ..
```

### 3.4 Build Soroban Contracts

```powershell
# Build all contracts
stellar contract build

# This creates .wasm files in target/wasm32-unknown-unknown/release/
```

**Expected output**: Should see `*.wasm` files created in `target/wasm32-unknown-unknown/release/`

---

## 🗄️ Step 4: Setup Database

### 4.1 Run Supabase Migrations

1. Open https://supabase.com/dashboard
2. Go to your project
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**

5. Run each migration file in order:

**Migration 1 - Users Table**:
```powershell
# Copy content from backend/migrations/001_users.sql
```
Open the file, copy the SQL, paste into Supabase SQL Editor, and click **Run**.

**Migration 2 - Vaults Table**:
```powershell
# Copy content from backend/migrations/002_vaults.sql
```
Repeat the process.

**Continue for all 7 migrations**:
- `003_vault_performance.sql`
- `004_backtest_results.sql`
- `005_ai_suggestions.sql`
- `006_vault_nfts.sql`
- `007_marketplace.sql`

### 4.2 Verify Database Setup

In Supabase:
1. Go to **Table Editor**
2. You should see these tables:
   - users
   - vaults
   - vault_performance
   - backtest_results
   - ai_suggestions
   - vault_nfts
   - marketplace_listings

---

## 🚀 Step 5: Deploy Smart Contracts (Optional for Initial Testing)

For now, you can skip contract deployment and test the UI. When ready to deploy:

### 5.1 Generate Stellar Identity (First Time Only)

```powershell
# Generate a new identity for deployment
stellar keys generate deployer --network futurenet

# Fund the deployer account
stellar keys fund deployer --network futurenet
```

### 5.2 Deploy Vault Factory Contract

```powershell
# Deploy the factory contract
stellar contract deploy `
  --wasm target/wasm32-unknown-unknown/release/syft_vault.wasm `
  --source deployer `
  --network futurenet

# Save the contract ID output - you'll need this!
```

### 5.3 Update Contract IDs

After deployment, update your `.env` files with contract addresses:

```bash
# Add to .env and backend/.env
PUBLIC_VAULT_FACTORY_CONTRACT_ID=C... (your deployed contract ID)
```

---

## 🏃 Step 6: Run the Application

### 6.1 Start Backend Server

Open a **new terminal**:

```powershell
cd C:\Users\ADMIN\Desktop\Syft\backend
npm run dev
```

**Expected output**:
```
🚀 Server running on http://localhost:3001
✅ Connected to Supabase
✅ Horizon SDK initialized
```

Keep this terminal running.

### 6.2 Start Frontend Dev Server

Open **another new terminal**:

```powershell
cd C:\Users\ADMIN\Desktop\Syft\frontend
npm run dev
```

**Expected output**:
```
VITE v5.x.x ready in xxx ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

Keep this terminal running too.

---

## ✅ Step 7: Verify Everything Works

### 7.1 Open the Application

1. Open your browser (Chrome/Edge recommended)
2. Go to: http://localhost:5173/
3. You should see the Syft platform homepage

### 7.2 Connect Your Wallet

1. Click **"Connect Wallet"** button
2. Select your wallet (Freighter/Albedo)
3. Approve the connection
4. Your wallet address should appear in the header
5. You should see your test XLM balance

### 7.3 Test the Visual Builder

1. Navigate to **"Create Vault"** or **"Builder"** page
2. You should see:
   - Block palette on the left
   - Canvas in the center
   - Strategy preview on the right
3. Try dragging an **Asset Block** onto the canvas
4. Try connecting blocks together

### 7.4 Check Backend Connection

1. Open browser DevTools (F12)
2. Go to **Network** tab
3. Interact with the app
4. You should see API calls to `http://localhost:3001/api/...`
5. Check the backend terminal - you should see request logs

---

## 🐛 Troubleshooting

### Backend Won't Start

**Issue**: `Error: Invalid Supabase credentials`
- **Fix**: Double-check your `SUPABASE_URL` and keys in `backend/.env`
- Make sure there are no extra spaces or quotes

**Issue**: `Port 3001 already in use`
- **Fix**: Change `PORT=3002` in `backend/.env`, update frontend API URL

### Frontend Won't Start

**Issue**: `Module not found` errors
- **Fix**: Run `npm install` again in frontend directory
- Delete `node_modules` and `package-lock.json`, reinstall

**Issue**: Blank white page
- **Fix**: Check browser console (F12) for errors
- Make sure backend is running
- Check `.env` file has `PUBLIC_` prefixed variables

### Wallet Connection Fails

**Issue**: Wallet not detected
- **Fix**: Install Freighter extension and refresh page
- Make sure wallet is unlocked

**Issue**: Wrong network
- **Fix**: Open wallet settings, switch to **Futurenet**

### Contract Build Fails

**Issue**: `stellar: command not found`
- **Fix**: Install Stellar CLI:
  ```powershell
  cargo install --locked stellar-cli --features opt
  ```

**Issue**: Rust compilation errors
- **Fix**: Update Rust: `rustup update`
- Check `rust-toolchain.toml` version matches installed Rust

### Database Issues

**Issue**: Tables not appearing in Supabase
- **Fix**: Re-run migrations in SQL Editor
- Check for SQL syntax errors in migration files

### API Calls Failing

**Issue**: CORS errors in browser console
- **Fix**: Check `CORS_ORIGINS` in `backend/.env` includes `http://localhost:5173`
- Restart backend server

---

## 🎯 What You Can Test Now

Based on the phases completed (1-8), you should be able to:

### ✅ Working Features

1. **Wallet Connection** (Phase 3 - US6)
   - Connect Freighter/Albedo wallet
   - View asset balances
   - See account information

2. **Visual Vault Builder** (Phase 4 - US5)
   - Drag and drop blocks
   - Create vault strategies visually
   - See plain-language preview
   - Connect assets → conditions → actions

3. **Vault Creation** (Phase 5 - US1)
   - Configure vault parameters
   - Set rebalancing rules
   - See fee estimates
   - Deploy vault (if contracts deployed)

4. **Backtesting** (Phase 6 - US3)
   - Select historical time period
   - Run strategy simulation
   - View performance metrics
   - See hypothetical returns

5. **AI Suggestions** (Phase 7 - US2)
   - Request AI strategy improvements
   - View sentiment analysis (if APIs configured)
   - See optimization recommendations

6. **NFT Marketplace** (Phase 8 - US4)
   - Mint vault NFTs
   - List vaults for sale
   - Browse marketplace
   - View vault performance

### ⏳ Limited Features (Need Configuration)

- **AI Suggestions**: Requires OpenAI API key
- **Sentiment Analysis**: Requires Twitter/Reddit API keys
- **Prophet Forecasting**: Requires Python setup
- **Contract Deployment**: Requires Stellar CLI setup

---

## 📚 Next Steps

### For Testing

1. **Create a Test Vault**:
   - Use the visual builder to design a simple strategy
   - Example: "Rebalance to 50/50 XLM/USDC when allocation drifts 5%"
   - Don't deploy yet - just test the UI

2. **Try Backtesting**:
   - Configure the vault strategy
   - Run a 30-day backtest
   - See what returns it would have generated

3. **Explore AI Suggestions** (if configured):
   - Request improvements for your strategy
   - Review AI recommendations

### For Development

1. **Read the Specs**:
   - `specs/001-syft-defi-platform/spec.md` - Full technical specification
   - `specs/001-syft-defi-platform/plan.md` - Implementation plan

2. **Check Task Progress**:
   - `specs/001-syft-defi-platform/tasks.md` - See what's completed

3. **Review Code Structure**:
   - `backend/src/` - Backend services and APIs
   - `frontend/src/` - React components and pages
   - `contracts/soroban/src/` - Smart contracts

---

## 🔐 Security Notes

### For Development

- ✅ Use Futurenet (test network) only
- ✅ Use test XLM, not real funds
- ✅ Keep `.env` files out of version control (already in `.gitignore`)

### Before Production

- ⚠️ **Never commit** API keys or secrets
- ⚠️ Rotate all API keys before mainnet deployment
- ⚠️ Use environment variables in production (Vercel, etc.)
- ⚠️ Enable rate limiting on backend APIs
- ⚠️ Audit smart contracts before mainnet deployment
- ⚠️ Set up proper monitoring and error tracking

---

## 📞 Getting Help

### Issues with Setup

1. Check the **Troubleshooting** section above
2. Review error messages in terminal/console
3. Check browser DevTools Network tab for API errors

### Stellar/Soroban Questions

- Stellar Docs: https://developers.stellar.org/
- Stellar Discord: https://discord.gg/stellar
- Soroban Examples: https://github.com/stellar/soroban-examples

### Project-Specific Questions

- Check `specs/001-syft-defi-platform/` for design decisions
- Review code comments in relevant files
- Look at component implementations in `frontend/src/components/`

---

## ✨ Quick Start Commands

Once everything is set up, use these commands to start development:

```powershell
# Terminal 1: Backend
cd C:\Users\ADMIN\Desktop\Syft\backend
npm run dev

# Terminal 2: Frontend
cd C:\Users\ADMIN\Desktop\Syft\frontend
npm run dev

# Terminal 3: Build contracts (when needed)
cd C:\Users\ADMIN\Desktop\Syft
stellar contract build

# Terminal 4: Deploy contracts (when ready)
stellar contract deploy --wasm target/wasm32-unknown-unknown/release/syft_vault.wasm --source deployer --network futurenet
```

---

## 🎉 Success Checklist

- [ ] All prerequisites installed (Node, Rust, Stellar CLI)
- [ ] API keys obtained (Supabase required, others optional)
- [ ] Environment files configured (`.env` and `backend/.env`)
- [ ] Dependencies installed (root, backend, frontend)
- [ ] Database migrations run in Supabase
- [ ] Backend server running (http://localhost:3001)
- [ ] Frontend server running (http://localhost:5173)
- [ ] Wallet connected successfully
- [ ] Can see visual builder interface
- [ ] API calls working (check Network tab)

**Once all boxes are checked, you're ready to start testing the platform! 🚀**

---

## 📝 Notes

- This is an **MVP** - some features may be partially implemented
- Focus on testing the core flows first (wallet → builder → vault creation)
- Not all error cases may be handled gracefully yet
- Performance optimizations are still needed for production use
- Smart contract deployment is optional for UI testing

**Happy Building! 🌟**
