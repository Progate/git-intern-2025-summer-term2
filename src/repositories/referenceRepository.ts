import * as fs from "fs/promises";
import * as path from "path";

/**
 * ReferenceRepositoryで発生するエラーを表すクラス
 */
export class ReferenceRepositoryError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "ReferenceRepositoryError";
  }
}

/**
 * .git/HEADやブランチファイルの読み書きを抽象化するクラス
 * HEAD参照の解決とブランチ参照の管理を担当
 */
export class ReferenceRepository {
  private readonly gitDir: string;

  /**
   * ReferenceRepositoryのコンストラクタ
   * @param gitDir .gitディレクトリのパス
   */
  constructor(gitDir: string) {
    this.gitDir = gitDir;
  }

  /**
   * HEADが指すコミットのSHAを取得
   * @returns コミットのSHA-1ハッシュ
   */
  async resolveHead(): Promise<string> {
    try {
      const headPath = path.join(this.gitDir, "HEAD");
      const headContent = await fs.readFile(headPath, "utf8");
      const trimmedContent = headContent.trim();

      // 直接的なSHA-1ハッシュの場合（detached HEAD）
      if (this.isValidSha(trimmedContent)) {
        return trimmedContent;
      }

      // ブランチ参照の場合（ref: refs/heads/branch-name）
      if (trimmedContent.startsWith("ref: ")) {
        const refName = trimmedContent.substring(5);
        return await this.resolveRef(refName);
      }

      throw new ReferenceRepositoryError(
        `Invalid HEAD content: ${trimmedContent}`,
        "INVALID_HEAD",
      );
    } catch (error) {
      if (error instanceof ReferenceRepositoryError) {
        throw error;
      }

      if (error instanceof Error && error.message.includes("ENOENT")) {
        throw new ReferenceRepositoryError(
          "HEAD file not found",
          "HEAD_NOT_FOUND",
        );
      }

      throw new ReferenceRepositoryError(
        `Failed to resolve HEAD: ${error instanceof Error ? error.message : String(error)}`,
        "IO_ERROR",
      );
    }
  }

  /**
   * HEADが指すブランチの参照を更新
   * @param sha 新しいコミットのSHA-1ハッシュ
   */
  async updateHead(sha: string): Promise<void> {
    if (!this.isValidSha(sha)) {
      throw new ReferenceRepositoryError(
        `Invalid SHA-1 format: ${sha}`,
        "INVALID_SHA",
      );
    }

    try {
      // 現在のHEADが指しているブランチを取得
      const currentBranch = await this.getCurrentBranch();

      if (!currentBranch) {
        // detached HEADの場合は直接HEADファイルを更新
        const headPath = path.join(this.gitDir, "HEAD");
        await fs.writeFile(headPath, `${sha}\n`, "utf8");
        return;
      }

      // ブランチファイルを更新
      const branchPath = path.join(this.gitDir, "refs", "heads", currentBranch);

      // ディレクトリが存在しない場合は作成
      const branchDir = path.dirname(branchPath);
      await fs.mkdir(branchDir, { recursive: true });

      await fs.writeFile(branchPath, `${sha}\n`, "utf8");
    } catch (error) {
      if (error instanceof ReferenceRepositoryError) {
        throw error;
      }

      throw new ReferenceRepositoryError(
        `Failed to update HEAD: ${error instanceof Error ? error.message : String(error)}`,
        "IO_ERROR",
      );
    }
  }

  /**
   * 現在のブランチ名を取得
   * @returns ブランチ名、detached HEADの場合はnull
   */
  async getCurrentBranch(): Promise<string | null> {
    try {
      const headPath = path.join(this.gitDir, "HEAD");
      const headContent = await fs.readFile(headPath, "utf8");
      const trimmedContent = headContent.trim();

      if (trimmedContent.startsWith("ref: refs/heads/")) {
        return trimmedContent.substring(16); // "ref: refs/heads/"を除去
      }

      return null; // detached HEAD
    } catch (error) {
      throw new ReferenceRepositoryError(
        `Failed to get current branch: ${error instanceof Error ? error.message : String(error)}`,
        "IO_ERROR",
      );
    }
  }

  /**
   * 指定された参照を解決してSHAを取得
   * @param refName 参照名（例: refs/heads/main）
   * @returns 参照が指すコミットのSHA-1ハッシュ
   */
  async resolveRef(refName: string): Promise<string> {
    try {
      const refPath = path.join(this.gitDir, refName);
      const refContent = await fs.readFile(refPath, "utf8");
      const sha = refContent.trim();

      if (!this.isValidSha(sha)) {
        throw new ReferenceRepositoryError(
          `Invalid SHA-1 in reference ${refName}: ${sha}`,
          "INVALID_SHA",
        );
      }

      return sha;
    } catch (error) {
      if (error instanceof ReferenceRepositoryError) {
        throw error;
      }

      if (error instanceof Error && error.message.includes("ENOENT")) {
        throw new ReferenceRepositoryError(
          `Reference not found: ${refName}`,
          "REF_NOT_FOUND",
        );
      }

      throw new ReferenceRepositoryError(
        `Failed to resolve reference ${refName}: ${error instanceof Error ? error.message : String(error)}`,
        "IO_ERROR",
      );
    }
  }

  /**
   * SHA-1ハッシュの形式が正しいかチェック
   * @param sha チェックするSHA-1ハッシュ
   * @returns 正しい形式の場合true
   */
  private isValidSha(sha: string): boolean {
    return /^[0-9a-f]{40}$/i.test(sha);
  }
}
