# Tasks: Syft DeFi Yield Vault Platform

**Input**: Design documents from `/specs/001-syft-defi-platform/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓
**Feature Branch**: `001-syft-defi-platform`
**Timeline**: 10 days (MVP)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

This project uses a monorepo structure:
- **Smart Contracts**: `contracts/soroban/src/`
- **Backend Services**: `backend/src/`
- **Frontend**: `frontend/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Create monorepo structure with contracts/, backend/, frontend/, and tests/ directories
- [x] T002 Initialize Rust workspace for Soroban contracts in contracts/soroban/ with Cargo.toml
- [x] T003 [P] Initialize Node.js backend service in backend/ with package.json and TypeScript configuration
- [x] T004 [P] Initialize React + Vite frontend in frontend/ with package.json, vite.config.ts, and tsconfig.json
- [x] T005 [P] Install essential developer tooling for local development (editorconfig, recommended extensions)
- [x] T008 Setup environment configuration (.env.example) with Stellar Futurenet, Supabase, OpenAI API keys
- [x] T009 [P] Configure ESLint and Prettier for TypeScript code formatting
- [x] T010 [P] Configure Rustfmt and Clippy for Rust code formatting and linting
- [x] T011 Install Stellar Wallet Kit SDK in frontend/package.json
- [x] T012 [P] Install Horizon SDK in backend/package.json
- [x] T013 [P] Install Zustand for state management in frontend/package.json
- [x] T014 [P] Install React Flow for visual builder in frontend/package.json
- [x] T015 [P] Install Recharts for visualization in frontend/package.json
- [x] T016 [P] Setup Supabase client in backend/src/lib/supabase.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T017 Create Supabase database schema for users table (wallet_address, created_at, profile) in migrations/001_users.sql
- [x] T018 [P] Create Supabase database schema for vaults table (vault_id, owner, contract_address, config, status) in migrations/002_vaults.sql
- [x] T019 [P] Create Supabase database schema for vault_performance table (vault_id, timestamp, value, returns) in migrations/003_vault_performance.sql
- [x] T020 [P] Create Supabase database schema for backtest_results table (backtest_id, vault_id, timeframe, results) in migrations/004_backtest_results.sql
- [x] T021 [P] Create Supabase database schema for ai_suggestions table (suggestion_id, vault_id, suggestion_data) in migrations/005_ai_suggestions.sql
- [x] T022 [P] Create Supabase database schema for vault_nfts table (nft_id, vault_id, ownership_pct, holder) in migrations/006_vault_nfts.sql
- [x] T023 [P] Create Supabase database schema for marketplace_listings table (listing_id, nft_id, price, status) in migrations/007_marketplace.sql
- [x] T024 Implement base error handling middleware in backend/src/middleware/errorHandler.ts
- [x] T025 [P] Implement request logging middleware in backend/src/middleware/logger.ts
- [x] T026 [P] Setup CORS configuration for frontend-backend communication in backend/src/middleware/cors.ts
- [x] T027 Implement base API router structure in backend/src/routes/index.ts
- [x] T028 [P] Create shared types for vault configuration in shared/types/vault.ts
- [x] T029 [P] Create shared types for blockchain transactions in shared/types/transaction.ts
- [x] T030 [P] Create utility for Horizon SDK connection management in backend/src/lib/horizonClient.ts
- [x] T031 [P] Create utility for wallet signature verification in backend/src/lib/walletAuth.ts
- [x] T032 Implement Prophet time-series forecasting client setup in backend/src/lib/prophetClient.ts
- [x] T033 [P] Implement OpenAI API client with prompt templates for sentiment analysis in backend/src/lib/openaiClient.ts
- [x] T034 [P] Create frontend layout components (Header, Footer, Navigation) in frontend/src/components/layout/
- [x] T035 [P] Setup Zustand store structure for app state in frontend/src/store/
- [x] T036 [P] Create reusable UI components (Button, Card, Modal, LoadingSpinner) in frontend/src/components/ui/

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 6 - One-Click Wallet Integration (Priority: P1) 🎯 MVP Foundation

**Goal**: Enable seamless wallet connection as the entry point to all platform features

**Independent Test**: Visit Syft with no wallet connected, click "Connect Wallet", authenticate with Freighter/Albedo, verify assets appear within 30 seconds

### Implementation for User Story 6

- [x] T037 [US6] Create WalletConnect component with Stellar Wallet Kit integration in frontend/src/components/wallet/WalletConnect.tsx
- [x] T038 [US6] Implement wallet selection modal showing supported wallets in frontend/src/components/wallet/WalletSelector.tsx
- [ ] T039 [US6] Create wallet context provider for managing connection state in frontend/src/contexts/WalletContext.tsx (Note: Already exists in WalletProvider.tsx)
- [x] T040 [US6] Implement asset balance fetching service using Horizon SDK in backend/src/services/assetService.ts
- [x] T041 [US6] Create API endpoint GET /api/wallet/:address/assets in backend/src/routes/wallet.ts
- [x] T042 [US6] Implement session persistence using localStorage in frontend/src/lib/sessionManager.ts
- [x] T043 [US6] Create AssetDisplay component showing user balances in frontend/src/components/wallet/AssetDisplay.tsx
- [x] T044 [US6] Add wallet disconnect functionality and cleanup in frontend/src/components/wallet/WalletConnect.tsx
- [x] T045 [US6] Implement transaction approval flow with clear details display in frontend/src/components/wallet/TransactionApproval.tsx
- [x] T046 [US6] Add error handling for wallet connection failures with user-friendly messages in frontend/src/components/wallet/WalletConnect.tsx

**Checkpoint**: Users can connect wallets and see their assets - enables all other features ✅

---

## Phase 4: User Story 5 - Visual Vault Builder Interface (Priority: P1) 🎯 MVP Core

**Goal**: Provide no-code drag-and-drop interface for vault strategy design

**Independent Test**: Create a vault using only visual blocks (asset + condition + action), see real-time validation, verify plain-language summary appears

### Implementation for User Story 5

- [x] T047 [P] [US5] Define block type interfaces (AssetBlock, ConditionBlock, ActionBlock) in frontend/src/types/blocks.ts
- [x] T048 [P] [US5] Create AssetBlock component for XLM, USDC, and supported tokens in frontend/src/components/builder/blocks/AssetBlock.tsx
- [x] T049 [P] [US5] Create ConditionBlock components for allocation %, APY threshold, and time-based conditions in frontend/src/components/builder/blocks/ConditionBlock.tsx
- [x] T050 [P] [US5] Create ActionBlock components for rebalance, stake, and provide liquidity in frontend/src/components/builder/blocks/ActionBlock.tsx
- [x] T051 [US5] Implement BlockPalette component showing categorized blocks in frontend/src/components/builder/BlockPalette.tsx
- [x] T052 [US5] Setup React Flow canvas with drag-and-drop handling in frontend/src/components/builder/VaultCanvas.tsx
- [x] T053 [US5] Implement block connection validation rules (type compatibility) in frontend/src/lib/blockValidator.ts
- [x] T054 [US5] Create real-time validation feedback UI for invalid connections in frontend/src/components/builder/ValidationFeedback.tsx
- [x] T055 [US5] Implement plain-language rule generator from block graph in frontend/src/lib/ruleTranslator.ts
- [x] T056 [US5] Create StrategyPreview component showing human-readable summary in frontend/src/components/builder/StrategyPreview.tsx
- [x] T057 [US5] Implement vault configuration serialization from visual graph in frontend/src/lib/configSerializer.ts
- [ ] T058 [US5] Add block deletion and modification functionality in frontend/src/components/builder/VaultCanvas.tsx (Note: Basic deletion via Delete key is already implemented)
- [x] T059 [US5] Create example vault templates for quick start in frontend/src/data/vaultTemplates.ts
- [x] T060 [US5] Implement undo/redo functionality for builder actions in frontend/src/hooks/useBuilderHistory.ts

**Checkpoint**: Users can design vault strategies visually without writing code ✅

---

## Phase 5: User Story 1 - Create and Deploy Basic Yield Vault (Priority: P1) 🎯 MVP Deployment

**Goal**: Enable vault creation, deployment to Stellar, and automatic execution of rebalancing rules

**Independent Test**: Connect wallet, create vault with single rebalancing rule, deploy contract, deposit assets, trigger condition, verify vault executes rebalance automatically

### Contract & Integration Notes for User Story 1

Note: To speed up implementation for MVP, formal automated contract/integration test tasks are deferred. Keep lightweight manual verification checklists near contracts/soroban/ for quick validation during development.

### Smart Contract Implementation for User Story 1

- [x] T066 [US1] Create vault data structures (VaultConfig, VaultState, RebalanceRule) in contracts/soroban/src/types.rs
- [x] T067 [P] [US1] Implement vault initialization function in contracts/soroban/src/vault.rs
- [x] T068 [P] [US1] Implement deposit function with share calculation in contracts/soroban/src/vault.rs
- [x] T069 [P] [US1] Implement withdrawal function with share burning in contracts/soroban/src/vault.rs
- [x] T070 [US1] Implement rule evaluation engine for rebalancing conditions in contracts/soroban/src/engine.rs
- [x] T071 [US1] Implement rebalancing execution with Stellar AMM integration in contracts/soroban/src/rebalance.rs
- [x] T072 [US1] Implement event emission for vault actions (deposit, withdraw, rebalance) in contracts/soroban/src/events.rs
- [x] T073 [US1] Create vault factory contract for generating vault instances in contracts/soroban/src/factory.rs
- [x] T074 [US1] Add error handling with descriptive error types in contracts/soroban/src/errors.rs

### Backend Services for User Story 1

- [x] T075 [P] [US1] Create vault deployment service using Scaffold Stellar CLI in backend/src/services/vaultDeploymentService.ts
- [x] T076 [P] [US1] Create vault state monitoring service with Horizon SDK in backend/src/services/vaultMonitorService.ts
- [x] T077 [US1] Implement rule trigger detection logic (polling every 60s) in backend/src/services/ruleTriggerService.ts
- [x] T078 [US1] Create vault action execution service for triggering rebalances in backend/src/services/vaultActionService.ts
- [x] T079 [P] [US1] Create API endpoint POST /api/vaults to deploy new vault in backend/src/routes/vaults.ts
- [x] T080 [P] [US1] Create API endpoint GET /api/vaults/:vaultId to fetch vault state in backend/src/routes/vaults.ts
- [x] T081 [P] [US1] Create API endpoint POST /api/vaults/:vaultId/deposit in backend/src/routes/vaults.ts
- [x] T082 [P] [US1] Create API endpoint POST /api/vaults/:vaultId/withdraw in backend/src/routes/vaults.ts
- [x] T083 [P] [US1] Create API endpoint GET /api/vaults/:vaultId/history for transaction history in backend/src/routes/vaults.ts
- [x] T084 [US1] Implement Supabase sync for vault state updates in backend/src/services/vaultSyncService.ts

### Frontend Integration for User Story 1

- [x] T085 [US1] Create VaultDeployment component integrating builder output in frontend/src/components/vault/VaultDeployment.tsx
- [x] T086 [US1] Implement gas fee estimation display before deployment in frontend/src/components/vault/FeeEstimator.tsx
- [x] T087 [US1] Create deposit/withdraw interface in frontend/src/components/vault/VaultActions.tsx
- [x] T088 [US1] Implement vault dashboard showing current state and performance in frontend/src/components/vault/VaultDashboard.tsx
- [x] T089 [US1] Create transaction history view in frontend/src/components/vault/TransactionHistory.tsx
- [x] T090 [US1] Add loading states for deployment and transactions in frontend/src/components/vault/VaultDeployment.tsx
- [x] T091 [US1] Implement error handling for failed deployments with actionable messages in frontend/src/components/vault/VaultDeployment.tsx

### Integration Notes for User Story 1

Note: Integration test automation is deferred for MVP. Implementers should perform manual end-to-end checks using the quickstart guide in `docs/quickstart.md`.

**Checkpoint**: Users can create, deploy, and operate basic yield vaults with automatic rebalancing

---

## Phase 6: User Story 3 - Backtest Vault Strategy (Priority: P2)

**Goal**: Enable historical simulation of vault strategies to validate performance before deployment

**Independent Test**: Configure vault strategy, select 3-month historical period, run backtest, receive performance report with returns and drawdowns within 15 seconds

### Backend Implementation for User Story 3

- [ ] T095 [P] [US3] Create historical price data fetching service using Horizon SDK in backend/src/services/historicalDataService.ts
- [ ] T096 [P] [US3] Implement backtest simulation engine that replays vault rules in backend/src/services/backtestEngine.ts
- [ ] T097 [US3] Integrate Prophet for APY trend forecasting in backtest scenarios in backend/src/services/prophetService.ts
- [ ] T098 [US3] Create performance metrics calculator (returns, volatility, drawdown) in backend/src/lib/performanceCalculator.ts
- [ ] T099 [US3] Create API endpoint POST /api/backtests to initiate backtest in backend/src/routes/backtests.ts
- [ ] T100 [US3] Create API endpoint GET /api/backtests/:backtestId for results in backend/src/routes/backtests.ts
- [ ] T101 [US3] Implement backtest result caching in Supabase in backend/src/services/backtestService.ts

### Frontend Implementation for User Story 3

- [ ] T102 [US3] Create BacktestConfig component for time period selection in frontend/src/components/backtest/BacktestConfig.tsx
- [ ] T103 [US3] Implement backtest results visualization with Recharts in frontend/src/components/backtest/BacktestResults.tsx
- [ ] T104 [US3] Create timeline view showing rule triggers and actions in frontend/src/components/backtest/BacktestTimeline.tsx
- [ ] T105 [US3] Display comparison to buy-and-hold strategy in frontend/src/components/backtest/StrategyComparison.tsx
- [ ] T106 [US3] Add export functionality for backtest reports in frontend/src/components/backtest/BacktestResults.tsx
- [ ] T107 [US3] Show loading progress during backtest simulation in frontend/src/components/backtest/BacktestProgress.tsx

### Integration Notes for User Story 3

Note: Automated integration tests for backtests are deferred for MVP; perform manual validation and add lightweight scripts in `backend/scripts/` to reproduce common scenarios.

**Checkpoint**: Users can validate strategies with historical simulations before risking real assets

---

## Phase 7: User Story 2 - AI-Assisted Strategy Optimization (Priority: P2)

**Goal**: Provide AI-generated strategy improvements based on market data and sentiment analysis

**Independent Test**: Create suboptimal vault, request AI suggestions, review 3-5 recommendations with performance projections, apply one suggestion, verify vault config updates

### Backend Implementation for User Story 2

- [ ] T110 [P] [US2] Create X/Twitter sentiment fetching service in backend/src/services/twitterService.ts
- [ ] T111 [P] [US2] Create Reddit sentiment fetching service in backend/src/services/redditService.ts
- [ ] T112 [US2] Implement OpenAI-based sentiment classification with prompt templates in backend/src/services/sentimentAnalysisService.ts
- [ ] T113 [US2] Create strategy analyzer that identifies improvement opportunities in backend/src/services/strategyAnalyzer.ts
- [ ] T114 [US2] Implement suggestion generator combining historical data, sentiment, and Prophet forecasts in backend/src/services/suggestionGenerator.ts
- [ ] T115 [US2] Create API endpoint POST /api/vaults/:vaultId/suggestions in backend/src/routes/suggestions.ts
- [ ] T116 [US2] Implement suggestion caching to reduce API costs in backend/src/services/suggestionCacheService.ts

### Frontend Implementation for User Story 2

- [ ] T117 [US2] Create AISuggestions component displaying recommendations in frontend/src/components/ai/AISuggestions.tsx
- [ ] T118 [US2] Implement suggestion detail view with supporting data visualization in frontend/src/components/ai/SuggestionDetail.tsx
- [ ] T119 [US2] Create suggestion application flow that updates vault config in frontend/src/components/ai/ApplySuggestion.tsx
- [ ] T120 [US2] Display sentiment indicators for assets in builder in frontend/src/components/builder/SentimentIndicator.tsx
- [ ] T121 [US2] Add "Get AI Suggestions" button in vault builder toolbar in frontend/src/components/builder/BuilderToolbar.tsx

### Integration Notes for User Story 2

Note: Automated AI suggestion integration tests are deferred for MVP; provide example payloads and manual test instructions in `docs/quickstart.md`.

**Checkpoint**: Users receive AI-powered strategy improvements to enhance vault performance

---

## Phase 8: User Story 4 - Mint and Share Vault NFT (Priority: P3)

**Goal**: Enable vault monetization and community co-investment through NFT shares

**Independent Test**: Deploy successful vault, mint NFT with 30% ownership, list in marketplace, have test user purchase shares, verify profit distribution

### Smart Contract Implementation for User Story 4

- [ ] T124 [P] [US4] Create VaultNFT data structures in contracts/soroban/src/nft_types.rs
- [ ] T125 [P] [US4] Implement NFT minting function with ownership percentage in contracts/soroban/src/vault_nft.rs
- [ ] T126 [P] [US4] Implement profit distribution logic proportional to shares in contracts/soroban/src/vault_nft.rs
- [ ] T127 [US4] Add NFT transfer functionality with ownership updates in contracts/soroban/src/vault_nft.rs

### Backend Implementation for User Story 4

- [ ] T128 [P] [US4] Create API endpoint POST /api/vaults/:vaultId/nft to mint NFT in backend/src/routes/nfts.ts
- [ ] T129 [P] [US4] Create API endpoint POST /api/marketplace/listings to list NFT in backend/src/routes/marketplace.ts
- [ ] T130 [P] [US4] Create API endpoint GET /api/marketplace/listings for browsing in backend/src/routes/marketplace.ts
- [ ] T131 [P] [US4] Create API endpoint POST /api/marketplace/purchase to buy NFT shares in backend/src/routes/marketplace.ts
- [ ] T132 [US4] Implement yield distribution service for multi-owner vaults in backend/src/services/yieldDistributionService.ts

### Frontend Implementation for User Story 4

- [ ] T133 [US4] Create NFT minting interface in vault dashboard in frontend/src/components/nft/MintNFT.tsx
- [ ] T134 [US4] Implement marketplace listing creation form in frontend/src/components/marketplace/CreateListing.tsx
- [ ] T135 [US4] Create marketplace browse interface with filters in frontend/src/components/marketplace/MarketplaceBrowse.tsx
- [ ] T136 [US4] Implement vault detail page showing performance and ownership in frontend/src/components/marketplace/VaultDetail.tsx
- [ ] T137 [US4] Create NFT purchase flow with share calculation in frontend/src/components/marketplace/PurchaseNFT.tsx
- [ ] T138 [US4] Display co-ownership dashboard showing all shared vaults in frontend/src/components/vault/CoOwnershipDashboard.tsx

### Integration Notes for User Story 4

Note: NFT marketplace integration tests are deferred for MVP; provide manual test checklist and example accounts in `docs/quickstart.md`.

**Checkpoint**: Vault marketplace enables community co-investment and TVL growth

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and platform reliability

- [ ] T141 [P] Add comprehensive error boundaries in React components in frontend/src/components/ErrorBoundary.tsx
- [ ] T142 [P] Implement platform-wide monitoring and logging using Vercel Analytics in backend/src/lib/monitoring.ts
- [ ] T143 [P] Create user onboarding flow and tutorial in frontend/src/components/onboarding/Tutorial.tsx
- [ ] T144 [P] Add accessibility improvements (ARIA labels, keyboard navigation) across all components
- [ ] T145 [P] Implement responsive design for mobile devices in frontend/src/styles/
- [ ] T146 [P] Add rate limiting to API endpoints in backend/src/middleware/rateLimiter.ts
- [ ] T147 [P] Create comprehensive API documentation using OpenAPI spec in docs/api/
- [ ] T148 [P] Write user documentation and FAQs in docs/user-guide.md
- [ ] T149 Performance optimization: Implement code splitting in frontend/vite.config.ts
- [ ] T150 Performance optimization: Add database indexes for common queries in migrations/008_indexes.sql
- [ ] T151 Security hardening: Implement input validation middleware in backend/src/middleware/validation.ts
- [ ] T152 Security hardening: Add CSRF protection for state-changing operations in backend/src/middleware/csrf.ts
- [ ] T153 [P] Create developer quickstart guide following quickstart.md template in docs/quickstart.md
-- [ ] T154 [P] Add lightweight sanity scripts for utility validation in backend/scripts/ and frontend/scripts/
- [ ] T156 Validate all success criteria from spec.md are met
- [ ] T157 Deploy to Vercel and configure environment variables
-- [ ] T158 Run smoke checks on production deployment (manual/ scripted), as appropriate

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 6 (Phase 3)**: Depends on Foundational - Wallet integration is entry point
- **User Story 5 (Phase 4)**: Depends on Foundational + US6 (needs wallet for asset display)
- **User Story 1 (Phase 5)**: Depends on Foundational + US6 + US5 (needs wallet + builder)
- **User Story 3 (Phase 6)**: Depends on US1 (needs vault structure) - Can run parallel with US2
- **User Story 2 (Phase 7)**: Depends on US1 (needs vault structure) - Can run parallel with US3
- **User Story 4 (Phase 8)**: Depends on US1 (needs deployed vaults)
- **Polish (Phase 9)**: Depends on all desired user stories being complete

### User Story Dependencies

**Critical Path (MVP)**:
1. Setup → Foundational → US6 (Wallet) → US5 (Builder) → US1 (Vault Deploy) = **CORE MVP**

**Parallel After MVP**:
- US3 (Backtest) can develop in parallel with US2 (AI Suggestions) after US1 completes
- Both are independent and don't block each other

**Final Phase**:
- US4 (NFT Marketplace) requires US1 but can develop while US2/US3 are in progress

### Within Each User Story

 - Smart contract implementation before backend services (US1, US4)
- Backend services before frontend integration
- Core functionality before error handling and polish
- Story complete and independently tested before moving to next priority

### Parallel Opportunities

**Phase 1 (Setup)**: Tasks T003-T016 can run in parallel (different package.json files)

**Phase 2 (Foundational)**: 
- Tasks T018-T023 (database schemas) can run in parallel
- Tasks T024-T036 (middleware, utilities, UI components) can run in parallel after schemas

**Phase 5 (User Story 1)**:
- Contract-related tasks and implementation work (contracts, deployment services) can be executed in parallel where safe; implementation functions (T067-T069) should follow types (T066)
 - API endpoint tasks (T075-T083) can run in parallel after core contract interfaces (T074)

**Phase 6 (User Story 3)**:
- Tasks T095-T096 (data + simulation) can run in parallel
- Tasks T099-T100 (API endpoints) can run in parallel

**Phase 7 (User Story 2)**:
- Tasks T110-T111 (sentiment services) can run in parallel

**Phase 8 (User Story 4)**:
- Tasks T124-T126 (NFT contract) can run in parallel
- Tasks T128-T131 (API endpoints) can run in parallel

**Phase 9 (Polish)**:
- Almost all tasks (T141-T154) can run in parallel by different team members

---

## Parallel Example: User Story 1 Implementation

```bash
# Week 1 Day 1-3: Parallel contract and API development
Developer A: "Implement vault initialization and core contract types (T066)"
Developer B: "Implement deposit and withdrawal functions (T068, T069)"
Developer C: "Implement backend deployment and monitor services (T075, T076)"

# Week 1 Day 4-5: Parallel API and frontend development
Developer A: "Create API endpoint POST /api/vaults (T079)"
Developer B: "Create API endpoint GET /api/vaults/:vaultId (T080)"
Developer C: "Frontend: VaultDeployment + VaultDashboard components (T085, T088)"

# Week 2: Manual verification and polish
All developers: Integrate components and run manual end-to-end checks
```

---

## Testing & CI/CD (deferred for MVP)

Formal automated testing and CI/CD tasks have been intentionally deferred to accelerate MVP delivery. Implementers should rely on lightweight sanity scripts and manual checklists during the fast iteration. Add automation later once core features (US6, US5, US1) are stable.


**Benefits**:
- Deliver value every 2-3 days
- Each story independently testable
- Can stop at any checkpoint for demo/launch
- Parallel development opportunities after MVP

### Parallel Team Strategy

**Optimal Team Size**: 3 developers + 1 designer

**Week 1 Allocation**:
- **Dev A**: Setup + Foundational (contracts focus)
- **Dev B**: Setup + Foundational (backend focus)
- **Dev C + Designer**: Setup + Foundational (frontend focus)

**Week 2 Allocation** (after Foundational complete):
- **Dev A**: Smart contracts (US1 vault contract)
- **Dev B**: Backend services (US1 monitoring + US6 wallet)
- **Dev C**: Frontend (US5 builder + US6 wallet UI)
- **Designer**: Visual builder components and UX

**Week 3+ Allocation** (post-MVP):
- **Dev A**: US3 (Backtest engine)
- **Dev B**: US2 (AI services)
- **Dev C**: US4 (NFT marketplace)

---

## Testing & CI/CD (MVP note)

Automated testing and CI/CD are intentionally deprioritized for the fast MVP. Use lightweight sanity scripts, local checks, and manual end-to-end verification during initial development. Add automation after core features (US6, US5, US1) stabilize.

---

## Risk Mitigation

Based on plan.md Risk Register:

| Risk | Tasks Addressing | Mitigation Strategy |
|------|------------------|---------------------|
| Soroban documentation gaps | T002, T066-T074 | Early prototype; use Stellar Discord; allow +1 day buffer |
| React Flow complexity | T052-T060 | Use community templates; prototype validation early (T053) |
| Prophet accuracy | T097 | Validate against real data; document uncertainty (T106) |
| Sentiment API rate limits | T110-T112, T116 | Implement caching (T116); queue requests |
| Timeline pressure | Entire plan | Strict MVP scope (US1+US5+US6); defer P2/P3 if needed |

---

## Success Metrics Validation

Tasks explicitly address spec.md Success Criteria:

- **SC-001** (10min vault creation): T037-T091 (complete flow)
- **SC-002** (30s wallet connect): T037-T046
-- **SC-003** (15s backtest): T095-T101 (backtest engine & endpoints)
- **SC-004** (60s rule execution): T077 (polling service)
-- **SC-005** (10s AI suggestions): T110-T116
- **SC-007** (99.5% uptime): T142 (monitoring)
- **SC-009** (70% deploy rate): T086-T091 (UX optimization)
- **SC-012** (90% success rate): T024, T029, T074, T091 (error handling)

---

## Notes

- **[P] tasks**: Different files, no dependencies - can run in parallel
- **[Story] label**: Maps task to specific user story for traceability
-- **QA note**: Formal automated test suites are deferred; maintain manual test checklists and sanity scripts for critical flows.
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- If timeline slips: Prioritize US1+US5+US6 (core MVP), defer US2-US4 to Phase 2

---

## Estimated Timeline

**Optimistic** (3 experienced devs, parallel execution): 10 days  
**Realistic** (2-3 devs, some sequential work): 12-14 days  
**Conservative** (learning curve, blockers): 15-18 days

**MVP Only** (US1+US5+US6): 7-10 days  
**Full Feature Set** (all user stories): 15-20 days