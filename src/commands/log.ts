import path from "path";

import { ObjectRepository } from "../repositories/objectRepository.js";
import { ReferenceRepository } from "../repositories/referenceRepository.js";
import { LogService } from "../services/logService.js";

/**
 * logコマンドの実装
 * コミット履歴を表示する
 */
export async function logCommand(): Promise<void> {
  try {
    const workDir = process.cwd();
    const gitDir = path.join(workDir, ".git");

    // 必要なRepositoryを直接インスタンス化
    const objectRepo = new ObjectRepository(gitDir);
    const referenceRepo = new ReferenceRepository(gitDir);

    // LogServiceを直接インスタンス化
    const logService = new LogService(objectRepo, referenceRepo);

    await logService.execute();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${errorMessage}`);
    process.exit(1);
  }
}
