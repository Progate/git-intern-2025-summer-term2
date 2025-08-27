// インデックスファイルの署名
export const INDEX_SIGNATURE = "DIRC";

// サポートされるインデックスのバージョン (バージョン2のみ)
export const INDEX_VERSION = 2;

// ファイルモードの定数
export const FILE_MODES = {
  // 通常のファイル (読み取り可能)
  REGULAR_FILE: 0o100644,
  // 実行可能ファイル
  EXECUTABLE_FILE: 0o100755,
  // シンボリックリンク
  SYMLINK: 0o120000,
  // Gitlink (submodule) - sparse-checkoutでディレクトリエントリとしても使用
  GITLINK: 0o160000,
} as const;

// ファイルモードのビット構造 (32ビット)
export const FILE_MODE_BITS = {
  // オブジェクトタイプ (4ビット, ビット12-15)
  OBJECT_TYPE_MASK: 0xf000,
  REGULAR_FILE_TYPE: 0x8000, // 1000 (binary)
  SYMLINK_TYPE: 0xa000, // 1010 (binary)
  GITLINK_TYPE: 0xe000, // 1110 (binary)

  // Unix権限 (9ビット, ビット0-8)
  PERMISSION_MASK: 0x01ff,
  PERMISSION_644: 0o644, // rw-r--r--
  PERMISSION_755: 0o755, // rwxr-xr-x
} as const;

// インデックスエントリのフラグ (16ビット) - バージョン2
export const INDEX_ENTRY_FLAGS = {
  // assume-valid flag (1ビット)
  ASSUME_VALID: 0x8000, // ビット15

  // 拡張フラグ (1ビット) - バージョン2では常に0
  EXTENDED_FLAG: 0x4000, // ビット14 (バージョン2では使用しない)

  // ステージレベル (2ビット)
  STAGE_MASK: 0x3000, // ビット12-13
  STAGE_0: 0x0000, // 通常のファイル
  STAGE_1: 0x1000, // base (merge conflict)
  STAGE_2: 0x2000, // ours (merge conflict)
  STAGE_3: 0x3000, // theirs (merge conflict)

  // パス名の長さ (12ビット)
  NAME_LENGTH_MASK: 0x0fff, // ビット0-11
} as const;

// エントリサイズの定数
export const INDEX_ENTRY_SIZE = {
  // 固定部分のサイズ (バイト)
  FIXED_SIZE: 62,
  // エントリの最小サイズ
  MIN_SIZE: 62,
  // エントリは8バイト境界にアライン
  ALIGNMENT: 8,
} as const;

// ヘッダーサイズ
export const INDEX_HEADER_SIZE = 12;

// チェックサムサイズ (SHA-1)
export const INDEX_CHECKSUM_SIZE = 20;
