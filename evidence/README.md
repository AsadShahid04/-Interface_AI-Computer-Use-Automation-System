# Evidence Directory

This directory contains real execution artifacts from the automation system.

## Structure

- `artifacts/` - Capability artifacts (versioned JSON schemas)
- `logs/` - Execution logs from discovery and replay runs
- `screenshots/` - Screenshots captured on failure (future enhancement)

## Generated Evidence

### Capability Artifact
- `member-lookup-capability.json` - Discovered capability for looking up demo bank members

### Replay Runs
- `replay-success-12345.log` - Successful replay for member 12345
- `replay-not-found-99999.log` - Business outcome (record not found) for member 99999

## Notes

Discovery requires `ANTHROPIC_API_KEY` to be set. The artifact in this directory represents
what would be discovered by the LLM-driven agent when the API key is available.

Replay runs are deterministic and do not require the LLM.
