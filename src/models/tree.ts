import { GitObject } from "./gitObject.js";
import { GitObjectType, TreeEntry } from "./types.js";

/**
 * Treeオブジェクトクラス
 * ディレクトリ構造を表現するGitオブジェクト
 */
export class Tree extends GitObject {
  private readonly entries: Array<TreeEntry>;

  /** Treeオブジェクトを作成 */
  constructor(entries: Array<TreeEntry>) {
    super();
    this.entries = entries;
  }

  /** オブジェクトの種別を取得 */
  getType(): GitObjectType {
    return "tree";
  }

  /** オブジェクトの内容をバイナリ形式で取得 */
  getContent(): Buffer {
    const buffers: Array<Buffer> = [];

    // Git仕様に従ってエントリをソート（ディレクトリは名前+'/'でソート）
    const sortedEntries = [...this.entries].sort((a, b) => {
      // Gitのtree sortingルール: ディレクトリは名前に'/'を付けた状態でソート
      const nameA = a.mode.startsWith("040000") ? a.name + "/" : a.name;
      const nameB = b.mode.startsWith("040000") ? b.name + "/" : b.name;

      if (nameA < nameB) return -1;
      if (nameA > nameB) return 1;
      return 0;
    });

    for (const entry of sortedEntries) {
      // モードとファイル名を結合
      const modeAndName = Buffer.from(`${entry.mode} ${entry.name}\0`, "utf8");

      // SHA-1ハッシュをバイナリ形式に変換（40文字の16進数 → 20バイトのバイナリ）
      const shaBuffer = Buffer.from(entry.sha, "hex");

      buffers.push(modeAndName, shaBuffer);
    }

    return Buffer.concat(buffers as ReadonlyArray<Uint8Array>);
  }
}
