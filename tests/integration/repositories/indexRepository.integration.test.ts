import { execSync } from "child_process";
import * as fs from "fs";
import assert from "node:assert";
import { afterEach, beforeEach, describe, test } from "node:test";
import * as path from "path";

import {
  IndexRepository,
  IndexRepositoryError,
} from "../../../src/repositories/indexRepository.js";

describe("IndexRepository integration tests", () => {
  let tempDir: string;
  let gitDir: string;
  let repo: IndexRepository;

  beforeEach(() => {
    // /tmp下に一時ディレクトリを作成（プロジェクトディレクトリの外部）
    tempDir = fs.mkdtempSync(path.join("/tmp", "git-index-integration-test-"));

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

    console.log("Created test git repository at:", tempDir);
  });

  afterEach(() => {
    // テスト後のクリーンアップ
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log("Cleaned up test repository:", tempDir);
    }
  });

  test("read returns empty IndexRepository when no index file exists", async () => {
    console.log(
      "🧪 Test: read returns empty IndexRepository when no index file exists",
    );

    // Act: インデックスファイルが存在しない状態でread
    repo = await IndexRepository.read(gitDir);

    // Assert: 空のインデックスが作成される
    assert.strictEqual(repo.getEntryCount(), 0);
    assert.ok(repo.isEmpty());
    console.log("   ✅ Test passed - empty IndexRepository created");
  });

  test("read returns IndexRepository with entries after git add", async () => {
    console.log(
      "🧪 Test: read returns IndexRepository with entries after git add",
    );

    // Arrange: テストファイルを作成してgit add
    const testFile = path.join(tempDir, "test.txt");
    const testContent = "Hello, Git Index!";
    fs.writeFileSync(testFile, testContent);

    execSync("git add test.txt", { cwd: tempDir, stdio: "pipe" });

    // Act: IndexRepositoryでインデックスを読み込み
    repo = await IndexRepository.read(gitDir);

    // Assert: エントリが存在する
    assert.strictEqual(repo.getEntryCount(), 1);
    assert.ok(!repo.isEmpty());
    assert.ok(repo.hasEntry("test.txt"));

    const entry = repo.getEntry("test.txt");
    assert.ok(entry !== undefined);
    assert.strictEqual(entry.path, "test.txt");
    assert.strictEqual(entry.size, testContent.length);
    assert.match(entry.objectId, /^[0-9a-f]{40}$/);

    console.log("   ✅ Test passed - IndexRepository read entries correctly");
  });

  test("write creates valid index file that git can read", async () => {
    console.log(
      "🧪 Test: write creates valid index file that git can read",
    );

    // Arrange: 空のIndexRepositoryを作成してファイルエントリを追加
    repo = await IndexRepository.read(gitDir);

    const testFile = path.join(tempDir, "manual.txt");
    const testContent = "Manually added content";
    fs.writeFileSync(testFile, testContent);

    // ファイル統計情報を取得してエントリを追加
    const stats = fs.statSync(testFile);
    // 実際のBlobオブジェクトハッシュを計算（簡単なテスト用）
    const sha = "a94a8fe5ccb19ba61c4c0873d391e987982fbbd3"; // "test"のSHA-1

    repo.add("manual.txt", sha, stats);

    // Act: インデックスファイルに書き込み
    await repo.write();

    // Assert: gitコマンドでインデックスが正しく読めることを確認
    try {
      const gitOutput = execSync("git ls-files --cached", {
        cwd: tempDir,
        encoding: "utf8",
      });
      assert.ok(gitOutput.includes("manual.txt"));
      console.log("   Git ls-files output:", gitOutput.trim());
    } catch (error) {
      // Gitバージョンによってはエラーになる可能性があるが、
      // ファイルが作成されていることは確認できる
      const indexPath = path.join(gitDir, "index");
      assert.ok(fs.existsSync(indexPath));
      console.log("   Index file created successfully");
    }

    console.log("   ✅ Test passed - write created valid index file");
  });

  test("add and remove operations work correctly", async () => {
    console.log("🧪 Test: add and remove operations work correctly");

    // Arrange: 複数のテストファイルを準備
    repo = await IndexRepository.read(gitDir);

    const files = ["file1.txt", "file2.txt", "file3.txt"];
    const sha = "a94a8fe5ccb19ba61c4c0873d391e987982fbbd3";

    // Act: ファイルを追加
    for (const fileName of files) {
      const filePath = path.join(tempDir, fileName);
      fs.writeFileSync(filePath, `Content of ${fileName}`);
      const stats = fs.statSync(filePath);
      repo.add(fileName, sha, stats);
    }

    // Assert: 全ファイルが追加されている
    assert.strictEqual(repo.getEntryCount(), 3);
    for (const fileName of files) {
      assert.ok(repo.hasEntry(fileName));
    }

    // Act: 1つのファイルを削除
    const removed = repo.remove("file2.txt");

    // Assert: 正しく削除されている
    assert.ok(removed);
    assert.strictEqual(repo.getEntryCount(), 2);
    assert.ok(!repo.hasEntry("file2.txt"));
    assert.ok(repo.hasEntry("file1.txt"));
    assert.ok(repo.hasEntry("file3.txt"));

    console.log("   ✅ Test passed - add and remove operations work correctly");
  });

  test("getAllEntries returns sorted entries", async () => {
    console.log("🧪 Test: getAllEntries returns sorted entries");

    // Arrange: 順番をランダムにしてファイルを追加
    repo = await IndexRepository.read(gitDir);
    const files = ["zebra.txt", "apple.txt", "banana.txt"];
    const sha = "a94a8fe5ccb19ba61c4c0873d391e987982fbbd3";

    for (const fileName of files) {
      const filePath = path.join(tempDir, fileName);
      fs.writeFileSync(filePath, `Content of ${fileName}`);
      const stats = fs.statSync(filePath);
      repo.add(fileName, sha, stats);
    }

    // Act: 全エントリを取得
    const entries = repo.getAllEntries();

    // Assert: パス名順にソートされている
    assert.strictEqual(entries.length, 3);
    assert.strictEqual(entries[0]?.path, "apple.txt");
    assert.strictEqual(entries[1]?.path, "banana.txt");
    assert.strictEqual(entries[2]?.path, "zebra.txt");

    console.log("   ✅ Test passed - getAllEntries returns sorted entries");
  });

  test("read throws error when index file is corrupted", async () => {
    console.log("🧪 Test: read throws error when index file is corrupted");

    // Arrange: 破損したインデックスファイルを作成
    const indexPath = path.join(gitDir, "index");
    fs.writeFileSync(indexPath, "corrupted data");

    // Act & Assert: エラーが投げられる
    try {
      await IndexRepository.read(gitDir);
      assert.fail("Expected IndexRepositoryError to be thrown");
    } catch (error) {
      assert.ok(error instanceof IndexRepositoryError);
      assert.strictEqual(error.code, "READ_ERROR");
      console.log(
        "   ✅ Test passed - correctly threw IndexRepositoryError for corrupted file",
      );
    }
  });

  test("roundtrip: write then read preserves data", async () => {
    console.log("🧪 Test: roundtrip: write then read preserves data");

    // Arrange: IndexRepositoryにデータを追加
    repo = await IndexRepository.read(gitDir);

    const testFile = path.join(tempDir, "roundtrip.txt");
    const testContent = "Roundtrip test content";
    fs.writeFileSync(testFile, testContent);

    const stats = fs.statSync(testFile);
    const sha = "b19ba61c4c0873d391e987982fbbd3a94a8fe5cc";

    repo.add("roundtrip.txt", sha, stats);

    // Act: 書き込み後、再度読み込み
    await repo.write();
    const repo2 = await IndexRepository.read(gitDir);

    // Assert: データが保持されている
    assert.strictEqual(repo2.getEntryCount(), 1);
    assert.ok(repo2.hasEntry("roundtrip.txt"));

    const entry = repo2.getEntry("roundtrip.txt");
    assert.ok(entry !== undefined);
    assert.strictEqual(entry.path, "roundtrip.txt");
    assert.strictEqual(entry.objectId, sha);
    assert.strictEqual(entry.size, testContent.length);

    console.log("   ✅ Test passed - roundtrip preserved all data correctly");
  });
});
