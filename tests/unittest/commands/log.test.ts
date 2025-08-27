import assert from "node:assert";
import { describe, it, mock } from "node:test";

import { logCommand } from "../../../src/commands/log.js";
import { LogService } from "../../../src/services/logService.js";

describe("logCommand", () => {
  it("should create LogService and call execute", async () => {
    // LogService.executeをモック化
    const mockExecute = mock.method(LogService.prototype, "execute");

    await logCommand();

    // executeが1回呼ばれたことを確認
    assert.strictEqual(mockExecute.mock.callCount(), 1);

    mockExecute.mock.restore();
  });

  it("should handle errors and exit with code 1", async () => {
    const originalConsoleError = console.error;
    const originalProcessExit = process.exit.bind(process);

    const consoleErrorCalls: Array<string> = [];
    let exitCode: number | undefined;

    // console.errorとprocess.exitをモック
    console.error = (message: string) => {
      consoleErrorCalls.push(message);
    };
    process.exit = ((code: number) => {
      exitCode = code;
    }) as never;

    // LogService.executeがエラーをスローするようにモック
    const mockExecute = mock.method(LogService.prototype, "execute");
    mockExecute.mock.mockImplementationOnce(() => {
      throw new Error("Test error message");
    });

    try {
      await logCommand();

      // console.errorが正しいメッセージで呼ばれたか確認
      assert.strictEqual(consoleErrorCalls.length, 1);
      assert.strictEqual(consoleErrorCalls[0], "Error: Test error message");

      // process.exit(1)が呼ばれたか確認
      assert.strictEqual(exitCode, 1);
    } finally {
      // 元の関数を復元
      console.error = originalConsoleError;
      process.exit = originalProcessExit;
      mockExecute.mock.restore();
    }
  });

  it("should handle non-Error exceptions", async () => {
    const originalConsoleError = console.error;
    const originalProcessExit = process.exit.bind(process);

    const consoleErrorCalls: Array<string> = [];
    let exitCode: number | undefined;

    console.error = (message: string) => {
      consoleErrorCalls.push(message);
    };
    process.exit = ((code: number) => {
      exitCode = code;
    }) as never;

    // LogService.executeが非標準エラーをスローするようにモック
    const mockExecute = mock.method(LogService.prototype, "execute");
    mockExecute.mock.mockImplementationOnce(() => {
      const error = new Error("String error");
      return Promise.reject(error);
    });

    try {
      await logCommand();

      assert.strictEqual(consoleErrorCalls.length, 1);
      assert.strictEqual(consoleErrorCalls[0], "Error: String error");
      assert.strictEqual(exitCode, 1);
    } finally {
      console.error = originalConsoleError;
      process.exit = originalProcessExit;
      mockExecute.mock.restore();
    }
  });
});
