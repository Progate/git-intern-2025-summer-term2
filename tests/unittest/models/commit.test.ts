import assert from "node:assert";
import { describe, it } from "node:test";

import { Commit } from "../../../src/models/commit.js";
import { GitActor } from "../../../src/models/types.js";

describe("Commit", () => {
  const testAuthor: GitActor = {
    name: "John Doe",
    email: "john@example.com",
    timestamp: new Date("2025-01-01T12:00:00Z"),
  };

  const testCommitter: GitActor = {
    name: "Jane Doe",
    email: "jane@example.com",
    timestamp: new Date("2025-01-02T15:30:00Z"),
  };

  describe("constructor", () => {
    it("should create commit with required fields", () => {
      const commit = new Commit(
        "tree123",
        ["parent1"],
        testAuthor,
        testCommitter,
        "Initial commit",
      );

      assert.strictEqual(commit.getType(), "commit");
    });

    it("should handle commit with no parents", () => {
      const commit = new Commit(
        "tree456",
        [],
        testAuthor,
        testCommitter,
        "Root commit",
      );

      assert.strictEqual(commit.getType(), "commit");
    });

    it("should handle commit with multiple parents", () => {
      const commit = new Commit(
        "tree789",
        ["parent1", "parent2", "parent3"],
        testAuthor,
        testCommitter,
        "Merge commit",
      );

      assert.strictEqual(commit.getType(), "commit");
    });
  });

  describe("getType", () => {
    it("should return 'commit'", () => {
      const commit = new Commit(
        "tree123",
        [],
        testAuthor,
        testCommitter,
        "Test",
      );
      assert.strictEqual(commit.getType(), "commit");
    });
  });

  describe("getContent", () => {
    it("should generate correct format for basic commit", () => {
      const commit = new Commit(
        "abc123",
        ["def456"],
        testAuthor,
        testCommitter,
        "Test commit",
      );

      const content = commit.getContent().toString("utf8");

      assert.ok(content.includes("tree abc123"));
      assert.ok(content.includes("parent def456"));
      assert.ok(content.includes("author John Doe <john@example.com>"));
      assert.ok(content.includes("committer Jane Doe <jane@example.com>"));
      assert.ok(content.includes("Test commit"));
    });

    it("should handle commit with no parents", () => {
      const commit = new Commit(
        "tree123",
        [],
        testAuthor,
        testCommitter,
        "Initial commit",
      );

      const content = commit.getContent().toString("utf8");

      assert.ok(content.includes("tree tree123"));
      assert.ok(!content.includes("parent"));
      assert.ok(content.includes("Initial commit"));
    });

    it("should handle commit with multiple parents", () => {
      const commit = new Commit(
        "tree123",
        ["parent1", "parent2"],
        testAuthor,
        testCommitter,
        "Merge commit",
      );

      const content = commit.getContent().toString("utf8");

      assert.ok(content.includes("tree tree123"));
      assert.ok(content.includes("parent parent1"));
      assert.ok(content.includes("parent parent2"));
      assert.ok(content.includes("Merge commit"));
    });

    it("should format timestamps correctly", () => {
      const commit = new Commit(
        "tree123",
        [],
        testAuthor,
        testCommitter,
        "Test",
      );

      const content = commit.getContent().toString("utf8");

      // 2025-01-01T12:00:00Z = 1735732800
      const authorTimestamp = Math.floor(testAuthor.timestamp.getTime() / 1000);
      const authorTimezone = (() => {
        const offset = -testAuthor.timestamp.getTimezoneOffset();
        const sign = offset >= 0 ? "+" : "-";
        const hours = Math.floor(Math.abs(offset) / 60)
          .toString()
          .padStart(2, "0");
        const minutes = (Math.abs(offset) % 60).toString().padStart(2, "0");
        return `${sign}${hours}${minutes}`;
      })();
      assert.ok(
        content.includes(`${authorTimestamp.toString()} ${authorTimezone}`),
      );

      // 2025-01-02T15:30:00Z = 1735831800
      const committerTimestamp = Math.floor(
        testCommitter.timestamp.getTime() / 1000,
      );
      const committerTimezone = (() => {
        const offset = -testCommitter.timestamp.getTimezoneOffset();
        const sign = offset >= 0 ? "+" : "-";
        const hours = Math.floor(Math.abs(offset) / 60)
          .toString()
          .padStart(2, "0");
        const minutes = (Math.abs(offset) % 60).toString().padStart(2, "0");
        return `${sign}${hours}${minutes}`;
      })();
      assert.ok(
        content.includes(
          `${committerTimestamp.toString()} ${committerTimezone}`,
        ),
      );
    });

    it("should handle multi-line commit messages", () => {
      const multiLineMessage = "First line\n\nSecond paragraph\nThird line";
      const commit = new Commit(
        "tree123",
        [],
        testAuthor,
        testCommitter,
        multiLineMessage,
      );

      const content = commit.getContent().toString("utf8");

      assert.ok(content.includes("First line"));
      assert.ok(content.includes("Second paragraph"));
      assert.ok(content.includes("Third line"));
    });

    it("should end with message content", () => {
      const commit = new Commit(
        "tree123",
        [],
        testAuthor,
        testCommitter,
        "Test",
      );

      const content = commit.getContent();
      const contentStr = content.toString("utf8");
      assert.ok(contentStr.endsWith("Test"));
    });

    it("should have correct structure order", () => {
      const commit = new Commit(
        "tree123",
        ["parent1"],
        testAuthor,
        testCommitter,
        "Test message",
      );

      const content = commit.getContent().toString("utf8");
      const lines = content.split("\n");

      assert.ok(lines[0]?.startsWith("tree "));
      assert.ok(lines[1]?.startsWith("parent "));
      assert.ok(lines[2]?.startsWith("author "));
      assert.ok(lines[3]?.startsWith("committer "));
      assert.strictEqual(lines[4], ""); // Empty line before message
      assert.strictEqual(lines[5], "Test message");
    });
  });

  describe("serialize", () => {
    it("should serialize commit correctly", () => {
      const commit = new Commit(
        "tree123",
        ["parent1"],
        testAuthor,
        testCommitter,
        "Test commit",
      );

      const serialized = commit.serialize();
      const content = commit.getContent();
      const expectedHeader = Buffer.from(
        `commit ${content.length.toString()}\x00`,
        "utf8",
      );
      const expected = Buffer.concat([
        expectedHeader,
        content,
      ] as ReadonlyArray<Uint8Array>);

      assert.deepStrictEqual(serialized, expected);
    });

    it("should include correct size in header", () => {
      const commit = new Commit(
        "tree123",
        [],
        testAuthor,
        testCommitter,
        "Short",
      );

      const serialized = commit.serialize();
      const headerEnd = serialized.indexOf(0);
      const header = serialized.subarray(0, headerEnd).toString("utf8");

      const content = commit.getContent();
      assert.strictEqual(header, `commit ${content.length.toString()}`);
    });
  });

  describe("getSha", () => {
    it("should return consistent SHA-1 hash", () => {
      const commit = new Commit(
        "tree123",
        ["parent1"],
        testAuthor,
        testCommitter,
        "Test commit",
      );

      const hash1 = commit.getSha();
      const hash2 = commit.getSha();

      assert.strictEqual(hash1, hash2);
      assert.strictEqual(hash1.length, 40);
      assert.match(hash1, /^[0-9a-f]{40}$/);
    });

    it("should generate different hashes for different commits", () => {
      const commit1 = new Commit(
        "tree1",
        [],
        testAuthor,
        testCommitter,
        "Message1",
      );
      const commit2 = new Commit(
        "tree2",
        [],
        testAuthor,
        testCommitter,
        "Message2",
      );

      assert.notStrictEqual(commit1.getSha(), commit2.getSha());
    });

    it("should generate same hash for identical commits", () => {
      const commit1 = new Commit(
        "tree123",
        ["parent1"],
        testAuthor,
        testCommitter,
        "Same",
      );
      const commit2 = new Commit(
        "tree123",
        ["parent1"],
        testAuthor,
        testCommitter,
        "Same",
      );

      assert.strictEqual(commit1.getSha(), commit2.getSha());
    });
  });
});
