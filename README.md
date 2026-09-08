# Computer-Use Automation System

An LLM-driven automation system that discovers capabilities in live web UIs and replays them deterministically. Built for Interface.ai Assignment A.

## Overview

This system demonstrates a complete observe-decide-act loop where an LLM discovers how to accomplish tasks in hostile UIs (no test IDs, complex layouts), captures those capabilities as typed artifacts, and replays them deterministically without LLM involvement.

## Features

- **LLM-driven discovery**: Uses Anthropic Claude Haiku to explore and learn UI interactions
- **Typed artifacts**: Versioned JSON schemas with typed outputs, validated with Zod
- **Deterministic replay**: Execute discovered capabilities without LLM in the loop
- **Business outcome detection**: Distinguishes between technical errors and business outcomes (e.g., "record not found")
- **Safety controls**: Domain allowlists, risky action blocking, and PII redaction enforced in discovery and replay
- **Human escalation**: Live session handoff with pause/cede/resume on the same browser context
- **Failure evidence**: Screenshots and DOM snapshots captured on hard failures

## Setup

### Prerequisites

- Node.js 20+
- npm

### Installation

```bash
npm install
npm run build
npx playwright install chromium
```

### Configuration

Copy `.env.example` to `.env` and configure:

```bash
ANTHROPIC_API_KEY=sk-ant-...  # Required for discovery, not required for replay
DEMO_BANK_PORT=3000            # Optional, defaults to 3000
```

**Note**: The Anthropic API key is only needed for the discovery phase. Replay and escalation work without it.

## Demo: Member Lookup Flow

### 1. Start the Demo Bank

In one terminal:

```bash
npm run demo:bank
```

The demo bank runs at `http://localhost:3000` with intentionally hostile HTML (table layouts, no test IDs). Test member IDs: `12345`, `67890`.

### 2. Discover Capability (requires API key)

**Note**: The current artifact in `evidence/artifacts/` is a provisional stand-in marked with `"provisional": true` in metadata. A real LLM-driven discovery run has not yet been executed. To run genuine discovery:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
npm run discover
```

This would run the LLM-driven agent to:
- Navigate to the demo bank
- Explore the UI using accessibility tree observations
- Determine actions (click, type) to accomplish the goal
- Save the discovered capability artifact to `evidence/artifacts/`

Until a real discovery run is completed, the provisional artifact can be used to test replay functionality.

### 3. Replay with Success

```bash
npm run replay evidence/artifacts/member-lookup-capability.json 12345
```

Or using the shorter form if only one artifact exists:

```bash
npm run replay "" 12345
```

**Expected output:**
```
Status: success
Result: {
  "url": "http://localhost:3000/member?id=12345",
  "data": {
    "savingsBalance": "15000.00",
    "checkingBalance": "2500.00"
  }
}
```

### 4. Replay with Business Outcome

```bash
npm run replay evidence/artifacts/member-lookup-capability.json 99999
```

**Expected output:**
```
Status: business_outcome
Business outcome: record_not_found - The requested member does not exist in the system
```

This demonstrates the system's ability to distinguish between technical failures and valid business outcomes.

### 5. Escalation Demo

```bash
npm run escalate
```

Demonstrates the human-in-the-loop escalation flow:
- Creates an intervention request with context
- Pauses the automation
- Generates a handoff token for live session transfer
- Resumes from the saved session state

## Project Structure

```
src/
├── surface/          # Surface adapter abstraction (Playwright implementation)
├── agent/            # LLM-driven discovery loop
├── artifact/         # Capability artifact schema (Zod validation)
├── replay/           # Deterministic executor with error taxonomy
├── policy/           # Safety: allowlists, risky actions, redaction
├── escalation/       # Human-in-the-loop session handoff
├── demo-bank/        # Intentionally hostile test UI
├── utils/            # Logger and utilities
└── cli.ts            # Command-line interface

evidence/
├── artifacts/        # Discovered capability JSON files
├── logs/             # Execution logs
└── screenshots/      # Failure screenshots (future)
```

## Architecture Highlights

- **Surface Adapter**: Abstracts browser automation (Playwright) behind a clean interface for heterogeneous surfaces
- **Artifact Schema**: Versioned, typed JSON with parameters, steps, success criteria, and metadata
- **Error Taxonomy**: Success | BusinessOutcome | Recoverable | HardFailure
- **Safety Policy**: Domain allowlist prevents navigation to unauthorized sites; redaction patterns protect PII in logs
- **Session Control**: pause/cede/resume enables seamless handoff to human operators on the same browser context

## Testing

Run the complete demo flow:

```bash
# Terminal 1: Start demo bank
npm run demo:bank

# Terminal 2: Run tests
npm run build
npm run replay evidence/artifacts/member-lookup-capability.json 12345
npm run replay evidence/artifacts/member-lookup-capability.json 99999
npm run escalate
```

## Evidence

The `evidence/` directory contains:
- **Provisional capability artifact** (`artifacts/member-lookup-capability.json`) - A stand-in until real LLM discovery is run
- **Replay logs** showing deterministic execution for success and business outcome cases
- **Failure screenshots** captured when hard failures occur (in `screenshots/`)
- See `evidence/README.md` for details

## Implementation Notes

### Discovery Status

**Current State**: The discovery agent code is complete and wired with safety controls, but a real LLM-driven discovery run has not been executed yet due to API key unavailability.

The provisional artifact (`evidence/artifacts/member-lookup-capability.json`) is marked with `metadata.provisional: true` and demonstrates the schema format. It can be used to test replay and escalation, which work independently without LLM inference.

To execute a genuine discovery run, set `ANTHROPIC_API_KEY` and run `npm run discover`. The agent will:
- Use Claude Haiku for cost-optimized exploration
- Enforce safety policy (domain allowlist, risky action blocking)
- Capture structured logs with LLM observations and decisions
- Generate a real artifact with `metadata.discoveryModel` and `discoveryRun` timestamps

### Design for Multi-Tenant

See `REPORT.md` for detailed discussion of heterogeneity, multi-tenant considerations, and production deployment patterns.

## License

MIT
