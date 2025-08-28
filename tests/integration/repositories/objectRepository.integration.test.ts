import { execSync } from "child_process";
import * as fs from "fs";
import assert from "node:assert";
import { afterEach, beforeEach, describe, test } from "node:test";
import * as path from "path";

import { Blob } from "../../../src/models/blob.js";
import { Commit } from "../../../src/models/commit.js";
import { Tree } from "../../../src/models/tree.js";
import { GitActor, TreeEntry } from "../../../src/models/types.js";
import {
  ObjectRepository,
  ObjectRepositoryError,
} from "../../../src/repositories/objectRepository.js";

describe("ObjectRepository integration tests", () => {
  let tempDir: string;
  let gitDir: string;
  let repo: ObjectRepository;

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
    repo = new ObjectRepository(gitDir);

    console.log("Created test git repository at:", tempDir);
  });

  afterEach(() => {
    // テスト後のクリーンアップ
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log("Cleaned up test repository:", tempDir);
    }
  });

  test("write and read blob object correctly", async () => {
    console.log("🧪 Test: write and read blob object correctly");

    // Arrange: テスト用のBlobオブジェクトを作成
    const testContent: Buffer = Buffer.from("Hello, Git!", "utf8");
    const blob: Blob = new Blob(testContent);
    const expectedSha: string = blob.getSha();
    console.log("   Created blob with SHA:", expectedSha);

    // Act: write then read
    const writtenSha: string = await repo.write(blob);
    console.log("   Written SHA:", writtenSha);

    const readObject = await repo.read(writtenSha);
    console.log("   Read object type:", readObject.getType());

    // Assert: 書き込みと読み取りの結果を検証
    assert.strictEqual(writtenSha, expectedSha);
    assert.strictEqual(readObject.getType(), "blob");
    assert.strictEqual(
      readObject.getContent().toString(),
      testContent.toString(),
    );
    assert.strictEqual(readObject.getSha(), expectedSha);
    console.log("   ✅ Test passed - write/read cycle completed correctly");
  });

  test("exists returns true for written object", async () => {
    console.log("🧪 Test: exists returns true for written object");

    // Arrange: テスト用のBlobオブジェクトを作成・書き込み
    const testContent: Buffer = Buffer.from("Test existence check", "utf8");
    const blob: Blob = new Blob(testContent);
    const sha: string = await repo.write(blob);
    console.log("   Written blob with SHA:", sha);

    // Act & Assert: exists check
    const exists: boolean = await repo.exists(sha);
    console.log("   Object exists:", exists);

    assert.strictEqual(exists, true);
    console.log("   ✅ Test passed - exists correctly returned true");
  });

  test("exists returns false for non-existent object", async () => {
    console.log("🧪 Test: exists returns false for non-existent object");

    // Arrange: 存在しないSHA-1を用意
    const nonExistentSha = "1234567890abcdef1234567890abcdef12345678";
    console.log("   Non-existent SHA:", nonExistentSha);

    // Act & Assert: exists check
    const exists: boolean = await repo.exists(nonExistentSha);
    console.log("   Object exists:", exists);

    assert.strictEqual(exists, false);
    console.log("   ✅ Test passed - exists correctly returned false");
  });

  test("write skips duplicate objects", async () => {
    console.log("🧪 Test: write skips duplicate objects");

    // Arrange: 同じBlobオブジェクトを2つ作成
    const testContent: Buffer = Buffer.from("Duplicate test", "utf8");
    const blob1: Blob = new Blob(testContent);
    const blob2: Blob = new Blob(testContent);
    console.log("   Created identical blobs with SHA:", blob1.getSha());

    // Act: 同じオブジェクトを2回書き込み
    const sha1: string = await repo.write(blob1);
    const sha2: string = await repo.write(blob2);

    // Assert: 同じSHAが返されることを確認
    assert.strictEqual(sha1, sha2);
    assert.strictEqual(sha1, blob1.getSha());
    console.log("   ✅ Test passed - duplicate write optimization works");
  });

  test("write creates directory structure automatically", async () => {
    console.log("🧪 Test: write creates directory structure automatically");

    // Arrange: .git/objects ディレクトリを削除
    const objectsDir = path.join(gitDir, "objects");
    if (fs.existsSync(objectsDir)) {
      fs.rmSync(objectsDir, { recursive: true, force: true });
    }
    console.log("   Removed objects directory");

    const testContent: Buffer = Buffer.from("Directory creation test", "utf8");
    const blob: Blob = new Blob(testContent);
    const expectedSha: string = blob.getSha();

    // Act: オブジェクトを書き込み（ディレクトリが自動作成されるはず）
    const sha: string = await repo.write(blob);

    // Assert: 書き込みが成功し、ファイルが存在することを確認
    assert.strictEqual(sha, expectedSha);

    const objectPath = path.join(
      objectsDir,
      sha.substring(0, 2),
      sha.substring(2),
    );
    assert.ok(fs.existsSync(objectPath));
    console.log(
      "   ✅ Test passed - directory structure created automatically",
    );
  });

  test("read throws error for non-existent object", async () => {
    console.log("🧪 Test: read throws error for non-existent object");

    // Arrange: 存在しないSHA-1を用意
    const nonExistentSha = "1234567890abcdef1234567890abcdef12345678";
    console.log("   Non-existent SHA:", nonExistentSha);

    // Act & Assert: エラーが投げられる
    try {
      await repo.read(nonExistentSha);
      assert.fail("Expected ObjectRepositoryError to be thrown");
    } catch (error: unknown) {
      assert.ok(error instanceof ObjectRepositoryError);
      assert.strictEqual(error.code, "NOT_FOUND");
      console.log(
        "   ✅ Test passed - correctly threw ObjectRepositoryError with NOT_FOUND",
      );
    }
  });

  test("exists returns false for invalid SHA format", async () => {
    console.log("🧪 Test: exists returns false for invalid SHA format");

    // Arrange: 不正なSHA-1形式を用意
    const invalidSha = "invalid-sha-format";
    console.log("   Invalid SHA:", invalidSha);

    // Act & Assert: falseが返される
    const exists: boolean = await repo.exists(invalidSha);
    console.log("   Object exists:", exists);

    assert.strictEqual(exists, false);
    console.log(
      "   ✅ Test passed - exists correctly returned false for invalid SHA",
    );
  });

  test("read throws error for invalid SHA format", async () => {
    console.log("🧪 Test: read throws error for invalid SHA format");

    // Arrange: 不正なSHA-1形式を用意
    const invalidSha = "invalid-sha-format";
    console.log("   Invalid SHA:", invalidSha);

    // Act & Assert: エラーが投げられる
    try {
      await repo.read(invalidSha);
      assert.fail("Expected ObjectRepositoryError to be thrown");
    } catch (error: unknown) {
      assert.ok(error instanceof ObjectRepositoryError);
      assert.strictEqual(error.code, "INVALID_SHA");
      console.log(
        "   ✅ Test passed - correctly threw ObjectRepositoryError with INVALID_SHA",
      );
    }
  });

  test("read works with objects created by real git", async () => {
    console.log("🧪 Test: read works with objects created by real git");

    // Arrange: 実際のgitコマンドでオブジェクトを作成
    const testFile = path.join(tempDir, "test.txt");
    const testContent = "Content created by real git";
    fs.writeFileSync(testFile, testContent);

    execSync("git add test.txt", { cwd: tempDir, stdio: "pipe" });
    execSync("git commit -m 'Test commit'", { cwd: tempDir, stdio: "pipe" });

    // git hash-objectでSHAを取得
    const expectedSha = execSync(`git hash-object test.txt`, {
      cwd: tempDir,
      encoding: "utf8",
    }).trim();
    console.log("   Git-created object SHA:", expectedSha);

    // Act: ObjectRepositoryでオブジェクトを読み取り
    const readObject = await repo.read(expectedSha);

    // Assert: 読み取ったオブジェクトが正しい
    assert.strictEqual(readObject.getType(), "blob");
    assert.strictEqual(readObject.getContent().toString("utf8"), testContent);
    assert.strictEqual(readObject.getSha(), expectedSha);
    console.log("   ✅ Test passed - successfully read git-created object");
  });

  test("write creates objects compatible with real git", async () => {
    console.log("🧪 Test: write creates objects compatible with real git");

    // Arrange: ObjectRepositoryでBlobオブジェクトを作成・書き込み
    const testContent = "Content created by ObjectRepository";
    const blob: Blob = new Blob(Buffer.from(testContent, "utf8"));
    const sha: string = await repo.write(blob);
    console.log("   ObjectRepository-created SHA:", sha);

    // Act: 実際のgitコマンドでオブジェクトを確認
    try {
      const gitCatFile = execSync(`git cat-file -p ${sha}`, {
        cwd: tempDir,
        encoding: "utf8",
      });
      const gitObjectType = execSync(`git cat-file -t ${sha}`, {
        cwd: tempDir,
        encoding: "utf8",
      }).trim();

      // Assert: gitコマンドで正しく読み取れる
      assert.strictEqual(gitCatFile.trim(), testContent);
      assert.strictEqual(gitObjectType, "blob");
      console.log(
        "   ✅ Test passed - git successfully read ObjectRepository-created object",
      );
    } catch (error) {
      assert.fail(
        `Git failed to read object: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  });

  test("write and read tree object correctly", async () => {
    console.log("🧪 Test: write and read tree object correctly");

    // Arrange: テスト用のTreeオブジェクトを作成
    // まず、Blobオブジェクトを作成してSHAを取得
    const fileBlob: Blob = new Blob(Buffer.from("Hello from file", "utf8"));
    const fileSha: string = fileBlob.getSha();

    // TreeEntryを作成
    const entries: Array<TreeEntry> = [
      {
        mode: "100644",
        name: "hello.txt",
        sha: fileSha,
      },
      {
        mode: "040000",
        name: "subdir",
        sha: "4b825dc642cb6eb9a060e54bf8d69288fbee4904", // 空のtreeのSHA
      },
    ];

    const tree: Tree = new Tree(entries);
    const expectedSha: string = tree.getSha();
    console.log("   Created tree with SHA:", expectedSha);

    // Act: write then read
    const writtenSha: string = await repo.write(tree);
    console.log("   Written SHA:", writtenSha);

    const readObject = await repo.read(writtenSha);
    console.log("   Read object type:", readObject.getType());

    // Assert: 書き込みと読み取りの結果を検証
    assert.strictEqual(writtenSha, expectedSha);
    assert.strictEqual(readObject.getType(), "tree");
    assert.strictEqual(readObject.getSha(), expectedSha);
    console.log(
      "   ✅ Test passed - tree write/read cycle completed correctly",
    );
  });

  test("write and read commit object correctly", async () => {
    console.log("🧪 Test: write and read commit object correctly");

    // Arrange: テスト用のCommitオブジェクトを作成
    const treeSha = "4b825dc642cb6eb9a060e54bf8d69288fbee4904"; // 空のtreeのSHA
    const parents: Array<string> = [];
    const author: GitActor = {
      name: "Test Author",
      email: "author@example.com",
      timestamp: new Date("2024-01-01T12:00:00Z"),
    };
    const committer: GitActor = {
      name: "Test Committer",
      email: "committer@example.com",
      timestamp: new Date("2024-01-01T12:00:00Z"),
    };
    const message = "Initial commit\n";

    const commit: Commit = new Commit(
      treeSha,
      parents,
      author,
      committer,
      message,
    );
    const expectedSha: string = commit.getSha();
    console.log("   Created commit with SHA:", expectedSha);

    // Act: write then read
    const writtenSha: string = await repo.write(commit);
    console.log("   Written SHA:", writtenSha);

    const readObject = await repo.read(writtenSha);
    console.log("   Read object type:", readObject.getType());

    // Assert: 書き込みと読み取りの結果を検証
    assert.strictEqual(writtenSha, expectedSha);
    assert.strictEqual(readObject.getType(), "commit");
    assert.strictEqual(readObject.getSha(), expectedSha);
    console.log(
      "   ✅ Test passed - commit write/read cycle completed correctly",
    );
  });

  test("tree objects are compatible with real git", async () => {
    console.log("🧪 Test: tree objects are compatible with real git");

    // Arrange: 実際のgitでファイルとツリーを作成
    const testFile1 = path.join(tempDir, "file1.txt");
    const testFile2 = path.join(tempDir, "file2.txt");
    fs.writeFileSync(testFile1, "Content of file 1");
    fs.writeFileSync(testFile2, "Content of file 2");

    execSync("git add file1.txt file2.txt", { cwd: tempDir, stdio: "pipe" });
    execSync("git commit -m 'Add test files'", { cwd: tempDir, stdio: "pipe" });

    // git log --pretty=format:%T でtree SHAを取得
    const treeSha = execSync("git log --pretty=format:%T -1", {
      cwd: tempDir,
      encoding: "utf8",
    }).trim();
    console.log("   Git-created tree SHA:", treeSha);

    // Act: ObjectRepositoryでtreeオブジェクトを読み取り
    const readObject = await repo.read(treeSha);

    // Assert: 読み取ったオブジェクトが正しい
    assert.strictEqual(readObject.getType(), "tree");
    assert.strictEqual(readObject.getSha(), treeSha);

    // git ls-tree でtreeの内容を確認
    const gitLsTree = execSync(`git ls-tree ${treeSha}`, {
      cwd: tempDir,
      encoding: "utf8",
    });
    console.log("   Git ls-tree output:", gitLsTree.trim());
    console.log(
      "   ✅ Test passed - successfully read git-created tree object",
    );
  });

  test("commit objects are compatible with real git", async () => {
    console.log("🧪 Test: commit objects are compatible with real git");

    // Arrange: 実際のgitでコミットを作成
    const testFile = path.join(tempDir, "commit-test.txt");
    fs.writeFileSync(testFile, "Test commit compatibility");

    execSync("git add commit-test.txt", { cwd: tempDir, stdio: "pipe" });
    execSync("git commit -m 'Test commit message'", {
      cwd: tempDir,
      stdio: "pipe",
    });

    // 最新コミットのSHAを取得
    const commitSha = execSync("git log --pretty=format:%H -1", {
      cwd: tempDir,
      encoding: "utf8",
    }).trim();
    console.log("   Git-created commit SHA:", commitSha);

    // Act: ObjectRepositoryでcommitオブジェクトを読み取り
    const readObject = await repo.read(commitSha);

    // Assert: 読み取ったオブジェクトが正しい
    assert.strictEqual(readObject.getType(), "commit");
    assert.strictEqual(readObject.getSha(), commitSha);

    // git cat-file でcommitの内容を確認
    const gitCatFile = execSync(`git cat-file -p ${commitSha}`, {
      cwd: tempDir,
      encoding: "utf8",
    });
    console.log("   Git commit content preview:", gitCatFile.split("\n")[0]); // 最初の行のみ表示
    console.log(
      "   ✅ Test passed - successfully read git-created commit object",
    );
  });
});
