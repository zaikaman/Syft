<!--
Sync Impact Report:
- Version: INITIAL → 1.0.0
- New Constitution: Initial ratification with four core principles
- Added Principles:
  * Code Quality & Maintainability (comprehensive standards for clean code)
  * Testing Standards & Test-First Development (TDD with comprehensive coverage)
  * User Experience Consistency (UI/UX patterns and accessibility)
  * Performance & Reliability Requirements (benchmarks and monitoring)
- Added Sections:
  * Quality Gates (enforcement checkpoints)
  * Development Workflow (process and review standards)
- Templates Status:
  ✅ plan-template.md - Constitution Check section aligns with all principles
  ✅ spec-template.md - User scenarios and requirements map to UX consistency
  ✅ tasks-template.md - Test-first approach enforced in task organization
- Follow-up Actions: None - all placeholders resolved
-->

# Syft Constitution

## Core Principles

### I. Code Quality & Maintainability

All code MUST meet the following non-negotiable standards:

- **Clean Code**: Functions/methods MUST do one thing well (Single Responsibility Principle)
- **Naming**: Names MUST be descriptive and reveal intent (no abbreviations except domain-standard)
- **Function Size**: Functions MUST be under 50 lines; over 30 lines requires justification
- **Cyclomatic Complexity**: Maximum complexity of 10 per function; over 5 requires comment justification
- **DRY Principle**: No code duplication; extract shared logic into reusable functions/modules
- **Comments**: Code MUST be self-documenting; comments explain WHY not WHAT
- **Error Handling**: All error paths MUST be explicitly handled (no silent failures)
- **Dependencies**: External dependencies MUST be justified and documented in plan.md
- **Type Safety**: Use static typing where available (TypeScript, Python type hints, etc.)

**Rationale**: Maintainable code reduces technical debt, accelerates feature delivery, 
and enables team scalability. Poor code quality compounds over time, making changes 
increasingly expensive and error-prone.

### II. Testing Standards & Test-First Development (NON-NEGOTIABLE)

Test-Driven Development is mandatory for all features:

- **TDD Workflow**: Tests written → User approved → Tests fail → Implementation → Tests pass
- **Test Coverage**: Minimum 80% line coverage; 90% for critical business logic
- **Test Types Required**:
  - **Contract Tests**: MUST exist for all API endpoints and module interfaces
  - **Integration Tests**: MUST exist for user journeys and cross-module interactions
  - **Unit Tests**: SHOULD exist for complex business logic (optional but recommended)
- **Test Independence**: Each test MUST be runnable in isolation (no test interdependencies)
- **Test Naming**: Test names MUST clearly describe what is tested and expected outcome
- **Fast Tests**: Unit tests MUST run in <1s each; integration tests <10s each
- **CI/CD**: All tests MUST pass before merge; no exceptions

**Rationale**: TDD ensures correctness by design, serves as living documentation, 
enables confident refactoring, and catches regressions immediately. Writing tests 
first clarifies requirements and exposes design issues early.

### III. User Experience Consistency

All user-facing features MUST maintain consistent experience:

- **Design Patterns**: Reuse established UI patterns and components across features
- **Error Messages**: User-facing errors MUST be actionable and non-technical
- **Response Times**: Interactive operations MUST respond within 200ms (perceived as instant)
- **Loading States**: Operations >200ms MUST show loading indicators with progress where possible
- **Accessibility**: MUST meet WCAG 2.1 Level AA standards:
  - Keyboard navigation for all interactive elements
  - Proper ARIA labels and semantic HTML
  - Sufficient color contrast (4.5:1 for normal text, 3:1 for large text)
  - Screen reader compatibility
- **Responsive Design**: UI MUST work on mobile, tablet, and desktop screen sizes
- **Consistency Checklist**:
  - Same action produces same result across different screens
  - Visual hierarchy consistent (headings, spacing, colors)
  - Interaction patterns predictable (buttons, forms, navigation)
- **User Stories**: Every feature MUST have prioritized user stories (P1, P2, P3)
- **Independent Testing**: Each user story MUST be independently testable as MVP

**Rationale**: Inconsistent UX confuses users, increases learning curve, and erodes 
trust. Consistent patterns reduce cognitive load and improve user satisfaction. 
Accessibility is both a legal requirement and moral obligation.

### IV. Performance & Reliability Requirements

All features MUST meet quantified performance benchmarks:

- **Response Time Targets**:
  - API endpoints: <100ms p50, <500ms p95, <2s p99
  - Page loads: <1s time-to-interactive on 3G connection
  - Database queries: <50ms for simple queries, <200ms for complex
- **Throughput**: System MUST handle minimum 1000 concurrent users without degradation
- **Resource Limits**:
  - Memory: No memory leaks; steady-state memory usage after warmup
  - CPU: Average utilization <70% at expected load
  - Storage: Implement data retention policies; no unbounded growth
- **Reliability Targets**:
  - Uptime: 99.9% availability (max 43 minutes downtime/month)
  - Error Rate: <0.1% of requests result in 5xx errors
  - Data Durability: Zero data loss for committed transactions
- **Monitoring & Observability**:
  - All critical operations MUST be instrumented with metrics
  - Structured logging with correlation IDs for request tracing
  - Performance metrics MUST be continuously monitored and alerted
  - Error tracking with stack traces and context
- **Performance Testing**: Load/stress tests MUST validate benchmarks before production
- **Graceful Degradation**: System MUST handle failures gracefully (circuit breakers, timeouts, fallbacks)

**Rationale**: Performance is a feature, not an afterthought. Slow systems frustrate 
users and incur infrastructure costs. Unreliable systems damage reputation and user 
trust. Quantified benchmarks enable objective measurement and accountability.

## Quality Gates

All features MUST pass these checkpoints before proceeding:

### Gate 1: Specification Review (Before Planning)
- [ ] User stories prioritized (P1, P2, P3) and independently testable
- [ ] Success criteria measurable and technology-agnostic
- [ ] Accessibility requirements identified
- [ ] Performance benchmarks defined for the feature

### Gate 2: Constitution Check (Before Implementation)
- [ ] Code structure follows single responsibility principle
- [ ] Test strategy defined (contract, integration, unit tests)
- [ ] UX patterns identified and consistent with existing features
- [ ] Performance targets quantified in plan.md Technical Context

### Gate 3: Implementation Review (Before Merge)
- [ ] All tests written first and initially failed (TDD verified)
- [ ] Code complexity within limits (cyclomatic complexity ≤10)
- [ ] Test coverage ≥80% (≥90% for critical business logic)
- [ ] User-facing errors are actionable and clear
- [ ] Accessibility checklist completed (keyboard nav, ARIA, contrast)
- [ ] Performance benchmarks validated (load tests passed)
- [ ] Monitoring/logging instrumented for critical operations

### Gate 4: Production Readiness (Before Deployment)
- [ ] All quality gates passed
- [ ] Documentation updated (quickstart.md, API docs if applicable)
- [ ] Performance monitoring dashboards configured
- [ ] Rollback plan documented
- [ ] User story independently validated in staging environment

## Development Workflow

### Planning Phase
1. Feature specification created with prioritized user stories (P1, P2, P3)
2. Each user story validated as independently testable MVP
3. Performance and accessibility requirements defined
4. Constitution Check completed and violations justified (if any)

### Implementation Phase
1. **Tests First**: Write contract and integration tests based on user stories
2. **Verify Failure**: Run tests to confirm they fail (red phase)
3. **Implement**: Write minimal code to pass tests (green phase)
4. **Refactor**: Clean up code while keeping tests green
5. **Quality Check**: Verify complexity, coverage, and style standards
6. **Commit**: Small, atomic commits with descriptive messages

### Review Phase
1. Self-review against all four core principles before requesting review
2. Peer review verifies constitution compliance (not just correctness)
3. Automated CI checks enforce coverage, complexity, and test passage
4. Performance tests validate benchmarks under expected load
5. Accessibility audit for user-facing changes

### Deployment Phase
1. Merge only after all quality gates passed
2. Monitor key metrics post-deployment (error rate, latency, resource usage)
3. Validate user stories in production environment
4. Document any issues or learnings in feature retrospective

## Governance

**Authority**: This constitution supersedes all other development practices and conventions.
Changes to working patterns MUST align with these principles.

**Amendment Process**:
- Proposals MUST document rationale, impact, and migration plan
- Amendments require team consensus and updated version number
- Version follows semantic versioning (MAJOR.MINOR.PATCH):
  - **MAJOR**: Principle removed/redefined (breaking governance change)
  - **MINOR**: New principle/section added or materially expanded
  - **PATCH**: Clarifications, wording improvements, non-semantic changes

**Compliance & Enforcement**:
- All PRs MUST be reviewed for constitution compliance
- Constitution violations MUST be documented and justified in plan.md Complexity Tracking
- Unjustified complexity or standard violations block merge
- Team members MUST escalate unresolved compliance disputes
- Quarterly retrospective reviews constitution effectiveness

**Living Document**: This constitution evolves with the project. Teams SHOULD propose 
amendments when principles prove impractical or when new insights emerge.

**Guidance**: Runtime development guidance is maintained in `.specify/templates/agent-file-template.md` 
and auto-generated from feature plans. Consult for language-specific commands and current 
technology stack.

**Version**: 1.0.0 | **Ratified**: 2025-10-26 | **Last Amended**: 2025-10-26
