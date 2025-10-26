# Implementation Plan: Syft DeFi Yield Vault Platform

**Feature Branch**: `001-syft-defi-platform`  
**Created**: October 26, 2025  
**Status**: Phase 0 - Research & Clarification  
**Timeline**: 10 days (MVP)

---

## Technical Context

### Tech Stack (Provided by User)

**Smart Contracts & On-Chain**:
- **Language**: Rust with Soroban
- **Compilation**: Wasm (compiled bytecode)
- **Scaffolding**: Scaffold Stellar CLI for rapid generation and deployment
- **Contract Generator**: SyftFactory for dynamic vault creation
- **Privacy**: halo2 for zk-proof privacy in backtests
- **On-Chain Queries**: Horizon SDK for real-time blockchain queries

**Frontend**:
- **Framework**: React + Vite
- **Visual Builder**: React Flow for drag-and-drop interface
- **Visualization**: Recharts for APY curves and risk metrics
- **State Management**: Zustand
- **Wallet Integration**: Stellar Wallet Kit for authentication and transactions

**Backend & AI Services**:
- **Runtime**: Node.js microservice (off-chain processing)
- **Time-Series Forecasting**: Prophet for trend analysis
- **Sentiment Analysis**: OpenAI API (GPT) for X/Twitter and Reddit sentiment analysis and classification (prompt-based or embeddings)
- **External Data**: X/Twitter and Reddit APIs for social sentiment

**Infrastructure & Data**:
- **Database/Backend**: Supabase (marketplace & backtest storage)
- **Deployment**: Vercel for serverless hosting (frontend + edge functions)
- **CI/CD**: GitHub Actions for automated testing and deployment
- **Testing**: Vitest (frontend/integration) and proptest (Rust contract tests)

**Architecture**:
- **Pattern**: Modular monorepo
- **Deployment Target**: Stellar Futurenet
- **Philosophy**: On-chain trustlessness + off-chain efficiency for scalability

### Dependencies & Integrations

| Category | Technology | Purpose | Status |
|----------|-----------|---------|--------|
| **Blockchain** | Soroban/Stellar | Smart contract execution | REQUIRED |
| **Blockchain** | Stellar AMM | Asset swaps for rebalancing | REQUIRED |
| **Blockchain** | Horizon SDK | Real-time blockchain queries | REQUIRED |
| **Frontend** | React Flow | Drag-and-drop builder | REQUIRED |
| **Data** | X/Twitter API | Sentiment signals | REQUIRED |
| **Data** | Reddit API | Community sentiment | REQUIRED |
| **AI** | Prophet | Time-series forecasting | REQUIRED |
| **AI** | OpenAI API (GPT) | Sentiment classification (prompt-based inference, embeddings) | REQUIRED |
| **Wallet** | Stellar Wallet Kit | Multi-wallet support | REQUIRED |
| **Database** | Supabase | Marketplace + vault metadata | REQUIRED |
| **Deployment** | Vercel | Frontend hosting | REQUIRED |
| **CI/CD** | GitHub Actions | Test automation | REQUIRED |
| **Privacy** | halo2 | ZK-proof generation | OPTIONAL (P2) |

### Constitution Check (Pre-Implementation)

**Gate 2 Assessment**: Reviewing against Syft Constitution Principles

#### I. Code Quality & Maintainability
- [ ] SRP Compliance: Contracts, services, and components need clear responsibility boundaries
  - Smart Contract: Handle vault logic only (deposit, withdraw, rebalance execution)
  - Factory: Generate contracts only (no state management)
  - API Service: Transform on-chain state for frontend (no business logic)
  - Frontend Builder: UI state only (no transaction logic)
- [ ] Naming Convention: Use full names (no `xchg`, use `exchange`; no `yr`, use `year`)
- [ ] Function Size: Target <50 lines; Rust closures <30 lines
- [ ] Cyclomatic Complexity: Max 10; over 5 requires justification in code comments
- [ ] Error Handling: No silent failures; all Rust Result types unwrapped with context
- [ ] Type Safety: Leverage Rust/TypeScript strict typing throughout

#### II. Testing Standards & Test-First Development (NON-NEGOTIABLE)
**TDD Workflow Required**:
1. **Contract Tests** (halo2 + proptest):
   - Vault initialization with various configurations
   - Deposit/withdrawal with different asset combinations
   - Rule evaluation and action execution
   - NFT minting and share distribution
   - Target: 90%+ coverage on vault contract

2. **Integration Tests** (Vitest):
   - Complete user journeys (connect wallet → build vault → deploy)
   - AI suggestion generation and application
   - Backtest simulation accuracy
   - Marketplace listing and purchase flow
   - Target: 80%+ coverage on business logic

3. **Contract Integration Tests**:
   - Off-chain to on-chain communication (deploy, state reads)
   - Stellar AMM integration
   - Horizon SDK real-time updates
   - Target: 80%+ coverage

**Minimum Coverage**: 80% overall; 90% for critical business logic (vault execution, NFT distribution)

#### III. User Experience Consistency
- [ ] Design Patterns: Document reusable components (VaultBuilder, RuleBlock, BlockPalette, etc.)
- [ ] Error Messages: All user-facing errors must be non-technical and actionable
  - Bad: "Contract execution reverted: insufficient liquidity"
  - Good: "Your vault couldn't rebalance because there aren't enough XLM buyers in the market right now. Try again in a few minutes."
- [ ] Response Times:
  - Wallet connection: <2s
  - Asset fetch: <1s
  - Build vault: <500ms (in-memory validation)
  - Deploy vault: 10-30s (on-chain)
  - Backtest: <15s for 90 days
  - AI suggestions: <10s
- [ ] Loading States: >500ms operations must show progress indication
- [ ] Accessibility (WCAG 2.1 AA):
  - Keyboard navigation for all blocks and actions
  - ARIA labels on drag-drop components
  - Color contrast ≥4.5:1 for text
  - Semantic HTML structure

#### IV. Performance & Reliability Requirements
- [ ] Response Time Targets:
  - API endpoints: <100ms p50, <500ms p95
  - Contract deployment: <30s
  - Backtest simulation: <15s for 365 days
  - AI analysis: <10s
- [ ] Throughput: Support 1000 concurrent active vaults
- [ ] Uptime: 99.5% (matches Success Criteria SC-007)
- [ ] Error Rate: <0.1% of vault actions fail
- [ ] Data Durability: Zero loss for executed transactions
- [ ] Monitoring: Instrument vault execution, AI requests, backtest completions

---

## Phase 0: Research & Clarification

### Research Tasks (TBD - AI Agent Output)

#### 1. Stellar Soroban Contract Best Practices
**Task**: Research Soroban contract development patterns for token management, state storage, and event emission  
**Context**: SyftFactory must generate optimized vaults quickly for MVP  
**Deliverable**: Best practices document with example contract structure

#### 2. React Flow Drag-Drop for DeFi Builders
**Task**: Research React Flow implementations for rule builders, including block validation patterns  
**Context**: Must support real-time validation and plain-language summaries  
**Deliverable**: Component architecture recommendations

#### 3. Prophet Time-Series Forecasting for APY Prediction
**Task**: Research Prophet integration for predicting APY trends over backtests  
**Context**: Accuracy critical for user confidence in strategy performance  
**Deliverable**: Model training and inference patterns

#### 4. OpenAI API Sentiment Analysis for Crypto Assets
**Task**: Research OpenAI API usage patterns for sentiment classification and embeddings with X/Twitter and Reddit data
**Context**: Must run in a Node.js microservice with <10s latency. Investigate whether to use classification via prompt engineering, fine-tuned models, or embeddings + lightweight classifier. Evaluate cost, rate limits, batching, and caching strategies.
**Deliverable**: Recommendation covering model choice (GPT-4o/GPT-4/GPT-3.5 variants), prompt templates, embedding strategies, expected latency, token/cost estimates, and caching patterns to meet latency and cost targets.

#### 5. Soroban x Horizon SDK Integration Pattern
**Task**: Research real-time contract monitoring using Horizon SDK for rule trigger detection  
**Context**: Must detect rule triggers within 60s of condition being met  
**Deliverable**: Event streaming and polling strategy

#### 6. NFT Minting on Soroban
**Task**: Research Stellar Native Asset vs. Soroban token contracts for vault NFTs  
**Context**: Must support fractional ownership and marketplace transfers  
**Deliverable**: NFT contract design and minting pattern

#### 7. Supabase Real-Time Sync with Stellar State
**Task**: Research Supabase webhooks and sync patterns for mirroring vault state  
**Context**: Marketplace needs fast queries without blocking on-chain  
**Deliverable**: State synchronization architecture

#### 8. Vercel Deployment for Full-Stack DeFi
**Task**: Research Vercel environment variables and Edge Functions for web3 data fetching  
**Context**: Must handle Stellar queries and AI requests securely  
**Deliverable**: Deployment architecture and secret management

#### 9. halo2 ZK-Proof Integration for Private Backtests
**Task**: Research halo2 circuit patterns for proving correct backtest simulation  
**Context**: Privacy requirement for P2 backtests (can defer to Phase 2)  
**Deliverable**: Circuit design sketch (Phase 2)

#### 10. Stellar AMM Integration Pattern
**Task**: Research Soroban Liquidity Pool contract interactions for automated rebalancing  
**Context**: Critical for vault action execution  
**Deliverable**: Swap and provide-liquidity patterns with slippage handling

### Clarification Questions

**Q1: Vault Configuration Persistence**  
**Context**: Should vault strategies be stored on-chain in the contract, or stored off-chain with only execution state on-chain?  
**Options**:
- A) **Full on-chain**: Strategy rules stored in contract state (simple, transparent, higher gas costs)
- B) **Hybrid**: Rules stored off-chain (Supabase), contract stores only execution state and rule hash (efficient, requires server)
- C) **Lazy evaluation**: Rules stored in contract but evaluated off-chain by oracle service (decentralized, complex)

**Q2: Backtest Privacy Implementation**  
**Context**: halo2 ZK-proofs are complex—should backtests use simpler confidentiality (off-chain only) or full ZK circuits?  
**Options**:
- A) **Off-chain privacy only**: Backtests computed off-chain, never exposed unless user publishes (simple, user controls sharing)
- B) **ZK-proofs with privacy**: Backtests include zk-proof of correctness, keeps inputs private (robust but complex, defer to Phase 2)

**Q3: AI Suggestion Frequency**  
**Context**: Should AI suggestions refresh automatically or only on-demand?  
**Options**:
- A) **On-demand only**: User clicks "Get Suggestions" (simpler, lower API costs)
- B) **Auto-refresh** periodically (e.g., hourly): Keeps suggestions fresh (better UX, higher costs)
- C) **Hybrid**: Auto-refresh during working hours (9-5), on-demand otherwise

**Q4: Vault Monitoring Service**  
**Context**: How should vaults monitor for rule triggers—active polling, event-driven, or hybrid?  
**Options**:
- A) **Polling**: Service checks vault conditions every 60s (simple, higher latency, predictable costs)
- B) **Event-driven**: React to Stellar events via Horizon webhooks (lower latency <10s, may have race conditions)
- C) **Hybrid**: Horizon events with fallback polling (robust, more complex)

**Q5: Minimum Viable Vault Configuration**  
**Context**: Should MVP vaults support only simple rules (APY, allocation %) or complex ones (volatility, time-weighted)?  
**Options**:
- A) **Simple only**: Allocation % and APY thresholds (achievable in 10 days, P2 adds volatility)
- B) **Full feature set**: All rule types from spec including volatility (ambitious, may slip timeline)

---

## Phase 1: Design & Contracts (Pending Phase 0)

### Deliverables (To Be Generated)

**Data Model** (`data-model.md`):
- User entity (wallet, profile, vault portfolio)
- Vault entity (configuration, state, performance)
- VaultRule entity (conditions, actions, trigger history)
- BacktestResult entity (simulation data, metrics)
- VaultNFT entity (ownership, marketplace listing)
- AIAnalysis entity (suggestions, supporting data)

**API Contracts** (`contracts/`):
- `openapi-vault-builder.yaml`: Vault creation endpoints
- `openapi-marketplace.yaml`: NFT listing and purchase endpoints
- `openapi-backtest.yaml`: Backtest simulation endpoints
- `openapi-ai.yaml`: AI suggestion endpoints

**Smart Contracts** (`contracts/soroban/`):
- `vault_factory.rs`: Generates vault contracts
- `vault.rs`: Core vault logic (deposit, withdraw, rebalance, monitor)
- `vault_nft.rs`: NFT minting and distribution logic
- `marketplace.rs`: NFT trading (or use Supabase-backed MVP)

**Quickstart Guide** (`quickstart.md`):
- Local development setup (Stellar Futurenet)
- Running tests (Vitest + proptest)
- Deploying vault contracts
- Running AI microservice
- Example: Create and deploy first vault

**Agent Context** (Auto-generated):
- Technology stack and CLI commands
- Project structure and module responsibilities
- Testing patterns (TDD, test organization)
- Deployment and monitoring

---

## Phase 2: Implementation Tasks (Post-Phase 1)

*To be generated after Phase 1 design completion. Will include*:
- User stories broken into sprint tasks
- Each task with TDD workflow (test template, implementation scope)
- Performance benchmarks to validate
- Accessibility checklist per user story

---

## Decision Log

| Date | Decision | Rationale | Owner |
|------|----------|-----------|-------|
| 2025-10-26 | Phase 0 start | Complete research before design | Planning |
| TBD | Vault config storage | Awaiting Q1 response | Design |
| TBD | Backtest privacy | Awaiting Q2 response | Design |
| TBD | AI refresh strategy | Awaiting Q3 response | Design |
| TBD | Monitoring approach | Awaiting Q4 response | Design |
| TBD | MVP feature set | Awaiting Q5 response | Design |

---

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| Stellar Soroban documentation gaps | Blocked contract development | MEDIUM | Early prototype; Stellar Discord community support |
| React Flow complexity for rule validation | Delayed builder MVP | MEDIUM | Use community templates; prototype validation logic early |
| Prophet model accuracy | Low user confidence in backtests | MEDIUM | Validate against real vault data; document uncertainty bounds |
| Sentiment API rate limits | Delayed AI suggestions | LOW | Queue requests; cache aggregated sentiment scores |
| Supabase sync lag | Stale marketplace data | LOW | Implement last-sync timestamp; show data freshness to users |
| Vercel cold start delays | >30s deployment times | MEDIUM | Pre-warm functions; investigate serverless costs at scale |
| 10-day timeline | Feature slip | HIGH | Prioritize P1 stories; defer P3 NFT marketplace to Phase 2 |

---

## Assumptions

1. Stellar Futurenet has sufficient capacity for 1000+ concurrent vault operations during testing
2. Stellar Wallet Kit supports all major wallets (Freighter, Albedo) without custom integration
3. Historical price/yield data for XLM and USDC is available via public APIs
4. React Flow community has battle-tested implementations for rule builders
5. OpenAI API can be called from Node.js with acceptable latency (<10s) but requires attention to token usage, batching, caching, and rate limits (cost considerations apply)
6. Supabase can handle real-time sync of vault state at 1000+ vault scale
7. Vercel's serverless environment can execute Rust Wasm and Python sentiment models
8. Team has Rust + Soroban development experience (learning curve built into timeline)
9. 10-day timeline allows MVP only; full feature set requires Phase 2 iteration
10. Marketplace transactions can be mocked with Supabase for MVP (real NFT trading Phase 2)

---

## Complexity Tracking

**Constitution Violations**: None identified at planning stage  
**Design Decisions Deferred**: halo2 ZK-proofs (Phase 2); full NFT marketplace (Phase 2)  
**Estimated Technical Debt**: Low; modular architecture enables clean separation

