# Computer-Use Automation System - Technical Report

## Architecture

The system follows a three-phase lifecycle: **discover**, **replay**, and **escalate**.

### Core Components

1. **Surface Adapter** (`src/surface/`)
   - Abstraction layer between automation logic and specific UI surfaces
   - Current implementation: `PlaywrightWebSurface` for web browsers
   - Interface: `initialize()`, `observe()`, `act()`, `close()`, `getContext()`, `restoreContext()`
   - Designed for extensibility to native apps, APIs, or other surfaces

2. **Discovery Agent** (`src/agent/`)
   - LLM-driven loop: observe UI → decide next action → act → repeat
   - Uses accessibility tree representation for lightweight observations
   - Generates capability artifacts capturing the discovered interaction sequence
   - Model: Claude Haiku (cost-optimized for exploration tasks)

3. **Artifact Schema** (`src/artifact/`)
   - Versioned JSON schema validated with Zod
   - Contains: metadata, parameters, steps (actions + expected outcomes), success criteria
   - Steps reference elements using role-based or CSS selectors
   - Parameters support variable substitution (e.g., `{memberId}`)

4. **Replay Executor** (`src/replay/`)
   - Executes artifacts deterministically without LLM
   - Interpolates parameters into action values
   - Checks for business outcomes after each step
   - Returns structured outcome: Success, BusinessOutcome, Recoverable, or HardFailure

5. **Policy Engine** (`src/policy/`)
   - Domain allowlist: restricts navigation to approved domains
   - Risky action detection: blocks interactions with destructive elements
   - PII redaction: removes emails, SSNs, credit cards from logs

6. **Escalation Manager** (`src/escalation/`)
   - Creates intervention requests with context and session snapshots
   - Supports pause/cede/resume for live handoff to human operators
   - Preserves browser state (cookies, storage) across handoff

### Data Flow

```
Discovery:
  Start URL → Surface.initialize() → observe() → LLM decision → act() → observe() → ...
  → CapabilityArtifact.json

Replay:
  Artifact + Parameters → Surface.initialize() → interpolate → executeStep() → detect outcome
  → Success | BusinessOutcome | Error

Escalation:
  Trigger → createInterventionRequest() → pause() → cede(operatorId) → [human work] → resume()
```

## Artifact Schema

### Schema Definition

```typescript
{
  version: "1.0",
  id: string,                    // UUID
  name: string,                  // Slug-friendly identifier
  description: string,           // Human-readable goal
  domain: string,                // Target domain
  createdAt: ISO8601,
  updatedAt: ISO8601,
  parameters: [                  // Input variables
    { name, type, description, required }
  ],
  steps: [                       // Interaction sequence
    {
      id: string,
      action: {
        type: "click" | "type" | "navigate" | "wait" | "screenshot",
        target?: string,         // Selector (role:name or CSS)
        value?: string,          // Text for type actions (supports {param})
        timeout?: number,
        description: string
      },
      expectedOutcome: string,
      fallback?: {               // Future: conditional branching
        condition: string,
        nextStepId?: string
      }
    }
  ],
  successCriteria: [string],     // Validation rules
  metadata: {
    discoveryModel?: string,
    discoveryRun?: string,
    tags?: [string]
  }
}
```

### Versioning Strategy

- **Breaking changes** (e.g., new required field): increment major version → `2.0`
- **Backward-compatible additions**: increment minor version → `1.1`
- Replay executor checks version and rejects unsupported schemas
- Migration tools (future) convert old artifacts to new schemas

### Example

See `evidence/artifacts/member-lookup-capability.json` for a complete example capturing the member lookup flow.

## Determinism & Error Handling

### Deterministic Replay Guarantees

1. **No LLM in the loop**: All decisions encoded in artifact
2. **Parameter interpolation**: Variables substituted before execution
3. **Explicit wait steps**: Timing controlled by artifact, not adaptive delays
4. **Selector stability**: Prefer role-based selectors (semantic, resilient to styling changes)

### Error Taxonomy

The system classifies outcomes into four categories:

1. **Success**
   - All steps completed
   - Result data extracted from final page state
   - Example: Member 12345 found, balance retrieved

2. **BusinessOutcome**
   - Valid business result, not a technical error
   - Detected by keyword matching in accessibility tree
   - Examples: "record not found", "access denied", "insufficient balance"
   - Code: `record_not_found`, `access_denied`, etc.

3. **Recoverable**
   - Transient technical error
   - Retry may succeed
   - Examples: network timeout, temporary server unavailable
   - Logged for retry logic (not implemented in demo)

4. **HardFailure**
   - Permanent error requiring intervention
   - Examples: element not found (UI changed), authentication failure
   - Triggers escalation flow

### Detection Logic

Business outcomes are detected by checking the accessibility tree for known patterns:
- "record not found" → `record_not_found`
- "access denied" | "unauthorized" → `access_denied`

This runs after each step, not just at the end, enabling early detection.

## Heterogeneity & Multi-Tenant

### Heterogeneous Surfaces

**Current implementation**: Web surfaces via Playwright  
**Design for extensibility**:

- **Surface Adapter Interface**: `SurfaceAdapter` abstracts observe/act operations
- **Native Apps**: Implement adapter using Appium or platform-specific tools (UIAutomator, XCTest)
- **APIs**: Adapter translates REST/GraphQL calls to surface actions; observation = response body
- **Terminal UIs**: Adapter captures terminal output as text; actions = keystrokes/commands

**Artifact portability**: Steps use semantic selectors (role:name) where possible. Surface-specific fallbacks (XPath, accessibility IDs) stored in metadata.

### Multi-Tenant Considerations

#### Isolation

- **Browser contexts**: Each tenant session gets isolated Playwright context (cookies, storage, cache)
- **Artifact namespacing**: Prefix artifact IDs with tenant identifier (`tenant_123:artifact_id`)
- **Policy per tenant**: Separate domain allowlists, redaction patterns, escalation endpoints

#### Scaling

- **Stateless replay**: Executor instances can run in parallel (Kubernetes pods, Lambda functions)
- **Artifact storage**: Centralized registry (S3, database) with versioning and ACLs
- **Execution queue**: Tenant-partitioned queue (SQS, RabbitMQ) for fairness and rate limiting

#### Security

- **Credential injection**: Tenant secrets passed as parameters at replay time, not stored in artifacts
- **Audit logs**: Every replay tagged with tenant ID, user ID, artifact version
- **Sandbox enforcement**: Surface adapter runs in restricted environment (no filesystem access, network limited to allowlist)

#### Example Multi-Tenant Flow

```
1. Tenant A uploads artifact "customer-lookup" to registry
2. Replay request arrives: { tenantId: "A", artifactId: "customer-lookup", params: {...} }
3. System loads tenant A's policy (allowlist, credentials, redaction rules)
4. Executor spins up isolated browser context
5. Executes artifact with tenant A's credentials
6. Logs tagged with tenant A
7. Result returned, context destroyed
```

## Escalation & Handoff

### Intervention Request

When automation encounters a blocker (element not found, ambiguous action, policy violation), it creates an `InterventionRequest`:

```typescript
{
  id: string,
  timestamp: ISO8601,
  reason: string,
  context: {
    currentUrl: string,
    attemptedAction?: string,
    errorMessage?: string
  },
  sessionSnapshot: {
    cookies: [...],
    storageState: {...}
  }
}
```

### Session Control Interface

```typescript
interface SessionControl {
  pause(): Promise<void>;              // Stop automation, hold browser state
  cede(operatorId: string): Promise<string>;  // Generate handoff token
  resume(fromSnapshot: any): Promise<void>;    // Restore and continue
}
```

### Handoff Mechanics

1. **Pause**: Automation stops after current step. Browser remains open with state intact.
2. **Cede**: Session snapshot serialized and encoded as base64 token. Operator receives token + current URL.
3. **Operator connects**: Token passed to new Playwright context via `restoreContext()`. Operator sees exact same page state.
4. **Resume**: After operator resolves blocker, automation calls `resume()` with updated snapshot and continues from next step.

### Implementation Notes

- **Same browser context**: Handoff token contains cookies and storage, not a new session
- **Operator UI**: Minimal implementation (CLI demo). Production would use web UI with embedded browser view.
- **Bidirectional communication**: WebSocket or long-polling for real-time updates during handoff

### Demo Flow

```bash
npm run escalate
```

Output:
1. Creates intervention request (element not found)
2. Pauses session
3. Generates handoff token
4. Resumes from snapshot

In production, step 3 would send token to operator dashboard, operator interacts with live browser, then automation resumes.

## Safety

### Domain Allowlist

**Configuration**: `SafetyPolicy` constructor takes `allowedDomains: string[]`  
**Enforcement**: Before navigate actions, URL hostname checked against allowlist  
**Behavior**: Rejected navigations return error, do not execute

Example:
```typescript
const policy = new SafetyPolicy({ allowedDomains: ['localhost', 'example.com'] });
policy.validateAction({ type: 'navigate', value: 'http://malicious.com' });
// → { allowed: false, reason: "Domain malicious.com not in allowlist" }
```

### Risky Actions

**Detection**: Actions targeting elements with keywords: `delete`, `remove`, `cancel`, `deactivate`  
**Enforcement**: Click/type actions on risky targets blocked  
**Customization**: Tenant-specific risky keyword lists

Example:
```typescript
policy.validateAction({ type: 'click', target: 'button:Delete Account' });
// → { allowed: false, reason: "Action targets risky element: button:Delete Account" }
```

### PII Redaction

**Patterns**: Email, SSN, credit card numbers  
**Application**: Logs, accessibility tree snapshots, extracted results  
**Mechanism**: Regex replacement with `[REDACTED]`

Example:
```typescript
policy.redactSensitiveData("User email: john@example.com, SSN: 123-45-6789");
// → "User email: [REDACTED], SSN: [REDACTED]"
```

### Production Enhancements

- **Content Security Policy**: Prevent inline scripts in observed pages
- **Rate limiting**: Throttle actions per second to avoid DoS patterns
- **Screenshot redaction**: Blur or mask sensitive UI regions before storing failure screenshots
- **Audit trail**: Immutable log of all actions with cryptographic signatures

## Cuts

### Scope Reductions

The following were cut from the demo to meet time constraints but are designed into the architecture:

1. **Adaptive retry logic**: Recoverable errors trigger exponential backoff retries
2. **Screenshot capture**: On failure, save annotated screenshot to evidence directory
3. **Artifact versioning UI**: Web interface for browsing artifact history and diffing versions
4. **Multi-step escalation**: Nested handoffs where operator can escalate to L2 support
5. **Confidence scoring**: LLM outputs confidence per action; low confidence triggers early escalation
6. **Parallel exploration**: Discovery agent explores multiple paths simultaneously, merges artifacts
7. **Artifact composition**: Combine smaller artifacts (login, search, extract) into workflows
8. **Real-time monitoring**: WebSocket API streaming live observations during replay
9. **Fallback selectors**: Multiple selector strategies per step (role-based, then CSS, then XPath)
10. **Native app support**: Appium surface adapter (design complete, not implemented)

### Why These Cuts Are Safe

- **Core value delivered**: Observe-decide-act loop, deterministic replay, business outcome detection, escalation all functional
- **Architectural integrity**: Cuts are leaf features, not foundational components
- **Production path clear**: Each cut has a defined extension point (e.g., `SurfaceAdapter` for new surfaces)

### What Would Change at Scale

1. **Discovery coordination**: Centralized registry prevents redundant exploration of same flows
2. **Artifact optimization**: Post-processing removes redundant steps, merges waits
3. **Execution infrastructure**: Kubernetes-based autoscaling, tenant-partitioned queues
4. **Credential management**: Integration with HashiCorp Vault or AWS Secrets Manager
5. **Observability**: OpenTelemetry tracing, Datadog metrics for success/failure rates per artifact
6. **Artifact testing**: CI/CD pipeline runs regression tests on all artifacts when UI changes detected
7. **Human-in-the-loop efficiency**: Predictive escalation based on artifact history (this artifact fails 80% → auto-escalate)
