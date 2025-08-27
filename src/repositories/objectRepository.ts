import * as fs from "fs/promises";
import * as path from "path";
import { promisify } from "util";
import * as zlib from "zlib";

import { GitObject } from "../models/gitObject.js";

// zlib関数のPromise化
const inflate = promisify(zlib.inflate);
const deflate = promisify(zlib.deflate);

/**
 * ObjectRepository固有のエラークラス
 */
export class ObjectRepositoryError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = "ObjectRepositoryError";
  }
}

/**
 * .git/objectsディレクトリとのやり取りを抽象化するクラス
 * Gitオブジェクトの読み書きとGit標準の圧縮/展開を管理
 */
export class ObjectRepository {
  private readonly objectsDir: string;

  /**
   * ObjectRepositoryのコンストラクタ
   * @param gitDir .gitディレクトリのパス
   */
  constructor(gitDir: string) {
    this.objectsDir = path.join(gitDir, "objects");
  }

  /**
   * SHA-1ハッシュを指定してGitオブジェクトを読み取り
   * @param sha SHA-1ハッシュ（40文字の16進数）
   * @returns 復元されたGitオブジェクト
   */
  async read(sha: string): Promise<GitObject> {
    // 1. SHA-1の検証はgetObjectPath内で実行
    // 2. ファイルパスの構築
    const objectPath = this.getObjectPath(sha);

    // 3. ファイルの読み取りと展開
    const uncompressedData = await this.readCompressedFile(objectPath);

    try {
      // 4. GitObject.deserialize()で復元
      const gitObject = await GitObject.deserialize(uncompressedData);

      // 5. SHA-1の整合性確認
      const actualSha = gitObject.getSha();
      if (actualSha !== sha.toLowerCase()) {
        throw new ObjectRepositoryError(
          `SHA-1 mismatch: expected ${sha.toLowerCase()}, got ${actualSha}`,
          "INVALID_SHA",
        );
      }

      return gitObject;
    } catch (error) {
      if (error instanceof ObjectRepositoryError) {
        throw error;
      }

      throw new ObjectRepositoryError(
        `Failed to deserialize object: ${error instanceof Error ? error.message : String(error)}`,
        "DESERIALIZATION_ERROR",
      );
    }
  }

  /**
   * GitオブジェクトをオブジェクトDBに書き込み
   * @param object 書き込むGitオブジェクト
   * @returns 計算されたSHA-1ハッシュ
   */
  async write(object: GitObject): Promise<string> {
    // 1. object.serialize()でバイナリデータ取得
    const serializedData = object.serialize();

    // 2. object.getSha()でSHA-1計算
    const sha = object.getSha();

    // 3. ファイルパス構築
    const objectPath = this.getObjectPath(sha);

    // 4. 既存ファイルの重複チェック（最適化）
    try {
      await fs.access(objectPath);
      // ファイルが既に存在する場合は、書き込みをスキップ
      return sha;
    } catch {
      // ファイルが存在しない場合は、書き込み処理を続行
    }

    // 5. zlib圧縮とファイル書き込み
    await this.writeCompressedFile(objectPath, serializedData);

    // 6. SHA-1を返却
    return sha;
  }

  /**
   * 指定されたSHA-1に対応するオブジェクトが存在するかチェック
   * @param sha SHA-1ハッシュ（40文字の16進数）
   * @returns オブジェクトが存在する場合true
   */
  async exists(sha: string): Promise<boolean> {
    try {
      // SHA-1の検証とファイルパス取得
      const objectPath = this.getObjectPath(sha);

      // ファイルの存在確認（高速チェック）
      await fs.access(objectPath);
      return true;
    } catch (error) {
      if (error instanceof ObjectRepositoryError) {
        // SHA-1形式が無効な場合はfalseを返す
        if (error.code === "INVALID_SHA") {
          return false;
        }
        throw error;
      }

      // ファイルが存在しない場合（ENOENT）はfalse
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return false;
      }

      // その他のエラーは再スロー
      throw new ObjectRepositoryError(
        `Failed to check object existence: ${error instanceof Error ? error.message : String(error)}`,
        "IO_ERROR",
      );
    }
  }

  /**
   * SHA-1ハッシュから対応するオブジェクトファイルのパスを生成
   * Git標準の形式: objects/ab/cdef123...（最初2文字がディレクトリ、残り38文字がファイル名）
   * @param sha SHA-1ハッシュ（40文字の16進数）
   * @returns オブジェクトファイルの絶対パス
   */
  private getObjectPath(sha: string): string {
    // SHA-1の形式検証（40文字の16進数）
    if (!/^[0-9a-f]{40}$/i.test(sha)) {
      throw new ObjectRepositoryError(
        `Invalid SHA-1 format: ${sha}`,
        "INVALID_SHA",
      );
    }

    // SHA-1を小文字に正規化（Gitの標準）
    const normalizedSha = sha.toLowerCase();

    // Git標準の2文字/38文字ディレクトリ構造
    const dirName = normalizedSha.substring(0, 2);
    const fileName = normalizedSha.substring(2);

    return path.join(this.objectsDir, dirName, fileName);
  }

  /**
   * 圧縮されたファイルを読み取り、展開してBufferとして返す
   * @param filePath 読み取るファイルのパス
   * @returns 展開されたデータ
   */
  private async readCompressedFile(filePath: string): Promise<Buffer> {
    try {
      // ファイル読み取り
      const compressedData = await fs.readFile(filePath);

      // zlib展開（BufferをUint8Arrayに変換）
      const uncompressedData = await inflate(new Uint8Array(compressedData));

      return Buffer.from(uncompressedData as Uint8Array);
    } catch (error) {
      if (error instanceof Error && "code" in error) {
        if (error.code === "ENOENT") {
          throw new ObjectRepositoryError(
            `Object file not found: ${filePath}`,
            "NOT_FOUND",
          );
        }
      }

      throw new ObjectRepositoryError(
        `Failed to read compressed file: ${error instanceof Error ? error.message : String(error)}`,
        "IO_ERROR",
      );
    }
  }

  /**
   * データを圧縮してファイルに書き込み
   * @param filePath 書き込み先ファイルのパス
   * @param data 圧縮するデータ
   */
  private async writeCompressedFile(
    filePath: string,
    data: Buffer,
  ): Promise<void> {
    try {
      // ディレクトリの存在確認・作成
      const dirPath = path.dirname(filePath);
      await this.ensureDirectoryExists(dirPath);

      // zlib圧縮（BufferをUint8Arrayに変換）
      const compressedData = await deflate(new Uint8Array(data));

      // アトミックな書き込み（一時ファイル→リネーム）
      // プロセスIDとタイムスタンプを使用して一意な一時ファイル名を生成
      const tempFilePath = `${filePath}.tmp.${process.pid.toString()}.${Date.now().toString()}`;

      try {
        await fs.writeFile(tempFilePath, compressedData as Uint8Array);
        await fs.rename(tempFilePath, filePath);
      } catch (error) {
        // 一時ファイルの削除（エラー時のクリーンアップ）
        try {
          await fs.unlink(tempFilePath);
        } catch {
          // 一時ファイルの削除に失敗しても無視
        }

        // renameが失敗した場合、同じファイルが既に存在するかもしれない（並行書き込み）
        // ファイルが既に存在し、同じ内容なら成功として扱う
        if (
          error instanceof Error &&
          (error.message.includes("EEXIST") || error.message.includes("ENOENT"))
        ) {
          try {
            await fs.access(filePath);
            // ファイルが存在する場合は成功として扱う（並行書き込み対応）
            return;
          } catch {
            // ファイルが存在しない場合は元のエラーを再スロー
          }
        }

        throw error;
      }
    } catch (error) {
      throw new ObjectRepositoryError(
        `Failed to write compressed file: ${error instanceof Error ? error.message : String(error)}`,
        "IO_ERROR",
      );
    }
  }

  /**
   * 指定されたディレクトリが存在しない場合は作成する
   * 親ディレクトリも再帰的に作成
   * @param dirPath 作成するディレクトリのパス
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      throw new ObjectRepositoryError(
        `Failed to create directory: ${error instanceof Error ? error.message : String(error)}`,
        "IO_ERROR",
      );
    }
  }
}
