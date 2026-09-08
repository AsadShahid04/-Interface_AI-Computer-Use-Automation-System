import { SurfaceAction } from '../surface/types.js';

export interface PolicyConfig {
  allowedDomains: string[];
  riskyActions: string[];
  redactPatterns: RegExp[];
}

export class SafetyPolicy {
  private config: PolicyConfig;

  constructor(config?: Partial<PolicyConfig>) {
    this.config = {
      allowedDomains: config?.allowedDomains || ['localhost'],
      riskyActions: config?.riskyActions || ['delete', 'remove', 'cancel'],
      redactPatterns: config?.redactPatterns || [
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        /\b\d{3}-\d{2}-\d{4}\b/g,
        /\b\d{16}\b/g
      ]
    };
  }

  validateAction(action: SurfaceAction, currentUrl: string): 
    { allowed: boolean; reason?: string } {
    
    if (action.type === 'navigate' && action.value) {
      const url = new URL(action.value);
      const isAllowed = this.config.allowedDomains.some(domain => 
        url.hostname === domain || url.hostname.endsWith(`.${domain}`)
      );

      if (!isAllowed) {
        return {
          allowed: false,
          reason: `Domain ${url.hostname} not in allowlist`
        };
      }
    }

    if (action.target) {
      const targetLower = action.target.toLowerCase();
      const isRisky = this.config.riskyActions.some(risky => 
        targetLower.includes(risky)
      );

      if (isRisky) {
        return {
          allowed: false,
          reason: `Action targets risky element: ${action.target}`
        };
      }
    }

    return { allowed: true };
  }

  redactSensitiveData(text: string): string {
    let redacted = text;

    for (const pattern of this.config.redactPatterns) {
      redacted = redacted.replace(pattern, '[REDACTED]');
    }

    return redacted;
  }

  isUrlAllowed(url: string): boolean {
    try {
      const parsed = new URL(url);
      return this.config.allowedDomains.some(domain =>
        parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
      );
    } catch {
      return false;
    }
  }
}
