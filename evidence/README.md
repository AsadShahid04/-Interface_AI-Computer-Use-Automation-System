# Evidence Directory

This directory contains execution artifacts and logs from the automation system.

## Current Status

**Discovery Evidence**: The current artifact is a **provisional stand-in**. A real LLM-driven discovery run has not been executed yet. The artifact is marked with:
```json
"metadata": {
  "provisional": true,
  "discoveryStatus": "pending_live_run"
}
```

**Replay Evidence**: Deterministic replay logs demonstrating success and business outcome detection are present.

## Structure

- `artifacts/` - Capability artifacts (versioned JSON schemas)
  - `member-lookup-capability.json` - Provisional artifact demonstrating schema format
- `logs/` - Execution logs from replay and escalation runs
  - `replay-success-12345.log` - Successful replay for member 12345
  - `replay-not-found-99999.log` - Business outcome (record not found) for member 99999
  - `escalation-demo.log` - Full escalation handoff details (when escalate-demo is run)
- `screenshots/` - Failure screenshots captured on hard failures (generated on demand)

## Running Real Discovery

To generate genuine LLM-driven discovery evidence:

1. Set `ANTHROPIC_API_KEY` environment variable
2. Start demo bank: `npm run demo:bank`
3. Run discovery: `npm run discover`

This will:
- Execute real LLM calls using Claude Haiku
- Capture structured logs with model observations and decisions
- Generate an artifact with actual `discoveryModel` and `discoveryRun` metadata
- Save discovery logs to `logs/discovery_[timestamp].json`

Until a real discovery run is completed, the provisional artifact can be used to test and demonstrate the replay and escalation systems, which operate deterministically without LLM involvement.

## Artifact Schema

All artifacts follow the versioned schema defined in `src/artifact/schema.ts`:
- **Parameters**: Input variables for replay (e.g., memberId)
- **Steps**: Sequence of actions with selectors and expected outcomes
- **Outputs**: Typed fields to extract from the final page state (with regex patterns)
- **Success Criteria**: Concrete validation rules checked during replay
- **Metadata**: Discovery provenance, provisioning status, and tags
