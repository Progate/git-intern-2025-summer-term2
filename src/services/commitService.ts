import { Commit } from "../models/commit.js";
import { Tree } from "../models/tree.js";
import { IndexEntry, TreeNode } from "../models/types.js";
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
   * インデックスエントリから階層的Treeオブジェクトを構築
   * @param entries インデックスエントリの配列
   * @returns ルートTreeのSHA
   */
  private async buildTreeFromIndex(
    entries: Array<IndexEntry>,
  ): Promise<string> {
    try {
      if (entries.length === 0) {
        throw new Error("No staged files to commit");
      }

      // 1. ディレクトリ階層の構築
      const rootNode = this.buildDirectoryTree(entries);

      // 2. 階層的Treeオブジェクトの作成
      const rootTreeSha = await this.createTreeObject(rootNode);

      this.logger.debug(`Built hierarchical tree: ${rootTreeSha}`);
      return rootTreeSha;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to build hierarchical tree: ${errorMessage}`);
    }
  }

  /**
   * インデックスエントリからディレクトリ階層を構築
   * @param entries インデックスエントリの配列
   * @returns ルートディレクトリのTreeNode
   */
  private buildDirectoryTree(entries: Array<IndexEntry>): TreeNode {
    const root: TreeNode = {
      name: "",
      children: new Map(),
      type: "directory",
    };

    for (const entry of entries) {
      const pathParts = entry.path.split("/").filter((part) => part.length > 0);
      let currentNode = root;

      // パスを辿ってディレクトリ階層を構築
      for (let i = 0; i < pathParts.length; i++) {
        const part = pathParts[i];
        if (!part) continue; // 空文字列をスキップ

        const isLastPart = i === pathParts.length - 1;

        if (isLastPart) {
          // ファイルノード作成
          currentNode.children.set(part, {
            name: part,
            children: new Map(),
            entry,
            type: "file",
          });
        } else {
          // ディレクトリノード作成または取得
          if (!currentNode.children.has(part)) {
            currentNode.children.set(part, {
              name: part,
              children: new Map(),
              type: "directory",
            });
          }
          const nextNode = currentNode.children.get(part);
          if (nextNode) {
            currentNode = nextNode;
          }
        }
      }
    }

    return root;
  }

  /**
   * TreeNodeから実際のTreeオブジェクトを再帰的に作成
   * @param node 対象のTreeNode
   * @returns TreeオブジェクトのSHA
   */
  private async createTreeObject(node: TreeNode): Promise<string> {
    const treeEntries = [];

    // 子ノードを名前順でソート（Git仕様準拠：バイナリ順）
    const sortedChildren = Array.from(node.children.entries()).sort((a, b) => {
      if (a[0] < b[0]) return -1;
      if (a[0] > b[0]) return 1;
      return 0;
    });

    for (const [, child] of sortedChildren) {
      if (child.type === "file" && child.entry) {
        // ファイルエントリ
        treeEntries.push({
          mode: this.formatFileMode(child.entry.mode),
          name: child.name,
          sha: child.entry.objectId,
        });
      } else if (child.type === "directory") {
        // ディレクトリエントリ（再帰的に処理）
        const subTreeSha = await this.createTreeObject(child);
        treeEntries.push({
          mode: "040000", // ディレクトリモード
          name: child.name,
          sha: subTreeSha,
        });
      }
    }

    // Treeオブジェクト作成・保存
    const tree = new Tree(treeEntries);
    const treeSha = await this.objectRepo.write(tree);

    this.logger.debug(
      `Created tree object with ${String(treeEntries.length)} entries: ${treeSha}`,
    );
    return treeSha;
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
