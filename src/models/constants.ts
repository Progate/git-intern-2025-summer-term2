// インデックスファイルの署名
export const INDEX_SIGNATURE = "DIRC";

// サポートされるインデックスのバージョン (バージョン2のみ)
export const INDEX_VERSION = 2;

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
