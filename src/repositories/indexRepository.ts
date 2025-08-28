import * as fs from "fs";
import * as path from "path";

import { Index } from "../models/gitIndex.js";
import { IndexEntry } from "../models/types.js";

/**
 * IndexRepositoryで発生するエラーを表すクラス
 */
export class IndexRepositoryError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "IndexRepositoryError";
  }
}

/**
 * .git/indexファイルの読み書きを抽象化するクラス
 * Indexクラスと上位層の橋渡し役を担当
 */
export class IndexRepository {
  private readonly indexPath: string;
  private index: Index;

  /**
   * IndexRepositoryのコンストラクタ
   * @param gitDir .gitディレクトリのパス
   * @param index Indexインスタンス
   */
  private constructor(gitDir: string, index: Index) {
    this.indexPath = path.join(gitDir, "index");
    this.index = index;
  }

  /**
   * .git/indexファイルからIndexRepositoryインスタンスを作成
   * @param gitDir .gitディレクトリのパス
   * @returns IndexRepositoryインスタンス
   */
  static async read(gitDir: string): Promise<IndexRepository> {
    try {
      const indexPath = path.join(gitDir, "index");

      // IndexクラスのfromFileメソッドを使用してIndexインスタンスを作成
      const index = await Index.fromFile(indexPath);

      return new IndexRepository(gitDir, index);
    } catch (error) {
      if (error instanceof Error) {
        throw new IndexRepositoryError(
          `Failed to read index file: ${error.message}`,
          "READ_ERROR",
        );
      }
      throw new IndexRepositoryError(
        `Failed to read index file: ${String(error)}`,
        "READ_ERROR",
      );
    }
  }

  /**
   * メモリ上の変更を.git/indexファイルに永続化
   */
  async write(): Promise<void> {
    try {
      // IndexクラスのtoFileメソッドを使用してファイルに書き込み
      await this.index.toFile(this.indexPath);
    } catch (error) {
      if (error instanceof Error) {
        throw new IndexRepositoryError(
          `Failed to write index file: ${error.message}`,
          "WRITE_ERROR",
        );
      }
      throw new IndexRepositoryError(
        `Failed to write index file: ${String(error)}`,
        "WRITE_ERROR",
      );
    }
  }

  /**
   * 指定パスのエントリを取得
   * @param filepath ファイルパス
   * @returns インデックスエントリまたはundefined
   */
  getEntry(filepath: string): IndexEntry | undefined {
    return this.index.getEntry(filepath);
  }

  /**
   * エントリを追加または更新
   * @param filepath ファイルパス
   * @param sha オブジェクトのSHA-1ハッシュ
   * @param stats ファイル統計情報
   */
  add(filepath: string, sha: string, stats: fs.Stats): void {
    try {
      // Indexクラスの静的メソッドを使用してIndexEntryを作成
      const entry = Index.createEntryFromStats(filepath, sha, stats);

      // エントリを追加
      this.index.addEntry(filepath, entry);
    } catch (error) {
      if (error instanceof Error) {
        throw new IndexRepositoryError(
          `Failed to add entry for ${filepath}: ${error.message}`,
          "ADD_ERROR",
        );
      }
      throw new IndexRepositoryError(
        `Failed to add entry for ${filepath}: ${String(error)}`,
        "ADD_ERROR",
      );
    }
  }

  /**
   * エントリを削除
   * @param filepath ファイルパス
   * @returns 削除されたかどうか
   */
  remove(filepath: string): boolean {
    try {
      return this.index.removeEntry(filepath);
    } catch (error) {
      if (error instanceof Error) {
        throw new IndexRepositoryError(
          `Failed to remove entry for ${filepath}: ${error.message}`,
          "REMOVE_ERROR",
        );
      }
      throw new IndexRepositoryError(
        `Failed to remove entry for ${filepath}: ${String(error)}`,
        "REMOVE_ERROR",
      );
    }
  }

  /**
   * 全てのエントリを取得（パス順でソート済み）
   * @returns インデックスエントリの配列
   */
  getAllEntries(): Array<IndexEntry> {
    return this.index.getAllEntries();
  }

  /**
   * エントリ数を取得
   * @returns エントリ数
   */
  getEntryCount(): number {
    return this.index.getEntryCount();
  }

  /**
   * インデックスのバージョン番号を取得
   * @returns バージョン番号
   */
  getVersion(): number {
    return this.index.version;
  }

  /**
   * 指定されたパスのエントリが存在するかチェック
   * @param filepath ファイルパス
   * @returns エントリが存在する場合true
   */
  hasEntry(filepath: string): boolean {
    return this.getEntry(filepath) !== undefined;
  }

  /**
   * インデックスが空かどうかをチェック
   * @returns インデックスが空の場合true
   */
  isEmpty(): boolean {
    return this.getEntryCount() === 0;
  }
}
