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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const normalizePathMethod = (service as any).normalizePath.bind(service);

      const absolutePath = path.join(tempDir, "test.txt");
      const result = normalizePathMethod(absolutePath);

      assert.strictEqual(result, "test.txt");
    });

    it("should keep relative path as is", async () => {
      const service = await AddService.create(tempDir, mockLogger);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const normalizePathMethod = (service as any).normalizePath.bind(service);

      const relativePath = "src/test.ts";
      const result = normalizePathMethod(relativePath);

      assert.strictEqual(result, "src/test.ts");
    });

    it("should handle nested paths correctly", async () => {
      const service = await AddService.create(tempDir, mockLogger);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const normalizePathMethod = (service as any).normalizePath.bind(service);

      const absolutePath = path.join(tempDir, "src", "models", "test.ts");
      const result = normalizePathMethod(absolutePath);

      assert.strictEqual(result, path.join("src", "models", "test.ts"));
    });
  });

  describe("fileExists", () => {
    it("should return true for existing file", async () => {
      const service = await AddService.create(tempDir, mockLogger);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const fileExistsMethod = (service as any).fileExists.bind(service);

      // テスト用ファイルを作成
      const testFile = "test.txt";
      await fs.writeFile(path.join(tempDir, testFile), "test content");

      const result = await fileExistsMethod(testFile);
      assert.strictEqual(result, true);
    });

    it("should return false for non-existing file", async () => {
      const service = await AddService.create(tempDir, mockLogger);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const fileExistsMethod = (service as any).fileExists.bind(service);

      const result = await fileExistsMethod("non-existing.txt");
      assert.strictEqual(result, false);
    });

    it("should return false for directory", async () => {
      const service = await AddService.create(tempDir, mockLogger);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const fileExistsMethod = (service as any).fileExists.bind(service);

      // テスト用ディレクトリを作成
      const testDir = "testdir";
      await fs.mkdir(path.join(tempDir, testDir));

      const result = await fileExistsMethod(testDir);
      assert.strictEqual(result, false);
    });
  });

  describe("categorizeFiles", () => {
    it("should categorize untracked files correctly", async () => {
      const service = await AddService.create(tempDir, mockLogger);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const categorizeFilesMethod = (service as any).categorizeFiles.bind(
        service,
      );

      // テスト用ファイルを作成
      await fs.writeFile(path.join(tempDir, "new-file.txt"), "new content");

      const result = await categorizeFilesMethod(["new-file.txt"]);

      assert.strictEqual(result.untracked.length, 1);
      assert.strictEqual(result.untracked[0], "new-file.txt");
      assert.strictEqual(result.tracking.length, 0);
      assert.strictEqual(result.deleted.length, 0);
    });

    it("should throw error for non-existing files not in index", async () => {
      const service = await AddService.create(tempDir, mockLogger);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const categorizeFilesMethod = (service as any).categorizeFiles.bind(
        service,
      );

      await assert.rejects(async () => {
        await categorizeFilesMethod(["non-existing.txt"]);
      }, /pathspec 'non-existing.txt' did not match any files/);
    });

    it("should handle multiple files correctly", async () => {
      const service = await AddService.create(tempDir, mockLogger);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const categorizeFilesMethod = (service as any).categorizeFiles.bind(
        service,
      );

      // 複数のテストファイルを作成
      await fs.writeFile(path.join(tempDir, "file1.txt"), "content1");
      await fs.writeFile(path.join(tempDir, "file2.txt"), "content2");

      const result = await categorizeFilesMethod(["file1.txt", "file2.txt"]);

      assert.strictEqual(result.untracked.length, 2);
      assert.strictEqual(result.tracking.length, 0);
      assert.strictEqual(result.deleted.length, 0);
    });
  });
});
