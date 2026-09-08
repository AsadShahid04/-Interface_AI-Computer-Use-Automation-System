export interface SurfaceAction {
  type: 'click' | 'type' | 'navigate' | 'wait' | 'screenshot';
  target?: string;
  value?: string;
  timeout?: number;
}

export interface SurfaceObservation {
  url: string;
  title: string;
  accessibilityTree: string;
  screenshot?: Buffer;
  timestamp: number;
}

export interface SurfaceAdapter {
  initialize(): Promise<void>;
  observe(): Promise<SurfaceObservation>;
  act(action: SurfaceAction): Promise<void>;
  close(): Promise<void>;
  getContext(): Promise<any>;
  restoreContext(context: any): Promise<void>;
}
