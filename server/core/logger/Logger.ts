export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  timestamp: string;
  level: string;
  context: string;
  message: string;
  data?: any;
}

export class Logger {
  private level: LogLevel;
  private context: string;

  constructor(context: string, level: LogLevel = LogLevel.INFO) {
    this.context = context;
    this.level = level;
  }

  private formatLog(level: string, message: string, data?: any): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      context: this.context,
      message,
      data,
    };
  }

  private outputLog(entry: LogEntry): void {
    const output = `[${entry.timestamp}] [${entry.level}] [${entry.context}] ${entry.message}`;
    
    // Handle BigInt serialization for JSON.stringify
    const replacer = (key: string, value: any) =>
      typeof value === 'bigint' ? value.toString() : value;
      
    const dataStr = entry.data ? ` | ${JSON.stringify(entry.data, replacer)}` : '';

    switch (entry.level) {
      case 'ERROR':
        console.error(output + dataStr);
        break;
      case 'WARN':
        console.warn(output + dataStr);
        break;
      case 'DEBUG':
        console.debug(output + dataStr);
        break;
      default:
        console.log(output + dataStr);
    }
  }

  debug(message: string, data?: any): void {
    if (this.level <= LogLevel.DEBUG) {
      this.outputLog(this.formatLog('DEBUG', message, data));
    }
  }

  info(message: string, data?: any): void {
    if (this.level <= LogLevel.INFO) {
      this.outputLog(this.formatLog('INFO', message, data));
    }
  }

  warn(message: string, data?: any): void {
    if (this.level <= LogLevel.WARN) {
      this.outputLog(this.formatLog('WARN', message, data));
    }
  }

  error(message: string, error?: Error | any): void {
    if (this.level <= LogLevel.ERROR) {
      const errorData = error instanceof Error ? error.message : error;
      this.outputLog(this.formatLog('ERROR', message, errorData));
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }
}
