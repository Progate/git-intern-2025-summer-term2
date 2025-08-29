#!/usr/bin/env node

/**
 * mygit add コマンドの手動テストスクリプト
 *
 * 使用方法:
 *   npm run build
 *   npm -g install .
 *   node scripts/test-add-manual.mjs
 */
import { execSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// テスト結果を記録
const results = [];

function log(message) {
  console.log(`📝 ${message}`);
}

function success(message) {
  console.log(`✅ ${message}`);
  results.push({ status: "PASS", test: message });
}

function error(message, err) {
  console.log(`❌ ${message}`);
  console.log(`   Error: ${err.message}`);
  results.push({ status: "FAIL", test: message, error: err.message });
}

function runTest(testName, testFunction) {
  log(`Starting test: ${testName}`);
  try {
    testFunction();
    success(testName);
  } catch (err) {
    error(testName, err);
  }
}

// メインテスト関数
function runAllTests() {
  log("Starting mygit add manual tests...\n");

  // テストディレクトリを作成
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "mygit-manual-test-"));
  const originalCwd = process.cwd();

  try {
    process.chdir(testDir);
    log(`Test directory: ${testDir}`);

    // テスト1: 基本的なファイル追加
    runTest("Basic file addition", () => {
      // Gitリポジトリを初期化
      execSync("git init", { stdio: "pipe" });
      execSync("git config user.name 'Test User'", { stdio: "pipe" });
      execSync("git config user.email 'test@example.com'", { stdio: "pipe" });

      // テストファイルを作成
      fs.writeFileSync("hello.txt", "Hello, World!");

      // mygit add実行
      const output = execSync("mygit add hello.txt", { encoding: "utf8" });
      log(`Output: ${output.trim()}`);

      // 結果確認
      const status = execSync("git status --porcelain", { encoding: "utf8" });
      if (!status.includes("A  hello.txt")) {
        throw new Error("File was not staged properly");
      }

      const indexContent = execSync("git ls-files --stage", {
        encoding: "utf8",
      });
      if (!indexContent.includes("hello.txt")) {
        throw new Error("File was not added to index");
      }
    });

    // テスト2: 複数ファイル追加
    runTest("Multiple files addition", () => {
      fs.writeFileSync("file1.txt", "Content 1");
      fs.writeFileSync("file2.txt", "Content 2");

      const output = execSync("mygit add file1.txt file2.txt", {
        encoding: "utf8",
      });
      log(`Output: ${output.trim()}`);

      const status = execSync("git status --porcelain", { encoding: "utf8" });
      if (
        !status.includes("A  file1.txt") ||
        !status.includes("A  file2.txt")
      ) {
        throw new Error("Multiple files were not staged properly");
      }
    });

    // テスト3: ディレクトリ内のファイル
    runTest("Nested directory file", () => {
      fs.mkdirSync("src", { recursive: true });
      fs.writeFileSync("src/main.js", "console.log('Hello');");

      const output = execSync("mygit add src/main.js", { encoding: "utf8" });
      log(`Output: ${output.trim()}`);

      const status = execSync("git status --porcelain", { encoding: "utf8" });
      if (!status.includes("A  src/main.js")) {
        throw new Error("Nested file was not staged properly");
      }
    });

    // テスト4: 変更されたファイル（コミット後に変更）
    runTest("Modified file after commit", () => {
      // 最初のコミット
      execSync("git commit -m 'Initial commit'", { stdio: "pipe" });

      // ファイルを変更
      fs.writeFileSync("hello.txt", "Hello, Modified World!");

      const output = execSync("mygit add hello.txt", { encoding: "utf8" });
      log(`Output: ${output.trim()}`);

      const status = execSync("git status --porcelain", { encoding: "utf8" });
      if (!status.includes("M  hello.txt")) {
        throw new Error("Modified file was not staged properly");
      }
    });

    // テスト5: ディレクトリ追加（新機能）
    runTest("Directory addition", () => {
      // ディレクトリ構造を作成
      fs.mkdirSync("testdir", { recursive: true });
      fs.mkdirSync("testdir/subdir", { recursive: true });
      fs.writeFileSync("testdir/file1.txt", "Directory content 1");
      fs.writeFileSync("testdir/file2.txt", "Directory content 2");
      fs.writeFileSync("testdir/subdir/nested.txt", "Nested content");

      const output = execSync("mygit add testdir", { encoding: "utf8" });
      log(`Output: ${output.trim()}`);

      const status = execSync("git status --porcelain", { encoding: "utf8" });
      if (
        !status.includes("A  testdir/file1.txt") ||
        !status.includes("A  testdir/file2.txt") ||
        !status.includes("A  testdir/subdir/nested.txt")
      ) {
        throw new Error("Directory files were not staged properly");
      }
    });

    // テスト6: カレントディレクトリ全体追加（.）
    runTest("Current directory addition (.)", () => {
      // 新しいファイルを作成
      fs.writeFileSync("root1.txt", "Root content 1");
      fs.writeFileSync("root2.txt", "Root content 2");

      const output = execSync("mygit add .", { encoding: "utf8" });
      log(`Output: ${output.trim()}`);

      const status = execSync("git status --porcelain", { encoding: "utf8" });
      if (
        !status.includes("A  root1.txt") ||
        !status.includes("A  root2.txt")
      ) {
        throw new Error("Current directory files were not staged properly");
      }
    });

    // テスト7: .gitディレクトリ除外確認
    runTest("Exclude .git directory", () => {
      // .git内にテストファイルを作成（通常はしないが、テストのため）
      fs.writeFileSync(".git/test-file", "Should not be added");
      fs.writeFileSync("normal.txt", "Normal file");

      const output = execSync("mygit add .", { encoding: "utf8" });
      log(`Output: ${output.trim()}`);

      const status = execSync("git status --porcelain", { encoding: "utf8" });
      if (status.includes(".git/test-file")) {
        throw new Error(".git directory was not properly excluded");
      }
      if (!status.includes("A  normal.txt")) {
        throw new Error("Normal file was not staged");
      }
    });

    // テスト8: 混在引数（ファイルとディレクトリ）
    runTest("Mixed file and directory arguments", () => {
      fs.writeFileSync("single.txt", "Single file");
      fs.mkdirSync("mixdir", { recursive: true });
      fs.writeFileSync("mixdir/mixed.txt", "Mixed content");

      const output = execSync("mygit add single.txt mixdir", {
        encoding: "utf8",
      });
      log(`Output: ${output.trim()}`);

      const status = execSync("git status --porcelain", { encoding: "utf8" });
      if (
        !status.includes("A  single.txt") ||
        !status.includes("A  mixdir/mixed.txt")
      ) {
        throw new Error("Mixed arguments were not staged properly");
      }
    });

    // テスト9: 空ディレクトリ処理
    runTest("Empty directory handling", () => {
      fs.mkdirSync("emptydir", { recursive: true });

      // 空ディレクトリを指定（エラーにならずに正常完了すべき）
      const output = execSync("mygit add emptydir", { encoding: "utf8" });
      log(`Output: ${output.trim()}`);

      // 空ディレクトリは何もステージされないが、エラーにならない
      // これは正常な動作
    });

    // テスト10: 実際のGitとの比較（ディレクトリ）
    runTest("Directory comparison with real git", () => {
      fs.mkdirSync("gitcomp", { recursive: true });
      fs.writeFileSync("gitcomp/comp1.txt", "Git comparison 1");
      fs.writeFileSync("gitcomp/comp2.txt", "Git comparison 2");

      // mygit addで追加
      execSync("mygit add gitcomp", { stdio: "pipe" });
      const mygitIndex = execSync("git ls-files --stage gitcomp/", {
        encoding: "utf8",
      });

      // gitでリセットして再追加
      execSync("git reset", { stdio: "pipe" });
      execSync("git add gitcomp", { stdio: "pipe" });
      const gitIndex = execSync("git ls-files --stage gitcomp/", {
        encoding: "utf8",
      });

      if (mygitIndex.trim() !== gitIndex.trim()) {
        throw new Error(
          `Directory index mismatch:\nmygit:\n${mygitIndex}\ngit:\n${gitIndex}`,
        );
      }
      log("Directory index matches git");
    });

    // テスト11: 実際のGitとの比較（元のテスト）
    runTest("Comparison with real git", () => {
      fs.writeFileSync("compare.txt", "Comparison test");

      // mygit addで追加
      execSync("mygit add compare.txt", { stdio: "pipe" });
      const mygitIndex = execSync("git ls-files --stage compare.txt", {
        encoding: "utf8",
      });
      const mygitSha = mygitIndex.match(/[0-9a-f]{40}/)?.[0];

      // gitでリセットして再追加
      execSync("git reset", { stdio: "pipe" });
      execSync("git add compare.txt", { stdio: "pipe" });
      const gitIndex = execSync("git ls-files --stage compare.txt", {
        encoding: "utf8",
      });
      const gitSha = gitIndex.match(/[0-9a-f]{40}/)?.[0];

      if (mygitSha !== gitSha) {
        throw new Error(`SHA mismatch: mygit=${mygitSha}, git=${gitSha}`);
      }
      log(`SHA match: ${mygitSha}`);
    });

    // テスト15: 直接指定された.gitファイルのスキップ
    runTest("Skip .git files when directly specified", () => {
      fs.writeFileSync("normal.txt", "Normal file content");

      // .gitファイルと通常ファイルを混在指定
      const output = execSync("mygit add .git/config normal.txt .git", {
        encoding: "utf8",
      });
      log(`Output: ${output.trim()}`);

      const status = execSync("git status --porcelain", { encoding: "utf8" });

      // 通常ファイルのみがステージされることを確認
      if (!status.includes("A  normal.txt")) {
        throw new Error("Normal file was not staged");
      }

      // .gitファイルはステージされていないことを確認
      if (status.includes(".git/config")) {
        throw new Error(".git files should be automatically skipped");
      }
    });

    // エラーケースのテスト
    log("\n--- Error Cases ---");

    // テスト12: 存在しないファイル
    runTest("Non-existing file error", () => {
      try {
        execSync("mygit add non-existing.txt", { stdio: "pipe" });
        throw new Error("Should have failed for non-existing file");
      } catch (err) {
        if (
          !err.message.includes("pathspec") ||
          !err.message.includes("did not match any files")
        ) {
          throw new Error(
            `Wrong error message for non-existing file. Got: ${err.message}`,
          );
        }
      }
    });

    // テスト13: 存在しないディレクトリ
    runTest("Non-existing directory error", () => {
      try {
        execSync("mygit add non-existing-dir", { stdio: "pipe" });
        throw new Error("Should have failed for non-existing directory");
      } catch (err) {
        if (!err.message.includes("Failed to process 'non-existing-dir'")) {
          throw new Error(
            `Wrong error message for non-existing directory. Got: ${err.message}`,
          );
        }
      }
    });

    // テスト14: 引数なし
    runTest("No arguments error", () => {
      try {
        execSync("mygit add", { stdio: "pipe" });
        throw new Error("Should have failed with no arguments");
      } catch (err) {
        if (!err.message.includes("No files specified")) {
          throw new Error(
            `Wrong error message for no arguments. Got: ${err.message}`,
          );
        }
      }
    });
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(testDir, { recursive: true, force: true });
    log(`Cleaned up ${testDir}`);
  }

  // 結果サマリー
  console.log("\n" + "=".repeat(50));
  console.log("TEST RESULTS SUMMARY");
  console.log("=".repeat(50));

  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;

  console.log(`Total tests: ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    console.log("\nFailed tests:");
    results
      .filter((r) => r.status === "FAIL")
      .forEach((r) => {
        console.log(`  ❌ ${r.test}: ${r.error}`);
      });
  }

  console.log(
    `\nOverall: ${failed === 0 ? "✅ ALL TESTS PASSED" : "❌ SOME TESTS FAILED"}`,
  );
}

// Gitが非リポジトリでのテスト
function testNonGitRepository() {
  log("\n--- Non-Git Repository Test ---");

  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "mygit-non-git-"));
  const originalCwd = process.cwd();

  try {
    process.chdir(testDir);
    fs.writeFileSync("test.txt", "test content");

    runTest("Non-git repository error", () => {
      try {
        execSync("mygit add test.txt", { stdio: "pipe" });
        throw new Error("Should have failed in non-git repository");
      } catch (err) {
        if (!err.message.includes("not a git repository")) {
          throw new Error(
            `Wrong error message for non-git repository. Got: ${err.message}`,
          );
        }
      }
    });
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

// メイン実行
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("🧪 mygit add Manual Test Suite");
  console.log("=".repeat(50));

  // mygitコマンドが利用可能かチェック
  try {
    execSync("mygit --version", { stdio: "pipe" });
    log("mygit command is available");
  } catch (err) {
    console.error("❌ mygit command not found. Please run:");
    console.error("   npm run build");
    console.error("   npm -g install .");
    console.error(`   Error: ${err.message}`);
    process.exit(1);
  }

  runAllTests();
  testNonGitRepository();
}
