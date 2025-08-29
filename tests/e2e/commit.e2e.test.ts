import assert from "node:assert";
import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, it } from "node:test";

describe("mygit commit E2E tests", () => {
  const originalCwd = process.cwd();
  let tempDir: string;

  const setupTest = (): void => {
    // 一時ディレクトリ作成
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mygit-commit-e2e-"));
    process.chdir(tempDir);

    // Git初期化とユーザー設定
    execSync("git init", { stdio: "pipe" });
    execSync("git config user.name 'Test User'", { stdio: "pipe" });
    execSync("git config user.email 'test@example.com'", { stdio: "pipe" });
  };

  const teardownTest = (): void => {
    process.chdir(originalCwd);
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  };

  describe("正常系", () => {
    it("should create commit with single file in flat structure", () => {
      try {
        setupTest();

        // テストファイル作成
        fs.writeFileSync("README.md", "# Test Project\n\nThis is a test file.");

        // git addでステージング
        execSync("git add README.md", { stdio: "pipe" });

        // mygit commitを実行
        const mygitPath = path.join(originalCwd, "bin", "main.mjs");
        const stdout = execSync(`node "${mygitPath}" commit "Initial commit"`, {
          encoding: "utf8",
          stdio: "pipe",
        });

        // コミットが作成されたことを確認
        const logOutput = execSync("git log --oneline", {
          encoding: "utf8",
          stdio: "pipe",
        });

        assert(
          logOutput.includes("Initial commit"),
          "Commit message should appear in git log",
        );
        assert(stdout.length > 0, "mygit commit should produce output");
      } finally {
        teardownTest();
      }
    });

    it("should create commit with multiple files in flat structure", () => {
      try {
        setupTest();

        // 複数のテストファイル作成（フラット構造）
        fs.writeFileSync("README.md", "# Test Project");
        fs.writeFileSync(
          "package.json",
          '{"name": "test", "version": "1.0.0"}',
        );
        fs.writeFileSync("main.js", "console.log('Hello World');");

        // 全ファイルをステージング
        execSync("git add .", { stdio: "pipe" });

        // mygit commitを実行
        const mygitPath = path.join(originalCwd, "bin", "main.mjs");
        execSync(`node "${mygitPath}" commit "Add project files"`, {
          stdio: "pipe",
        });

        // コミットが作成されたことを確認
        const logOutput = execSync("git log --oneline", {
          encoding: "utf8",
          stdio: "pipe",
        });

        assert(
          logOutput.includes("Add project files"),
          "Commit message should appear in git log",
        );

        // コミット内容の確認
        const showOutput = execSync("git show --name-only", {
          encoding: "utf8",
          stdio: "pipe",
        });

        assert(
          showOutput.includes("README.md"),
          "README.md should be in commit",
        );
        assert(
          showOutput.includes("package.json"),
          "package.json should be in commit",
        );
        assert(showOutput.includes("main.js"), "main.js should be in commit");
      } finally {
        teardownTest();
      }
    });
  });

  describe("エラー系", () => {
    it("should fail when commit message is empty", () => {
      try {
        setupTest();

        fs.writeFileSync("test.txt", "test content");
        execSync("git add test.txt", { stdio: "pipe" });

        const mygitPath = path.join(originalCwd, "bin", "main.mjs");

        assert.throws(() => {
          execSync(`node "${mygitPath}" commit ""`, { stdio: "pipe" });
        }, "Empty commit message should cause error");
      } finally {
        teardownTest();
      }
    });

    it("should fail when no files are staged", () => {
      try {
        setupTest();

        fs.writeFileSync("test.txt", "test content");
        // git addを実行しない（ステージングなし）

        const mygitPath = path.join(originalCwd, "bin", "main.mjs");

        assert.throws(() => {
          execSync(`node "${mygitPath}" commit "Test commit"`, {
            stdio: "pipe",
          });
        }, "No staged files should cause error");
      } finally {
        teardownTest();
      }
    });

    it("should fail when user config is not set", () => {
      try {
        setupTest();

        // ユーザー設定を削除
        execSync("git config --unset user.name", { stdio: "pipe" });
        execSync("git config --unset user.email", { stdio: "pipe" });

        fs.writeFileSync("test.txt", "test content");
        execSync("git add test.txt", { stdio: "pipe" });

        const mygitPath = path.join(originalCwd, "bin", "main.mjs");

        assert.throws(() => {
          execSync(`node "${mygitPath}" commit "Test commit"`, {
            stdio: "pipe",
          });
        }, "Missing user config should cause error");
      } finally {
        teardownTest();
      }
    });
  });
});
