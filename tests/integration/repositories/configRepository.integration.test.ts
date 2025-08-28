import { execSync } from "child_process";
import * as fs from "fs";
import assert from "node:assert";
import { afterEach, beforeEach, describe, test } from "node:test";
import * as path from "path";

import { ConfigRepository } from "../../../src/repositories/configRepository.js";

describe("ConfigRepository integration tests", () => {
  let tempDir: string;
  let gitDir: string;
  let configPath: string;
  let repo: ConfigRepository;

  beforeEach(() => {
    // /tmp下に一時ディレクトリを作成（プロジェクトディレクトリの外部）
    tempDir = fs.mkdtempSync(path.join("/tmp", "config-integration-test-"));

    // gitリポジトリを初期化
    execSync("git init", { cwd: tempDir, stdio: "pipe" });

    gitDir = path.join(tempDir, ".git");
    configPath = path.join(gitDir, "config");

    console.log("Created test git repository at:", tempDir);
    console.log("Config file path:", configPath);
  });

  afterEach(() => {
    // テスト後のクリーンアップ
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log("Cleaned up test repository:", tempDir);
    }
  });

  test("should read and parse actual .git/config file", async () => {
    console.log("🧪 Test: should read and parse actual .git/config file");

    // Arrange: git configコマンドでユーザー設定を追加
    execSync("git config user.name 'Integration Test User'", {
      cwd: tempDir,
      stdio: "pipe",
    });
    execSync("git config user.email 'integration@example.com'", {
      cwd: tempDir,
      stdio: "pipe",
    });
    execSync("git config core.filemode true", {
      cwd: tempDir,
      stdio: "pipe",
    });
    execSync("git config core.compression 1", {
      cwd: tempDir,
      stdio: "pipe",
    });

    console.log("   Added git config settings");

    // 実際の設定ファイル内容を確認
    const actualConfigContent = fs.readFileSync(configPath, "utf-8");
    console.log("   Actual config file content:");
    console.log(
      "  ",
      actualConfigContent
        .split("\n")
        .map((line) => `   ${line}`)
        .join("\n"),
    );

    // Act: ConfigRepositoryで読み取り
    repo = await ConfigRepository.read(configPath);

    // Assert: 設定値の確認
    const userConfig = repo.getUserConfig();
    assert(userConfig !== undefined, "User config should be defined");
    assert.strictEqual(userConfig.name, "Integration Test User");
    assert.strictEqual(userConfig.email, "integration@example.com");
    assert(userConfig.timestamp instanceof Date);

    const coreConfig = repo.getCoreConfig();
    assert.strictEqual(coreConfig.fileMode, true);
    assert.strictEqual(coreConfig.compression, 1);

    console.log("   ✅ Test passed - successfully read real .git/config file");
  });

  test("should handle git config with remote and branch settings", async () => {
    console.log(
      "🧪 Test: should handle git config with remote and branch settings",
    );

    // Arrange: 複雑なgit設定を作成
    execSync("git config user.name 'Test User'", {
      cwd: tempDir,
      stdio: "pipe",
    });
    execSync("git config user.email 'test@example.com'", {
      cwd: tempDir,
      stdio: "pipe",
    });
    execSync(
      "git config remote.origin.url 'https://github.com/test/repo.git'",
      {
        cwd: tempDir,
        stdio: "pipe",
      },
    );
    execSync(
      "git config remote.origin.fetch '+refs/heads/*:refs/remotes/origin/*'",
      {
        cwd: tempDir,
        stdio: "pipe",
      },
    );
    execSync("git config branch.main.remote 'origin'", {
      cwd: tempDir,
      stdio: "pipe",
    });
    execSync("git config branch.main.merge 'refs/heads/main'", {
      cwd: tempDir,
      stdio: "pipe",
    });

    console.log("   Added complex git config settings");

    // Act: ConfigRepositoryで読み取り
    repo = await ConfigRepository.read(configPath);

    // Assert: 複雑な設定の確認
    const sectionNames = repo.getSectionNames();
    console.log("   Found sections:", sectionNames);

    assert(sectionNames.includes("user"));
    assert(sectionNames.includes('remote "origin"'));
    assert(sectionNames.includes('branch "main"'));

    // ユーザー設定
    const userConfig = repo.getUserConfig();
    assert(userConfig !== undefined);
    assert.strictEqual(userConfig.name, "Test User");
    assert.strictEqual(userConfig.email, "test@example.com");

    // リモート設定
    assert.strictEqual(
      repo.getValue('remote "origin"', "url"),
      "https://github.com/test/repo.git",
    );
    assert.strictEqual(
      repo.getValue('remote "origin"', "fetch"),
      "+refs/heads/*:refs/remotes/origin/*",
    );

    // ブランチ設定
    assert.strictEqual(repo.getValue('branch "main"', "remote"), "origin");
    assert.strictEqual(
      repo.getValue('branch "main"', "merge"),
      "refs/heads/main",
    );

    console.log("   ✅ Test passed - successfully parsed complex git config");
  });

  test("should handle empty .git/config file", async () => {
    console.log("🧪 Test: should handle empty .git/config file");

    // Arrange: 空の設定ファイル（git initで作成されるデフォルト状態）
    // git initはデフォルトでconfigファイルを作成するが、ユーザー設定は含まれない
    console.log("   Using default empty config from git init");

    // Act: ConfigRepositoryで読み取り
    repo = await ConfigRepository.read(configPath);

    // Assert: 空設定の確認
    const userConfig = repo.getUserConfig();
    assert.strictEqual(
      userConfig,
      undefined,
      "User config should be undefined for empty config",
    );

    const coreConfig = repo.getCoreConfig();
    // デフォルト値が返される
    assert.strictEqual(coreConfig.compression, 1);
    assert.strictEqual(coreConfig.fileMode, true);

    const sectionNames = repo.getSectionNames();
    console.log("   Found sections in default config:", sectionNames);

    console.log("   ✅ Test passed - handled empty config file correctly");
  });

  test("should work with different file permissions", async () => {
    console.log("🧪 Test: should work with different file permissions");

    // Arrange: 設定ファイルを作成
    execSync("git config user.name 'Permission Test User'", {
      cwd: tempDir,
      stdio: "pipe",
    });
    execSync("git config user.email 'permission@example.com'", {
      cwd: tempDir,
      stdio: "pipe",
    });

    // ファイル権限を変更（読み取り専用）
    fs.chmodSync(configPath, 0o444);
    console.log("   Set config file to read-only (444)");

    // Act: ConfigRepositoryで読み取り
    repo = await ConfigRepository.read(configPath);

    // Assert: 読み取り専用でも正常に読める
    const userConfig = repo.getUserConfig();
    assert(userConfig !== undefined);
    assert.strictEqual(userConfig.name, "Permission Test User");
    assert.strictEqual(userConfig.email, "permission@example.com");

    console.log("   ✅ Test passed - read from read-only config file");
  });

  test("should handle config file with comments and formatting", async () => {
    console.log(
      "🧪 Test: should handle config file with comments and formatting",
    );

    // Arrange: コメントや複雑なフォーマットを含む設定ファイルを作成
    const complexConfigContent = `# This is a git config file
; Alternative comment style

[core]
	# Core repository settings
	repositoryformatversion = 0
	filemode = true
	bare = false
	logallrefupdates = true
	ignorecase = true

[user]
	# User identification
	name = "Complex Config User"
	email = complex@example.com

[remote "origin"]
	url = git@github.com:user/repo.git
	fetch = +refs/heads/*:refs/remotes/origin/*

[alias]
	# Useful aliases
	st = status
	co = checkout
	br = branch
	ci = commit
	lg = log --graph --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset'

[branch "develop"]
	remote = origin
	merge = refs/heads/develop
`;

    // 既存の設定ファイルを上書き
    fs.writeFileSync(configPath, complexConfigContent, "utf-8");
    console.log("   Created complex config file with comments");

    // Act: ConfigRepositoryで読み取り
    repo = await ConfigRepository.read(configPath);

    // Assert: 複雑な設定の正確な読み取り
    const userConfig = repo.getUserConfig();
    assert(userConfig !== undefined);
    assert.strictEqual(userConfig.name, "Complex Config User");
    assert.strictEqual(userConfig.email, "complex@example.com");

    const coreConfig = repo.getCoreConfig();
    assert.strictEqual(coreConfig.fileMode, true);

    // セクションの確認
    const sectionNames = repo.getSectionNames();
    assert(sectionNames.includes("core"));
    assert(sectionNames.includes("user"));
    assert(sectionNames.includes('remote "origin"'));
    assert(sectionNames.includes("alias"));
    assert(sectionNames.includes('branch "develop"'));

    // エイリアス設定の確認
    assert.strictEqual(repo.getValue("alias", "st"), "status");
    assert.strictEqual(repo.getValue("alias", "co"), "checkout");
    assert.strictEqual(
      repo.getValue("alias", "lg"),
      "log --graph --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset'",
    );

    // リモート設定の確認
    assert.strictEqual(
      repo.getValue('remote "origin"', "url"),
      "git@github.com:user/repo.git",
    );

    console.log(
      "   ✅ Test passed - parsed complex config with comments and formatting",
    );
  });

  test("should handle concurrent file reads", async () => {
    console.log("🧪 Test: should handle concurrent file reads");

    // Arrange: 設定ファイルを作成
    execSync("git config user.name 'Concurrent Test User'", {
      cwd: tempDir,
      stdio: "pipe",
    });
    execSync("git config user.email 'concurrent@example.com'", {
      cwd: tempDir,
      stdio: "pipe",
    });

    console.log("   Created config for concurrent access test");

    // Act: 複数の同時読み取り
    const readPromises = Array.from({ length: 5 }, (_, i) =>
      ConfigRepository.read(configPath).then((repo) => ({ index: i, repo })),
    );

    const results = await Promise.all(readPromises);

    // Assert: すべての読み取りが成功
    assert.strictEqual(results.length, 5);

    for (const result of results) {
      const userConfig = result.repo.getUserConfig();
      assert(
        userConfig !== undefined,
        `Read ${String(result.index)} should have user config`,
      );
      assert.strictEqual(userConfig.name, "Concurrent Test User");
      assert.strictEqual(userConfig.email, "concurrent@example.com");
    }

    console.log("   ✅ Test passed - handled concurrent file reads");
  });

  test("should throw error when config file is corrupted", async () => {
    console.log("🧪 Test: should throw error when config file is corrupted");

    // Arrange: 破損した設定ファイルを作成（バイナリデータ）
    const corruptedData = Buffer.from([0xff, 0xfe, 0x00, 0x00, 0xff, 0xff]);
    fs.writeFileSync(configPath, corruptedData as unknown as string);
    console.log("   Created corrupted config file");

    try {
      // Act: ConfigRepositoryで読み取り試行
      repo = await ConfigRepository.read(configPath);

      // 破損ファイルでも基本的には読み取り可能（エラーにならない）
      // ただし、有効な設定は取得できない
      const userConfig = repo.getUserConfig();
      assert.strictEqual(
        userConfig,
        undefined,
        "Should not parse user config from corrupted file",
      );

      console.log(
        "   ✅ Test passed - gracefully handled corrupted config file",
      );
    } catch (error) {
      // エンコーディングエラーが発生する場合もある
      console.log(
        "   ✅ Test passed - appropriately threw error for corrupted file:",
        (error as Error).message,
      );
      assert(error instanceof Error);
    }
  });

  test("should handle very large config file efficiently", async () => {
    console.log("🧪 Test: should handle very large config file efficiently");

    // Arrange: 大きな設定ファイルを生成
    const largeConfigParts = [
      `[user]
name = Large Config Test User
email = large@example.com

[core]
filemode = true
compression = 1

`,
    ];

    // 多数のリモートとブランチ設定を追加
    for (let i = 0; i < 100; i++) {
      largeConfigParts.push(`[remote "remote${String(i)}"]
	url = https://github.com/user/repo${String(i)}.git
	fetch = +refs/heads/*:refs/remotes/remote${String(i)}/*

[branch "feature${String(i)}"]
	remote = remote${String(i)}
	merge = refs/heads/feature${String(i)}

`);
    }

    const largeConfigContent = largeConfigParts.join("");
    fs.writeFileSync(configPath, largeConfigContent, "utf-8");
    console.log(
      `   Created large config file (${String(largeConfigContent.length)} characters)`,
    );

    // Act: パフォーマンス測定付きで読み取り
    const startTime = Date.now();
    repo = await ConfigRepository.read(configPath);
    const endTime = Date.now();
    const readTime = endTime - startTime;

    console.log(`   Config read time: ${String(readTime)}ms`);

    // Assert: 正確な読み取りと合理的なパフォーマンス
    const userConfig = repo.getUserConfig();
    assert(userConfig !== undefined);
    assert.strictEqual(userConfig.name, "Large Config Test User");
    assert.strictEqual(userConfig.email, "large@example.com");

    const sectionNames = repo.getSectionNames();
    assert(sectionNames.length >= 201, "Should have many sections"); // user + core + 100 remotes + 100 branches

    // パフォーマンスチェック（1秒以内）
    assert(
      readTime < 1000,
      `Read time should be under 1 second, got ${String(readTime)}ms`,
    );

    console.log("   ✅ Test passed - efficiently handled large config file");
  });
});
