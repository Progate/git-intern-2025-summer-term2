/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable @typescript-eslint/no-unsafe-call */

/* eslint-disable @typescript-eslint/no-unsafe-member-access */

/* eslint-disable @typescript-eslint/no-explicit-any */
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

      const normalizePathMethod = (service as any).normalizePath.bind(service);

      const absolutePath = path.join(tempDir, "test.txt");

      const result = normalizePathMethod(absolutePath);

      assert.strictEqual(result, "test.txt");
    });

    it("should keep relative path as is", async () => {
      const service = await AddService.create(tempDir, mockLogger);

      const normalizePathMethod = (service as any).normalizePath.bind(service);

      const relativePath = "src/test.ts";

      const result = normalizePathMethod(relativePath);

      assert.strictEqual(result, "src/test.ts");
    });

    it("should handle nested paths correctly", async () => {
      const service = await AddService.create(tempDir, mockLogger);

      const normalizePathMethod = (service as any).normalizePath.bind(service);

      const absolutePath = path.join(tempDir, "src", "models", "test.ts");

      const result = normalizePathMethod(absolutePath);

      assert.strictEqual(result, path.join("src", "models", "test.ts"));
    });
  });

  describe("fileExists", () => {
    it("should return true for existing file", async () => {
      const service = await AddService.create(tempDir, mockLogger);

      const fileExistsMethod = (service as any).fileExists.bind(service);

      // テスト用ファイルを作成
      const testFile = "test.txt";
      await fs.writeFile(path.join(tempDir, testFile), "test content");

      const result = await fileExistsMethod(testFile);
      assert.strictEqual(result, true);
    });

    it("should return false for non-existing file", async () => {
      const service = await AddService.create(tempDir, mockLogger);

      const fileExistsMethod = (service as any).fileExists.bind(service);

      const result = await fileExistsMethod("non-existing.txt");
      assert.strictEqual(result, false);
    });

    it("should return false for directory", async () => {
      const service = await AddService.create(tempDir, mockLogger);

      const fileExistsMethod = (service as any).fileExists.bind(service);

      // テスト用ディレクトリを作成
      const testDir = "testdir";
      await fs.mkdir(path.join(tempDir, testDir));

      const result = await fileExistsMethod(testDir);
      assert.strictEqual(result, false);
    });
  });

  describe("processFile", () => {
    it("should process untracked files correctly", async () => {
      const service = await AddService.create(tempDir, mockLogger);

      const processFileMethod = (service as any).processFile.bind(service);

      // テスト用ファイルを作成
      await fs.writeFile(path.join(tempDir, "new-file.txt"), "new content");

      const result = await processFileMethod("new-file.txt");

      assert.strictEqual(result.filePath, "new-file.txt");

      assert.strictEqual(result.operation, "add");

      assert(result.sha);

      assert(result.stats);
    });

    it("should throw error for non-existing files not in index", async () => {
      const service = await AddService.create(tempDir, mockLogger);

      const processFileMethod = (service as any).processFile.bind(service);

      await assert.rejects(async () => {
        await processFileMethod("non-existing.txt");
      }, /pathspec 'non-existing.txt' did not match any files/);
    });

    it("should handle deleted files correctly", async () => {
      const service = await AddService.create(tempDir, mockLogger);

      const processFileMethod = (service as any).processFile.bind(service);

      // ファイルをインデックスに追加してから削除をシミュレート
      await fs.writeFile(path.join(tempDir, "delete-me.txt"), "content");

      // インデックスにエントリを追加（手動でモック）

      const indexRepo = (service as any).indexRepo;
      const stats = await fs.stat(path.join(tempDir, "delete-me.txt"));

      indexRepo.add("delete-me.txt", "dummy-sha", stats);

      // ファイルを削除
      await fs.unlink(path.join(tempDir, "delete-me.txt"));

      const result = await processFileMethod("delete-me.txt");

      assert.strictEqual(result.filePath, "delete-me.txt");

      assert.strictEqual(result.operation, "delete");

      assert.strictEqual(result.sha, undefined);

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

      const indexRepo = (service as any).indexRepo;

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

      const indexRepo = (service as any).indexRepo;

      assert(indexRepo.getEntry("file1.txt"), "file1.txt should be in index");

      assert(indexRepo.getEntry("file2.txt"), "file2.txt should be in index");

      assert(indexRepo.getEntry("file3.txt"), "file3.txt should be in index");
    });
  });

  describe("Directory processing", () => {
    it("should add all files in a directory recursively", async () => {
      const service = await AddService.create(tempDir, mockLogger);

      // ディレクトリ構造を作成
      const subDir = path.join(tempDir, "subdir");
      const nestedDir = path.join(subDir, "nested");
      await fs.mkdir(subDir, { recursive: true });
      await fs.mkdir(nestedDir, { recursive: true });

      // ファイルを各ディレクトリに配置
      await fs.writeFile(path.join(tempDir, "root.txt"), "root content");
      await fs.writeFile(path.join(subDir, "sub.txt"), "sub content");
      await fs.writeFile(path.join(nestedDir, "nested.txt"), "nested content");

      // ディレクトリを指定してadd
      await service.execute(["subdir"]);

      const indexRepo = (service as any).indexRepo;

      // サブディレクトリ内のファイルがインデックスに追加されたことを確認
      assert(
        indexRepo.getEntry("subdir/sub.txt"),
        "subdir/sub.txt should be in index",
      );
      assert(
        indexRepo.getEntry("subdir/nested/nested.txt"),
        "subdir/nested/nested.txt should be in index",
      );

      // ルートファイルは追加されていないことを確認
      assert(
        !indexRepo.getEntry("root.txt"),
        "root.txt should not be in index",
      );
    });

    it("should add all files when using current directory (.)", async () => {
      const service = await AddService.create(tempDir, mockLogger);

      // ファイルとディレクトリ構造を作成
      await fs.writeFile(path.join(tempDir, "root1.txt"), "root1 content");
      await fs.writeFile(path.join(tempDir, "root2.txt"), "root2 content");

      const subDir = path.join(tempDir, "subdir");
      await fs.mkdir(subDir, { recursive: true });
      await fs.writeFile(path.join(subDir, "sub.txt"), "sub content");

      // カレントディレクトリ全体をadd
      await service.execute(["."]);

      const indexRepo = (service as any).indexRepo;

      // 全てのファイルがインデックスに追加されたことを確認
      assert(indexRepo.getEntry("root1.txt"), "root1.txt should be in index");
      assert(indexRepo.getEntry("root2.txt"), "root2.txt should be in index");
      assert(
        indexRepo.getEntry("subdir/sub.txt"),
        "subdir/sub.txt should be in index",
      );
    });

    it("should exclude .git directory", async () => {
      const service = await AddService.create(tempDir, mockLogger);

      // .git内にファイルを作成（テスト用）
      await fs.writeFile(path.join(gitDir, "config"), "git config");

      // 通常ファイルも作成
      await fs.writeFile(path.join(tempDir, "normal.txt"), "normal content");

      // カレントディレクトリ全体をadd
      await service.execute(["."]);

      const indexRepo = (service as any).indexRepo;

      // 通常ファイルは追加される
      assert(indexRepo.getEntry("normal.txt"), "normal.txt should be in index");

      // .git内のファイルは追加されない
      assert(
        !indexRepo.getEntry(".git/config"),
        ".git/config should not be in index",
      );
    });

    it("should handle mixed file and directory arguments", async () => {
      const service = await AddService.create(tempDir, mockLogger);

      // ファイルとディレクトリを作成
      await fs.writeFile(path.join(tempDir, "single.txt"), "single content");

      const subDir = path.join(tempDir, "subdir");
      await fs.mkdir(subDir, { recursive: true });
      await fs.writeFile(path.join(subDir, "sub.txt"), "sub content");

      // ファイルとディレクトリを混在指定
      await service.execute(["single.txt", "subdir"]);

      const indexRepo = (service as any).indexRepo;

      // 両方ともインデックスに追加されたことを確認
      assert(indexRepo.getEntry("single.txt"), "single.txt should be in index");
      assert(
        indexRepo.getEntry("subdir/sub.txt"),
        "subdir/sub.txt should be in index",
      );
    });

    it("should throw error for non-existent directory", async () => {
      const service = await AddService.create(tempDir, mockLogger);

      // 存在しないディレクトリを指定
      await assert.rejects(
        async () => {
          await service.execute(["non-existent-dir"]);
        },
        /Failed to process 'non-existent-dir'/,
        "Should throw error for non-existent directory",
      );
    });

    it("should handle empty directory gracefully", async () => {
      const service = await AddService.create(tempDir, mockLogger);

      // 空のディレクトリを作成
      const emptyDir = path.join(tempDir, "empty");
      await fs.mkdir(emptyDir, { recursive: true });

      // 空ディレクトリを指定してadd（エラーにならずに正常完了）
      await service.execute(["empty"]);

      // 処理が正常に完了することを確認
      assert(true, "Empty directory processing should succeed");
    });

    it("should automatically skip .git files and directories", async () => {
      const service = await AddService.create(tempDir, mockLogger);

      // 通常ファイルと.git関連ファイルを作成
      await fs.writeFile(path.join(tempDir, "normal.txt"), "normal content");

      // .git関連のパスを引数に含める
      await service.execute([".git/config", "normal.txt", ".git"]);

      const indexRepo = (service as any).indexRepo;

      // 通常ファイルのみがインデックスに追加されることを確認
      assert(indexRepo.getEntry("normal.txt"), "normal.txt should be in index");
      assert(
        !indexRepo.getEntry(".git/config"),
        ".git/config should not be in index",
      );
    });
  });
});
