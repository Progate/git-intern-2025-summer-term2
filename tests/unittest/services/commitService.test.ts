import assert from "node:assert";
import { describe, it, mock } from "node:test";

import { FileTime, GitActor, IndexEntry } from "../../../src/models/types.js";
import { CommitService } from "../../../src/services/commitService.js";
import { MockLogger } from "../../../src/utils/logger.js";

// Type definitions for test mocks - disabling strict type checking as these are test doubles
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

describe("CommitService", () => {
  let mockLogger: MockLogger;

  const mockUserConfig: GitActor = {
    name: "Test User",
    email: "test@example.com",
    timestamp: new Date("2025-01-01T12:00:00Z"),
  };

  const createMockFileTime = (): FileTime => ({
    seconds: Math.floor(Date.now() / 1000),
    nanoseconds: 0,
  });

  // Create common mock repositories
  const createMockRepositories = (
    overrides: {
      indexEntries?: Array<IndexEntry>;
      userConfig?: GitActor | undefined;
      parentCommitSha?: string | null;
    } = {},
  ): {
    mockIndexRepo: any;
    mockObjectRepo: any;
    mockReferenceRepo: any;
    mockConfigRepo: any;
  } => {
    return {
      mockIndexRepo: {
        getAllEntries: mock.fn(
          () => overrides.indexEntries ?? mockIndexEntries,
        ),
        write: mock.fn(),
        add: mock.fn(),
        remove: mock.fn(),
        getEntry: mock.fn(),
      } as any,
      mockObjectRepo: {
        write: mock.fn(() => Promise.resolve("mock-tree-sha")),
        read: mock.fn(),
        exists: mock.fn(),
      } as any,
      mockReferenceRepo: {
        resolveHead: mock.fn(() =>
          Promise.resolve(overrides.parentCommitSha ?? "parent-commit-sha-123"),
        ),
        updateHead: mock.fn(() => Promise.resolve()),
        getCurrentBranch: mock.fn(() => Promise.resolve("main")),
      } as any,
      mockConfigRepo: {
        getUserConfig: mock.fn(() =>
          "userConfig" in overrides ? overrides.userConfig : mockUserConfig,
        ),
        getCoreConfig: mock.fn(),
      } as any,
    };
  };

  const mockIndexEntries: Array<IndexEntry> = [
    {
      path: "README.md",
      objectId: "abc123456789abcdef123456789abcdef12345678",
      mode: 0o100644,
      size: 100,
      ctime: createMockFileTime(),
      mtime: createMockFileTime(),
      dev: 1,
      ino: 1,
      uid: 1000,
      gid: 1000,
      flags: 0,
    },
  ];

  describe("execute", () => {
    it("should throw INVALID_MESSAGE error when message is empty", async () => {
      // Arrange
      mockLogger = new MockLogger();
      const repos = createMockRepositories();

      const commitService = new CommitService(
        repos.mockIndexRepo,
        repos.mockObjectRepo,
        repos.mockReferenceRepo,
        repos.mockConfigRepo,
        mockLogger,
      );

      // Act & Assert
      await assert.rejects(commitService.execute(""), (err: Error) => {
        return (
          err instanceof Error &&
          err.message ===
            "Failed to create commit: Commit message cannot be empty"
        );
      });
    });

    it("should throw INVALID_MESSAGE error when message is whitespace only", async () => {
      // Arrange
      mockLogger = new MockLogger();
      const repos = createMockRepositories();

      const commitService = new CommitService(
        repos.mockIndexRepo,
        repos.mockObjectRepo,
        repos.mockReferenceRepo,
        repos.mockConfigRepo,
        mockLogger,
      );

      // Act & Assert
      await assert.rejects(commitService.execute("   \n\t  "), (err: Error) => {
        return (
          err instanceof Error &&
          err.message ===
            "Failed to create commit: Commit message cannot be empty"
        );
      });
    });

    it("should throw EMPTY_INDEX error when no staged files", async () => {
      // Arrange
      mockLogger = new MockLogger();
      const repos = createMockRepositories({ indexEntries: [] });

      const commitService = new CommitService(
        repos.mockIndexRepo,
        repos.mockObjectRepo,
        repos.mockReferenceRepo,
        repos.mockConfigRepo,
        mockLogger,
      );

      // Act & Assert
      await assert.rejects(
        commitService.execute("Test commit"),
        (err: Error) => {
          return (
            err instanceof Error &&
            err.message === "Failed to create commit: No staged files to commit"
          );
        },
      );
    });

    it("should throw MISSING_USER_CONFIG error when user config is not set", async () => {
      // Arrange
      mockLogger = new MockLogger();
      const repos = createMockRepositories({ userConfig: undefined });

      const commitService = new CommitService(
        repos.mockIndexRepo,
        repos.mockObjectRepo,
        repos.mockReferenceRepo,
        repos.mockConfigRepo,
        mockLogger,
      );

      // Act & Assert
      await assert.rejects(
        commitService.execute("Test commit"),
        (err: Error) => {
          return (
            err instanceof Error &&
            err.message ===
              "Failed to create commit: User name and email must be configured"
          );
        },
      );
    });
  });
});
