import * as fs from "fs/promises";
import * as path from "path";

import { Blob } from "../models/blob.js";
import { IndexRepository } from "../repositories/indexRepository.js";
import { ObjectRepository } from "../repositories/objectRepository.js";
import { findGitDirectory } from "../utils/gitUtils.js";
import { Logger, defaultLogger } from "../utils/logger.js";

/**
 * ファイル処理結果を格納する型
 */
interface FileProcessingResult {
  filePath: string;
  operation: "add" | "update" | "delete";
  sha?: string;
  stats?: import("fs").Stats;
}

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
   * addコマンドのメイン処理（ストリーミング処理版）
   * @param files 追加対象のファイルパス配列
   */
  async execute(files: Array<string>): Promise<void> {
    this.logger.info(`Adding files: ${files.join(", ")}`);

    // 引数の検証
    this.validateArguments(files);

    // ファイルを順次処理し、結果を蓄積
    const processingResults: Array<FileProcessingResult> = [];

    for (const file of files) {
      try {
        const result = await this.processFile(file);
        if (result) {
          processingResults.push(result);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to process file '${file}': ${errorMessage}`);
      }
    }

    // インデックスを一括更新
    await this.updateIndexFromResults(processingResults);

    this.logger.info(`Add operation completed successfully. Processed ${processingResults.length.toString()} files.`);
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
   * 単一ファイルを処理（分類、blob作成、結果生成）
   * @param file ファイルパス
   * @returns 処理結果、削除対象ファイルの場合はundefined
   */
  private async processFile(file: string): Promise<FileProcessingResult | undefined> {
    // ファイルパスを正規化
    const normalizedPath = this.normalizePath(file);

    // ファイルの存在確認
    const fileExists = await this.fileExists(normalizedPath);

    // インデックスでの存在確認
    const indexEntry = this.indexRepo.getEntry(normalizedPath);
    const inIndex = indexEntry !== undefined;

    // 分類判定とそれに応じた処理
    if (!fileExists && !inIndex) {
      // ファイルも存在せず、インデックスにもない場合はエラー
      throw new Error(`pathspec '${file}' did not match any files`);
    }

    if (!fileExists && inIndex) {
      // deleted: インデックスから削除
      this.logger.debug(`File marked for deletion: ${normalizedPath}`);
      return {
        filePath: normalizedPath,
        operation: "delete",
      };
    }

    // ファイルが存在する場合（tracking または untracked）
    const absolutePath = path.resolve(this.workDir, normalizedPath);
    const content = await fs.readFile(absolutePath);
    const stats = await fs.stat(absolutePath);

    // Blobオブジェクトを作成
    const blob = new Blob(content);
    const sha = await this.objectRepo.write(blob);

    const operation = inIndex ? "update" : "add";
    this.logger.debug(`File processed for ${operation}: ${normalizedPath} -> ${sha}`);

    return {
      filePath: normalizedPath,
      operation,
      sha,
      stats,
    };
  }

  /**
   * 処理結果からインデックスを一括更新
   * @param results ファイル処理結果の配列
   */
  private async updateIndexFromResults(results: Array<FileProcessingResult>): Promise<void> {
    try {
      for (const result of results) {
        switch (result.operation) {
          case "add":
          case "update":
            if (!result.sha || !result.stats) {
              throw new Error(`Missing SHA or stats for file: ${result.filePath}`);
            }
            this.indexRepo.add(result.filePath, result.sha, result.stats);
            this.logger.debug(`${result.operation} index entry for ${result.filePath}: ${result.sha}`);
            break;

          case "delete":
            this.indexRepo.remove(result.filePath);
            this.logger.debug(`Removed index entry for ${result.filePath}`);
            break;

          default:
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            throw new Error(`Unknown operation: ${result.operation}`);
        }
      }

      // インデックスファイルを保存
      await this.indexRepo.write();

      const addCount = results.filter(r => r.operation === "add" || r.operation === "update").length;
      const deleteCount = results.filter(r => r.operation === "delete").length;
      
      this.logger.info(
        `Updated index with ${addCount.toString()} additions/updates and ${deleteCount.toString()} deletions`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to update index: ${errorMessage}`);
    }
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
}
