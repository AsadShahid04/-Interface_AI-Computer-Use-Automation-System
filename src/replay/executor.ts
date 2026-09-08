import { SurfaceAdapter, SurfaceObservation } from '../surface/types.js';
import { CapabilityArtifact, Step } from '../artifact/schema.js';
import { Logger } from '../utils/logger.js';

export type ReplayOutcome = 
  | { status: 'success'; result: any; steps: number }
  | { status: 'business_outcome'; code: string; message: string; steps: number }
  | { status: 'recoverable'; error: string; lastStep: number }
  | { status: 'hard_failure'; error: string; lastStep: number };

export class ReplayExecutor {
  constructor(private logger: Logger) {}

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
    
    const savingsMatch = tree.match(/Savings Balance[:\s]*\$?([0-9,]+\.\d{2})/i);
    const checkingMatch = tree.match(/Checking Balance[:\s]*\$?([0-9,]+\.\d{2})/i);
    const nameMatch = tree.match(/Full Name[:\s]*"([^"]+)"/i);
    const memberIdMatch = tree.match(/Member ID[:\s]*"([^"]+)"/i);

    return {
      url: observation.url,
      data: {
        memberId: memberIdMatch?.[1],
        name: nameMatch?.[1],
        savingsBalance: savingsMatch?.[1],
        checkingBalance: checkingMatch?.[1]
      }
    };
  }
}
