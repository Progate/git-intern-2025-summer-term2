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
  sha: string; // SHA-1ハッシュ (40文字の16進文字列)
  flags: number; // フラグ (assume-valid, stage, nameLength等)
  path: string; // ファイルパス
}

// Indexのヘッダー情報
export interface IndexHeader {
  signature: string; // "DIRC"
  version: number; // バージョン番号 (2)
  entryCount: number; // エントリ数
}
