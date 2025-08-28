import * as fs from "fs/promises";

import { GitActor } from "../models/types.js";

/**
 * Git設定ファイル(.git/config)の読み取りを担当するリポジトリクラス
 * INI形式の設定ファイルをパースし、ユーザー設定やコア設定を提供する
 */
export class ConfigRepository {
  private config: Map<string, Map<string, string>>;
  private configPath: string;

  /**
   * ConfigRepositoryインスタンスを作成
   * @param configPath 設定ファイルのパス
   * @param config パース済みの設定データ
   */
  private constructor(
    configPath: string,
    config: Map<string, Map<string, string>>,
  ) {
    this.configPath = configPath;
    this.config = config;
  }

  /**
   * 設定ファイルからConfigRepositoryインスタンスを作成する静的ファクトリーメソッド
   * @param configPath 設定ファイルのパス
   * @returns ConfigRepositoryインスタンス
   */
  static async read(configPath: string): Promise<ConfigRepository> {
    try {
      const content = await fs.readFile(configPath, "utf-8");
      const config = ConfigRepository.parseConfig(content);
      return new ConfigRepository(configPath, config);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        // ファイルが存在しない場合は空の設定で初期化
        const emptyConfig = new Map<string, Map<string, string>>();
        return new ConfigRepository(configPath, emptyConfig);
      }
      throw error;
    }
  }

  /**
   * ユーザー設定（user.name、user.email）を取得
   * @returns GitActorオブジェクト、または設定が不完全な場合はundefined
   */
  getUserConfig(): GitActor | undefined {
    const userSection = this.config.get("user");
    if (!userSection) {
      return undefined;
    }

    const name = userSection.get("name");
    const email = userSection.get("email");

    // 名前とメールアドレスの両方が設定されている場合のみ有効
    if (name && email) {
      return {
        name: name.trim(),
        email: email.trim(),
        timestamp: new Date(), // タイムスタンプは呼び出し時に設定
      };
    }

    return undefined;
  }

  /**
   * コア設定を取得（将来的な拡張用）
   * @returns コア設定オブジェクト
   */
  getCoreConfig(): { compression: number; fileMode: boolean } {
    const coreSection = this.config.get("core");
    const defaults = { compression: 1, fileMode: true };

    if (!coreSection) {
      return defaults;
    }

    const compression = coreSection.get("compression");
    const fileMode = coreSection.get("filemode");

    return {
      compression: compression
        ? parseInt(compression, 10)
        : defaults.compression,
      fileMode: fileMode
        ? fileMode.toLowerCase() === "true"
        : defaults.fileMode,
    };
  }

  /**
   * INI形式の設定ファイル内容をパース
   * @param content ファイル内容
   * @returns パース済みの設定データ（セクション名 -> キー-値のマップ）
   */
  private static parseConfig(
    content: string,
  ): Map<string, Map<string, string>> {
    const config = new Map<string, Map<string, string>>();
    const lines = content.split("\n");
    let currentSection: string | null = null;

    // 正規表現をコンパイル時に定義
    const sectionPattern = /^\[([^\]]+)\]$/;
    const keyValuePattern = /^([^=]+)=(.*)$/;

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];
      if (!line) continue; // undefined チェック

      const trimmedLine = line.trim();

      // 空行またはコメント行をスキップ
      if (
        trimmedLine === "" ||
        trimmedLine.startsWith("#") ||
        trimmedLine.startsWith(";")
      ) {
        continue;
      }

      // セクションヘッダーの検出 [section_name]
      const sectionMatch = sectionPattern.exec(trimmedLine);
      if (sectionMatch?.[1]) {
        currentSection = sectionMatch[1].toLowerCase();
        if (!config.has(currentSection)) {
          config.set(currentSection, new Map<string, string>());
        }
        continue;
      }

      // キー-値ペアの検出 key = value
      const keyValueMatch = keyValuePattern.exec(trimmedLine);
      if (keyValueMatch?.[1] && keyValueMatch[2] && currentSection) {
        const key = keyValueMatch[1].trim().toLowerCase();
        const value = keyValueMatch[2].trim();

        // 値が引用符で囲まれている場合は除去
        const cleanValue = value.replace(/^["'](.*)["']$/, "$1");

        const sectionMap = config.get(currentSection);
        if (sectionMap) {
          sectionMap.set(key, cleanValue);
        }
      } else if (keyValueMatch && !currentSection) {
        // セクション外でのキー-値ペアは警告してスキップ
        console.warn(
          `Config parse warning: Key-value pair "${trimmedLine}" found outside of section at line ${String(lineNum + 1)}`,
        );
      }
    }

    return config;
  }

  /**
   * 設定ファイルのパスを取得
   * @returns 設定ファイルのパス
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * 指定されたセクションの設定を取得
   * @param sectionName セクション名
   * @returns セクションの設定マップ、存在しない場合はundefined
   */
  getSection(sectionName: string): Map<string, string> | undefined {
    return this.config.get(sectionName.toLowerCase());
  }

  /**
   * 指定されたセクションとキーの値を取得
   * @param sectionName セクション名
   * @param key キー名
   * @returns 設定値、存在しない場合はundefined
   */
  getValue(sectionName: string, key: string): string | undefined {
    const section = this.config.get(sectionName.toLowerCase());
    return section?.get(key.toLowerCase());
  }

  /**
   * 全ての設定セクションの名前を取得
   * @returns セクション名の配列
   */
  getSectionNames(): Array<string> {
    return Array.from(this.config.keys());
  }
}
