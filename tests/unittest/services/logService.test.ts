import assert from "node:assert";
import { describe, it, mock } from "node:test";

import { Commit } from "../../../src/models/commit.js";
import { GitActor } from "../../../src/models/types.js";
import { ObjectRepository } from "../../../src/repositories/objectRepository.js";
import { ReferenceRepository } from "../../../src/repositories/referenceRepository.js";
import { LogService } from "../../../src/services/logService.js";
import { MockLogger } from "../../../src/utils/logger.js";

describe("LogService", () => {
  let mockLogger: MockLogger;

  // テスト用のコミット作成ヘルパー
  function createTestCommit(
    tree: string,
    parents: Array<string>,
    authorName: string,
    message: string,
    timestamp = new Date("2025-01-01T12:00:00Z"),
  ): Commit {
    const actor: GitActor = {
      name: authorName,
      email: `${authorName.toLowerCase().replace(" ", ".")}@example.com`,
      timestamp,
    };
    return new Commit(tree, parents, actor, actor, message);
  }

  describe("execute", () => {
    it("should display 'No commits found.' when HEAD is null", async () => {
      mockLogger = new MockLogger();

      // モックオブジェクトリポジトリ
      const mockObjectRepo = {} as ObjectRepository;

      // モックリファレンスリポジトリ
      const mockReferenceRepo = {
        resolveHead: mock.fn(() => Promise.resolve(null)),
      } as unknown as ReferenceRepository;

      const logService = new LogService(
        mockObjectRepo,
        mockReferenceRepo,
        mockLogger,
      );

      await logService.execute();

      const infoMessages = mockLogger.getMessages("info");
      assert.strictEqual(infoMessages.length, 1);
      assert.strictEqual(infoMessages[0], "No commits found.");
    });

    it("should display single commit history", async () => {
      mockLogger = new MockLogger();

      const commitSha = "abc123";
      const commit = createTestCommit(
        "tree1",
        [],
        "John Doe",
        "Initial commit",
      );

      // モックオブジェクトリポジトリ
      const mockObjectRepo = {
        read: mock.fn(() => Promise.resolve(commit)),
      } as unknown as ObjectRepository;

      // モックリファレンスリポジトリ
      const mockReferenceRepo = {
        resolveHead: mock.fn(() => Promise.resolve(commitSha)),
      } as unknown as ReferenceRepository;

      const logService = new LogService(
        mockObjectRepo,
        mockReferenceRepo,
        mockLogger,
      );

      await logService.execute();

      const infoMessages = mockLogger.getMessages("info");
      assert.ok(infoMessages.length >= 2); // コミット情報 + 空行

      // コミット情報の検証
      const commitOutput = infoMessages[0];
      assert.ok(commitOutput?.includes(`commit ${commitSha}`));
      assert.ok(
        commitOutput?.includes("Author: John Doe <john.doe@example.com>"),
      );
      assert.ok(commitOutput?.includes("Date:   2025-01-01 12:00:00"));
      assert.ok(commitOutput?.includes("    Initial commit"));

      // 空行の検証
      assert.strictEqual(infoMessages[1], "");
    });

    it("should handle multi-line commit message", async () => {
      mockLogger = new MockLogger();

      const commitSha = "abc123";
      const multiLineMessage = "First line\n\nSecond paragraph\nThird line";
      const commit = createTestCommit(
        "tree1",
        [],
        "John Doe",
        multiLineMessage,
      );

      const mockObjectRepo = {
        read: mock.fn(() => Promise.resolve(commit)),
      } as unknown as ObjectRepository;

      const mockReferenceRepo = {
        resolveHead: mock.fn(() => Promise.resolve(commitSha)),
      } as unknown as ReferenceRepository;

      const logService = new LogService(
        mockObjectRepo,
        mockReferenceRepo,
        mockLogger,
      );

      await logService.execute();

      const infoMessages = mockLogger.getMessages("info");
      const commitOutput = infoMessages[0];

      assert.ok(commitOutput?.includes("    First line"));
      assert.ok(commitOutput?.includes("    Second paragraph"));
      assert.ok(commitOutput?.includes("    Third line"));
    });

    it("should warn when object is not a commit", async () => {
      mockLogger = new MockLogger();

      const sha = "abc123";
      const nonCommitObject = { type: "blob" }; // 非Commitオブジェクト

      const mockObjectRepo = {
        read: mock.fn(() => Promise.resolve(nonCommitObject)),
      } as unknown as ObjectRepository;

      const mockReferenceRepo = {
        resolveHead: mock.fn(() => Promise.resolve(sha)),
      } as unknown as ReferenceRepository;

      const logService = new LogService(
        mockObjectRepo,
        mockReferenceRepo,
        mockLogger,
      );

      await logService.execute();

      const warnMessages = mockLogger.getMessages("warn");
      assert.strictEqual(warnMessages.length, 1);
      assert.strictEqual(
        warnMessages[0],
        `Warning: ${sha} is not a commit object`,
      );
    });

    it("should warn when failed to read commit object", async () => {
      mockLogger = new MockLogger();

      const sha = "nonexistent";

      const mockObjectRepo = {
        read: mock.fn(() => {
          return Promise.reject(new Error("Object not found"));
        }),
      } as unknown as ObjectRepository;

      const mockReferenceRepo = {
        resolveHead: mock.fn(() => Promise.resolve(sha)),
      } as unknown as ReferenceRepository;

      const logService = new LogService(
        mockObjectRepo,
        mockReferenceRepo,
        mockLogger,
      );

      await logService.execute();

      const warnMessages = mockLogger.getMessages("warn");
      assert.strictEqual(warnMessages.length, 1);
      assert.ok(
        warnMessages[0]?.includes(`Warning: Failed to read commit ${sha}`),
      );
    });

    it("should throw error when resolveHead fails", async () => {
      mockLogger = new MockLogger();

      const mockObjectRepo = {} as ObjectRepository;

      const mockReferenceRepo = {
        resolveHead: mock.fn(() => {
          return Promise.reject(new Error("Failed to resolve HEAD"));
        }),
      } as unknown as ReferenceRepository;

      const logService = new LogService(
        mockObjectRepo,
        mockReferenceRepo,
        mockLogger,
      );

      await assert.rejects(
        logService.execute(),
        /Failed to retrieve commit history: Failed to resolve HEAD/,
      );
    });

    it("should handle commit chain correctly", async () => {
      mockLogger = new MockLogger();

      const commit1Sha = "commit1";
      const commit2Sha = "commit2";

      const commit1 = createTestCommit("tree1", [], "John Doe", "First commit");
      const commit2 = createTestCommit(
        "tree2",
        [commit1Sha],
        "Jane Smith",
        "Second commit",
      );

      let callCount = 0;
      const mockObjectRepo = {
        read: mock.fn((sha: string) => {
          callCount++;
          if (sha === commit2Sha) return Promise.resolve(commit2);
          if (sha === commit1Sha) return Promise.resolve(commit1);
          return Promise.reject(new Error("Unknown commit"));
        }),
      } as unknown as ObjectRepository;

      const mockReferenceRepo = {
        resolveHead: mock.fn(() => Promise.resolve(commit2Sha)),
      } as unknown as ReferenceRepository;

      const logService = new LogService(
        mockObjectRepo,
        mockReferenceRepo,
        mockLogger,
      );

      await logService.execute();

      // 2つのコミットが読み込まれたことを確認
      assert.strictEqual(callCount, 2);

      const infoMessages = mockLogger.getMessages("info");

      // 最新のコミット（commit2）が最初に表示される
      const firstCommitOutput = infoMessages[0];
      assert.ok(firstCommitOutput?.includes(`commit ${commit2Sha}`));
      assert.ok(firstCommitOutput?.includes("Jane Smith"));

      // 2番目のコミット（commit1）が後に表示される
      const secondCommitOutput = infoMessages[2]; // 空行をスキップ
      assert.ok(secondCommitOutput?.includes(`commit ${commit1Sha}`));
      assert.ok(secondCommitOutput?.includes("John Doe"));
    });
  });
});
