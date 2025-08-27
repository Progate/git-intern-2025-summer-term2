import { execSync } from "child_process";
import * as fs from "fs";
import assert from "node:assert";
import { afterEach, beforeEach, describe, test } from "node:test";
import * as path from "path";

import {
  ReferenceRepository,
  ReferenceRepositoryError,
} from "../../../src/repositories/referenceRepository.js";

describe("ReferenceRepository integration tests", () => {
  let tempDir: string;
  let gitDir: string;
  let repo: ReferenceRepository;

  beforeEach(() => {
    // /tmp下に一時ディレクトリを作成（プロジェクトディレクトリの外部）
    tempDir = fs.mkdtempSync(path.join("/tmp", "git-integration-test-"));

    // gitリポジトリを初期化
    execSync("git init", { cwd: tempDir, stdio: "pipe" });
    execSync("git config user.name 'Test User'", {
      cwd: tempDir,
      stdio: "pipe",
    });
    execSync("git config user.email 'test@example.com'", {
      cwd: tempDir,
      stdio: "pipe",
    });

    gitDir = path.join(tempDir, ".git");
    repo = new ReferenceRepository(gitDir);

    console.log("Created test git repository at:", tempDir);
  });

  afterEach(() => {
    // テスト後のクリーンアップ
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log("Cleaned up test repository:", tempDir);
    }
  });

  test("resolveHead returns correct SHA after initial commit", () => {
    console.log(
      "🧪 Test: resolveHead returns correct SHA after initial commit",
    );

    // Arrange: テストファイルを作成してコミット
    const testFile = path.join(tempDir, "test.txt");
    fs.writeFileSync(testFile, "test content");
    execSync("git add test.txt", { cwd: tempDir, stdio: "pipe" });
    execSync("git commit -m 'Initial commit'", { cwd: tempDir, stdio: "pipe" });

    // 期待するSHAを取得（git rev-parse HEAD）
    const expectedSha = execSync("git rev-parse HEAD", {
      cwd: tempDir,
      encoding: "utf8",
    }).trim();
    console.log("   Expected SHA from git:", expectedSha);

    // Act & Assert
    return repo.resolveHead().then((result) => {
      console.log("   ReferenceRepository result:", result);
      assert.strictEqual(result, expectedSha);
      assert.match(result, /^[0-9a-f]{40}$/);
      console.log("   ✅ Test passed - resolveHead returned correct SHA");
    });
  });

  test("getCurrentBranch returns default branch name", () => {
    console.log("🧪 Test: getCurrentBranch returns default branch name");

    // Arrange: テストファイルを作成してコミット
    const testFile = path.join(tempDir, "test.txt");
    fs.writeFileSync(testFile, "test content");
    execSync("git add test.txt", { cwd: tempDir, stdio: "pipe" });
    execSync("git commit -m 'Initial commit'", { cwd: tempDir, stdio: "pipe" });

    // Act & Assert
    return repo.getCurrentBranch().then((result) => {
      console.log("   Current branch:", result);
      assert.ok(result !== null);
      assert.ok(typeof result === "string");
      assert.ok(result.length > 0);
      console.log(
        "   ✅ Test passed - getCurrentBranch returned valid branch name",
      );
    });
  });

  test("resolveRef resolves branch reference correctly", () => {
    console.log("🧪 Test: resolveRef resolves branch reference correctly");

    // Arrange: テストファイルを作成してコミット
    const testFile = path.join(tempDir, "test.txt");
    fs.writeFileSync(testFile, "test content");
    execSync("git add test.txt", { cwd: tempDir, stdio: "pipe" });
    execSync("git commit -m 'Initial commit'", { cwd: tempDir, stdio: "pipe" });

    // ブランチ名を取得
    const branchName = execSync("git branch --show-current", {
      cwd: tempDir,
      encoding: "utf8",
    }).trim();
    const expectedSha = execSync("git rev-parse HEAD", {
      cwd: tempDir,
      encoding: "utf8",
    }).trim();
    console.log("   Branch name:", branchName);
    console.log("   Expected SHA:", expectedSha);

    // Act & Assert
    return repo.resolveRef(`refs/heads/${branchName}`).then((result) => {
      console.log("   resolveRef result:", result);
      assert.strictEqual(result, expectedSha);
      console.log(
        "   ✅ Test passed - resolveRef resolved branch reference correctly",
      );
    });
  });

  test("resolveHead throws error when HEAD file does not exist", () => {
    console.log(
      "🧪 Test: resolveHead throws error when HEAD file does not exist",
    );

    // Arrange: .git/HEADファイルを削除
    const headPath = path.join(gitDir, "HEAD");
    fs.unlinkSync(headPath);
    console.log("   Removed HEAD file");

    // Act & Assert: エラーが投げられる
    return repo.resolveHead().then(
      () => {
        assert.fail("Expected ReferenceRepositoryError to be thrown");
      },
      (error: unknown) => {
        assert.ok(error instanceof ReferenceRepositoryError);
        assert.strictEqual(error.code, "HEAD_NOT_FOUND");
        console.log(
          "   ✅ Test passed - correctly threw ReferenceRepositoryError with HEAD_NOT_FOUND",
        );
      },
    );
  });

  test("resolveRef throws error for non-existent reference", () => {
    console.log("🧪 Test: resolveRef throws error for non-existent reference");

    // Act & Assert: 存在しない参照でエラーが投げられる
    return repo.resolveRef("refs/heads/nonexistent").then(
      () => {
        assert.fail("Expected ReferenceRepositoryError to be thrown");
      },
      (error: unknown) => {
        assert.ok(error instanceof ReferenceRepositoryError);
        assert.strictEqual(error.code, "REF_NOT_FOUND");
        console.log(
          "   ✅ Test passed - correctly threw ReferenceRepositoryError with REF_NOT_FOUND",
        );
      },
    );
  });
});
