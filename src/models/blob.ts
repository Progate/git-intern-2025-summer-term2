import { GitObject } from "./gitObject.js";
import { GitObjectType } from "./types.js";

/**
 * Blobオブジェクトクラス
 * ファイルの生バイナリ内容を表現するGitオブジェクト
 */
export class Blob extends GitObject {
  private readonly content: Buffer;

  /** Blobオブジェクトを作成 */
  constructor(content: Buffer) {
    super();
    this.content = content;
  }

  /** オブジェクトの種別を取得 */
  getType(): GitObjectType {
    return "blob";
  }

  /** オブジェクトの内容を取得 */
  getContent(): Buffer {
    return this.content;
  }
}
