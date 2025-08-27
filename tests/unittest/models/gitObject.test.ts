import assert from "node:assert";
import { describe, it } from "node:test";

import { Blob } from "../../../src/models/blob.js";
import { Commit } from "../../../src/models/commit.js";
import { GitObject } from "../../../src/models/gitObject.js";
import { Tree } from "../../../src/models/tree.js";
import { GitActor, TreeEntry } from "../../../src/models/types.js";

describe("GitObject", () => {
  const testActor: GitActor = {
    name: "Test User",
    email: "test@example.com",
    timestamp: new Date("2025-01-01T00:00:00Z"),
  };

  describe("deserialize", () => {
    it("should deserialize blob correctly", async () => {
      const originalBlob = new Blob(Buffer.from("test content", "utf8"));
      const serialized = originalBlob.serialize();
      const deserialized = await GitObject.deserialize(serialized);

      assert.strictEqual(deserialized.getType(), "blob");
      assert.deepStrictEqual(
        deserialized.getContent(),
        originalBlob.getContent(),
      );
      assert.strictEqual(deserialized.getSha(), originalBlob.getSha());
    });

    it("should deserialize tree correctly", async () => {
      const entries: Array<TreeEntry> = [
        { mode: "100644", name: "file.txt", sha: "a".repeat(40) },
        { mode: "040000", name: "directory", sha: "b".repeat(40) },
      ];
      const originalTree = new Tree(entries);
      const serialized = originalTree.serialize();
      const deserialized = await GitObject.deserialize(serialized);

      assert.strictEqual(deserialized.getType(), "tree");
      assert.strictEqual(deserialized.getSha(), originalTree.getSha());
    });

    it("should deserialize commit correctly", async () => {
      const originalCommit = new Commit(
        "tree123",
        ["parent1"],
        testActor,
        testActor,
        "Test commit",
      );
      const serialized = originalCommit.serialize();
      const deserialized = await GitObject.deserialize(serialized);

      assert.strictEqual(deserialized.getType(), "commit");
      assert.strictEqual(deserialized.getSha(), originalCommit.getSha());
    });

    it("should throw error for invalid format", async () => {
      const invalidData = Buffer.from("invalid data", "utf8");

      await assert.rejects(
        GitObject.deserialize(invalidData),
        /Invalid git object format/,
      );
    });

    it("should throw error for unknown object type", async () => {
      const invalidData = Buffer.from("unknown 4\x00test", "utf8");

      await assert.rejects(
        GitObject.deserialize(invalidData),
        /Unknown git object type/,
      );
    });

    it("should maintain round-trip consistency", async () => {
      const original = new Blob(Buffer.from("test", "utf8"));
      const serialized = original.serialize();
      const deserialized = await GitObject.deserialize(serialized);
      const reserialized = deserialized.serialize();

      assert.deepStrictEqual(reserialized, serialized);
    });
  });
});
