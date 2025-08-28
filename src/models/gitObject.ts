import * as crypto from "crypto";

import { GitObjectType } from "./types.js";

/**
 * Gitオブジェクトの抽象基底クラス
 * 全てのGitオブジェクト（Blob, Tree, Commit）の共通機能を提供
 */
export abstract class GitObject {
  /** オブジェクトの種別を取得する抽象メソッド */
  abstract getType(): GitObjectType;

  /** オブジェクトの内容をバイナリ形式で取得する抽象メソッド */
  abstract getContent(): Buffer;

  /**
   * オブジェクトをGit標準形式でシリアライズ
   * 形式: "<type> <size>\0<content>"
   */
  serialize(): Buffer {
    const type = this.getType();
    const content = this.getContent();
    const header = Buffer.from(
      `${type} ${content.length.toString()}\0`,
      "utf8",
    );

    return Buffer.concat([header, content] as ReadonlyArray<Uint8Array>);
  }

  /** オブジェクトのSHA-1ハッシュを計算 */
  getSha(): string {
    const serialized = this.serialize();
    return crypto
      .createHash("sha1")
      .update(new Uint8Array(serialized))
      .digest("hex");
  }

  /** バイナリデータからGitオブジェクトを復元 */
  static async deserialize(data: Buffer): Promise<GitObject> {
    // ヘッダーとコンテンツを分離
    const nullIndex = data.indexOf(0);
    if (nullIndex === -1) {
      throw new Error("Invalid git object format: null separator not found");
    }

    const header = data.subarray(0, nullIndex).toString("utf8");
    const content = data.subarray(nullIndex + 1);

    // ヘッダーから型とサイズを取得
    const spaceIndex = header.indexOf(" ");
    if (spaceIndex === -1) {
      throw new Error("Invalid git object header format");
    }

    const type = header.substring(0, spaceIndex) as GitObjectType;
    const size = parseInt(header.substring(spaceIndex + 1), 10);

    if (content.length !== size) {
      throw new Error(
        `Content size mismatch: expected ${size.toString()}, got ${content.length.toString()}`,
      );
    }

    // 型に応じて適切な具象クラスのインスタンスを生成
    switch (type) {
      case "blob":
        return GitObject.deserializeBlob(content);
      case "tree":
        return GitObject.deserializeTree(content);
      case "commit":
        return GitObject.deserializeCommit(content);
      default:
        throw new Error(`Unknown git object type: ${String(type)}`);
    }
  }

  /** Blobオブジェクトのデシリアライゼーション */
  private static async deserializeBlob(content: Buffer): Promise<GitObject> {
    const { Blob } = await import("./blob.js");
    return new Blob(content);
  }

  /** Treeオブジェクトのデシリアライゼーション */
  private static async deserializeTree(content: Buffer): Promise<GitObject> {
    const { Tree } = await import("./tree.js");

    const entries: Array<{ mode: string; name: string; sha: string }> = [];
    let offset = 0;

    while (offset < content.length) {
      // モードとファイル名を読み取り（null文字まで）
      const nullIndex = content.indexOf(0, offset);
      if (nullIndex === -1) {
        throw new Error("Invalid tree entry format: null separator not found");
      }

      const modeAndName = content.subarray(offset, nullIndex).toString("utf8");
      const spaceIndex = modeAndName.indexOf(" ");
      if (spaceIndex === -1) {
        throw new Error("Invalid tree entry format: space separator not found");
      }

      const mode = modeAndName.substring(0, spaceIndex);
      const name = modeAndName.substring(spaceIndex + 1);

      // SHA-1ハッシュを読み取り（20バイト）
      const shaStart = nullIndex + 1;
      const shaEnd = shaStart + 20;
      if (shaEnd > content.length) {
        throw new Error("Invalid tree entry format: incomplete SHA hash");
      }

      const sha = content.subarray(shaStart, shaEnd).toString("hex");

      entries.push({ mode, name, sha });
      offset = shaEnd;
    }

    return new Tree(entries);
  }

  /** Commitオブジェクトのデシリアライゼーション */
  private static async deserializeCommit(content: Buffer): Promise<GitObject> {
    const { Commit } = await import("./commit.js");

    const text = content.toString("utf8");
    const lines = text.split("\n");

    let tree = "";
    const parents: Array<string> = [];
    let author: { name: string; email: string; timestamp: Date } | null = null;
    let committer: { name: string; email: string; timestamp: Date } | null =
      null;
    let messageStartIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (!line || line === "") {
        messageStartIndex = i + 1;
        break;
      }

      if (line.startsWith("tree ")) {
        tree = line.substring(5);
      } else if (line.startsWith("parent ")) {
        parents.push(line.substring(7));
      } else if (line.startsWith("author ")) {
        author = GitObject.parseActorLine(line.substring(7));
      } else if (line.startsWith("committer ")) {
        committer = GitObject.parseActorLine(line.substring(10));
      }
    }

    if (!tree || !author || !committer || messageStartIndex === -1) {
      throw new Error("Invalid commit format: missing required fields");
    }

    const message = lines.slice(messageStartIndex).join("\n");

    return new Commit(tree, parents, author, committer, message);
  }

  /** 作者/コミッター情報をパース */
  private static parseActorLine(line: string): {
    name: string;
    email: string;
    timestamp: Date;
  } {
    // フォーマット: "Name <email> timestamp timezone"
    const emailRegex = /^(.+) <(.+)> (\d+) ([+-]\d{4})$/;
    const emailMatch = emailRegex.exec(line);
    if (!emailMatch) {
      throw new Error(`Invalid actor format: ${line}`);
    }

    const name = emailMatch[1];
    const email = emailMatch[2];
    const timestampStr = emailMatch[3];

    if (!name || !email || !timestampStr) {
      throw new Error(`Invalid actor format: ${line}`);
    }

    const timestamp = new Date(parseInt(timestampStr, 10) * 1000);

    return { name, email, timestamp };
  }
}
