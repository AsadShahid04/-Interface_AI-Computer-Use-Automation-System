# Evidence Directory

This directory contains real execution artifacts from the automation system, including a genuine LLM-driven discovery run from 2026-09-08.

## Real Discovery Evidence

**Discovery Run**: Completed 2026-09-08T21:34:09Z using Claude Haiku (`claude-haiku-4-5-20251001`)

The discovery agent successfully explored the demo bank UI and captured the member lookup capability. The LLM made observations, determined actions, and generated a complete artifact with typed outputs.

### Discovery Artifacts

- **`discovery-haiku.json`** - Structured discovery log with timestamps, LLM observations, and action decisions
- **`discovery_1788903242402.json`** - Same log (timestamped copy)
- **Discovery duration**: ~7 seconds (3 steps from initial page to member details)
- **LLM model**: claude-haiku-4-5-20251001
- **Goal achieved**: "Successfully looked up member 12345 and read the savings balance. Member John Anderson has a savings balance of $15000.00"

## Structure

- `artifacts/` - Capability artifacts (versioned JSON schemas)
  - `member-lookup-capability.json` - Primary artifact from real Haiku discovery
  - `3c342e06-fef9-4038-af82-f18427750cc8.json` - Same artifact (UUID-named copy)
- `logs/` - Execution logs from discovery, replay, and escalation runs
  - `discovery-haiku.json` - Real LLM-driven discovery log (2026-09-08)
  - `discovery_1788903242402.json` - Same discovery log (timestamped)
  - `replay-success-12345.log` - Successful deterministic replay for member 12345
  - `replay-not-found-99999.log` - Business outcome (record not found) for member 99999
  - `escalation-demo.log` - Full escalation handoff details (simulated scenario)
- `screenshots/` - Failure screenshots captured on hard failures (generated on demand)

## Replay Verification

Both replay scenarios have been verified with the discovered artifact:

1. **Success case** (`memberId=12345`):
   - Status: success
   - Extracted: `savingsBalance: "15000.00"`, `checkingBalance: "2500.00"`

2. **Business outcome** (`memberId=99999`):
   - Status: business_outcome
   - Code: record_not_found
   - Message: "The requested member does not exist in the system"

Replays are deterministic and execute without LLM involvement, using only the artifact's encoded steps and safety policy.

## Artifact Schema

All artifacts follow the versioned schema defined in `src/artifact/schema.ts`:
- **Parameters**: Input variables for replay (e.g., memberId)
- **Steps**: Sequence of actions with selectors and expected outcomes
- **Outputs**: Typed fields to extract from the final page state (with regex patterns)
- **Success Criteria**: Concrete validation rules checked during replay
- **Metadata**: Discovery provenance with actual model name and timestamp

The real artifact contains `metadata.discoveryModel: "claude-haiku-4-5-20251001"` and `metadata.discoveryRun: "2026-09-08T21:34:09.242Z"` from the genuine LLM run.
