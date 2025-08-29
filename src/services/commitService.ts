import { Commit } from "../models/commit.js";
import { Tree } from "../models/tree.js";
import { IndexEntry } from "../models/types.js";
import { ConfigRepository } from "../repositories/configRepository.js";
import { IndexRepository } from "../repositories/indexRepository.js";
import { ObjectRepository } from "../repositories/objectRepository.js";
import { ReferenceRepository } from "../repositories/referenceRepository.js";
import { Logger, defaultLogger } from "../utils/logger.js";

/**
 * commitコマンドのビジネスロジックを担当するサービス
 */
export class CommitService {
  constructor(
    private readonly indexRepo: IndexRepository,
    private readonly objectRepo: ObjectRepository,
    private readonly referenceRepo: ReferenceRepository,
    private readonly configRepo: ConfigRepository,
    private readonly logger: Logger = defaultLogger,
  ) {}

  /**
   * コミットを作成・保存し、HEADを更新
   * @param message コミットメッセージ
   * @returns 新しいコミットのSHA
   */
  public async execute(message: string): Promise<string> {
    try {
      // 1. メッセージバリデーション
      if (!message.trim()) {
        throw new Error("Commit message cannot be empty");
      }

      this.logger.debug(`Creating commit with message: "${message}"`);

      // 2. インデックス読み込み
      const entries = this.indexRepo.getAllEntries();
      if (entries.length === 0) {
        throw new Error("No staged files to commit");
      }

      this.logger.debug(`Found ${String(entries.length)} staged entries`);

      // 3. Tree構築（フラット構造のみ）
      const rootTreeSha = await this.buildTreeFromIndex(entries);
      this.logger.debug(`Created root tree: ${rootTreeSha}`);

      // 4. 親コミット取得
      let parentCommitSha: string | null;
      try {
        parentCommitSha = await this.referenceRepo.resolveHead();
        this.logger.debug(
          `Parent commit: ${parentCommitSha || "none (initial commit)"}`,
        );
      } catch {
        parentCommitSha = null; // 初回コミット
        this.logger.debug("Initial commit (no parent)");
      }

      // 5. ユーザー設定取得
      const userConfig = this.configRepo.getUserConfig();
      if (!userConfig?.name || !userConfig.email) {
        throw new Error("User name and email must be configured");
      }

      this.logger.debug(
        `User config: ${String(userConfig.name)} <${String(userConfig.email)}>`,
      );

      // 6. コミットオブジェクト作成
      const commit = new Commit(
        rootTreeSha,
        parentCommitSha ? [parentCommitSha] : [],
        userConfig,
        userConfig, // author === committer
        message,
      );

      // 7. コミットオブジェクト保存
      const commitSha = await this.objectRepo.write(commit);
      this.logger.debug(`Saved commit object: ${commitSha}`);

      // 8. HEAD更新
      await this.referenceRepo.updateHead(commitSha);
      this.logger.debug(`Updated HEAD to: ${commitSha}`);

      return commitSha;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to create commit: ${errorMessage}`);
      throw new Error(`Failed to create commit: ${errorMessage}`);
    }
  }

  /**
   * インデックスエントリからTreeオブジェクトを構築
   * 現在はフラット構造のみ対応（PR1の範囲）
   * @param entries インデックスエントリの配列
   * @returns ルートTreeのSHA
   */
  private async buildTreeFromIndex(
    entries: Array<IndexEntry>,
  ): Promise<string> {
    try {
      // PR1: シンプルなフラット構造のみ対応
      // 全ファイルが同一ディレクトリにある前提で処理
      const treeEntries = entries.map((entry) => ({
        mode: this.formatFileMode(entry.mode),
        name: entry.path.split("/").pop() ?? entry.path, // ファイル名のみ取得
        sha: entry.objectId,
      }));

      // TreeEntryをソート（Git仕様準拠）
      treeEntries.sort((a, b) => a.name.localeCompare(b.name));

      // Treeオブジェクト作成・保存
      const tree = new Tree(treeEntries);
      const treeSha = await this.objectRepo.write(tree);

      this.logger.debug(
        `Built tree with ${String(treeEntries.length)} entries: ${treeSha}`,
      );
      return treeSha;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to build tree from index: ${errorMessage}`);
    }
  }

  /**
   * ファイルモードを適切な形式に変換
   * @param mode 数値形式のファイルモード
   * @returns 文字列形式のファイルモード
   */
  private formatFileMode(mode: number): string {
    // 通常ファイル: 100644, 実行可能ファイル: 100755
    if (mode & 0o100000) {
      return mode & 0o111 ? "100755" : "100644";
    }
    // その他のモード（今後の拡張用）
    return mode.toString(8).padStart(6, "0");
  }
}
