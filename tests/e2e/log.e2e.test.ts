import { execSync } from "child_process";
import * as fs from "fs";
import assert from "node:assert";
import { afterEach, beforeEach, describe, test } from "node:test";
import * as os from "os";
import * as path from "path";

describe("mygit log e2e", () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "mygit-e2e-"));
    process.chdir(testDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  const setupGitRepo = (
    commits: Array<{ message: string; files: Record<string, string> }>,
  ): void => {
    execSync("git init", { cwd: testDir, stdio: "pipe" });
    execSync("git config user.name 'Test User'", { cwd: testDir });
    execSync("git config user.email 'test@example.com'", { cwd: testDir });

    commits.forEach((commit, index) => {
      Object.entries(commit.files).forEach(([filename, content]) => {
        const filePath = path.join(testDir, filename);
        const dirPath = path.dirname(filePath);
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }
        fs.writeFileSync(filePath, content);
      });

      execSync("git add .", { cwd: testDir });

      const timestamp = new Date(
        Date.now() - (commits.length - index - 1) * 60000,
      );
      const envDate = `GIT_AUTHOR_DATE="${timestamp.toISOString()}" GIT_COMMITTER_DATE="${timestamp.toISOString()}"`;
      execSync(`${envDate} git commit -m "${commit.message}"`, {
        cwd: testDir,
      });
    });
  };

  const runMygitLog = (): {
    stdout: string;
    stderr: string;
    exitCode: number;
  } => {
    const mygitPath = path.join(originalCwd, "bin", "main.mjs");

    try {
      const stdout = execSync(`node "${mygitPath}" log`, {
        cwd: testDir,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      return { stdout, stderr: "", exitCode: 0 };
    } catch (error) {
      const execError = error as {
        stdout?: Buffer | string;
        stderr?: Buffer | string;
        status?: number;
      };
      return {
        stdout: execError.stdout ? execError.stdout.toString() : "",
        stderr: execError.stderr ? execError.stderr.toString() : "",
        exitCode: execError.status ?? 1,
      };
    }
  };

  describe("正常系", () => {
    test("複数のコミット履歴を表示", () => {
      // Git リポジトリ初期化
      execSync("git init", { stdio: "pipe" });
      execSync("git config user.name 'Test User'");
      execSync("git config user.email 'test@example.com'");

      // 1つ目のコミット
      fs.writeFileSync("README.md", "# Hello World");
      execSync("git add .");
      execSync("git commit -m 'first commit'");

      // 2つ目のコミット
      fs.writeFileSync("feature.txt", "new feature");
      execSync("git add .");
      execSync("git commit -m 'add feature'");

      // 3つ目のコミット
      fs.writeFileSync("bug.txt", "bug fixed");
      execSync("git add .");
      execSync("git commit -m 'fix bug'");

      // mygit log実行
      const mygitPath = path.join(originalCwd, "bin", "main.mjs");
      const stdout = execSync(`node "${mygitPath}" log`, { encoding: "utf8" });

      // 検証
      assert(stdout.includes("fix bug"));
      assert(stdout.includes("add feature"));
      assert(stdout.includes("first commit"));
      assert(stdout.includes("Author: Test User <test@example.com>"));
      assert(stdout.includes("commit "));

      // 順序確認（最新が最初に表示される）
      const fixBugIndex = stdout.indexOf("fix bug");
      const addFeatureIndex = stdout.indexOf("add feature");
      const firstCommitIndex = stdout.indexOf("first commit");

      assert(fixBugIndex !== -1 && fixBugIndex < addFeatureIndex);
      assert(addFeatureIndex !== -1 && addFeatureIndex < firstCommitIndex);
    });

    test("単一のコミット履歴を表示", () => {
      // Git リポジトリ初期化
      execSync("git init", { stdio: "pipe" });
      execSync("git config user.name 'Test User'");
      execSync("git config user.email 'test@example.com'");

      // 1つのコミット
      fs.writeFileSync("index.html", "<html></html>");
      execSync("git add .");
      execSync("git commit -m 'initial commit'");

      // mygit log実行
      const mygitPath = path.join(originalCwd, "bin", "main.mjs");
      const stdout = execSync(`node "${mygitPath}" log`, { encoding: "utf8" });

      // 検証
      assert(stdout.includes("initial commit"));
      assert(stdout.includes("Author: Test User <test@example.com>"));
      assert(stdout.includes("commit "));

      // コミットが1つだけ表示されることを確認
      const commitMatches = stdout.match(/commit [0-9a-f]{40}/g);
      assert.strictEqual(commitMatches?.length, 1);
    });

    test("長いコミットメッセージを正しく表示", () => {
      const longMessage = `Very long commit message that spans multiple lines

This is the body of the commit message.
It contains multiple paragraphs.

- Feature A was added
- Bug B was fixed
- Refactored module C

Closes #123`;

      // setupGitRepoを使わず、直接Git操作を実行
      execSync("git init", { cwd: testDir, stdio: "pipe" });
      execSync("git config user.name 'Test User'", { cwd: testDir });
      execSync("git config user.email 'test@example.com'", { cwd: testDir });

      // ファイル作成
      const filePath = path.join(testDir, "app.js");
      fs.writeFileSync(filePath, "console.log('hello');");

      execSync("git add .", { cwd: testDir });

      // コミットメッセージの特殊文字をエスケープ
      const escapedMessage = longMessage.replace(/'/g, "'\"'\"'");
      execSync(`git commit -m '${escapedMessage}'`, { cwd: testDir });

      const result = runMygitLog();

      assert.strictEqual(result.exitCode, 0);
      assert(result.stdout.includes("Very long commit message"));
      assert(result.stdout.includes("Feature A was added"));
      assert(result.stdout.includes("Closes #123"));
    });

    test("特殊文字を含むコミットメッセージを正しく表示", () => {
      const specialMessage = "Fix: 日本語メッセージ & Special chars !@#$%^&*()";

      // setupGitRepoを使わず、直接Git操作を実行
      execSync("git init", { cwd: testDir, stdio: "pipe" });
      execSync("git config user.name 'Test User'", { cwd: testDir });
      execSync("git config user.email 'test@example.com'", { cwd: testDir });

      // ファイル作成（特殊文字含む）
      const filePath = path.join(testDir, "test.txt");
      fs.writeFileSync(filePath, "テスト", "utf8");

      execSync("git add .", { cwd: testDir });

      // コミットメッセージを一時ファイルに書き込んでからコミット（特殊文字対応）
      const messageFile = path.join(testDir, "commit-message.txt");
      fs.writeFileSync(messageFile, specialMessage, "utf8");
      execSync(`git commit -F "${messageFile}"`, { cwd: testDir });
      fs.unlinkSync(messageFile); // 一時ファイルを削除

      const result = runMygitLog();

      assert.strictEqual(result.exitCode, 0);
      assert(result.stdout.includes("日本語メッセージ"));
      assert(result.stdout.includes("!@#$%^&*()"));
    });
  });

  describe("エラー系", () => {
    test(".gitディレクトリが存在しない場合", () => {
      // .gitディレクトリを作成しない（空のディレクトリ）

      const result = runMygitLog();

      // 終了コードの確認
      assert.notStrictEqual(result.exitCode, 0);

      // より具体的なエラーメッセージの確認
      assert(result.stderr.includes("Error:"));
      assert(result.stderr.includes("not a git repository"));
    });

    test("空のリポジトリの場合（コミットが存在しない）", () => {
      // Gitリポジトリを初期化するがコミットは作成しない
      execSync("git init", { cwd: testDir, stdio: "pipe" });

      const result = runMygitLog();

      // エラーになることを確認（実際の実装では "Reference not found" エラーが出力される）
      assert.notStrictEqual(result.exitCode, 0);
      assert(result.stderr.includes("Error:"));
    });

    test("HEADファイルが存在しない場合", () => {
      // Gitリポジトリを初期化してからHEADファイルを削除
      execSync("git init", { cwd: testDir, stdio: "pipe" });
      setupGitRepo([
        { message: "test commit", files: { "file.txt": "content" } },
      ]);

      // HEADファイルを削除してリポジトリを破損させる
      fs.unlinkSync(path.join(testDir, ".git", "HEAD"));

      const result = runMygitLog();

      assert.notStrictEqual(result.exitCode, 0);
      assert(result.stderr.includes("Error:"));
    });
  });

  describe("境界値テスト", () => {
    // test("マージコミット（複数の親を持つコミット）", () => {
    //   setupGitRepo([
    //     { message: "initial commit", files: { "main.txt": "main" } },
    //   ]);

    //   execSync("git checkout -b feature", { cwd: testDir });
    //   setupGitRepo([
    //     { message: "feature commit", files: { "feature.txt": "feature" } },
    //   ]);

    //   execSync("git checkout master", { cwd: testDir });
    //   execSync("git merge feature --no-ff -m 'merge feature branch'", {
    //     cwd: testDir,
    //   });

    //   const result = runMygitLog();

    //   assert.strictEqual(result.exitCode, 0);
    //   assert(result.stdout.includes("merge feature branch"));
    //   assert(result.stdout.includes("feature commit"));
    //   assert(result.stdout.includes("initial commit"));
    // });

    test("作者名に特殊文字が含まれる場合", () => {
      execSync("git init", { cwd: testDir, stdio: "pipe" });
      execSync("git config user.name '田中 太郎'", { cwd: testDir });
      execSync("git config user.email 'tanaka@例え.jp'", { cwd: testDir });

      fs.writeFileSync(path.join(testDir, "test.txt"), "test");
      execSync("git add .", { cwd: testDir });
      execSync("git commit -m 'test commit'", { cwd: testDir });

      const result = runMygitLog();

      assert.strictEqual(result.exitCode, 0);
      assert(result.stdout.includes("田中 太郎"));
      assert(result.stdout.includes("tanaka@例え.jp"));
    });

    test("コミットメッセージに改行が含まれる場合", () => {
      const messageWithNewlines =
        "multiline message\n\nSecond line\nThird line";

      // setupGitRepoを使わず、直接Git操作を実行
      execSync("git init", { cwd: testDir, stdio: "pipe" });
      execSync("git config user.name 'Test User'", { cwd: testDir });
      execSync("git config user.email 'test@example.com'", { cwd: testDir });

      // ファイル作成
      const filePath = path.join(testDir, "multiline.txt");
      fs.writeFileSync(filePath, "content");

      execSync("git add .", { cwd: testDir });

      // 改行を含むコミットメッセージを一時ファイルに書き込み
      const messageFile = path.join(testDir, "commit-message.txt");
      fs.writeFileSync(messageFile, messageWithNewlines, "utf8");
      execSync(`git commit -F "${messageFile}"`, { cwd: testDir });
      fs.unlinkSync(messageFile); // 一時ファイルを削除

      const result = runMygitLog();

      assert.strictEqual(result.exitCode, 0);
      assert(result.stdout.includes("multiline message"));
      assert(result.stdout.includes("Second line"));
      assert(result.stdout.includes("Third line"));
    });
  });
});
