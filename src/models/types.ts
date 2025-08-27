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
