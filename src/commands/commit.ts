import path from "path";

import { ConfigRepository } from "../repositories/configRepository.js";
import { IndexRepository } from "../repositories/indexRepository.js";
import { ObjectRepository } from "../repositories/objectRepository.js";
import { ReferenceRepository } from "../repositories/referenceRepository.js";
import { CommitService } from "../services/commitService.js";
import { findGitDirectory } from "../utils/gitUtils.js";

/**
 * commitコマンドの実装
 * 新しいコミットを作成する
 * @param message コミットメッセージ
 */
export async function commitCommand(message: string): Promise<void> {
  try {
    const gitDir = await findGitDirectory();
    if (!gitDir) {
      throw new Error("Not a git repository");
    }

    // 必要なRepositoryを直接インスタンス化
    const indexRepo = await IndexRepository.read(gitDir);
    const objectRepo = new ObjectRepository(gitDir);
    const referenceRepo = new ReferenceRepository(gitDir);
    const configRepo = await ConfigRepository.read(path.join(gitDir, "config"));

    // CommitServiceを直接インスタンス化
    const commitService = new CommitService(
      indexRepo,
      objectRepo,
      referenceRepo,
      configRepo,
    );

    const commitSha = await commitService.execute(message);

    // 成功メッセージ表示
    console.log(
      `[${await getCurrentBranch(referenceRepo)} ${commitSha.substring(0, 7)}] ${message}`,
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${errorMessage}`);
    process.exit(1);
  }
}

/**
 * 現在のブランチ名を取得
 * @param referenceRepo ReferenceRepository インスタンス
 * @returns ブランチ名（取得できない場合は"main"）
 */
async function getCurrentBranch(
  referenceRepo: ReferenceRepository,
): Promise<string> {
  try {
    return (await referenceRepo.getCurrentBranch()) ?? "main";
  } catch {
    return "main";
  }
}
