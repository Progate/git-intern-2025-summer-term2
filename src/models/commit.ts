import { GitObject } from "./gitObject.js";
import { GitActor, GitObjectType } from "./types.js";

/**
 * Commitオブジェクトクラス
 * コミット情報を表現するGitオブジェクト
 */
export class Commit extends GitObject {
  private readonly tree: string;
  private readonly parents: Array<string>;
  private readonly author: GitActor;
  private readonly committer: GitActor;
  private readonly message: string;

  /** Commitオブジェクトを作成 */
  constructor(
    tree: string,
    parents: Array<string>,
    author: GitActor,
    committer: GitActor,
    message: string,
  ) {
    super();
    this.tree = tree;
    this.parents = parents;
    this.author = author;
    this.committer = committer;
    this.message = message;
  }

  /** オブジェクトの種別を取得 */
  getType(): GitObjectType {
    return "commit";
  }

  /** オブジェクトの内容をテキスト形式で取得 */
  getContent(): Buffer {
    const lines: Array<string> = [];

    // ツリーの情報
    lines.push(`tree ${this.tree}`);

    // 親コミットの情報
    for (const parent of this.parents) {
      lines.push(`parent ${parent}`);
    }

    // 作者情報
    const authorTimestamp = Math.floor(this.author.timestamp.getTime() / 1000);
    const authorTimezone = this.formatTimezone(this.author.timestamp);
    lines.push(
      `author ${this.author.name} <${this.author.email}> ${authorTimestamp.toString()} ${authorTimezone}`,
    );

    // コミッター情報
    const committerTimestamp = Math.floor(
      this.committer.timestamp.getTime() / 1000,
    );
    const committerTimezone = this.formatTimezone(this.committer.timestamp);
    lines.push(
      `committer ${this.committer.name} <${this.committer.email}> ${committerTimestamp.toString()} ${committerTimezone}`,
    );

    // 空行とメッセージ
    lines.push("");
    lines.push(this.message);

    return Buffer.from(lines.join("\n"), "utf8");
  }

  /** タイムゾーンを+HHMM形式でフォーマット */
  private formatTimezone(date: Date): string {
    const offset = -date.getTimezoneOffset();
    const sign = offset >= 0 ? "+" : "-";
    const hours = Math.floor(Math.abs(offset) / 60)
      .toString()
      .padStart(2, "0");
    const minutes = (Math.abs(offset) % 60).toString().padStart(2, "0");
    return `${sign}${hours}${minutes}`;
  }

  /** 親コミットのSHA配列を取得 */
  getParents(): Array<string> {
    return this.parents;
  }

  /** 作者情報を取得 */
  getAuthor(): GitActor {
    return this.author;
  }

  /** コミットメッセージを取得 */
  getMessage(): string {
    return this.message;
  }

  /** ツリーのSHAを取得 */
  getTree(): string {
    return this.tree;
  }

  /** コミッター情報を取得 */
  getCommitter(): GitActor {
    return this.committer;
  }
}
