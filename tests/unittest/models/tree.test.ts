import assert from "node:assert";
import { describe, it } from "node:test";

import { Tree } from "../../../src/models/tree.js";
import { TreeEntry } from "../../../src/models/types.js";

describe("Tree", () => {
  describe("constructor", () => {
    it("should create tree with entries", () => {
      const entries: Array<TreeEntry> = [
        { mode: "100644", name: "file.txt", sha: "a".repeat(40) },
        { mode: "040000", name: "directory", sha: "b".repeat(40) },
      ];
      const tree = new Tree(entries);

      assert.strictEqual(tree.getType(), "tree");
    });

    it("should handle empty tree", () => {
      const tree = new Tree([]);

      assert.strictEqual(tree.getType(), "tree");
      assert.deepStrictEqual(tree.getContent(), Buffer.alloc(0));
    });
  });

  describe("getType", () => {
    it("should return 'tree'", () => {
      const tree = new Tree([]);
      assert.strictEqual(tree.getType(), "tree");
    });
  });

  describe("getContent", () => {
    it("should sort entries by name", () => {
      const entries: Array<TreeEntry> = [
        { mode: "100644", name: "z.txt", sha: "a".repeat(40) },
        { mode: "100644", name: "a.txt", sha: "b".repeat(40) },
        { mode: "100644", name: "m.txt", sha: "c".repeat(40) },
      ];
      const tree = new Tree(entries);
      const content = tree.getContent();

      // Parse the content to verify sorting
      const contentStr = content.toString("binary");
      const aIndex = contentStr.indexOf("a.txt");
      const mIndex = contentStr.indexOf("m.txt");
      const zIndex = contentStr.indexOf("z.txt");

      assert.ok(aIndex < mIndex);
      assert.ok(mIndex < zIndex);
    });

    it("should generate correct binary format", () => {
      const entries: Array<TreeEntry> = [
        {
          mode: "100644",
          name: "file.txt",
          sha: "1234567890abcdef1234567890abcdef12345678",
        },
      ];
      const tree = new Tree(entries);
      const content = tree.getContent();

      // Expected format: "100644 file.txt\0" + 20-byte SHA
      const expectedText = Buffer.from("100644 file.txt\x00", "utf8");
      const expectedSha = Buffer.from(
        "1234567890abcdef1234567890abcdef12345678",
        "hex",
      );
      const expected = Buffer.concat([
        expectedText,
        expectedSha,
      ] as ReadonlyArray<Uint8Array>);

      assert.deepStrictEqual(content, expected);
    });

    it("should handle multiple entries", () => {
      const entries: Array<TreeEntry> = [
        { mode: "100644", name: "b.txt", sha: "a".repeat(40) },
        { mode: "100755", name: "a.sh", sha: "b".repeat(40) },
      ];
      const tree = new Tree(entries);
      const content = tree.getContent();

      // Should be sorted: a.sh, b.txt
      const contentStr = content.toString("binary");
      const aIndex = contentStr.indexOf("a.sh");
      const bIndex = contentStr.indexOf("b.txt");
      assert.ok(aIndex < bIndex);
    });

    it("should handle directory entries", () => {
      const entries: Array<TreeEntry> = [
        { mode: "040000", name: "subdir", sha: "c".repeat(40) },
      ];
      const tree = new Tree(entries);
      const content = tree.getContent();

      // Tree implementation outputs mode as-is, including leading zero
      const expectedText = Buffer.from("040000 subdir\x00", "utf8");
      const expectedSha = Buffer.from("c".repeat(40), "hex");
      const expected = Buffer.concat([
        expectedText,
        expectedSha,
      ] as ReadonlyArray<Uint8Array>);

      assert.deepStrictEqual(content, expected);
    });

    it("should handle executable files", () => {
      const entries: Array<TreeEntry> = [
        { mode: "100755", name: "script.sh", sha: "d".repeat(40) },
      ];
      const tree = new Tree(entries);
      const content = tree.getContent();

      const expectedText = Buffer.from("100755 script.sh\x00", "utf8");
      const expectedSha = Buffer.from("d".repeat(40), "hex");
      const expected = Buffer.concat([
        expectedText,
        expectedSha,
      ] as ReadonlyArray<Uint8Array>);

      assert.deepStrictEqual(content, expected);
    });

    it("should not modify original entries array", () => {
      const entries: Array<TreeEntry> = [
        { mode: "100644", name: "z.txt", sha: "a".repeat(40) },
        { mode: "100644", name: "a.txt", sha: "b".repeat(40) },
      ];
      const originalOrder = [...entries];
      const tree = new Tree(entries);

      tree.getContent(); // This should not modify entries

      assert.deepStrictEqual(entries, originalOrder);
    });
  });

  describe("serialize", () => {
    it("should serialize tree correctly", () => {
      const entries: Array<TreeEntry> = [
        { mode: "100644", name: "file.txt", sha: "a".repeat(40) },
      ];
      const tree = new Tree(entries);
      const serialized = tree.serialize();

      const content = tree.getContent();
      const expectedHeader = Buffer.from(
        `tree ${content.length.toString()}\x00`,
        "utf8",
      );
      const expected = Buffer.concat([
        expectedHeader,
        content,
      ] as ReadonlyArray<Uint8Array>);

      assert.deepStrictEqual(serialized, expected);
    });

    it("should serialize empty tree", () => {
      const tree = new Tree([]);
      const serialized = tree.serialize();

      const expected = Buffer.from("tree 0\x00", "utf8");
      assert.deepStrictEqual(serialized, expected);
    });

    it("should serialize multiple entries", () => {
      const entries: Array<TreeEntry> = [
        { mode: "100644", name: "b.txt", sha: "a".repeat(40) },
        { mode: "100644", name: "a.txt", sha: "b".repeat(40) },
      ];
      const tree = new Tree(entries);
      const serialized = tree.serialize();

      const content = tree.getContent();
      const expectedHeader = Buffer.from(
        `tree ${content.length.toString()}\x00`,
        "utf8",
      );
      const expected = Buffer.concat([
        expectedHeader,
        content,
      ] as ReadonlyArray<Uint8Array>);

      assert.deepStrictEqual(serialized, expected);
    });
  });

  describe("getSha", () => {
    it("should return consistent SHA-1 hash", () => {
      const entries: Array<TreeEntry> = [
        { mode: "100644", name: "file.txt", sha: "a".repeat(40) },
      ];
      const tree = new Tree(entries);

      const hash1 = tree.getSha();
      const hash2 = tree.getSha();

      assert.strictEqual(hash1, hash2);
      assert.strictEqual(hash1.length, 40);
      assert.match(hash1, /^[0-9a-f]{40}$/);
    });

    it("should generate different hashes for different trees", () => {
      const tree1 = new Tree([
        { mode: "100644", name: "file1.txt", sha: "a".repeat(40) },
      ]);
      const tree2 = new Tree([
        { mode: "100644", name: "file2.txt", sha: "b".repeat(40) },
      ]);

      assert.notStrictEqual(tree1.getSha(), tree2.getSha());
    });

    it("should generate same hash for same entries in different order", () => {
      const tree1 = new Tree([
        { mode: "100644", name: "a.txt", sha: "a".repeat(40) },
        { mode: "100644", name: "b.txt", sha: "b".repeat(40) },
      ]);
      const tree2 = new Tree([
        { mode: "100644", name: "b.txt", sha: "b".repeat(40) },
        { mode: "100644", name: "a.txt", sha: "a".repeat(40) },
      ]);

      assert.strictEqual(tree1.getSha(), tree2.getSha());
    });

    it("should handle empty tree hash", () => {
      const tree = new Tree([]);
      const hash = tree.getSha();

      assert.strictEqual(hash.length, 40);
      assert.match(hash, /^[0-9a-f]{40}$/);
    });
  });
});
