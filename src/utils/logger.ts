/**
 * ログレベル
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * ロガーインターfaces
 */
export interface Logger {
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

/**
 * コンソール出力を行うロガー実装
 */
export class ConsoleLogger implements Logger {
  constructor(private readonly level: LogLevel = "info") {}

  debug(message: string): void {
    if (this.shouldLog("debug")) {
      console.debug(message);
    }
  }

  info(message: string): void {
    if (this.shouldLog("info")) {
      console.log(message);
    }
  }

  warn(message: string): void {
    if (this.shouldLog("warn")) {
      console.warn(message);
    }
  }

  error(message: string): void {
    if (this.shouldLog("error")) {
      console.error(message);
    }
  }

  private shouldLog(messageLevel: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };
    return levels[messageLevel] >= levels[this.level];
  }
}

/**
 * デフォルトのロガーインスタンス
 */
export const defaultLogger: Logger = new ConsoleLogger("info");

/**
 * テスト用のモックロガー
 */
export class MockLogger implements Logger {
  public readonly logs: Array<{ level: LogLevel; message: string }> = [];

  debug(message: string): void {
    this.logs.push({ level: "debug", message });
  }

  info(message: string): void {
    this.logs.push({ level: "info", message });
  }

  warn(message: string): void {
    this.logs.push({ level: "warn", message });
  }

  error(message: string): void {
    this.logs.push({ level: "error", message });
  }

  /**
   * ログをクリア
   */
  clear(): void {
    this.logs.length = 0;
  }

  /**
   * 指定されたレベルのログメッセージを取得
   */
  getMessages(level: LogLevel): Array<string> {
    return this.logs
      .filter((log) => log.level === level)
      .map((log) => log.message);
  }
}
