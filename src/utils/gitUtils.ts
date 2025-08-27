import * as fs from "fs/promises";
import * as path from "path";

/**
 * 指定されたディレクトリから上位に向かって.gitディレクトリを探す
 * @param startDir 検索開始ディレクトリ（デフォルト：現在のディレクトリ）
 * @returns .gitディレクトリのパス、見つからない場合はnull
 */
export async function findGitDirectory(
  startDir: string = process.cwd(),
): Promise<string | null> {
  let currentDir = path.resolve(startDir);

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    const gitDir = path.join(currentDir, ".git");

    try {
      const stats = await fs.stat(gitDir);
      if (stats.isDirectory()) {
        return gitDir;
      }
    } catch {
      // .gitディレクトリが存在しない場合は上位ディレクトリを確認
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      // ルートディレクトリに到達した場合は見つからない
      return null;
    }
    currentDir = parentDir;
  }
}

/**
 * 現在のディレクトリがGitリポジトリかどうかを判定
 * @param dir 確認するディレクトリ（デフォルト：現在のディレクトリ）
 * @returns Gitリポジトリの場合true
 */
export async function isGitRepository(
  dir: string = process.cwd(),
): Promise<boolean> {
  const gitDir = await findGitDirectory(dir);
  return gitDir !== null;
}
