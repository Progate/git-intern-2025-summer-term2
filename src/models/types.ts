// ファイルの時刻情報 (Unix時刻 + ナノ秒)
export interface FileTime {
  seconds: number; // Unix時刻 (秒)
  nanoseconds: number; // ナノ秒部分
}

// Gitインデックスエントリ
export interface IndexEntry {
  ctime: FileTime; // 作成時刻
  mtime: FileTime; // 変更時刻
  dev: number; // デバイス番号
  ino: number; // inode番号
  mode: number; // ファイルモード (例: 0o100644)
  uid: number; // ユーザーID
  gid: number; // グループID
  size: number; // ファイルサイズ
  objectId: string; // Object identifier (40文字の16進文字列)
  flags: number; // フラグ (assume-valid, stage, nameLength等)
  path: string; // ファイルパス
}

// Indexのヘッダー情報
export interface IndexHeader {
  signature: string; // "DIRC"
  version: number; // バージョン番号 (2)
  entryCount: number; // エントリ数
}

/** Gitオブジェクトの種別を表す型 */
export type GitObjectType = "blob" | "tree" | "commit";

/**
 * ツリーエントリのインターフェース
 * ディレクトリ内のファイル・ディレクトリを表現
 */
export interface TreeEntry {
  /** ファイルモード (例: '100644', '040000', '100755') */
  mode: string;
  /** ファイル/ディレクトリ名 */
  name: string;
  /** 対応するBlob/TreeのSHA-1ハッシュ */
  sha: string;
}

/** 作者・コミッター情報のインターフェース */
export interface GitActor {
  /** 作者/コミッター名 */
  name: string;
  /** メールアドレス */
  email: string;
  /** タイムスタンプ */
  timestamp: Date;
}

/** ワーキングディレクトリのファイル状態を表す型 */
export type WorkdirStatus = "untracked" | "modified" | "deleted" | "unmodified";
