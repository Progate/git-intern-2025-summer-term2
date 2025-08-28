import * as crypto from "crypto";
import * as fs from "fs";

import {
  INDEX_CHECKSUM_SIZE,
  INDEX_ENTRY_SIZE,
  INDEX_HEADER_SIZE,
  INDEX_SIGNATURE,
  INDEX_VERSION,
} from "./constants.js";
import { FileTime, IndexEntry, IndexHeader } from "./types.js";

/**
 * Gitインデックス(.git/index)を表現するクラス
 * インデックスファイルの基本的な操作を提供する
 */
export class Index {
  private _version: number;
  private _entries: Map<string, IndexEntry>;

  constructor(version: number = INDEX_VERSION) {
    this._version = version;
    this._entries = new Map();
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
    this._entries.set(_path, _entry);
  }

  /**
   * エントリを削除
   * @param _path ファイルパス
   * @returns 削除されたかどうか
   */
  removeEntry(_path: string): boolean {
    return this._entries.delete(_path);
  }

  /**
   * エントリを取得
   * @param _path ファイルパス
   * @returns インデックスエントリまたはundefined
   */
  getEntry(_path: string): IndexEntry | undefined {
    return this._entries.get(_path);
  }

  /**
   * 全てのエントリを取得 (パス順でソート)
   * @returns インデックスエントリの配列
   */
  getAllEntries(): Array<IndexEntry> {
    const entries = Array.from(this._entries.values());
    // Git仕様に従ってバイナリ順（memcmp相当）でソート
    return entries.sort((a, b) => {
      // バイナリ比較（UTF-8バイト順）
      const pathA = a.path;
      const pathB = b.path;

      // 文字列比較でバイナリ順を実現
      if (pathA < pathB) return -1;
      if (pathA > pathB) return 1;
      return 0;
    });
  }

  /**
   * エントリ数を取得
   * @returns エントリ数
   */
  getEntryCount(): number {
    return this._entries.size;
  }

  /**
   * インデックスヘッダーを生成
   * @returns インデックスヘッダー
   */
  getHeader(): IndexHeader {
    return {
      signature: INDEX_SIGNATURE,
      version: this._version,
      entryCount: this.getEntryCount(),
    };
  }

  /**
   * ファイルの統計情報からIndexEntryを作成
   * @param _path ファイルパス
   * @param _objectId オブジェクト識別子
   * @param _stats ファイル統計情報
   * @returns 新しいIndexEntry
   */
  static createEntryFromStats(
    _path: string,
    _objectId: string,
    _stats: fs.Stats,
  ): IndexEntry {
    // Git Index flags を正しく構成
    const flags = Index.createFlags(_path.length);

    return {
      ctime: Index.timestampToFileTime(_stats.ctime),
      mtime: Index.timestampToFileTime(_stats.mtime),
      dev: _stats.dev,
      ino: _stats.ino,
      mode: _stats.mode,
      uid: _stats.uid,
      gid: _stats.gid,
      size: _stats.size,
      objectId: _objectId,
      flags,
      path: _path,
    };
  }

  /**
   * Date/numberをFileTimeに変換
   * @param _timestamp タイムスタンプ
   * @returns FileTime
   */
  static timestampToFileTime(_timestamp: Date | number): FileTime {
    let timestampMs: number;

    if (_timestamp instanceof Date) {
      timestampMs = _timestamp.getTime();
    } else {
      timestampMs = _timestamp;
    }

    const seconds = Math.floor(timestampMs / 1000);
    const nanoseconds = (timestampMs % 1000) * 1000000; // ミリ秒をナノ秒に変換

    return { seconds, nanoseconds };
  }

  /**
   * Git Index flagsフィールドを構成
   * @param nameLength パス名の長さ
   * @param stage ステージレベル (0-3)
   * @param assumeValid assume-validフラグ
   * @returns 構成されたflagsフィールド
   */
  static createFlags(
    nameLength: number,
    stage = 0,
    assumeValid = false,
  ): number {
    let flags = 0;

    // assume-valid flag (bit 15)
    if (assumeValid) {
      flags |= 0x8000;
    }

    // extended flag (bit 14) - version 2では常に0
    // flags |= 0x4000; // 設定しない

    // stage (bits 12-13)
    flags |= (stage & 0x3) << 12;

    // name length (bits 0-11)
    flags |= Math.min(nameLength, 0x0fff);

    return flags;
  }

  /**
   * インデックスをバイナリデータにシリアライズ
   * @returns バイナリデータ
   */
  serialize(): Buffer {
    // ヘッダーをシリアライズ
    const header = this.serializeHeader();

    // エントリをパス名順にソートしてシリアライズ
    const entries = this.getAllEntries();
    const entryBuffers: Array<Buffer> = [];

    for (const entry of entries) {
      entryBuffers.push(this.serializeEntry(entry));
    }

    // ヘッダーとエントリを結合
    const content = Buffer.concat([
      header,
      ...entryBuffers,
    ] as ReadonlyArray<Uint8Array>);

    // チェックサムを計算
    const checksum = crypto
      .createHash("sha1")
      .update(content as Uint8Array)
      .digest();

    // 最終的なバイナリデータを返す
    return Buffer.concat([content, checksum] as ReadonlyArray<Uint8Array>);
  }

  /**
   * インデックスをファイルに書き込み
   * @param indexPath インデックスファイルのパス
   */
  async toFile(indexPath: string): Promise<void> {
    const data = this.serialize();
    await fs.promises.writeFile(indexPath, data as Uint8Array);
  }

  /**
   * インデックスヘッダーをシリアライズ
   * @returns ヘッダーのバイナリデータ
   */
  private serializeHeader(): Buffer {
    const header = Buffer.allocUnsafe(INDEX_HEADER_SIZE);
    let offset = 0;

    // 署名 "DIRC" (4バイト)
    header.write(INDEX_SIGNATURE, offset, "ascii");
    offset += 4;

    // バージョン (4バイト)
    header.writeUInt32BE(this._version, offset);
    offset += 4;

    // エントリ数 (4バイト)
    header.writeUInt32BE(this.getEntryCount(), offset);

    return header;
  }

  /**
   * インデックスエントリをシリアライズ
   * @param entry インデックスエントリ
   * @returns エントリのバイナリデータ（パディング含む）
   */
  private serializeEntry(entry: IndexEntry): Buffer {
    // パディングサイズを計算
    const paddedSize = Index.calculatePaddedSize(entry.path.length);
    const buffer = Buffer.alloc(paddedSize); // ゼロで初期化
    let offset = 0;

    // ctime (8バイト)
    buffer.writeUInt32BE(entry.ctime.seconds, offset);
    buffer.writeUInt32BE(entry.ctime.nanoseconds, offset + 4);
    offset += 8;

    // mtime (8バイト)
    buffer.writeUInt32BE(entry.mtime.seconds, offset);
    buffer.writeUInt32BE(entry.mtime.nanoseconds, offset + 4);
    offset += 8;

    // dev, ino, mode, uid, gid, size (各4バイト = 24バイト)
    buffer.writeUInt32BE(entry.dev, offset);
    buffer.writeUInt32BE(entry.ino, offset + 4);
    buffer.writeUInt32BE(entry.mode, offset + 8);
    buffer.writeUInt32BE(entry.uid, offset + 12);
    buffer.writeUInt32BE(entry.gid, offset + 16);
    buffer.writeUInt32BE(entry.size, offset + 20);
    offset += 24;

    // SHA-1 (20バイト)
    if (entry.objectId.length !== 40) {
      throw new Error(
        `Invalid objectId: expected 40 characters, got ${entry.objectId.length.toString()}`,
      );
    }
    const objectIdBuffer = Buffer.from(entry.objectId, "hex");
    for (let i = 0; i < objectIdBuffer.length; i++) {
      const byte = objectIdBuffer[i];
      if (byte !== undefined) {
        buffer[offset + i] = byte;
      }
    }
    offset += 20;

    // flags (2バイト)
    buffer.writeUInt16BE(entry.flags, offset);
    offset += 2;

    // パス名 + NULL終端
    buffer.write(entry.path, offset, "utf8");
    // NULL終端はBuffer.alloc()で既にゼロクリアされているので明示的な設定不要

    return buffer;
  }

  /**
   * パス名の長さからパディング後のエントリサイズを計算
   * @param pathLength パス名の長さ
   * @returns パディング後のサイズ
   */
  private static calculatePaddedSize(pathLength: number): number {
    const entrySize = INDEX_ENTRY_SIZE.FIXED_SIZE + pathLength + 1; // +1 for null terminator
    return (
      Math.ceil(entrySize / INDEX_ENTRY_SIZE.ALIGNMENT) *
      INDEX_ENTRY_SIZE.ALIGNMENT
    );
  }

  /**
   * ファイルからインデックスを読み込み
   * @param indexPath インデックスファイルのパス
   * @returns Indexインスタンス
   */
  static async fromFile(indexPath: string): Promise<Index> {
    try {
      const data = await fs.promises.readFile(indexPath);
      return Index.deserialize(data);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        // ファイルが存在しない場合は新しいインデックスを作成
        return new Index();
      }
      throw error;
    }
  }

  /**
   * バイナリデータからインデックスをデシリアライズ
   * @param data バイナリデータ
   * @returns Indexインスタンス
   */
  static deserialize(data: Buffer): Index {
    // 最小サイズチェック（ヘッダー + チェックサム）
    if (data.length < INDEX_HEADER_SIZE + INDEX_CHECKSUM_SIZE) {
      throw new Error("Invalid index file: too short");
    }

    // チェックサムの検証
    const contentData = data.subarray(0, data.length - INDEX_CHECKSUM_SIZE);
    const expectedChecksum = data.subarray(data.length - INDEX_CHECKSUM_SIZE);
    const actualChecksum = crypto
      .createHash("sha1")
      .update(contentData as Uint8Array)
      .digest();

    if (!expectedChecksum.equals(actualChecksum as Uint8Array)) {
      throw new Error("Invalid index file: checksum mismatch");
    }

    // ヘッダーの解析
    const header = Index.parseHeader(contentData);

    // Indexインスタンスを作成
    const index = new Index(header.version);

    // エントリの解析
    let offset = INDEX_HEADER_SIZE;
    for (let i = 0; i < header.entryCount; i++) {
      if (offset >= contentData.length) {
        throw new Error(
          `Invalid index file: insufficient data for entry ${String(i)}`,
        );
      }

      const entry = Index.parseEntry(contentData, offset);
      index._entries.set(entry.path, entry);

      // 次のエントリのオフセットを計算（8バイト境界にアライン）
      const entrySize = INDEX_ENTRY_SIZE.FIXED_SIZE + entry.path.length + 1; // +1 for null terminator
      const paddedSize =
        Math.ceil(entrySize / INDEX_ENTRY_SIZE.ALIGNMENT) *
        INDEX_ENTRY_SIZE.ALIGNMENT;
      offset += paddedSize;
    }

    return index;
  }

  /**
   * インデックスヘッダーを解析
   * @param data バイナリデータ
   * @returns インデックスヘッダー
   */
  private static parseHeader(data: Buffer): IndexHeader {
    if (data.length < INDEX_HEADER_SIZE) {
      throw new Error("Invalid index file: header too short");
    }

    // 署名の確認
    const signature = data.toString("ascii", 0, 4);
    if (signature !== INDEX_SIGNATURE) {
      throw new Error(`Invalid index file: wrong signature "${signature}"`);
    }

    // バージョンとエントリ数の読み取り
    const version = data.readUInt32BE(4);
    const entryCount = data.readUInt32BE(8);

    return {
      signature,
      version,
      entryCount,
    };
  }

  /**
   * インデックスエントリを解析
   * @param data バイナリデータ
   * @param offset エントリの開始オフセット
   * @returns インデックスエントリ
   */
  private static parseEntry(data: Buffer, offset: number): IndexEntry {
    if (offset + INDEX_ENTRY_SIZE.FIXED_SIZE > data.length) {
      throw new Error(
        `Invalid index file: entry data too short at offset ${String(offset)}`,
      );
    }

    let pos = offset;

    // ctime (8バイト)
    const ctimeSeconds = data.readUInt32BE(pos);
    const ctimeNanoseconds = data.readUInt32BE(pos + 4);
    pos += 8;

    // mtime (8バイト)
    const mtimeSeconds = data.readUInt32BE(pos);
    const mtimeNanoseconds = data.readUInt32BE(pos + 4);
    pos += 8;

    // dev, ino, mode, uid, gid, size (各4バイト = 24バイト)
    const dev = data.readUInt32BE(pos);
    const ino = data.readUInt32BE(pos + 4);
    const mode = data.readUInt32BE(pos + 8);
    const uid = data.readUInt32BE(pos + 12);
    const gid = data.readUInt32BE(pos + 16);
    const size = data.readUInt32BE(pos + 20);
    pos += 24;

    // SHA-1 (20バイト)
    const objectId = data.subarray(pos, pos + 20).toString("hex");
    pos += 20;

    // flags (2バイト)
    const flags = data.readUInt16BE(pos);
    pos += 2;

    // パス名の長さを取得
    const nameLength = flags & 0x0fff; // 下位12ビット

    // パス名を読み取り
    let pathEndPos = pos;
    if (nameLength < 0x0fff) {
      // 名前の長さが指定されている場合
      pathEndPos = pos + nameLength;
    } else {
      // 名前の長さが0xFFFの場合、NULL終端まで読む
      while (pathEndPos < data.length && data[pathEndPos] !== 0) {
        pathEndPos++;
      }
    }

    if (pathEndPos > data.length) {
      throw new Error(
        `Invalid index file: path extends beyond data at offset ${String(offset)}`,
      );
    }

    const path = data.toString("utf8", pos, pathEndPos);

    return {
      ctime: { seconds: ctimeSeconds, nanoseconds: ctimeNanoseconds },
      mtime: { seconds: mtimeSeconds, nanoseconds: mtimeNanoseconds },
      dev,
      ino,
      mode,
      uid,
      gid,
      size,
      objectId,
      flags,
      path,
    };
  }
}
