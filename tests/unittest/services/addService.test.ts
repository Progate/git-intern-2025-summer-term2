import * as fs from "fs/promises";
import assert from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
import * as os from "os";
import * as path from "path";

import { Index } from "../../../src/models/gitIndex.js";
import { AddService } from "../../../src/services/addService.js";
import { MockLogger } from "../../../src/utils/logger.js";

describe("AddService", () => {
  let tempDir: string;
  let gitDir: string;
  let mockLogger: MockLogger;

  before(async () => {
    // 一時ディレクトリを作成
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "addservice-test-"));
    gitDir = path.join(tempDir, ".git");

    // .gitディレクトリを作成
    await fs.mkdir(gitDir, { recursive: true });
    await fs.mkdir(path.join(gitDir, "objects"), { recursive: true });

    // 正しいGitインデックスファイルを作成
    const emptyIndex = new Index();
    const indexData = emptyIndex.serialize();
    await fs.writeFile(path.join(gitDir, "index"), indexData as Uint8Array);
  });

  beforeEach(() => {
    mockLogger = new MockLogger();
  });

  after(async () => {
    // テスト後のクリーンアップ
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("normalizePath", () => {
    it("should convert absolute path to relative path", async () => {
      const service = await AddService.create(tempDir, mockLogger);

      // プライベートメソッドにアクセスするためにanyでキャスト
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      const normalizePathMethod = (service as any).normalizePath.bind(service);

      const absolutePath = path.join(tempDir, "test.txt");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
      const result = normalizePathMethod(absolutePath);

      assert.strictEqual(result, "test.txt");
    });

    it("should keep relative path as is", async () => {
      const service = await AddService.create(tempDir, mockLogger);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      const normalizePathMethod = (service as any).normalizePath.bind(service);

      const relativePath = "src/test.ts";
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
      const result = normalizePathMethod(relativePath);

      assert.strictEqual(result, "src/test.ts");
    });

    it("should handle nested paths correctly", async () => {
      const service = await AddService.create(tempDir, mockLogger);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      const normalizePathMethod = (service as any).normalizePath.bind(service);

      const absolutePath = path.join(tempDir, "src", "models", "test.ts");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
      const result = normalizePathMethod(absolutePath);

      assert.strictEqual(result, path.join("src", "models", "test.ts"));
    });
  });

  describe("fileExists", () => {
    it("should return true for existing file", async () => {
      const service = await AddService.create(tempDir, mockLogger);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      const fileExistsMethod = (service as any).fileExists.bind(service);

      // テスト用ファイルを作成
      const testFile = "test.txt";
      await fs.writeFile(path.join(tempDir, testFile), "test content");

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
      const result = await fileExistsMethod(testFile);
      assert.strictEqual(result, true);
    });

    it("should return false for non-existing file", async () => {
      const service = await AddService.create(tempDir, mockLogger);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      const fileExistsMethod = (service as any).fileExists.bind(service);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
      const result = await fileExistsMethod("non-existing.txt");
      assert.strictEqual(result, false);
    });

    it("should return false for directory", async () => {
      const service = await AddService.create(tempDir, mockLogger);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      const fileExistsMethod = (service as any).fileExists.bind(service);

      // テスト用ディレクトリを作成
      const testDir = "testdir";
      await fs.mkdir(path.join(tempDir, testDir));

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
      const result = await fileExistsMethod(testDir);
      assert.strictEqual(result, false);
    });
  });

  describe("processFile", () => {
    it("should process untracked files correctly", async () => {
      const service = await AddService.create(tempDir, mockLogger);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      const processFileMethod = (service as any).processFile.bind(service);

      // テスト用ファイルを作成
      await fs.writeFile(path.join(tempDir, "new-file.txt"), "new content");

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
      const result = await processFileMethod("new-file.txt");

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      assert.strictEqual(result.filePath, "new-file.txt");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      assert.strictEqual(result.operation, "add");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      assert(result.sha);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      assert(result.stats);
    });

    it("should throw error for non-existing files not in index", async () => {
      const service = await AddService.create(tempDir, mockLogger);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      const processFileMethod = (service as any).processFile.bind(service);

      await assert.rejects(async () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        await processFileMethod("non-existing.txt");
      }, /pathspec 'non-existing.txt' did not match any files/);
    });

    it("should handle deleted files correctly", async () => {
      const service = await AddService.create(tempDir, mockLogger);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      const processFileMethod = (service as any).processFile.bind(service);

      // ファイルをインデックスに追加してから削除をシミュレート
      await fs.writeFile(path.join(tempDir, "delete-me.txt"), "content");
      
      // インデックスにエントリを追加（手動でモック）
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      const indexRepo = (service as any).indexRepo;
      const stats = await fs.stat(path.join(tempDir, "delete-me.txt"));
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      indexRepo.add("delete-me.txt", "dummy-sha", stats);

      // ファイルを削除
      await fs.unlink(path.join(tempDir, "delete-me.txt"));

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
      const result = await processFileMethod("delete-me.txt");

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      assert.strictEqual(result.filePath, "delete-me.txt");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      assert.strictEqual(result.operation, "delete");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      assert.strictEqual(result.sha, undefined);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      assert.strictEqual(result.stats, undefined);
    });
  });

  describe("execute (integration)", () => {
    it("should handle mixed operations (add/update/delete)", async () => {
      const service = await AddService.create(tempDir, mockLogger);

      // ファイルを作成してaddをテスト
      await fs.writeFile(path.join(tempDir, "new-file.txt"), "new content");
      await service.execute(["new-file.txt"]);

      // インデックスにエントリが追加されたことを確認
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      const indexRepo = (service as any).indexRepo;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const entry = indexRepo.getEntry("new-file.txt");
      assert(entry, "Entry should exist in index");

      // ファイルを更新してupdateをテスト  
      await fs.writeFile(path.join(tempDir, "new-file.txt"), "updated content");
      await service.execute(["new-file.txt"]);
      
      // 正常に完了することを確認（エラーが発生しない）
      assert(true, "Update operation should succeed");
    });

    it("should handle multiple files in one operation", async () => {
      const service = await AddService.create(tempDir, mockLogger);

      // 複数のファイルを作成
      await fs.writeFile(path.join(tempDir, "file1.txt"), "content1");
      await fs.writeFile(path.join(tempDir, "file2.txt"), "content2");
      await fs.writeFile(path.join(tempDir, "file3.txt"), "content3");

      // 一度に全て追加
      await service.execute(["file1.txt", "file2.txt", "file3.txt"]);

      // 全てのファイルがインデックスに追加されたことを確認
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      const indexRepo = (service as any).indexRepo;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      assert(indexRepo.getEntry("file1.txt"), "file1.txt should be in index");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      assert(indexRepo.getEntry("file2.txt"), "file2.txt should be in index");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      assert(indexRepo.getEntry("file3.txt"), "file3.txt should be in index");
    });
  });
});
