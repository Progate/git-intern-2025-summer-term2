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
    // 元の作業ディレクトリを保存
    originalCwd = process.cwd();

    // 一時テストディレクトリを作成
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "mygit-e2e-"));
    process.chdir(testDir);
  });

  afterEach(() => {
    // 元の作業ディレクトリに戻る
    process.chdir(originalCwd);

    // テストディレクトリを削除
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  /**
   * テスト用のGitリポジトリを初期化し、指定されたコミットを作成
   */
  const setupGitRepo = (
    commits: Array<{ message: string; files: Record<string, string> }>,
  ): void => {
    // Gitリポジトリを初期化
    execSync("git init", { cwd: testDir });
    execSync("git config user.name 'Test User'", { cwd: testDir });
    execSync("git config user.email 'test@example.com'", { cwd: testDir });

    // 各コミットを作成
    commits.forEach((commit, index) => {
      // ファイルを作成
      Object.entries(commit.files).forEach(([filename, content]) => {
        const filePath = path.join(testDir, filename);
        const dirPath = path.dirname(filePath);
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }
        fs.writeFileSync(filePath, content);
      });

      // ファイルをステージング
      execSync("git add .", { cwd: testDir });

      // コミット（一意性を確保するため時刻をずらす）
      const timestamp = new Date(
        Date.now() - (commits.length - index - 1) * 60000,
      );
      const envDate = `GIT_AUTHOR_DATE="${timestamp.toISOString()}" GIT_COMMITTER_DATE="${timestamp.toISOString()}"`;
      execSync(`${envDate} git commit -m "${commit.message}"`, {
        cwd: testDir,
      });
    });
  };

  /**
   * mygit logコマンドを実行してその結果を取得
   */
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
      // テスト用リポジトリをセットアップ（3つのコミット）
      setupGitRepo([
        {
          message: "first commit",
          files: { "README.md": "# Hello World" },
        },
        {
          message: "add feature",
          files: { "feature.txt": "new feature" },
        },
        {
          message: "fix bug",
          files: { "bug.txt": "bug fixed" },
        },
      ]);

      const result = runMygitLog();

      // 正常終了
      assert.strictEqual(result.exitCode, 0);
      assert.strictEqual(result.stderr, "");

      // 出力内容の確認
      assert(result.stdout.includes("fix bug"));
      assert(result.stdout.includes("add feature"));
      assert(result.stdout.includes("first commit"));
      assert(result.stdout.includes("Author: Test User <test@example.com>"));
      assert(result.stdout.includes("commit "));

      // コミットの順序確認（最新が最初に表示される）
      const fixBugIndex = result.stdout.indexOf("fix bug");
      const addFeatureIndex = result.stdout.indexOf("add feature");
      const firstCommitIndex = result.stdout.indexOf("first commit");

      assert(fixBugIndex < addFeatureIndex);
      assert(addFeatureIndex < firstCommitIndex);
    });

    test("単一のコミット履歴を表示", () => {
      // 単一コミットのリポジトリをセットアップ
      setupGitRepo([
        {
          message: "initial commit",
          files: { "index.html": "<html></html>" },
        },
      ]);

      const result = runMygitLog();

      // 正常終了
      assert.strictEqual(result.exitCode, 0);
      assert.strictEqual(result.stderr, "");

      // 出力内容の確認
      assert(result.stdout.includes("initial commit"));
      assert(result.stdout.includes("Author: Test User <test@example.com>"));
      assert(result.stdout.includes("commit "));

      // コミットが1つだけ表示されることを確認
      const commitMatches = result.stdout.match(/commit [0-9a-f]{40}/g);
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

      setupGitRepo([
        {
          message: longMessage,
          files: { "app.js": "console.log('hello');" },
        },
      ]);

      const result = runMygitLog();

      assert.strictEqual(result.exitCode, 0);
      assert(result.stdout.includes("Very long commit message"));
      assert(result.stdout.includes("Feature A was added"));
      assert(result.stdout.includes("Closes #123"));
    });

    test("特殊文字を含むコミットメッセージを正しく表示", () => {
      const specialMessage = "Fix: 日本語メッセージ & Special chars !@#$%^&*()";

      setupGitRepo([
        {
          message: specialMessage,
          files: { "test.txt": "テスト" },
        },
      ]);

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

      assert.notStrictEqual(result.exitCode, 0);
      assert(result.stderr.includes("Error:"));
    });

    test("空のリポジトリの場合（コミットが存在しない）", () => {
      // Gitリポジトリを初期化するがコミットは作成しない
      execSync("git init", { cwd: testDir });

      const result = runMygitLog();

      // エラーまたは「コミットなし」メッセージが表示される
      if (result.exitCode === 0) {
        const matchResult = /No commits found|コミットがありません/.exec(
          result.stdout,
        );
        assert(matchResult !== null);
      } else {
        assert(result.stderr.includes("Error:"));
      }
    });

    test("HEADファイルが存在しない場合", () => {
      // Gitリポジトリを初期化してからHEADファイルを削除
      execSync("git init", { cwd: testDir });
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
    test("マージコミット（複数の親を持つコミット）", () => {
      // メインブランチにコミット
      setupGitRepo([
        { message: "initial commit", files: { "main.txt": "main" } },
      ]);

      // featureブランチを作成してコミット
      execSync("git checkout -b feature", { cwd: testDir });
      setupGitRepo([
        { message: "feature commit", files: { "feature.txt": "feature" } },
      ]);

      // メインブランチに戻ってマージ（masterブランチを使用）
      execSync("git checkout master", { cwd: testDir });
      execSync("git merge feature --no-ff -m 'merge feature branch'", {
        cwd: testDir,
      });

      const result = runMygitLog();

      assert.strictEqual(result.exitCode, 0);
      assert(result.stdout.includes("merge feature branch"));
      assert(result.stdout.includes("feature commit"));
      assert(result.stdout.includes("initial commit"));
    });

    test("空のコミットメッセージ", () => {
      setupGitRepo([{ message: "", files: { "empty.txt": "content" } }]);

      const result = runMygitLog();

      assert.strictEqual(result.exitCode, 0);
      // 空のメッセージでも正常に処理される
      assert(result.stdout.includes("commit "));
      assert(result.stdout.includes("Author: Test User"));
    });

    test("作者名に特殊文字が含まれる場合", () => {
      // Gitリポジトリを初期化
      execSync("git init", { cwd: testDir });
      execSync("git config user.name '田中 太郎'", { cwd: testDir });
      execSync("git config user.email 'tanaka@例え.jp'", { cwd: testDir });

      // ファイル作成とコミット
      fs.writeFileSync(path.join(testDir, "test.txt"), "test");
      execSync("git add .", { cwd: testDir });
      execSync("git commit -m 'test commit'", { cwd: testDir });

      const result = runMygitLog();

      assert.strictEqual(result.exitCode, 0);
      assert(result.stdout.includes("田中 太郎"));
      assert(result.stdout.includes("tanaka@例え.jp"));
    });
  });
});
