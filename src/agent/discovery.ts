import Anthropic from '@anthropic-ai/sdk';
import { SurfaceAdapter } from '../surface/types.js';
import { CapabilityArtifact, Step } from '../artifact/schema.js';
import { Logger } from '../utils/logger.js';
import { randomUUID } from 'crypto';

interface DiscoveryConfig {
  goal: string;
  startUrl: string;
  maxSteps?: number;
  model?: string;
}

export class DiscoveryAgent {
  private anthropic: Anthropic;
  private logger: Logger;

  constructor(apiKey: string, logger: Logger) {
    this.anthropic = new Anthropic({ apiKey });
    this.logger = logger;
  }

  async discover(
    surface: SurfaceAdapter,
    config: DiscoveryConfig
  ): Promise<CapabilityArtifact> {
    const { goal, startUrl, maxSteps = 20, model = 'claude-haiku-4-5-20251001' } = config;

    this.logger.info('Starting discovery', { goal, startUrl });

    await surface.initialize();
    await surface.act({ type: 'navigate', value: startUrl, description: 'Navigate to start URL' });

    const steps: Step[] = [];
    const conversationHistory: any[] = [];

    for (let i = 0; i < maxSteps; i++) {
      const observation = await surface.observe();
      this.logger.info(`Step ${i + 1}: Observing`, { url: observation.url });

      const decision = await this.getNextAction(
        goal,
        observation.accessibilityTree,
        observation.url,
        conversationHistory,
        model
      );

      if (decision.done) {
        this.logger.info('Goal achieved', { outcome: decision.outcome });
        break;
      }

      if (!decision.action) {
        this.logger.warn('No action determined, stopping');
        break;
      }

      const step: Step = {
        id: `step_${i + 1}`,
        action: {
          type: decision.action.type,
          target: decision.action.target,
          value: decision.action.value,
          description: decision.reasoning
        },
        expectedOutcome: decision.expectedOutcome
      };

      steps.push(step);

      this.logger.info(`Executing action`, { action: step.action });
      await surface.act(step.action);

      conversationHistory.push({
        observation: {
          url: observation.url,
          tree: observation.accessibilityTree.substring(0, 500)
        },
        action: step.action,
        reasoning: decision.reasoning
      });
    }

    const artifact: CapabilityArtifact = {
      version: '1.0',
      id: randomUUID(),
      name: this.generateArtifactName(goal),
      description: goal,
      domain: new URL(startUrl).hostname,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      parameters: this.extractParameters(goal),
      steps,
      successCriteria: ['Task completed without errors', 'Expected data retrieved'],
      metadata: {
        discoveryModel: model,
        discoveryRun: new Date().toISOString(),
        tags: ['discovered', 'demo-bank']
      }
    };

    return artifact;
  }

  private async getNextAction(
    goal: string,
    accessibilityTree: string,
    currentUrl: string,
    history: any[],
    model: string
  ): Promise<{
    done: boolean;
    outcome?: string;
    action?: { type: string; target?: string; value?: string };
    reasoning: string;
    expectedOutcome: string;
  }> {
    const prompt = this.buildPrompt(goal, accessibilityTree, currentUrl, history);

    try {
      const response = await this.anthropic.messages.create({
        model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      return this.parseResponse(content.text);
    } catch (error) {
      this.logger.error('LLM call failed', { error });
      throw error;
    }
  }

  private buildPrompt(
    goal: string,
    accessibilityTree: string,
    currentUrl: string,
    history: any[]
  ): string {
    const historyText = history.length > 0
      ? `\n\nPrevious actions:\n${history.map((h, i) => 
          `${i + 1}. ${h.action.type} ${h.action.target || ''} - ${h.reasoning}`
        ).join('\n')}`
      : '';

    return `You are an automation agent. Your goal: ${goal}

Current URL: ${currentUrl}

Accessibility tree:
${accessibilityTree}
${historyText}

Determine the next action. Respond in this exact JSON format:
{
  "done": false,
  "action": { "type": "click|type|navigate", "target": "selector or role:name", "value": "text if typing" },
  "reasoning": "why this action",
  "expectedOutcome": "what should happen"
}

If the goal is achieved, respond:
{
  "done": true,
  "outcome": "description of achieved goal"
}

For form inputs, use role-based selectors like "textbox:Member ID" or CSS selectors.
For buttons, use "button:Search Member".
Be specific and concise.`;
  }

  private parseResponse(text: string): any {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    if (parsed.done) {
      return {
        done: true,
        outcome: parsed.outcome || 'Goal completed',
        reasoning: parsed.outcome || 'Goal completed',
        expectedOutcome: 'Task complete'
      };
    }

    return {
      done: false,
      action: parsed.action,
      reasoning: parsed.reasoning || 'Proceeding with action',
      expectedOutcome: parsed.expectedOutcome || 'Action should succeed'
    };
  }

  private generateArtifactName(goal: string): string {
    return goal
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .substring(0, 50);
  }

  private extractParameters(goal: string): any[] {
    const params: any[] = [];
    const memberIdMatch = goal.match(/member\s+(\d+|ID)/i);
    
    if (memberIdMatch) {
      params.push({
        name: 'memberId',
        type: 'string',
        description: 'Member ID to look up',
        required: true
      });
    }

    return params;
  }
}
