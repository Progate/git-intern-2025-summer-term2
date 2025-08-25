import { readFileSync } from "fs";
import { inflateSync } from "zlib";

/**
 * .git ディレクトリ関連のパス定数
 */
const GIT_OBJECTS_DIR = ".git/objects/";
const GIT_HEAD_FILE = ".git/HEAD";
const GIT_REF_PREFIX = ".git/";

/**
 * Gitのコミットオブジェクトを表現し、各属性を抽出するクラス
 */
class CommitObject {
  hash: string;
  parent?: string;
  author: string;
  date: string;
  message: string;

  /**
   * コンストラクタ
   * @param content コミットオブジェクトの内容
   * @param hash コミットハッシュ
   */
  constructor(content: string, hash: string) {
    this.hash = hash;
    const lines = content.split("\n");

    this.parent = this.parseParent(lines);
    this.author = this.parseAuthor(lines);
    this.date = this.parseDate(lines);
    this.message = this.parseMessage(lines);
  }

  /**
   * parent の抽出
   * @param lines コミットオブジェクトの各行
   * @returns 親コミットのハッシュ（存在しない場合はundefined）
   */
  private parseParent(lines: string[]): string | undefined {
    return lines[1]?.startsWith("parent ")
      ? lines[1].slice("parent ".length)
      : undefined;
  }

  /**
   * author の抽出
   * @param lines コミットオブジェクトの各行
   * @returns 著者名
   */
  private parseAuthor(lines: string[]): string {
    const authorLine = lines.find((line) => line.startsWith("author ")) || "";
    const authorMatch = authorLine.match(/^author (.+) (\d+) ([\+\-]\d{4})$/);
    return authorMatch && authorMatch[1] ? authorMatch[1] : "";
  }

  /**
   * date の抽出・フォーマット
   * @param lines コミットオブジェクトの各行
   * @returns 日付文字列
   */
  private parseDate(lines: string[]): string {
    const authorLine = lines.find((line) => line.startsWith("author ")) || "";
    const authorMatch = authorLine.match(/^author (.+) (\d+) ([\+\-]\d{4})$/);
    if (authorMatch && authorMatch[2]) {
      const unixTime = parseInt(authorMatch[2]);
      const timezone = authorMatch[3] || "";
      const date = new Date(unixTime * 1000);
      return `${date.toString().slice(0, 24)} ${timezone}`;
    }
    return "";
  }

  /**
   * message の抽出
   * @param lines コミットオブジェクトの各行
   * @returns コミットメッセージ
   */
  private parseMessage(lines: string[]): string {
    const emptyLineIndex = lines.findIndex((line) => line === "");
    return emptyLineIndex !== -1
      ? lines
          .slice(emptyLineIndex + 1)
          .join("\n")
          .trim()
      : "";
  }

  /**
   * git log形式の文字列に変換
   * @returns フォーマット済み文字列
   */
  toLogString(): string {
    return [
      `commit ${this.hash}`,
      `Author: ${this.author}`,
      `Date:   ${this.date}`,
      "",
      `    ${this.message}`,
    ].join("\n");
  }
}

/**
 * git logの出力生成を担うクラス
 */
class MyGitLog {
  /**
   * コミットオブジェクトの内容を取得する
   * @param refHash コミットハッシュ
   * @returns デコンプレスされたコミットオブジェクトの内容
   * @throws {Error} ファイルが存在しない場合やzlib解凍失敗時
   */
  private getCommitObject(refHash: string): string {
    const dirName = refHash.slice(0, 2);
    const fileName = refHash.slice(2);
    const path = `${GIT_OBJECTS_DIR}${dirName}/${fileName}`;
    const compressedObject = readFileSync(path);
    const decompressedObject = inflateSync(Uint8Array.from(compressedObject));
    const content = decompressedObject.toString("utf8");
    return content;
  }

  /**
   * 現在のブランチのコミットハッシュを取得する
   * @returns コミットハッシュ
   * @throws {Error} ファイルが存在しない場合やパース失敗時
   */
  private getCurrentCommitHash(): string {
    const headContent = readFileSync(GIT_HEAD_FILE, "utf8").trim();
    // memo: detached HEADを一旦考慮しない
    const ref = headContent.replace("ref: ", "");

    try {
      return readFileSync(`${GIT_REF_PREFIX}${ref}`, "utf8").trim();
    } catch (error: unknown) {
      if (error instanceof Error && (error as any).code === "ENOENT") {
        const branchName = ref.split("/").pop() || ref;
        throw new Error(
          `fatal: your current branch '${branchName}' does not have any commits yet`,
        );
      }
      throw error;
    }
  }

  /**
   * logの出力を生成する
   * @returns フォーマットされた文字列
   * @throws {Error} ファイル読み込みやパース失敗時
   */
  public generate(): string {
    const logs: string[] = [];

    try {
      let currentHash: string | undefined = this.getCurrentCommitHash();

      while (currentHash !== undefined) {
        const content = this.getCommitObject(currentHash);
        const commitObj: CommitObject = new CommitObject(content, currentHash);
        logs.push(commitObj.toLogString());
        currentHash = commitObj.parent;
      }

      return logs.join("\n\n");
    } catch (error: unknown) {
      if (error instanceof Error && error.message.startsWith("fatal:")) {
        return error.message;
      }
      throw error;
    }
  }
}

/**
 * git logコマンドの出力を返す関数
 * @returns フォーマット済みのlog文字列
 */
export const log = (): string => {
  const myGitLog = new MyGitLog();
  return myGitLog.generate();
};
