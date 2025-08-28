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
  private gitDir: string;
  private logger: Logger;

  constructor(
    objectRepo: ObjectRepository,
    indexRepo: IndexRepository,
    workDir: string,
    gitDir: string,
    logger: Logger = defaultLogger,
  ) {
    this.objectRepo = objectRepo;
    this.indexRepo = indexRepo;
    this.workDir = workDir;
    this.gitDir = gitDir;
    this.logger = logger;
  }

  /**
   * ファクトリーメソッド: AddServiceのインスタンスを作成
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
    // フィールドの初期化確認（一時的）
    if (!this._checkFieldsInitialized()) {
      throw new Error("Service not properly initialized");
    }

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
   */
  private validateArguments(files: Array<string>): void {
    if (files.length === 0) {
      throw new Error("No files specified");
    }
  }

  /**
   * 一時的なヘルパーメソッド - 未使用変数エラーを回避するため
   * TODO: 実装完了時に削除
   */
  private _checkFieldsInitialized(): boolean {
    return !!(
      this.objectRepo &&
      this.indexRepo &&
      this.workDir.length > 0 &&
      this.gitDir.length > 0
    );
  }

  /**
   * ファイルを tracking/untracked/deleted に分類
   */
  private categorizeFiles(_files: Array<string>): Promise<FileCategorization> {
    // TODO: 具体的な実装を後で追加
    throw new Error("Not implemented yet");
  }

  /**
   * blobオブジェクトを作成
   */
  private createBlobObjects(
    _files: Array<string>,
  ): Promise<Map<string, string>> {
    // TODO: 具体的な実装を後で追加
    throw new Error("Not implemented yet");
  }

  /**
   * インデックスを更新
   */
  private updateIndex(
    _categorizedFiles: FileCategorization,
    _blobResults: Map<string, string>,
  ): Promise<void> {
    // TODO: 具体的な実装を後で追加
    throw new Error("Not implemented yet");
  }
}
