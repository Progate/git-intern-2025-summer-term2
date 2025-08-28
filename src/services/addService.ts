import * as fs from "fs/promises";
import * as path from "path";

import { Blob } from "../models/blob.js";
import { FileCategorization } from "../models/types.js";
import { IndexRepository } from "../repositories/indexRepository.js";
import { ObjectRepository } from "../repositories/objectRepository.js";
import { findGitDirectory } from "../utils/gitUtils.js";
import { Logger, defaultLogger } from "../utils/logger.js";

/**
 * addコマンドのビジネスロジックを実装するサービスクラス
 */
export class AddService {
  private objectRepo: ObjectRepository;
  private indexRepo: IndexRepository;
  private workDir: string;
  private logger: Logger;

  /**
   * AddServiceのコンストラクタ
   * @param objectRepo Gitオブジェクトストアリポジトリ
   * @param indexRepo Gitインデックスリポジトリ
   * @param workDir ワーキングディレクトリのパス
   * @param _gitDir .gitディレクトリのパス
   * @param logger ログ出力用のロガー
   */
  constructor(
    objectRepo: ObjectRepository,
    indexRepo: IndexRepository,
    workDir: string,
    _gitDir: string,
    logger: Logger = defaultLogger,
  ) {
    this.objectRepo = objectRepo;
    this.indexRepo = indexRepo;
    this.workDir = workDir;
    this.logger = logger;
  }

  /**
   * ファクトリーメソッド: AddServiceのインスタンスを作成
   * @param workDir ワーキングディレクトリのパス
   * @param logger ログ出力用のロガー
   * @returns 初期化されたAddServiceインスタンス
   */
  static async create(
    workDir: string = process.cwd(),
    logger: Logger = defaultLogger,
  ): Promise<AddService> {
    const gitDir = await findGitDirectory(workDir);
    if (!gitDir) {
      throw new Error("Not a git repository");
    }

    const objectRepo = new ObjectRepository(gitDir);
    const indexRepo = await IndexRepository.read(gitDir);

    return new AddService(objectRepo, indexRepo, workDir, gitDir, logger);
  }

  /**
   * addコマンドのメイン処理
   * @param files 追加対象のファイルパス配列
   */
  async execute(files: Array<string>): Promise<void> {
    this.logger.info(`Adding files: ${files.join(", ")}`);

    // 引数の検証
    this.validateArguments(files);

    // ファイルの分類
    const categorizedFiles = await this.categorizeFiles(files);

    // blobオブジェクトの作成（tracking / untrackedファイル）
    const blobResults = await this.createBlobObjects([
      ...categorizedFiles.tracking,
      ...categorizedFiles.untracked,
    ]);

    // インデックスの更新
    await this.updateIndex(categorizedFiles, blobResults);

    this.logger.info("Add operation completed successfully");
  }

  /**
   * 引数の検証
   * @param files ファイルパス配列
   */
  private validateArguments(files: Array<string>): void {
    if (files.length === 0) {
      throw new Error("No files specified");
    }
  }

  /**
   * ファイルを tracking/untracked/deleted に分類
   * @param files ファイルパス配列
   * @returns 分類されたファイル情報
   */
  private async categorizeFiles(
    files: Array<string>,
  ): Promise<FileCategorization> {
    const tracking: Array<string> = [];
    const untracked: Array<string> = [];
    const deleted: Array<string> = [];

    for (const file of files) {
      // ファイルパスを正規化（workDirからの相対パスに変換）
      const normalizedPath = this.normalizePath(file);

      // ファイルの存在確認
      const fileExists = await this.fileExists(normalizedPath);

      // インデックスでの存在確認
      const indexEntry = this.indexRepo.getEntry(normalizedPath);
      const inIndex = indexEntry !== undefined;

      // 分類ロジック
      if (fileExists && inIndex) {
        tracking.push(normalizedPath);
      } else if (fileExists && !inIndex) {
        untracked.push(normalizedPath);
      } else if (!fileExists && inIndex) {
        deleted.push(normalizedPath);
      } else {
        // ファイルも存在せず、インデックスにもない場合はエラー
        throw new Error(`pathspec '${file}' did not match any files`);
      }
    }

    this.logger.info(
      `Categorized files - tracking: ${tracking.length.toString()}, untracked: ${untracked.length.toString()}, deleted: ${deleted.length.toString()}`,
    );

    return { tracking, untracked, deleted };
  }

  /**
   * ファイルパスを正規化（workDirからの相対パスに変換）
   * @param filePath ファイルパス
   * @returns 正規化されたパス
   */
  private normalizePath(filePath: string): string {
    // 絶対パスの場合は相対パスに変換
    if (path.isAbsolute(filePath)) {
      return path.relative(this.workDir, filePath);
    }

    // 既に相対パスの場合はそのまま
    return filePath;
  }

  /**
   * ファイルが存在するかチェック
   * @param filePath ファイルパス
   * @returns ファイルが存在する場合true
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      const fullPath = path.resolve(this.workDir, filePath);
      await fs.access(fullPath);

      // ディレクトリでないことも確認
      const stats = await fs.stat(fullPath);
      return stats.isFile();
    } catch {
      return false;
    }
  }

  /**
   * blobオブジェクトを作成
   * @param files ファイルパス配列
   * @returns ファイルパスとSHA-1のマップ
   */
  private async createBlobObjects(
    files: Array<string>,
  ): Promise<Map<string, string>> {
    const results = new Map<string, string>();

    for (const filePath of files) {
      try {
        // ファイルの内容を読み取り
        const absolutePath = path.isAbsolute(filePath)
          ? filePath
          : path.join(this.workDir, filePath);

        const content = await fs.readFile(absolutePath);

        // Blobオブジェクトを作成
        const blob = new Blob(content);

        // オブジェクトストアに書き込み
        const sha = await this.objectRepo.write(blob);

        // 相対パスで結果を保存
        const relativePath = this.normalizePath(filePath);
        results.set(relativePath, sha);

        this.logger.debug(`Created blob object for ${relativePath}: ${sha}`);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        throw new Error(
          `Failed to create blob for file '${filePath}': ${errorMessage}`,
        );
      }
    }

    return results;
  }

  /**
   * インデックスを更新
   * @param categorizedFiles 分類されたファイル情報
   * @param blobResults ファイルパスとSHA-1のマップ
   */
  private async updateIndex(
    categorizedFiles: FileCategorization,
    blobResults: Map<string, string>,
  ): Promise<void> {
    try {
      // 追跡されているファイルを追加または更新
      for (const filePath of categorizedFiles.tracking) {
        const sha = blobResults.get(filePath);
        if (!sha) {
          throw new Error(`SHA not found for file: ${filePath}`);
        }

        // ファイルの統計情報を取得
        const absolutePath = path.isAbsolute(filePath)
          ? filePath
          : path.join(this.workDir, filePath);

        const stats = await fs.stat(absolutePath);

        // インデックスエントリを追加/更新
        this.indexRepo.add(filePath, sha, stats);

        this.logger.debug(`Updated index entry for ${filePath}: ${sha}`);
      }

      // 追跡されていないファイルを追加
      for (const filePath of categorizedFiles.untracked) {
        const sha = blobResults.get(filePath);
        if (!sha) {
          throw new Error(`SHA not found for file: ${filePath}`);
        }

        // ファイルの統計情報を取得
        const absolutePath = path.isAbsolute(filePath)
          ? filePath
          : path.join(this.workDir, filePath);

        const stats = await fs.stat(absolutePath);

        // インデックスエントリを追加
        this.indexRepo.add(filePath, sha, stats);

        this.logger.debug(`Added index entry for ${filePath}: ${sha}`);
      }

      // 削除されたファイルをインデックスから除去
      for (const filePath of categorizedFiles.deleted) {
        this.indexRepo.remove(filePath);
        this.logger.debug(`Removed index entry for ${filePath}`);
      }

      // インデックスファイルを保存
      await this.indexRepo.write();

      this.logger.info(
        `Updated index with ${(categorizedFiles.tracking.length + categorizedFiles.untracked.length).toString()} additions and ${categorizedFiles.deleted.length.toString()} deletions`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to update index: ${errorMessage}`);
    }
  }
}
