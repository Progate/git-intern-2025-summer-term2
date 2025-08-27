import * as fs from "fs";

import { INDEX_VERSION } from "./constants.js";
import { FileTime, IndexEntry, IndexHeader } from "./types.js";

/**
 * Gitインデックス(.git/index)を表現するクラス
 * インデックスファイルの基本的な操作を提供する
 */
export class Index {
  private _version: number;
  // private _entries: Map<string, IndexEntry>; // TODO: 実装時に使用予定

  constructor(version: number = INDEX_VERSION) {
    this._version = version;
    // this._entries = new Map(); // TODO: 実装時に初期化予定
  }

  /**
   * インデックスのバージョン番号を取得
   * @returns バージョン番号
   */
  get version(): number {
    return this._version;
  }

  /**
   * エントリを追加または更新
   * @param _path ファイルパス
   * @param _entry インデックスエントリ
   */
  addEntry(_path: string, _entry: IndexEntry): void {
    // TODO: 実装予定
  }

  /**
   * エントリを削除
   * @param _path ファイルパス
   * @returns 削除されたかどうか
   */
  removeEntry(_path: string): boolean {
    // TODO: 実装予定
    return false;
  }

  /**
   * エントリを取得
   * @param _path ファイルパス
   * @returns インデックスエントリまたはundefined
   */
  getEntry(_path: string): IndexEntry | undefined {
    // TODO: 実装予定
    return undefined;
  }

  /**
   * 全てのエントリを取得 (パス順でソート)
   * @returns インデックスエントリの配列
   */
  getAllEntries(): Array<IndexEntry> {
    // TODO: 実装予定
    return [];
  }

  /**
   * エントリ数を取得
   * @returns エントリ数
   */
  getEntryCount(): number {
    // TODO: 実装予定
    return 0;
  }

  /**
   * インデックスヘッダーを生成
   * @returns インデックスヘッダー
   */
  getHeader(): IndexHeader {
    // TODO: 実装予定
    return {
      signature: "DIRC",
      version: this._version,
      entryCount: 0,
    };
  }

  /**
   * ファイルの統計情報からIndexEntryを作成
   * @param _path ファイルパス
   * @param _sha1 ファイルのSHA-1ハッシュ
   * @param _stats ファイル統計情報
   * @returns 新しいIndexEntry
   */
  static createEntryFromStats(
    _path: string,
    _sha1: string,
    _stats: fs.Stats,
  ): IndexEntry {
    // TODO: 実装予定
    throw new Error("Not implemented");
  }

  /**
   * Date/numberをFileTimeに変換
   * @param _timestamp タイムスタンプ
   * @returns FileTime
   */
  static timestampToFileTime(_timestamp: Date | number): FileTime {
    // TODO: 実装予定
    return { seconds: 0, nanoseconds: 0 };
  }
}
