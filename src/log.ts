import { execSync } from "node:child_process";
import * as fs from "node:fs/promises";
import zlib from "node:zlib";

/**
 * `mygit log`コマンド
 *
 * 処理の流れ:
 * 1. 現在のHEADポインタから最新コミットのハッシュ値を取得
 * 2. そのコミットから親コミットまでの履歴を順次辿り、各コミット情報を表示
 *
 * @throws ファイル読み込みエラー、Gitオブジェクトの読み込みエラー、パースエラー
 */
export const log = async () => {
  const headHash = await getHeadCommitHash();
  await traverseCommitHistory(headHash);
};

/**
 * 現在のHEADポインタが指すコミットのハッシュ値を取得する
 * @returns コミットのハッシュ値
 * @throws ファイル読み込みエラー（.git/HEADまたは参照先ファイルが存在しない場合）
 */
const getHeadCommitHash = async (): Promise<string> => {
  const headFileContent = await fs.readFile(".git/HEAD", "utf-8");
  const branchRefPath = headFileContent.slice(5).trim();
  const headHash = (await fs.readFile(`.git/${branchRefPath}`, "utf-8")).trim();
  return headHash;
};

/**
 * 指定されたコミットから親コミットまでのコミット履歴を辿り、各コミット情報を表示する
 * @param startHash 開始コミットのハッシュ値
 * @throws Gitオブジェクトの読み込みエラーまたはパースエラー
 */
const traverseCommitHistory = async (startHash: string): Promise<void> => {
  let currentHash: string | undefined = startHash;
  while (currentHash) {
    const commitContent = await readGitObjectContent(currentHash);
    const commitData = parseCommitContent(currentHash, commitContent);
    printCommitInfo(commitData);
    // 親コミットのハッシュ値を抽出
    const parentLine = commitContent
      .split("\n")
      .find((line) => line.startsWith("parent "));
    currentHash = parentLine?.split(" ")[1];
  }
};

/**
 * 指定されたハッシュのGitオブジェクトを読み込み、内容を文字列として返す
 * @param hash Gitオブジェクトのハッシュ値
 * @returns Gitオブジェクトの内容（文字列）
 * @throws ファイル読み込みエラー（packfileの場合はgit cat-fileコマンドの実行エラー）
 *
 * 補足:
 * - 通常のオブジェクトファイルが存在する場合はzlibで展開
 * - ファイルが存在しない場合（packfile）は`git cat-file`コマンドにフォールバック
 */
const readGitObjectContent = async (hash: string): Promise<string> => {
  const gitObjectPath = `.git/objects/${hash.slice(0, 2)}/${hash.slice(2)}`;
  try {
    const compressedData = await fs.readFile(gitObjectPath);
    const decompressedContent = zlib.inflateSync(
      new Uint8Array(compressedData),
    );
    return decompressedContent.toString("utf-8");
  } catch (err: any) {
    if (err.code === "ENOENT") {
      // packfileの場合
      const result = execSync(`git cat-file -p ${hash}`);
      return result.toString("utf-8");
    } else {
      throw err;
    }
  }
};

interface CommitData {
  hash: string;
  author: string;
  date: Date;
  message: string;
  timezone: string;
}

/**
 * コミットオブジェクトの文字列からコミット情報を抽出してCommitDataオブジェクトを生成する
 * @param hash コミットのハッシュ値
 * @param commitContent コミットオブジェクトの文字列表現
 * @returns パースされたコミット情報
 *
 * 補足:
 * - authorが見つからない場合は空文字列を設定
 * - 日付が無効な場合は現在日時を設定
 * - メッセージが見つからない場合は空文字列を設定
 */
const parseCommitContent = (
  hash: string,
  commitContent: string,
): CommitData => {
  const authorLine = commitContent
    .split("\n")
    .find((line) => line.startsWith("author "));
  const authorMatch = authorLine?.match(
    /^author ([^<]+ <[^>]+>) (\d+) ([+-]\d{4})/,
  );
  const author = authorMatch?.[1] ? authorMatch[1].trim() : "";
  const unixTimestamp = authorMatch?.[2] ? authorMatch[2] : "";
  const timezone = authorMatch?.[3] ? authorMatch[3] : "+0000";
  const date = unixTimestamp
    ? new Date(parseInt(unixTimestamp) * 1000)
    : new Date();
  const message = commitContent.split("\n\n")[1]?.trim() || "";
  return {
    hash,
    author,
    date,
    message,
    timezone,
  };
};

/**
 * コミット情報をコンソールに表示する
 * @param commitData 表示するコミット情報
 */
const printCommitInfo = (commitData: CommitData): void => {
  // DateオブジェクトのtoString()のGMT以降をコミットオブジェクトのタイムゾーンで置換
  const dateStr = commitData.date
    .toString()
    .replace(/GMT.*$/, commitData.timezone || "+0000");

  console.log(`commit ${commitData.hash}`);
  console.log(`Author: ${commitData.author}`);
  console.log(`Date:   ${dateStr}`);
  console.log(`\n    ${commitData.message}\n`);
};
