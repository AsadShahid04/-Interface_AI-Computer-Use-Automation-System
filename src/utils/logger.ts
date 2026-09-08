import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: any;
}

export class Logger {
  private logs: LogEntry[] = [];
  private outputPath?: string;

  constructor(outputPath?: string) {
    this.outputPath = outputPath;
  }

  info(message: string, context?: any): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: any): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: any): void {
    this.log('error', message, context);
  }

  debug(message: string, context?: any): void {
    this.log('debug', message, context);
  }

  private log(level: LogLevel, message: string, context?: any): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context
    };

    this.logs.push(entry);
    
    console.log(`[${level.toUpperCase()}] ${message}`, context || '');
  }

  save(): void {
    if (!this.outputPath) {
      return;
    }

    try {
      const dir = this.outputPath.substring(0, this.outputPath.lastIndexOf('/'));
      mkdirSync(dir, { recursive: true });
      writeFileSync(this.outputPath, JSON.stringify(this.logs, null, 2));
    } catch (error) {
      console.error('Failed to save logs', error);
    }
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }
}
