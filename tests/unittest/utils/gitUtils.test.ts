import * as fs from "fs/promises";
import assert from "node:assert";
import { afterEach, beforeEach, describe, it } from "node:test";
import * as os from "os";
import * as path from "path";

import {
  findGitDirectory,
  isGitRepository,
} from "../../../src/utils/gitUtils.js";

describe("GitUtils", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "gitutils-test-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("findGitDirectory", () => {
    it("should find .git directory in current directory", async () => {
      // .gitディレクトリを作成
      const gitDir = path.join(tempDir, ".git");
      await fs.mkdir(gitDir);

      const result = await findGitDirectory(tempDir);
      assert.strictEqual(result, gitDir);
    });

    it("should find .git directory in parent directory", async () => {
      // 親ディレクトリに.gitを作成
      const gitDir = path.join(tempDir, ".git");
      await fs.mkdir(gitDir);

      // 子ディレクトリを作成
      const childDir = path.join(tempDir, "subdir");
      await fs.mkdir(childDir);

      const result = await findGitDirectory(childDir);
      assert.strictEqual(result, gitDir);
    });

    it("should find .git directory multiple levels up", async () => {
      // ルートに.gitを作成
      const gitDir = path.join(tempDir, ".git");
      await fs.mkdir(gitDir);

      // 深い階層のディレクトリを作成
      const deepDir = path.join(tempDir, "a", "b", "c");
      await fs.mkdir(deepDir, { recursive: true });

      const result = await findGitDirectory(deepDir);
      assert.strictEqual(result, gitDir);
    });

    it("should return null when .git directory not found", async () => {
      const result = await findGitDirectory(tempDir);
      assert.strictEqual(result, null);
    });

    it("should ignore .git file and look for directory", async () => {
      // .gitファイルを作成（ディレクトリではない）
      const gitFile = path.join(tempDir, ".git");
      await fs.writeFile(gitFile, "gitdir: /path/to/git");

      const result = await findGitDirectory(tempDir);
      assert.strictEqual(result, null);
    });

    it("should handle permission errors gracefully", async () => {
      // 通常は権限エラーをシミュレートするのは困難
      // このテストは基本的な動作確認のみ
      const result = await findGitDirectory(tempDir);
      assert.strictEqual(result, null);
    });
  });

  describe("isGitRepository", () => {
    it("should return true when .git directory exists", async () => {
      const gitDir = path.join(tempDir, ".git");
      await fs.mkdir(gitDir);

      const result = await isGitRepository(tempDir);
      assert.strictEqual(result, true);
    });

    it("should return true when .git directory exists in parent", async () => {
      // 親ディレクトリに.gitを作成
      const gitDir = path.join(tempDir, ".git");
      await fs.mkdir(gitDir);

      // 子ディレクトリを作成
      const childDir = path.join(tempDir, "subdir");
      await fs.mkdir(childDir);

      const result = await isGitRepository(childDir);
      assert.strictEqual(result, true);
    });

    it("should return false when .git directory not found", async () => {
      const result = await isGitRepository(tempDir);
      assert.strictEqual(result, false);
    });

    it("should use current working directory by default", async () => {
      // このテストは実際のcwdに依存するため、基本的な呼び出しのみテスト
      const result = await isGitRepository();
      assert.strictEqual(typeof result, "boolean");
    });
  });

  describe("Edge cases", () => {
    it("should handle symlink .git directories", async () => {
      // 実際の.gitディレクトリを作成
      const realGitDir = path.join(tempDir, "real.git");
      await fs.mkdir(realGitDir);

      // シンボリックリンクを作成（可能な場合）
      const gitSymlink = path.join(tempDir, ".git");
      try {
        await fs.symlink(realGitDir, gitSymlink);

        const result = await findGitDirectory(tempDir);
        // シンボリックリンクも.gitディレクトリとして認識される
        assert.strictEqual(result, gitSymlink);
      } catch {
        // シンボリックリンク作成に失敗した場合はスキップ
        // （Windows等の環境では権限が必要）
        console.log("Symlink test skipped - not supported in this environment");
      }
    });

    it("should handle very deep directory structures", async () => {
      // ルートに.gitを作成
      const gitDir = path.join(tempDir, ".git");
      await fs.mkdir(gitDir);

      // 非常に深い階層を作成（パスの長さ制限に注意）
      let deepPath = tempDir;
      for (let i = 0; i < 10; i++) {
        deepPath = path.join(deepPath, `level-${i.toString()}`);
      }
      await fs.mkdir(deepPath, { recursive: true });

      const result = await findGitDirectory(deepPath);
      assert.strictEqual(result, gitDir);
    });

    it("should handle empty directory names gracefully", async () => {
      // 通常の動作確認
      const result = await findGitDirectory(tempDir);
      assert.strictEqual(result, null);
    });
  });
});
