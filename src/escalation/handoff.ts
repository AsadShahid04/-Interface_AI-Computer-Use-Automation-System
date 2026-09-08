import { SurfaceAdapter } from '../surface/types.js';
import { Logger } from '../utils/logger.js';

export interface InterventionRequest {
  id: string;
  timestamp: string;
  reason: string;
  context: {
    currentUrl: string;
    attemptedAction?: string;
    errorMessage?: string;
  };
  sessionSnapshot: any;
}

export interface SessionControl {
  pause(): Promise<void>;
  cede(operatorId: string): Promise<string>;
  resume(fromSnapshot: any): Promise<void>;
}

export class EscalationManager implements SessionControl {
  private surface: SurfaceAdapter;
  private logger: Logger;
  private paused: boolean = false;

  constructor(surface: SurfaceAdapter, logger: Logger) {
    this.surface = surface;
    this.logger = logger;
  }

  async createInterventionRequest(
    reason: string,
    currentUrl: string,
    attemptedAction?: string,
    error?: string
  ): Promise<InterventionRequest> {
    const sessionSnapshot = await this.surface.getContext();

    const request: InterventionRequest = {
      id: `intervention_${Date.now()}`,
      timestamp: new Date().toISOString(),
      reason,
      context: {
        currentUrl,
        attemptedAction,
        errorMessage: error
      },
      sessionSnapshot
    };

    this.logger.info('Intervention request created', { 
      id: request.id, 
      reason 
    });

    return request;
  }

  async pause(): Promise<void> {
    this.paused = true;
    this.logger.info('Session paused for intervention');
  }

  async cede(operatorId: string): Promise<string> {
    this.logger.info('Ceding control to operator', { operatorId });
    
    const context = await this.surface.getContext();
    const handoffToken = Buffer.from(JSON.stringify(context)).toString('base64');
    
    this.logger.info('Handoff token generated', { 
      operatorId, 
      tokenLength: handoffToken.length 
    });

    return handoffToken;
  }

  async resume(fromSnapshot: any): Promise<void> {
    this.logger.info('Resuming session from snapshot');
    
    await this.surface.restoreContext(fromSnapshot);
    this.paused = false;
    
    this.logger.info('Session resumed');
  }

  isPaused(): boolean {
    return this.paused;
  }
}
