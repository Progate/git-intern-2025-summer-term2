import * as fs from "fs/promises";
import assert from "node:assert";
import { afterEach, beforeEach, describe, it } from "node:test";
import * as os from "os";
import * as path from "path";

import { Blob } from "../../../src/models/blob.js";
import { Commit } from "../../../src/models/commit.js";
import { Tree } from "../../../src/models/tree.js";
import {
  ObjectRepository,
  ObjectRepositoryError,
} from "../../../src/repositories/objectRepository.js";

/**
 * テストで共通使用するヘルパー関数
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
class TestHelper {
  static async createTempGitDir(): Promise<string> {
    return await fs.mkdtemp(path.join(os.tmpdir(), "objectrepo-test-"));
  }

  static async cleanupTempDir(dir: string): Promise<void> {
    await fs.rm(dir, { recursive: true, force: true });
  }

  static createTestBlob(content: string): Blob {
    return new Blob(Buffer.from(content, "utf8"));
  }

  static createTestTree(
    entries: Array<{ mode: string; name: string; sha: string }>,
  ): Tree {
    return new Tree(entries);
  }

  static createTestCommit(): Commit {
    return new Commit(
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", // tree SHA
      ["bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"], // parent SHAs
      {
        name: "Test Author",
        email: "test@example.com",
        timestamp: new Date("2023-01-01T00:00:00Z"),
      },
      {
        name: "Test Committer",
        email: "test@example.com",
        timestamp: new Date("2023-01-01T00:00:00Z"),
      },
      "Test commit message",
    );
  }

  static generateRandomSHA(): string {
    return Array(40)
      .fill(0)
      .map(() => Math.floor(Math.random() * 16).toString(16))
      .join("");
  }
}

describe("ObjectRepository", () => {
  let tempGitDir: string;
  let objectRepo: ObjectRepository;

  beforeEach(async () => {
    tempGitDir = await TestHelper.createTempGitDir();
    objectRepo = new ObjectRepository(tempGitDir);
  });

  afterEach(async () => {
    await TestHelper.cleanupTempDir(tempGitDir);
  });

  describe("constructor", () => {
    it("should initialize with gitDir path", () => {
      const gitDir = "/path/to/.git";
      const repo = new ObjectRepository(gitDir);
      assert.ok(repo, "ObjectRepository should be defined");
    });

    it("should set objectsDir correctly", () => {
      // コンストラクタが正常に動作することを確認
      assert.ok(objectRepo, "ObjectRepository instance should be created");
    });
  });

  describe("write() method", () => {
    it("should write Blob object and return SHA", async () => {
      // テストデータ準備
      const content = Buffer.from("Hello, World!", "utf8");
      const blob = new Blob(content);
      const expectedSha = blob.getSha();

      // 書き込み実行
      const actualSha = await objectRepo.write(blob);

      // 結果検証
      assert.strictEqual(
        actualSha,
        expectedSha,
        "Returned SHA should match expected SHA",
      );
      assert.strictEqual(
        await objectRepo.exists(actualSha),
        true,
        "Object should exist after write",
      );
    });

    it("should write Tree object correctly", async () => {
      // Treeオブジェクトのテスト
      const entries = [
        {
          mode: "100644",
          name: "file1.txt",
          sha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
        {
          mode: "100644",
          name: "file2.txt",
          sha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        },
      ];
      const tree = new Tree(entries);

      const sha = await objectRepo.write(tree);
      assert.strictEqual(
        sha,
        tree.getSha(),
        "SHA should match Tree object's SHA",
      );
    });

    it("should write Commit object correctly", async () => {
      // Commitオブジェクトのテスト
      const commit = TestHelper.createTestCommit();

      const sha = await objectRepo.write(commit);
      assert.strictEqual(
        sha,
        commit.getSha(),
        "SHA should match Commit object's SHA",
      );
    });

    it("should skip duplicate writes (optimization)", async () => {
      // 重複書き込み最適化のテスト
      const blob = new Blob(Buffer.from("test content"));

      // 1回目の書き込み
      const sha1 = await objectRepo.write(blob);

      // 2回目の書き込み（同じオブジェクト）
      const sha2 = await objectRepo.write(blob);

      assert.strictEqual(sha1, sha2, "Duplicate writes should return same SHA");
      assert.strictEqual(
        await objectRepo.exists(sha1),
        true,
        "Object should exist",
      );
    });

    it("should create directory structure automatically", async () => {
      // ディレクトリ自動作成のテスト
      const blob = new Blob(Buffer.from("test"));
      const sha = await objectRepo.write(blob);

      // objects/ab/cdef... 構造が作成されていることを確認
      const objectPath = path.join(
        tempGitDir,
        "objects",
        sha.substring(0, 2),
        sha.substring(2),
      );

      try {
        await fs.access(objectPath);
        assert.ok(true, "Object file should be accessible");
      } catch {
        assert.fail("Object file should exist");
      }
    });
  });

  describe("read() method", () => {
    it("should read existing Blob object", async () => {
      // 事前にBlobを書き込み
      const content = Buffer.from("Test blob content");
      const originalBlob = new Blob(content);
      const sha = await objectRepo.write(originalBlob);

      // 読み取りテスト
      const readBlob = await objectRepo.read(sha);

      assert.ok(
        readBlob instanceof Blob,
        "Read object should be instance of Blob",
      );
      assert.strictEqual(
        readBlob.getType(),
        "blob",
        "Object type should be blob",
      );
      assert.deepStrictEqual(
        readBlob.getContent(),
        content,
        "Content should match original",
      );
    });

    it("should read existing Tree object", async () => {
      // Treeオブジェクトの読み取りテスト
      const entries = [
        {
          mode: "100644",
          name: "test.txt",
          sha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
      ];
      const originalTree = new Tree(entries);
      const sha = await objectRepo.write(originalTree);

      const readTree = await objectRepo.read(sha);

      assert.ok(
        readTree instanceof Tree,
        "Read object should be instance of Tree",
      );
      assert.strictEqual(
        readTree.getType(),
        "tree",
        "Object type should be tree",
      );
    });

    it("should read existing Commit object", async () => {
      // Commitオブジェクトの読み取りテスト
      const commit = TestHelper.createTestCommit();
      const sha = await objectRepo.write(commit);

      const readCommit = await objectRepo.read(sha);

      assert.ok(
        readCommit instanceof Commit,
        "Read object should be instance of Commit",
      );
      assert.strictEqual(
        readCommit.getType(),
        "commit",
        "Object type should be commit",
      );
    });

    it("should verify SHA-1 integrity", async () => {
      // SHA-1整合性確認のテスト
      const blob = new Blob(Buffer.from("integrity test"));
      const originalSha = await objectRepo.write(blob);

      const readObject = await objectRepo.read(originalSha);
      assert.strictEqual(
        readObject.getSha(),
        originalSha,
        "SHA should match original",
      );
    });

    it("should throw error for non-existent object", async () => {
      // 存在しないオブジェクトのエラーテスト
      const nonExistentSha = "1234567890abcdef1234567890abcdef12345678";

      await assert.rejects(
        async () => await objectRepo.read(nonExistentSha),
        ObjectRepositoryError,
        "Should throw ObjectRepositoryError for non-existent object",
      );
    });

    it("should throw error for invalid SHA-1", async () => {
      // 無効なSHA-1形式のエラーテスト
      const invalidSha = "invalid-sha";

      await assert.rejects(
        async () => await objectRepo.read(invalidSha),
        ObjectRepositoryError,
        "Should throw ObjectRepositoryError for invalid SHA-1",
      );
    });
  });

  describe("exists() method", () => {
    it("should return true for existing objects", async () => {
      // 既存オブジェクトの存在確認
      const blob = new Blob(Buffer.from("exists test"));
      const sha = await objectRepo.write(blob);

      assert.strictEqual(
        await objectRepo.exists(sha),
        true,
        "Should return true for existing object",
      );
    });

    it("should return false for non-existent objects", async () => {
      // 存在しないオブジェクトの確認
      const nonExistentSha = "abcdef1234567890abcdef1234567890abcdef12";

      assert.strictEqual(
        await objectRepo.exists(nonExistentSha),
        false,
        "Should return false for non-existent object",
      );
    });

    it("should return false for invalid SHA-1", async () => {
      // 無効なSHA-1形式の処理
      const invalidSha = "invalid-sha-format";

      assert.strictEqual(
        await objectRepo.exists(invalidSha),
        false,
        "Should return false for invalid SHA-1",
      );
    });
  });

  describe("Error handling", () => {
    it("should throw INVALID_SHA for malformed SHA-1", async () => {
      // 形式不正なSHA-1のテスト
      const malformedShas = [
        "short",
        "toolongsha1234567890abcdef1234567890abcdef123456789",
        "contains-invalid-chars-!@#$%^&*()abcdef1234",
        "",
      ];

      for (const sha of malformedShas) {
        await assert.rejects(
          async () => await objectRepo.read(sha),
          (error: Error): error is ObjectRepositoryError => {
            return (
              error instanceof ObjectRepositoryError &&
              error.code === "INVALID_SHA"
            );
          },
          `Should throw INVALID_SHA error for malformed SHA: ${sha}`,
        );
      }
    });

    it("should throw NOT_FOUND for missing files", async () => {
      // ファイル不存在エラーのテスト
      const validButNonExistentSha = "1111111111111111111111111111111111111111";

      await assert.rejects(
        async () => await objectRepo.read(validButNonExistentSha),
        (error: Error): error is ObjectRepositoryError => {
          return (
            error instanceof ObjectRepositoryError && error.code === "NOT_FOUND"
          );
        },
        "Should throw NOT_FOUND error for missing files",
      );
    });

    it("should handle file corruption gracefully", async () => {
      // ファイル破損時の処理テスト
      const blob = new Blob(Buffer.from("corruption test"));
      const sha = await objectRepo.write(blob);

      // ファイルを意図的に破損させる
      const objectPath = path.join(
        tempGitDir,
        "objects",
        sha.substring(0, 2),
        sha.substring(2),
      );
      await fs.writeFile(objectPath, "corrupted data");

      await assert.rejects(
        async () => await objectRepo.read(sha),
        ObjectRepositoryError,
        "Should throw ObjectRepositoryError for corrupted file",
      );
    });
  });

  describe("Integration tests", () => {
    it("should perform write→read roundtrip correctly", async () => {
      // ラウンドトリップテスト（全オブジェクトタイプ）
      const testCases = [
        new Blob(Buffer.from("roundtrip blob test")),
        new Tree([
          {
            mode: "100644",
            name: "test.txt",
            sha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          },
        ]),
        TestHelper.createTestCommit(),
      ];

      for (const originalObject of testCases) {
        // 書き込み
        const sha = await objectRepo.write(originalObject);

        // 読み取り
        const readObject = await objectRepo.read(sha);

        // 検証
        assert.strictEqual(
          readObject.getType(),
          originalObject.getType(),
          "Object type should match",
        );
        assert.strictEqual(
          readObject.getSha(),
          originalObject.getSha(),
          "SHA should match",
        );
        assert.deepStrictEqual(
          readObject.serialize(),
          originalObject.serialize(),
          "Serialized data should match",
        );
      }
    });

    it("should handle concurrent writes safely", async () => {
      // 並行書き込みの安全性テスト
      const blob = new Blob(Buffer.from("concurrent test"));

      // 同じオブジェクトを並行して書き込み
      const promises = Array(5)
        .fill(null)
        .map(() => objectRepo.write(blob));
      const results = await Promise.all(promises);

      // 全て同じSHAを返すことを確認
      const firstSha = results[0];
      const allSame = results.every((sha) => sha === firstSha);
      assert.strictEqual(
        allSame,
        true,
        "All concurrent writes should return same SHA",
      );
      assert.ok(firstSha, "First SHA should be defined");
      assert.strictEqual(
        await objectRepo.exists(firstSha),
        true,
        "Object should exist after concurrent writes",
      );
    });
  });

  describe("Performance tests", () => {
    it("should handle large binary files", async () => {
      // 大きなバイナリファイルのテスト（100KB）
      const largeContent = Buffer.alloc(100 * 1024, 0xff); // 100KB
      const blob = new Blob(largeContent);

      const startTime = Date.now();
      const sha = await objectRepo.write(blob);
      const writeTime = Date.now() - startTime;

      const readStartTime = Date.now();
      const readBlob = await objectRepo.read(sha);
      const readTime = Date.now() - readStartTime;

      assert.deepStrictEqual(
        readBlob.getContent(),
        largeContent,
        "Large file content should match",
      );

      // パフォーマンス情報をログ出力（テスト失敗にはならない）
      console.log(
        `Large file test - Write time: ${writeTime.toString()}ms, Read time: ${readTime.toString()}ms`,
      );
    });

    it("should handle many small objects", async () => {
      // 大量の小さなオブジェクトのテスト
      const objectCount = 50; // CIでタイムアウトを避けるため50個に制限
      const shas = [];

      for (let i = 0; i < objectCount; i++) {
        const blob = new Blob(Buffer.from(`test content ${i.toString()}`));
        const sha = await objectRepo.write(blob);
        shas.push(sha);
      }

      // 全オブジェクトが正常に読み取れることを確認
      for (const sha of shas) {
        const object = await objectRepo.read(sha);
        assert.ok(object, `Object with SHA ${sha} should be readable`);
      }

      console.log(
        `Successfully handled ${objectCount.toString()} small objects`,
      );
    });
  });

  describe("Edge cases", () => {
    it("should handle empty blob", async () => {
      // 空のBlobのテスト
      const emptyBlob = new Blob(Buffer.alloc(0));
      const sha = await objectRepo.write(emptyBlob);

      const readBlob = await objectRepo.read(sha);
      assert.ok(readBlob instanceof Blob, "Should be Blob instance");
      assert.strictEqual(
        readBlob.getContent().length,
        0,
        "Empty blob should have zero length",
      );
    });

    it("should handle tree with no entries", async () => {
      // エントリのないTreeのテスト
      const emptyTree = new Tree([]);
      const sha = await objectRepo.write(emptyTree);

      const readTree = await objectRepo.read(sha);
      assert.ok(readTree instanceof Tree, "Should be Tree instance");
    });

    it("should handle commit with no parents", async () => {
      // 親のないCommit（初回コミット）のテスト
      const rootCommit = new Commit(
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", // tree SHA
        [], // no parents
        {
          name: "Root Author",
          email: "root@example.com",
          timestamp: new Date("2023-01-01T00:00:00Z"),
        },
        {
          name: "Root Committer",
          email: "root@example.com",
          timestamp: new Date("2023-01-01T00:00:00Z"),
        },
        "Initial commit",
      );

      const sha = await objectRepo.write(rootCommit);
      const readCommit = await objectRepo.read(sha);

      assert.ok(readCommit instanceof Commit, "Should be Commit instance");
    });

    it("should handle SHA-1 with mixed case", async () => {
      // 大文字小文字混在のSHA-1のテスト
      const blob = new Blob(Buffer.from("case test"));
      const sha = await objectRepo.write(blob);

      // 大文字に変換して読み取りテスト
      const upperSha = sha.toUpperCase();
      const readBlob = await objectRepo.read(upperSha);

      assert.ok(readBlob instanceof Blob, "Should handle mixed case SHA-1");
      assert.strictEqual(
        readBlob.getSha(),
        sha.toLowerCase(),
        "SHA should be normalized to lowercase",
      );
    });
  });
});
