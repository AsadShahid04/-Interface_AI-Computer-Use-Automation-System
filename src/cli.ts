import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { PlaywrightWebSurface } from './surface/playwright.js';
import { DiscoveryAgent } from './agent/discovery.js';
import { ReplayExecutor } from './replay/executor.js';
import { EscalationManager } from './escalation/handoff.js';
import { Logger } from './utils/logger.js';
import { CapabilityArtifact, CapabilityArtifactSchema } from './artifact/schema.js';

const EVIDENCE_DIR = './evidence';
const ARTIFACTS_DIR = join(EVIDENCE_DIR, 'artifacts');
const LOGS_DIR = join(EVIDENCE_DIR, 'logs');

function ensureDirectories(): void {
  mkdirSync(ARTIFACTS_DIR, { recursive: true });
  mkdirSync(LOGS_DIR, { recursive: true });
}

async function discoverCommand(): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('Error: ANTHROPIC_API_KEY environment variable not set');
    console.error('See .env.example for configuration');
    process.exit(1);
  }

  ensureDirectories();

  const logger = new Logger(join(LOGS_DIR, `discovery_${Date.now()}.json`));
  const surface = new PlaywrightWebSurface();
  const agent = new DiscoveryAgent(apiKey, logger);

  try {
    console.log('Starting discovery: Look up member 12345 and read savings balance');
    
    const artifact = await agent.discover(surface, {
      goal: 'Look up member 12345 and read the savings balance',
      startUrl: 'http://localhost:3000',
      maxSteps: 15
    });

    const artifactPath = join(ARTIFACTS_DIR, `${artifact.id}.json`);
    writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));

    console.log('\nDiscovery complete!');
    console.log(`Artifact saved: ${artifactPath}`);
    console.log(`Logs saved: ${logger['outputPath']}`);
    
    logger.save();
  } catch (error) {
    logger.error('Discovery failed', { error: String(error) });
    logger.save();
    throw error;
  } finally {
    await surface.close();
  }
}

async function replayCommand(): Promise<void> {
  ensureDirectories();

  const args = process.argv.slice(3);
  const artifactPath = args[0] || join(ARTIFACTS_DIR, 'latest.json');
  const memberId = args[1] || '12345';

  let artifact: CapabilityArtifact;
  try {
    const content = readFileSync(artifactPath, 'utf-8');
    artifact = CapabilityArtifactSchema.parse(JSON.parse(content));
  } catch (error) {
    console.error(`Failed to load artifact from ${artifactPath}`);
    throw error;
  }

  const logger = new Logger(join(LOGS_DIR, `replay_${Date.now()}.json`));
  const surface = new PlaywrightWebSurface();
  const executor = new ReplayExecutor(logger);

  try {
    console.log(`Replaying artifact: ${artifact.name}`);
    console.log(`Parameters: memberId=${memberId}`);

    const outcome = await executor.execute(surface, artifact, { memberId });

    console.log('\nReplay complete!');
    console.log(`Status: ${outcome.status}`);
    
    if (outcome.status === 'success') {
      console.log('Result:', JSON.stringify(outcome.result, null, 2));
    } else if (outcome.status === 'business_outcome') {
      console.log(`Business outcome: ${outcome.code} - ${outcome.message}`);
    } else {
      console.log(`Error: ${(outcome as any).error}`);
    }

    logger.save();
  } catch (error) {
    logger.error('Replay failed', { error: String(error) });
    logger.save();
    throw error;
  } finally {
    await surface.close();
  }
}

async function escalateDemoCommand(): Promise<void> {
  ensureDirectories();
  
  const logger = new Logger();
  const surface = new PlaywrightWebSurface();

  try {
    await surface.initialize();
    await surface.act({ 
      type: 'navigate', 
      value: 'http://localhost:3000',
      description: 'Navigate to demo bank'
    });

    const escalation = new EscalationManager(surface, logger);

    console.log('Escalation Demo: Simulating stuck automation state\n');
    console.log('Creating intervention request...');
    const request = await escalation.createInterventionRequest(
      'Simulated: Unable to locate submit button (demo scenario)',
      'http://localhost:3000',
      'click button:Submit',
      'Element not found'
    );

    console.log('\nIntervention Request (truncated):');
    console.log(JSON.stringify({
      ...request,
      sessionSnapshot: '[TRUNCATED]'
    }, null, 2));

    console.log('\nPausing session...');
    await escalation.pause();

    console.log('Ceding control to operator...');
    const handoffToken = await escalation.cede('operator_123');
    console.log(`Handoff token (truncated): ${handoffToken.substring(0, 12)}...`);

    const logPath = join(LOGS_DIR, 'escalation-demo.log');
    writeFileSync(logPath, JSON.stringify({
      request,
      handoffToken,
      timestamp: new Date().toISOString()
    }, null, 2));
    console.log(`Full details saved to: ${logPath}`);

    console.log('\nResuming session...');
    await escalation.resume(request.sessionSnapshot);
    console.log('Session resumed successfully');

    console.log('\nEscalation demo complete!');
    console.log('Note: This demonstrates the handoff mechanism in a simulated scenario.');
  } finally {
    await surface.close();
  }
}

const command = process.argv[2];

switch (command) {
  case 'discover':
    discoverCommand().catch(error => {
      console.error('Discovery failed:', error);
      process.exit(1);
    });
    break;

  case 'replay':
    replayCommand().catch(error => {
      console.error('Replay failed:', error);
      process.exit(1);
    });
    break;

  case 'escalate-demo':
    escalateDemoCommand().catch(error => {
      console.error('Escalation demo failed:', error);
      process.exit(1);
    });
    break;

  default:
    console.log('Usage:');
    console.log('  npm run discover                     # Discover capability');
    console.log('  npm run replay [artifact] [memberId] # Replay artifact');
    console.log('  npm run escalate                     # Demo escalation');
    process.exit(1);
}
