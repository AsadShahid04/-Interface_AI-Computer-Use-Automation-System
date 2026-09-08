import { SurfaceAdapter, SurfaceObservation } from '../surface/types.js';
import { CapabilityArtifact, Step } from '../artifact/schema.js';
import { Logger } from '../utils/logger.js';
import { SafetyPolicy } from '../policy/safety.js';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

export type ReplayOutcome = 
  | { status: 'success'; result: any; steps: number }
  | { status: 'business_outcome'; code: string; message: string; steps: number }
  | { status: 'recoverable'; error: string; lastStep: number }
  | { status: 'hard_failure'; error: string; lastStep: number };

export class ReplayExecutor {
  private policy: SafetyPolicy;

  constructor(private logger: Logger, policy?: SafetyPolicy) {
    this.policy = policy || new SafetyPolicy({
      allowedDomains: ['localhost']
    });
  }

  async execute(
    surface: SurfaceAdapter,
    artifact: CapabilityArtifact,
    parameters: Record<string, any>
  ): Promise<ReplayOutcome> {
    this.logger.info('Starting replay', { 
      artifact: artifact.name, 
      parameters 
    });

    try {
      await surface.initialize();

      const startUrl = this.buildStartUrl(artifact.domain, parameters);
      await surface.act({ 
        type: 'navigate', 
        value: startUrl,
        description: 'Navigate to start URL'
      });

      for (let i = 0; i < artifact.steps.length; i++) {
        const step = artifact.steps[i];
        
        try {
          await this.executeStep(surface, step, parameters);
          this.logger.info(`Step ${i + 1} completed`, { step: step.id });
          
          const observation = await surface.observe();
          const businessOutcome = this.detectBusinessOutcome(observation);
          if (businessOutcome) {
            return {
              status: 'business_outcome',
              code: businessOutcome.code,
              message: businessOutcome.message,
              steps: i + 1
            };
          }
        } catch (error) {
          const observation = await surface.observe();
          
          const businessOutcome = this.detectBusinessOutcome(observation);
          if (businessOutcome) {
            return {
              status: 'business_outcome',
              code: businessOutcome.code,
              message: businessOutcome.message,
              steps: i + 1
            };
          }

          if (this.isRecoverable(error)) {
            return {
              status: 'recoverable',
              error: String(error),
              lastStep: i
            };
          }

          await this.captureFailureEvidence(surface, artifact, i, String(error));
          
          return {
            status: 'hard_failure',
            error: String(error),
            lastStep: i
          };
        }
      }

      const finalObservation = await surface.observe();
      const result = this.extractResult(artifact, finalObservation);

      return {
        status: 'success',
        result,
        steps: artifact.steps.length
      };

    } catch (error) {
      this.logger.error('Replay failed', { error });
      return {
        status: 'hard_failure',
        error: String(error),
        lastStep: 0
      };
    }
  }

  private async executeStep(
    surface: SurfaceAdapter,
    step: Step,
    parameters: Record<string, any>
  ): Promise<void> {
    const action = { ...step.action };

    if (action.value) {
      action.value = this.interpolateParameters(action.value, parameters);
    }

    const observation = await surface.observe();
    const validation = this.policy.validateAction(action, observation.url);
    if (!validation.allowed) {
      throw new Error(`Policy violation: ${validation.reason}`);
    }

    await surface.act(action);
  }

  private interpolateParameters(template: string, parameters: Record<string, any>): string {
    return template.replace(/\{(\w+)\}/g, (_, key) => {
      return parameters[key] || '';
    });
  }

  private buildStartUrl(domain: string, parameters: Record<string, any>): string {
    return `http://${domain}`;
  }

  private detectBusinessOutcome(observation: SurfaceObservation): 
    { code: string; message: string } | null {
    const tree = observation.accessibilityTree.toLowerCase();
    
    if (tree.includes('record not found') || tree.includes('member not found')) {
      return {
        code: 'record_not_found',
        message: 'The requested member does not exist in the system'
      };
    }

    if (tree.includes('access denied') || tree.includes('unauthorized')) {
      return {
        code: 'access_denied',
        message: 'Insufficient permissions to access this resource'
      };
    }

    return null;
  }

  private isRecoverable(error: any): boolean {
    const errorStr = String(error).toLowerCase();
    
    return errorStr.includes('timeout') ||
           errorStr.includes('network') ||
           errorStr.includes('temporarily unavailable');
  }

  private extractResult(artifact: CapabilityArtifact, observation: SurfaceObservation): any {
    const tree = observation.accessibilityTree;
    const data: Record<string, any> = {};

    if (artifact.outputs) {
      for (const output of artifact.outputs) {
        if (output.pattern) {
          const regex = new RegExp(output.pattern, 'i');
          const match = tree.match(regex);
          if (match && match[1]) {
            data[output.name] = match[1];
          }
        }
      }
    } else {
      const savingsMatch = tree.match(/Savings Balance[:\s]*\$?([0-9,]+\.\d{2})/i);
      const checkingMatch = tree.match(/Checking Balance[:\s]*\$?([0-9,]+\.\d{2})/i);
      const nameMatch = tree.match(/Full Name[:\s]*"([^"]+)"/i);
      const memberIdMatch = tree.match(/Member ID[:\s]*"([^"]+)"/i);

      data.memberId = memberIdMatch?.[1];
      data.name = nameMatch?.[1];
      data.savingsBalance = savingsMatch?.[1];
      data.checkingBalance = checkingMatch?.[1];
    }

    return {
      url: observation.url,
      data: this.policy.redactSensitiveData(JSON.stringify(data))
    };
  }

  private async captureFailureEvidence(
    surface: SurfaceAdapter,
    artifact: CapabilityArtifact,
    step: number,
    error: string
  ): Promise<void> {
    try {
      const screenshotDir = './evidence/screenshots';
      mkdirSync(screenshotDir, { recursive: true });

      const timestamp = Date.now();
      const screenshotPath = join(screenshotDir, `failure_${artifact.name}_step${step}_${timestamp}.png`);
      
      await surface.act({ type: 'screenshot', description: 'Capture failure state' });
      
      const observation = await surface.observe();
      const evidencePath = join(screenshotDir, `failure_${artifact.name}_step${step}_${timestamp}.txt`);
      writeFileSync(evidencePath, `Error: ${error}\n\nURL: ${observation.url}\n\nPage State:\n${observation.accessibilityTree}`);
      
      this.logger.info('Failure evidence captured', { screenshotPath, evidencePath });
    } catch (captureError) {
      this.logger.warn('Failed to capture evidence', { error: String(captureError) });
    }
  }
}
