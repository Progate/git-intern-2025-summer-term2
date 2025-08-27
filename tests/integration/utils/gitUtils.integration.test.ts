import { execSync } from "child_process";
import * as fs from "fs";
import assert from "node:assert";
import { afterEach, beforeEach, describe, test } from "node:test";
import * as path from "path";

import {
  findGitDirectory,
  isGitRepository,
} from "../../../src/utils/gitUtils.js";

describe("gitUtils integration tests", () => {
  let tempDir: string;

  beforeEach(() => {
    // /tmp下に一時ディレクトリを作成（プロジェクトディレクトリの外部）
    tempDir = fs.mkdtempSync(path.join("/tmp", "git-integration-test-"));
    console.log("Created temp directory:", tempDir);
  });

  afterEach(() => {
    // テスト後のクリーンアップ
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log("Cleaned up temp directory:", tempDir);
    }
  });

  test("findGitDirectory detects actual .git directory", () => {
    console.log("🧪 Test: findGitDirectory detects actual .git directory");

    // Arrange: 一時ディレクトリにgitリポジトリを初期化
    execSync("git init", { cwd: tempDir, stdio: "pipe" });
    console.log("   Git repository initialized");

    // Act & Assert
    return findGitDirectory(tempDir).then((result) => {
      console.log("   findGitDirectory result:", result);

      const expectedGitDir = path.join(tempDir, ".git");
      assert.strictEqual(result, expectedGitDir);
      assert.ok(fs.existsSync(expectedGitDir));
      assert.ok(fs.statSync(expectedGitDir).isDirectory());

      console.log("   ✅ Test passed - .git directory detected correctly");
    });
  });

  test("findGitDirectory returns null when no .git directory exists", () => {
    console.log(
      "🧪 Test: findGitDirectory returns null when no .git directory exists",
    );

    // Act & Assert
    return findGitDirectory(tempDir).then((result) => {
      console.log("   findGitDirectory result:", result);
      assert.strictEqual(result, null);
      console.log("   ✅ Test passed - correctly returned null");
    });
  });

  test("isGitRepository returns true for actual git repository", () => {
    console.log(
      "🧪 Test: isGitRepository returns true for actual git repository",
    );

    // Arrange: 一時ディレクトリにgitリポジトリを初期化
    execSync("git init", { cwd: tempDir, stdio: "pipe" });
    console.log("   Git repository initialized");

    // Act & Assert
    return isGitRepository(tempDir).then((result) => {
      console.log("   isGitRepository result:", result);
      assert.strictEqual(result, true);
      console.log("   ✅ Test passed - correctly identified as git repository");
    });
  });

  test("isGitRepository returns false when not a git repository", () => {
    console.log(
      "🧪 Test: isGitRepository returns false when not a git repository",
    );

    // Act & Assert
    return isGitRepository(tempDir).then((result) => {
      console.log("   isGitRepository result:", result);
      assert.strictEqual(result, false);
      console.log(
        "   ✅ Test passed - correctly identified as NOT a git repository",
      );
    });
  });
});
