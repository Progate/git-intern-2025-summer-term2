import * as fs from "node:fs/promises";
import zlib from 'node:zlib';
import { execSync } from "node:child_process";

/**
 * `git log`コマンドと同様にコミット履歴を表示する
 * 
 * 処理の流れ:
 * 1. 現在のHEADポインタから最新コミットのハッシュ値を取得
 * 2. そのコミットから親コミットまでの履歴を順次辿り、各コミット情報を表示
 * 
 * @throws ファイル読み込みエラー、Gitオブジェクトの読み込みエラー、パースエラー
 */
export const log = async () => {
  const headHash = await getCurrentHeadHash();
  await traverseCommitHistory(headHash);
};

/**
 * 現在のHEADポインタが指すコミットのハッシュ値を取得する
 * @returns コミットのハッシュ値
 * @throws ファイル読み込みエラー（.git/HEADまたは参照先ファイルが存在しない場合）
 */
const getCurrentHeadHash = async (): Promise<string> => {
  const headPointer = await fs.readFile(".git/HEAD", "utf-8");
  const refPath = headPointer.slice(5).trim();
  const headHash = (await fs.readFile(`.git/${refPath}`, "utf-8")).trim();
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
    const commitObject = await readGitObject(currentHash);
    const commitInfo = parseCommitObject(currentHash, commitObject);
    displayCommitLog(commitInfo);
    currentHash = extractParentHash(commitObject);
  }
};

/**
 * コミットオブジェクトから親コミットのハッシュ値を抽出する
 * @param commitObject コミットオブジェクトの文字列表現
 * @returns 親コミットのハッシュ値（親コミットが存在しない場合はundefined）
 */
const extractParentHash = (commitObject: string): string | undefined => {
  const parentLine = commitObject.split('\n').find(line => line.startsWith('parent '));
  return parentLine?.split(' ')[1];
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
const readGitObject = async (hash: string): Promise<string> => {
  const objPath = `.git/objects/${hash.slice(0, 2)}/${hash.slice(2)}`;
  try {
    const compressed = await fs.readFile(objPath);
    const decompressed = zlib.inflateSync(new Uint8Array(compressed));
    return decompressed.toString('utf-8');
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      // packfileの場合
      const result = execSync(`git cat-file -p ${hash}`);
      return result.toString('utf-8');
    } else {
      throw err;
    }
  }
};

type CommitInfo = {
  hash: string;
  author: string;
  date: Date;
  message: string;
}

/**
 * コミットオブジェクトの文字列からコミット情報を抽出してCommitInfoオブジェクトを生成する
 * @param hash コミットのハッシュ値
 * @param obj コミットオブジェクトの文字列表現
 * @returns パースされたコミット情報
 * 
 * 補足:
 * - authorが見つからない場合は空文字列を設定
 * - 日付が無効な場合は現在日時を設定
 * - メッセージが見つからない場合は空文字列を設定
 */
const parseCommitObject = (hash: string, obj: string): CommitInfo => {
  const author = obj.split('\n').find(line => line.startsWith('author '))?.slice(7).trim();
  const dateUnix = obj.split('\n').find(line => line.startsWith('author '))?.split(' ').slice(-2, -1)[0];
  const date = dateUnix ? new Date(parseInt(dateUnix) * 1000) : new Date();
  const message = obj.split('\n\n')[1]?.trim() || '';
  return {
    hash: hash,
    author: author || '',
    date: date,
    message: message || '',
  }
};

/**
 * コミット情報をコンソールに表示する
 * @param info 表示するコミット情報
 */
const displayCommitLog = (info: CommitInfo): void => {
  console.log(`commit ${info.hash}`);
  console.log(`Author: ${info.author}`);
  console.log(`Date:   ${info.date.toISOString()}`);
  console.log(`\n    ${info.message}\n`);
};
