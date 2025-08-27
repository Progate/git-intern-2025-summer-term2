import * as crypto from "crypto";
import assert from "node:assert";
import { describe, it } from "node:test";

import { Blob } from "../../../src/models/blob.js";

describe("Blob", () => {
  describe("constructor", () => {
    it("should create blob with content", () => {
      const content = Buffer.from("Hello, World!", "utf8");
      const blob = new Blob(content);

      assert.strictEqual(blob.getType(), "blob");
      assert.deepStrictEqual(blob.getContent(), content);
    });

    it("should handle empty content", () => {
      const content = Buffer.alloc(0);
      const blob = new Blob(content);

      assert.strictEqual(blob.getType(), "blob");
      assert.deepStrictEqual(blob.getContent(), content);
    });

    it("should handle binary content", () => {
      const content = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0xfd]);
      const blob = new Blob(content);

      assert.strictEqual(blob.getType(), "blob");
      assert.deepStrictEqual(blob.getContent(), content);
    });

    it("should handle large content", () => {
      const largeContent = Buffer.alloc(1024 * 1024, "A"); // 1MB of 'A's
      const blob = new Blob(largeContent);

      assert.strictEqual(blob.getType(), "blob");
      assert.strictEqual(blob.getContent().length, 1024 * 1024);
    });

    it("should handle Unicode content", () => {
      const content = Buffer.from("こんにちは世界 🌍 Hello", "utf8");
      const blob = new Blob(content);

      assert.strictEqual(blob.getType(), "blob");
      assert.deepStrictEqual(blob.getContent(), content);
    });
  });

  describe("getType", () => {
    it("should return 'blob'", () => {
      const blob = new Blob(Buffer.from("test", "utf8"));
      assert.strictEqual(blob.getType(), "blob");
    });
  });

  describe("getContent", () => {
    it("should return the exact content buffer", () => {
      const content = Buffer.from("test content", "utf8");
      const blob = new Blob(content);

      const returned = blob.getContent();
      assert.deepStrictEqual(returned, content);
      // Ensure it returns the same buffer instance
      assert.strictEqual(returned, content);
    });

    it("should return buffer with null bytes", () => {
      const content = Buffer.from("before\x00after", "utf8");
      const blob = new Blob(content);

      assert.deepStrictEqual(blob.getContent(), content);
    });
  });

  describe("serialize", () => {
    it("should serialize blob correctly", () => {
      const content = Buffer.from("hello world", "utf8");
      const blob = new Blob(content);
      const serialized = blob.serialize();

      const expected = Buffer.concat([
        Buffer.from("blob 11\x00", "utf8"),
        content,
      ] as ReadonlyArray<Uint8Array>);

      assert.deepStrictEqual(serialized, expected);
    });

    it("should serialize empty blob", () => {
      const content = Buffer.alloc(0);
      const blob = new Blob(content);
      const serialized = blob.serialize();

      const expected = Buffer.from("blob 0\x00", "utf8");
      assert.deepStrictEqual(serialized, expected);
    });

    it("should serialize binary blob", () => {
      const content = Buffer.from([0x00, 0xff]);
      const blob = new Blob(content);
      const serialized = blob.serialize();

      const expectedHeader = Buffer.from("blob 2\x00", "utf8");
      const expected = Buffer.concat([
        expectedHeader,
        content,
      ] as ReadonlyArray<Uint8Array>);

      assert.deepStrictEqual(serialized, expected);
    });

    it("should handle content with newlines", () => {
      const content = Buffer.from("line1\nline2\nline3", "utf8");
      const blob = new Blob(content);
      const serialized = blob.serialize();

      const expectedHeader = Buffer.from(
        `blob ${content.length.toString()}\x00`,
        "utf8",
      );
      const expected = Buffer.concat([
        expectedHeader,
        content,
      ] as ReadonlyArray<Uint8Array>);

      assert.deepStrictEqual(serialized, expected);
    });

    it("should include exact byte count in header", () => {
      const content = Buffer.from("測試", "utf8"); // UTF-8 encoded
      const blob = new Blob(content);
      const serialized = blob.serialize();

      const expectedSize = content.length; // Byte count, not character count
      const expectedHeader = Buffer.from(
        `blob ${expectedSize.toString()}\x00`,
        "utf8",
      );

      assert.ok(
        serialized
          .subarray(0, expectedHeader.length)
          .equals(expectedHeader as unknown as Uint8Array),
      );
    });
  });

  describe("getSha", () => {
    it("should return consistent SHA-1 hash", () => {
      const content = Buffer.from("hello world", "utf8");
      const blob = new Blob(content);

      const hash1 = blob.getSha();
      const hash2 = blob.getSha();

      assert.strictEqual(hash1, hash2);
      assert.strictEqual(hash1.length, 40); // SHA-1 hex string length
      assert.match(hash1, /^[0-9a-f]{40}$/);
    });

    it("should generate different hashes for different content", () => {
      const blob1 = new Blob(Buffer.from("content1", "utf8"));
      const blob2 = new Blob(Buffer.from("content2", "utf8"));

      assert.notStrictEqual(blob1.getSha(), blob2.getSha());
    });

    it("should match expected Git SHA-1 hash", () => {
      const content = Buffer.from("hello world", "utf8");
      const blob = new Blob(content);

      // Calculate expected hash manually
      const gitContent = Buffer.concat([
        Buffer.from("blob 11\x00", "utf8"),
        content,
      ] as ReadonlyArray<Uint8Array>);
      const expectedHash = crypto
        .createHash("sha1")
        .update(gitContent as unknown as string)
        .digest("hex");

      assert.strictEqual(blob.getSha(), expectedHash);
    });

    it("should handle empty blob hash", () => {
      const blob = new Blob(Buffer.alloc(0));
      const hash = blob.getSha();

      assert.strictEqual(hash.length, 40);
      assert.match(hash, /^[0-9a-f]{40}$/);

      // Manually calculate expected empty blob hash
      const gitContent = Buffer.from("blob 0\x00", "utf8");
      const expectedHash = crypto
        .createHash("sha1")
        .update(gitContent as unknown as string)
        .digest("hex");
      assert.strictEqual(hash, expectedHash);
    });

    it("should handle binary content hash", () => {
      const content = Buffer.from([0x00, 0x01, 0xff, 0xfe]);
      const blob = new Blob(content);
      const hash = blob.getSha();

      assert.strictEqual(hash.length, 40);
      assert.match(hash, /^[0-9a-f]{40}$/);
    });
  });
});
