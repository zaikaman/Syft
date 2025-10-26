# Research & Clarification: Syft DeFi Yield Vault Platform

**Date**: October 26, 2025  
**Status**: Awaiting User Clarifications (5 questions)  
**Phase**: 0 - Research & Clarification

---

## Clarification Questions for Architecture Decisions

The implementation plan requires your input on 5 critical architecture decisions before proceeding to Phase 1 (Design & Contracts). Please review and provide answers:

---

### Q1: Vault Configuration Storage Strategy

**Question**: Should vault strategy rules be stored on-chain (in the contract) or off-chain (in Supabase)?

**Context**: This affects contract complexity, gas costs, query performance, and decentralization guarantees.

**Options**:

| Option | Storage Model | Pros | Cons | Recommendation |
|--------|---------------|------|------|-----------------|
| A | **Full On-Chain** | Simple; fully transparent; no server dependencies; rules tamper-proof | Higher gas costs; harder to modify strategies; bloats contract state | Best for trustlessness, worst for UX |
| B | **Hybrid (Recommended)** | Off-chain rules (Supabase) + on-chain state; efficient; UX-friendly; rules still auditable via hash | Requires server coordination; slight trust increase | Balance of cost, UX, and auditability |
| C | **Off-Chain Only** | Minimal gas; fast strategy modifications; cheapest deployment | Less transparent; requires complete server trust; harder to prove rule execution | Best for rapid iteration, riskier long-term |

**Your choice**: _[A, B, or C]_

---

### Q2: Backtest Privacy & ZK-Proofs

**Question**: Should backtests use halo2 ZK-proofs for privacy, or simpler off-chain confidentiality?

**Context**: halo2 ZK-circuits are complex (learning curve + 2-3 extra days development). Off-chain privacy is simpler but less cryptographically robust.

**Options**:

| Option | Implementation | Privacy Model | Complexity | Timeline Impact | Recommendation |
|--------|----------------|---------------|-----------|-----------------|-----------------|
| A | **Off-Chain Privacy (MVP)** | Backtests stored encrypted in Supabase; visible only if user publishes | Simple, user-controlled | 0 days | Ideal for MVP; sufficient for most users |
| B | **Full ZK-Proofs (Phase 2)** | Backtests include zk-proof; proof verifiable without revealing simulation details | Cryptographically robust | +2-3 days | Defer to Phase 2; complex but powerful |
| C | **Hybrid** | Off-chain MVP + prepare ZK integration for Phase 2 | Medium | +0 days (MVP) | Best long-term, lowest risk |

**Your choice**: _[A (off-chain MVP), B (full ZK), or C (hybrid)]_

---

### Q3: AI Suggestion Refresh Strategy

**Question**: Should AI suggestions for vault configurations refresh automatically or only on-demand?

**Context**: This affects API costs, user experience, and computational load.

**Options**:

| Option | Refresh Pattern | User Experience | API Cost | Implementation | Recommendation |
|--------|-----------------|-----------------|----------|-----------------|-----------------|
| A | **On-Demand Only** | User clicks "Get Suggestions" button when wanted | Low cost; predictable | Simple | Best for MVP; user controls costs |
| B | **Auto-Refresh Periodically** | Suggestions update every 60 min or hourly | Higher cost; always fresh | Medium complexity | Better UX; harder to forecast costs |
| C | **Smart Hybrid** | Auto-refresh during market hours (9 AM-5 PM UTC); on-demand other times | Balanced | Medium-high | Sweet spot; but needs schedule config |

**Your choice**: _[A (on-demand), B (auto-refresh), or C (hybrid)]_

---

### Q4: Vault Rule Trigger Monitoring

**Question**: How should deployed vaults monitor for rule triggers—active polling, event-driven, or hybrid?

**Context**: This affects latency (<60s target), cost, and architectural complexity.

**Options**:

| Option | Monitoring Pattern | Latency | Cost | Complexity | Reliability |
|--------|-------------------|---------|------|-----------|------------|
| A | **Polling Every 60s** | 0-60s (avg 30s) | Low; predictable | Simple background job | Reliable; misses fast-changing conditions |
| B | **Event-Driven (Horizon)** | 0-10s (avg 5s) | Medium; pay per event | High; requires webhook handler | Lower latency; race conditions possible |
| C | **Hybrid (Recommended)** | <10s on events; 60s fallback | Medium; predictable + event charges | Medium | Best reliability + latency combination |

**Your choice**: _[A (polling), B (events), or C (hybrid)]_

---

### Q5: MVP Feature Scope for Rules

**Question**: For the MVP (10-day timeline), should vaults support only simple rule types or the full feature set?

**Context**: This affects what users can build and timeline pressure.

**Options**:

| Option | Rule Types Supported | Examples | Timeline | P1/P2 Impact | Recommendation |
|--------|---------------------|----------|----------|--------------|-----------------|
| A | **Simple Only (MVP)** | Asset allocation %, APY thresholds, time-based | Achievable in 10 days | P1 features only; P2 adds volatility | Safest for timeline; still powerful for beginners |
| B | **Full Feature Set** | All from spec: allocation, APY, volatility, time-based, sentiment-driven | Ambitious; may slip | All P1+P2; leaves NFT marketplace for Phase 2 | Ambitious; requires focused team |
| C | **Incremental Launch** | MVP with simple rules (10 days); add volatility in week 2 | 10 days + 3 days iteration | P1 in MVP; P2 shortly after | Balanced; some feature delay |

**Your choice**: _[A (simple MVP), B (full feature set), or C (incremental)]_

---

## Recommendation Summary

Based on best practices for 10-day DeFi MVP launch:

1. **Q1 (Storage)**: Recommend **Option B (Hybrid)** for balance of cost, UX, and auditability
2. **Q2 (Privacy)**: Recommend **Option A or C** (defer ZK to Phase 2) to protect timeline
3. **Q3 (AI Refresh)**: Recommend **Option A (On-Demand)** for MVP cost control; upgrade to C later
4. **Q4 (Monitoring)**: Recommend **Option C (Hybrid)** for reliability and latency
5. **Q5 (Rules)**: Recommend **Option A or C** to ensure timeline; volatility as Phase 1.5

---

## Next Steps

Please provide your answers to all 5 questions in this format:
```
Q1: B (Hybrid)
Q2: A (Off-Chain Privacy MVP)
Q3: A (On-Demand)
Q4: C (Hybrid)
Q5: A (Simple MVP) or C (Incremental)
```

Once clarified, I will proceed with Phase 1 (Design & Contracts) to generate:
- `data-model.md` (entities and relationships)
- `contracts/` (API and smart contract specifications)
- `quickstart.md` (development guide)
- Updated agent context for implementation

