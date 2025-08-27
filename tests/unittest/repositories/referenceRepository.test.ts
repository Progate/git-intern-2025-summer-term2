import * as fs from "fs/promises";
import assert from "node:assert";
import { afterEach, beforeEach, describe, it } from "node:test";
import * as os from "os";
import * as path from "path";

import {
  ReferenceRepository,
  ReferenceRepositoryError,
} from "../../../src/repositories/referenceRepository.js";

describe("ReferenceRepository", () => {
  let tempGitDir: string;
  let refRepo: ReferenceRepository;

  beforeEach(async () => {
    tempGitDir = await fs.mkdtemp(path.join(os.tmpdir(), "refRepo-test-"));
    refRepo = new ReferenceRepository(tempGitDir);

    // 基本的な.git構造を作成
    await fs.mkdir(path.join(tempGitDir, "refs"), { recursive: true });
    await fs.mkdir(path.join(tempGitDir, "refs", "heads"), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempGitDir, { recursive: true, force: true });
  });

  describe("constructor", () => {
    it("should initialize with gitDir path", () => {
      const repo = new ReferenceRepository("/path/to/.git");
      assert.ok(repo, "ReferenceRepository should be defined");
    });
  });

  describe("resolveHead() method", () => {
    it("should resolve HEAD pointing to branch reference", async () => {
      const commitSha = "a1b2c3d4e5f6789012345678901234567890abcd";

      // HEADファイルを作成（ブランチ参照）
      await fs.writeFile(
        path.join(tempGitDir, "HEAD"),
        "ref: refs/heads/main\n",
        "utf8",
      );

      // ブランチファイルを作成
      await fs.writeFile(
        path.join(tempGitDir, "refs", "heads", "main"),
        `${commitSha}\n`,
        "utf8",
      );

      const result = await refRepo.resolveHead();
      assert.strictEqual(result, commitSha);
    });

    it("should resolve HEAD with direct SHA (detached HEAD)", async () => {
      const commitSha = "a1b2c3d4e5f6789012345678901234567890abcd";

      // HEADファイルを作成（直接SHA）
      await fs.writeFile(
        path.join(tempGitDir, "HEAD"),
        `${commitSha}\n`,
        "utf8",
      );

      const result = await refRepo.resolveHead();
      assert.strictEqual(result, commitSha);
    });

    it("should handle HEAD without trailing newline", async () => {
      const commitSha = "a1b2c3d4e5f6789012345678901234567890abcd";

      // 改行なしでHEADファイルを作成
      await fs.writeFile(path.join(tempGitDir, "HEAD"), commitSha, "utf8");

      const result = await refRepo.resolveHead();
      assert.strictEqual(result, commitSha);
    });

    it("should throw error when HEAD file not found", async () => {
      await assert.rejects(
        async () => await refRepo.resolveHead(),
        (error: Error): error is ReferenceRepositoryError => {
          return (
            error instanceof ReferenceRepositoryError &&
            error.code === "HEAD_NOT_FOUND"
          );
        },
        "Should throw HEAD_NOT_FOUND error",
      );
    });

    it("should throw error for invalid HEAD content", async () => {
      // 無効な内容でHEADファイルを作成
      await fs.writeFile(
        path.join(tempGitDir, "HEAD"),
        "invalid content\n",
        "utf8",
      );

      await assert.rejects(
        async () => await refRepo.resolveHead(),
        (error: Error): error is ReferenceRepositoryError => {
          return (
            error instanceof ReferenceRepositoryError &&
            error.code === "INVALID_HEAD"
          );
        },
        "Should throw INVALID_HEAD error",
      );
    });

    it("should throw error when branch reference not found", async () => {
      // 存在しないブランチを指すHEADファイルを作成
      await fs.writeFile(
        path.join(tempGitDir, "HEAD"),
        "ref: refs/heads/nonexistent\n",
        "utf8",
      );

      await assert.rejects(
        async () => await refRepo.resolveHead(),
        (error: Error): error is ReferenceRepositoryError => {
          return (
            error instanceof ReferenceRepositoryError &&
            error.code === "REF_NOT_FOUND"
          );
        },
        "Should throw REF_NOT_FOUND error",
      );
    });

    it("should throw error for invalid SHA in branch file", async () => {
      // HEADファイルを作成
      await fs.writeFile(
        path.join(tempGitDir, "HEAD"),
        "ref: refs/heads/main\n",
        "utf8",
      );

      // 無効なSHAでブランチファイルを作成
      await fs.writeFile(
        path.join(tempGitDir, "refs", "heads", "main"),
        "invalid-sha\n",
        "utf8",
      );

      await assert.rejects(
        async () => await refRepo.resolveHead(),
        (error: Error): error is ReferenceRepositoryError => {
          return (
            error instanceof ReferenceRepositoryError &&
            error.code === "INVALID_SHA"
          );
        },
        "Should throw INVALID_SHA error",
      );
    });
  });

  describe("getCurrentBranch() method", () => {
    it("should return branch name when HEAD points to branch", async () => {
      await fs.writeFile(
        path.join(tempGitDir, "HEAD"),
        "ref: refs/heads/feature-branch\n",
        "utf8",
      );

      const result = await refRepo.getCurrentBranch();
      assert.strictEqual(result, "feature-branch");
    });

    it("should return null for detached HEAD", async () => {
      const commitSha = "a1b2c3d4e5f6789012345678901234567890abcd";
      await fs.writeFile(
        path.join(tempGitDir, "HEAD"),
        `${commitSha}\n`,
        "utf8",
      );

      const result = await refRepo.getCurrentBranch();
      assert.strictEqual(result, null);
    });

    it("should handle different branch name formats", async () => {
      await fs.writeFile(
        path.join(tempGitDir, "HEAD"),
        "ref: refs/heads/fix/issue-123\n",
        "utf8",
      );

      const result = await refRepo.getCurrentBranch();
      assert.strictEqual(result, "fix/issue-123");
    });
  });

  describe("updateHead() method", () => {
    it("should update branch file when on branch", async () => {
      const oldSha = "a1b2c3d4e5f6789012345678901234567890abcd";
      const newSha = "b2c3d4e5f6789012345678901234567890abcdef";

      // 初期状態設定
      await fs.writeFile(
        path.join(tempGitDir, "HEAD"),
        "ref: refs/heads/main\n",
        "utf8",
      );
      await fs.writeFile(
        path.join(tempGitDir, "refs", "heads", "main"),
        `${oldSha}\n`,
        "utf8",
      );

      // ブランチ更新
      await refRepo.updateHead(newSha);

      // ブランチファイルが更新されたことを確認
      const branchContent = await fs.readFile(
        path.join(tempGitDir, "refs", "heads", "main"),
        "utf8",
      );
      assert.strictEqual(branchContent.trim(), newSha);
    });

    it("should update HEAD file when in detached HEAD state", async () => {
      const oldSha = "a1b2c3d4e5f6789012345678901234567890abcd";
      const newSha = "b2c3d4e5f6789012345678901234567890abcdef";

      // detached HEAD状態を設定
      await fs.writeFile(path.join(tempGitDir, "HEAD"), `${oldSha}\n`, "utf8");

      // HEAD更新
      await refRepo.updateHead(newSha);

      // HEADファイルが更新されたことを確認
      const headContent = await fs.readFile(
        path.join(tempGitDir, "HEAD"),
        "utf8",
      );
      assert.strictEqual(headContent.trim(), newSha);
    });

    it("should create branch directory if not exists", async () => {
      const newSha = "b2c3d4e5f6789012345678901234567890abcdef";

      // 新しいブランチ階層を指すHEADを作成
      await fs.writeFile(
        path.join(tempGitDir, "HEAD"),
        "ref: refs/heads/feature/new-branch\n",
        "utf8",
      );

      // ディレクトリが存在しない状態で更新
      await refRepo.updateHead(newSha);

      // ファイルが正常に作成されたことを確認
      const branchContent = await fs.readFile(
        path.join(tempGitDir, "refs", "heads", "feature", "new-branch"),
        "utf8",
      );
      assert.strictEqual(branchContent.trim(), newSha);
    });

    it("should throw error for invalid SHA format", async () => {
      await fs.writeFile(
        path.join(tempGitDir, "HEAD"),
        "ref: refs/heads/main\n",
        "utf8",
      );

      await assert.rejects(
        async () => {
          await refRepo.updateHead("invalid-sha");
        },
        (error: Error): error is ReferenceRepositoryError => {
          return (
            error instanceof ReferenceRepositoryError &&
            error.code === "INVALID_SHA"
          );
        },
        "Should throw INVALID_SHA error",
      );
    });
  });

  describe("resolveRef() method", () => {
    it("should resolve valid reference", async () => {
      const commitSha = "a1b2c3d4e5f6789012345678901234567890abcd";

      await fs.writeFile(
        path.join(tempGitDir, "refs", "heads", "main"),
        `${commitSha}\n`,
        "utf8",
      );

      const result = await refRepo.resolveRef("refs/heads/main");
      assert.strictEqual(result, commitSha);
    });

    it("should handle reference without trailing newline", async () => {
      const commitSha = "a1b2c3d4e5f6789012345678901234567890abcd";

      await fs.writeFile(
        path.join(tempGitDir, "refs", "heads", "main"),
        commitSha, // 改行なし
        "utf8",
      );

      const result = await refRepo.resolveRef("refs/heads/main");
      assert.strictEqual(result, commitSha);
    });

    it("should throw error for non-existent reference", async () => {
      await assert.rejects(
        async () => await refRepo.resolveRef("refs/heads/nonexistent"),
        (error: Error): error is ReferenceRepositoryError => {
          return (
            error instanceof ReferenceRepositoryError &&
            error.code === "REF_NOT_FOUND"
          );
        },
        "Should throw REF_NOT_FOUND error",
      );
    });

    it("should throw error for invalid SHA in reference", async () => {
      await fs.writeFile(
        path.join(tempGitDir, "refs", "heads", "main"),
        "invalid-sha\n",
        "utf8",
      );

      await assert.rejects(
        async () => await refRepo.resolveRef("refs/heads/main"),
        (error: Error): error is ReferenceRepositoryError => {
          return (
            error instanceof ReferenceRepositoryError &&
            error.code === "INVALID_SHA"
          );
        },
        "Should throw INVALID_SHA error",
      );
    });
  });

  describe("Edge cases and integration", () => {
    it("should handle uppercase and lowercase SHA formats", async () => {
      const mixedCaseSha = "A1b2C3d4E5f6789012345678901234567890AbCd";

      await fs.writeFile(
        path.join(tempGitDir, "HEAD"),
        `${mixedCaseSha}\n`,
        "utf8",
      );

      const result = await refRepo.resolveHead();
      // SHA-1検証は大文字小文字を区別しない
      assert.strictEqual(result.toLowerCase(), mixedCaseSha.toLowerCase());
    });

    it("should handle complex branch names", async () => {
      const commitSha = "a1b2c3d4e5f6789012345678901234567890abcd";
      const branchName = "feature/fix-issue-123_with-underscores";

      // 複雑なブランチ名のディレクトリ構造を作成
      await fs.mkdir(path.join(tempGitDir, "refs", "heads", "feature"), {
        recursive: true,
      });
      await fs.writeFile(
        path.join(tempGitDir, "refs", "heads", branchName),
        `${commitSha}\n`,
        "utf8",
      );
      await fs.writeFile(
        path.join(tempGitDir, "HEAD"),
        `ref: refs/heads/${branchName}\n`,
        "utf8",
      );

      const resolvedSha = await refRepo.resolveHead();
      const currentBranch = await refRepo.getCurrentBranch();

      assert.strictEqual(resolvedSha, commitSha);
      assert.strictEqual(currentBranch, branchName);
    });

    it("should handle complete workflow: create branch and update", async () => {
      const initialSha = "a1b2c3d4e5f6789012345678901234567890abcd";
      const newSha = "b2c3d4e5f6789012345678901234567890abcdef";

      // 初期ブランチを作成
      await fs.writeFile(
        path.join(tempGitDir, "refs", "heads", "main"),
        `${initialSha}\n`,
        "utf8",
      );
      await fs.writeFile(
        path.join(tempGitDir, "HEAD"),
        "ref: refs/heads/main\n",
        "utf8",
      );

      // 初期状態確認
      assert.strictEqual(await refRepo.resolveHead(), initialSha);
      assert.strictEqual(await refRepo.getCurrentBranch(), "main");

      // ブランチ更新
      await refRepo.updateHead(newSha);

      // 更新後確認
      assert.strictEqual(await refRepo.resolveHead(), newSha);
      assert.strictEqual(await refRepo.getCurrentBranch(), "main");
    });

    it("should handle whitespace in files gracefully", async () => {
      const commitSha = "a1b2c3d4e5f6789012345678901234567890abcd";

      // 前後に空白があるファイルを作成
      await fs.writeFile(
        path.join(tempGitDir, "HEAD"),
        `  ${commitSha}  \n`,
        "utf8",
      );

      const result = await refRepo.resolveHead();
      assert.strictEqual(result, commitSha);
    });
  });
});
