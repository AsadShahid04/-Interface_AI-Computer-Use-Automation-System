import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { SurfaceAdapter, SurfaceAction, SurfaceObservation } from './types.js';

export class PlaywrightWebSurface implements SurfaceAdapter {
  private browser?: Browser;
  private context?: BrowserContext;
  private page?: Page;
  private lastScreenshot?: Buffer;

  async initialize(): Promise<void> {
    this.browser = await chromium.launch({ headless: true });
    this.context = await this.browser.newContext();
    this.page = await this.context.newPage();
  }

  async observe(): Promise<SurfaceObservation> {
    if (!this.page) {
      throw new Error('Surface not initialized');
    }

    const url = this.page.url();
    const title = await this.page.title();
    const accessibilityTree = await this.getAccessibilityTree();

    return {
      url,
      title,
      accessibilityTree,
      screenshot: this.lastScreenshot,
      timestamp: Date.now()
    };
  }

  private async getAccessibilityTree(): Promise<string> {
    if (!this.page) {
      throw new Error('Surface not initialized');
    }

    const bodyText = await this.page.evaluate(`document.body.innerText`);

    const formElements = await this.page.evaluate(`
      (() => {
        const elements = [];
        document.querySelectorAll('input, button, select, textarea').forEach(el => {
          const tag = el.tagName.toLowerCase();
          const name = el.getAttribute('name') || '';
          const placeholder = el.placeholder || '';
          const text = (el.textContent || '').trim();
          elements.push(tag + (name ? '[name="' + name + '"]' : '') + (placeholder ? ' placeholder="' + placeholder + '"' : '') + (text ? ' "' + text + '"' : ''));
        });
        return elements.join('\\n');
      })()
    `);

    return `Body text:\n${bodyText}\n\nForm elements:\n${formElements}`;
  }

  async act(action: SurfaceAction): Promise<void> {
    if (!this.page) {
      throw new Error('Surface not initialized');
    }

    switch (action.type) {
      case 'navigate':
        if (!action.value) {
          throw new Error('Navigate action requires a URL value');
        }
        await this.page.goto(action.value, { waitUntil: 'networkidle' });
        break;

      case 'click':
        if (!action.target) {
          throw new Error('Click action requires a target');
        }
        await this.clickElement(action.target);
        break;

      case 'type':
        if (!action.target || !action.value) {
          throw new Error('Type action requires target and value');
        }
        await this.typeIntoElement(action.target, action.value);
        break;

      case 'wait':
        await this.page.waitForTimeout(action.timeout || 1000);
        break;

      case 'screenshot':
        this.lastScreenshot = await this.page.screenshot({ fullPage: true });
        break;

      default:
        throw new Error(`Unknown action type: ${(action as any).type}`);
    }
  }

  private async clickElement(selector: string): Promise<void> {
    if (!this.page) {
      throw new Error('Surface not initialized');
    }

    const element = await this.findElement(selector);
    await element.click();
    await this.page.waitForTimeout(500);
  }

  private async typeIntoElement(selector: string, value: string): Promise<void> {
    if (!this.page) {
      throw new Error('Surface not initialized');
    }

    const element = await this.findElement(selector);
    await element.fill(value);
    await this.page.waitForTimeout(300);
  }

  private async findElement(selector: string) {
    if (!this.page) {
      throw new Error('Surface not initialized');
    }

    const parts = selector.split(':');
    if (parts.length === 2) {
      const [role, name] = parts;
      return this.page.getByRole(role as any, { name });
    }

    try {
      return this.page.locator(selector).first();
    } catch (error) {
      throw new Error(`Could not find element: ${selector}`);
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async getContext(): Promise<any> {
    if (!this.context) {
      throw new Error('Surface not initialized');
    }
    return {
      cookies: await this.context.cookies(),
      storageState: await this.context.storageState()
    };
  }

  async restoreContext(contextData: any): Promise<void> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }
    
    this.context = await this.browser.newContext({
      storageState: contextData.storageState
    });
    
    this.page = await this.context.newPage();
  }
}
