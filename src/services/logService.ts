import { Commit } from "../models/commit.js";
import { ObjectRepository } from "../repositories/objectRepository.js";
import { ReferenceRepository } from "../repositories/referenceRepository.js";

/**
 * logコマンドのビジネスロジックを担当するサービス
 */
export class LogService {
  constructor(
    private readonly objectRepo: ObjectRepository,
    private readonly referenceRepo: ReferenceRepository,
  ) {}

  /**
   * コミット履歴を表示
   */
  public async execute(): Promise<void> {
    try {
      // HEADが指すコミットのSHAを取得
      const headSha = await this.referenceRepo.resolveHead();

      if (!headSha) {
        console.log("No commits found.");
        return;
      }

      // コミット履歴を収集
      const commitHistory = await this.collectCommitHistory(headSha);

      // 各コミットを表示（最新から順）
      for (const { sha, commit } of commitHistory) {
        console.log(this.formatCommit(commit, sha));
        console.log(); // 空行でコミット間を区切り
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to retrieve commit history: ${errorMessage}`);
    }
  }

  /**
   * 指定されたSHAから親コミットを辿って履歴を収集
   * @param startSha 開始コミットのSHA
   * @returns コミット履歴の配列
   */
  private async collectCommitHistory(
    startSha: string,
  ): Promise<Array<{ sha: string; commit: Commit }>> {
    const history: Array<{ sha: string; commit: Commit }> = [];
    const visited = new Set<string>();

    // 幅優先探索でコミット履歴を収集
    const queue = [startSha];

    while (queue.length > 0) {
      const currentSha = queue.shift();

      if (!currentSha) {
        break;
      }

      // 既に処理済みの場合はスキップ
      if (visited.has(currentSha)) {
        continue;
      }

      visited.add(currentSha);

      try {
        // コミットオブジェクトを読み込み
        const gitObject = await this.objectRepo.read(currentSha);

        if (!(gitObject instanceof Commit)) {
          console.warn(`Warning: ${currentSha} is not a commit object`);
          continue;
        }

        const commit = gitObject;
        history.push({ sha: currentSha, commit });

        // 親コミットをキューに追加
        for (const parentSha of commit.getParents()) {
          if (!visited.has(parentSha)) {
            queue.push(parentSha);
          }
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.warn(
          `Warning: Failed to read commit ${currentSha}: ${errorMessage}`,
        );
        continue;
      }
    }

    return history;
  }

  /**
   * コミット情報を表示用に整形
   * @param commit Commitオブジェクト
   * @param sha コミットのSHA
   * @returns 整形された文字列
   */
  private formatCommit(commit: Commit, sha: string): string {
    const lines = [];

    // コミットSHA（短縮形）
    lines.push(`commit ${sha}`);

    // 作者情報
    const author = commit.getAuthor();
    lines.push(`Author: ${author.name} <${author.email}>`);

    // 日時
    const date = author.timestamp
      .toISOString()
      .replace("T", " ")
      .substring(0, 19);
    lines.push(`Date:   ${date}`);

    // 空行
    lines.push("");

    // コミットメッセージ（インデント付き）
    const messageLines = commit.getMessage().trim().split("\n");
    for (const line of messageLines) {
      lines.push(`    ${line}`);
    }

    return lines.join("\n");
  }

  /**
   * コミット履歴の統計情報を取得（将来の拡張用）
   */
  public async getCommitStats(sha: string): Promise<{
    totalCommits: number;
    authors: Set<string>;
    dateRange: { earliest: Date; latest: Date };
  }> {
    const history = await this.collectCommitHistory(sha);
    const authors = new Set<string>();
    let earliest = new Date();
    let latest = new Date(0);

    for (const { commit } of history) {
      const author = commit.getAuthor();
      authors.add(`${author.name} <${author.email}>`);

      const commitDate = author.timestamp;
      if (commitDate < earliest) {
        earliest = commitDate;
      }
      if (commitDate > latest) {
        latest = commitDate;
      }
    }

    return {
      totalCommits: history.length,
      authors,
      dateRange: { earliest, latest },
    };
  }
}
