# mygit設計書

## 1. 概要 (Overview)

このプロジェクトは、分散バージョン管理システムであるGitのコアな内部機能を、TypeScriptを用いてスクラッチで実装することを目的とした学習用プロジェクトです。`.git`ディレクトリ以下のオブジェクトやインデックスを直接操作することで、`add`, `commit`, `log`といった基本的なGitコマンドの仕組みを深く理解することを目指します。

## 2. アーキテクチャ設計 (Architecture)

**関心の分離 (Separation of Concerns)** の原則に基づき、明確に役割分担されたレイヤー構造を採用しています。

- **`models/` (データモデル層)**: データの「形」を定義します。（名詞）
- **`repositories/` (データ永続化層)**: データの保存先（ファイルシステム）とのやり取りを抽象化します。
- **`services/` (アプリケーション/ビジネスロジック層)**: アプリケーションの機能（ユースケース）や、特定のビジネスロジックを実装します。
- **`commands/` (UI層)**: ユーザーからのコマンドライン入力を受け付けます。

**依存関係の流れ**: `commands` → `services` → `repositories` → `models`
UIからビジネスロジック、データ永続化、データモデルへと一方向に流れる、クリーンで直感的な構造です。

## 3. ファイル構成 (File Structure)

```

src/
├── mygit.ts                   # アプリケーションのエントリーポイント
├── models/                    # データモデル層
│   ├── gitObject.ts           # Gitオブジェクトの抽象基底クラス
│   ├── blob.ts                # Blobオブジェクトの具象クラス
│   ├── tree.ts                # Treeオブジェクトの具象クラス
│   ├── commit.ts              # Commitオブジェクトの具象クラス
│   └── types.ts               # 共有される型定義
├── repositories/              # データ永続化層
│   ├── objectRepository.ts
│   ├── indexRepository.ts
│   ├── referenceRepository.ts
│   └── configRepository.ts    # 設定ファイル(.git/config)の読み書き
├── services/                  # アプリケーション/ビジネスロジック層
│   ├── gitService.ts          # 高レベルなGit操作（ユースケース）を実装
│   └── statusService.ts       # 状態分析などのドメインサービス
├── commands/                  # UI層
│   ├── add.ts
│   ├── commit.ts
│   └── log.ts
└── utils/                     # 共通ユーティリティ
    └── logger.ts              # ログ機能

```

## 4. コンポーネント詳細 (Component Details)

### `src/models/`

- **`types.ts`**

  - **役割**: プロジェクト全体で共有される型定義を管理します。
  - **主な要素**:
    - `type GitObjectType = 'blob' | 'tree' | 'commit';`
    - `type WorkdirStatus = 'untracked' | 'modified' | 'deleted' | 'unmodified';`
    - `interface TreeEntry`:
      - `mode: string`: ファイルモード
      - `name: string`: ファイル/ディレクトリ名
      - `sha: string`: 対応するBlob/TreeのSHA
    - `type GitActor`:
      - `name: string`: 作者/コミッター名
      - `email: string`: メールアドレス
      - `timestamp: Date`: タイムスタンプ

- **`gitObject.ts`**

  - **役割**: 全Gitオブジェクト共通の振る舞いを定義する抽象基底クラスです。
  - **主な要素**:
    - `abstract class GitObject`:
      - `serialize(): Buffer`: オブジェクトをヘッダー付きバイナリに変換します。
      - `getSha(): string`: オブジェクトのSHA-1ハッシュを計算します。

- **`blob.ts` / `tree.ts` / `commit.ts`**
  - **役割**: `GitObject`を継承し、各オブジェクト種別固有のデータ構造とロジックを実装します。
  - **主な要素**:
    - `class Blob extends GitObject`:
      - `content: Buffer`: ファイルのバイナリ内容。
    - `class Tree extends GitObject`:
      - `entries: TreeEntry[]`: ディレクトリ内のエントリ一覧。
    - `class Commit extends GitObject`:
      - `tree: string`: ルートツリーのSHA。
      - `parents: string[]`: 親コミットのSHAリスト。
      - `author: GitActor`: 作者情報。
      - `committer: GitActor`: コミッター情報。
      - `message: string`: コミットメッセージ。

### `src/repositories/`

- **`objectRepository.ts`**
  - **役割**: `.git/objects` ディレクトリとのやり取りを抽象化します。
  - **主なメソッド**:
    - `read(sha: string): Promise<GitObject>`: SHAを受け取り、対応する `GitObject` を返します。
    - `write(object: GitObject): Promise<string>`: `GitObject` を受け取り、DBに保存してそのSHAを返します。
- **`indexRepository.ts`**
  - **役割**: `.git/index` ファイルの読み書きと解析を抽象化します。
  - **主なメソッド**:
    - `static async read(gitDir: string): Promise<IndexRepository>`: ファイルからインスタンスを生成します。
    - `write(): Promise<void>`: メモリ上の変更をファイルに永続化します。
    - `getEntry(filepath: string): IndexEntry | undefined`: 指定パスのエントリを取得します。
    - `add(filepath: string, sha: string, stats: fs.Stats): void`: エントリを追加・更新します。
    - `remove(filepath: string): void`: エントリを削除します。
- **`referenceRepository.ts`**
  - **役割**: `.git/HEAD` やブランチファイルの読み書きを抽象化します。
  - **主なメソッド**:
    - `resolveHead(): Promise<string>`: `HEAD`が指すコミットのSHAを返します。
    - `updateHead(sha: string): Promise<void>`: `HEAD`が指すブランチの参照を更新します。
- **`configRepository.ts`**
  - **役割**: `.gitconfig` や `.git/config` ファイルの読み書きを抽象化します。
  - **主なメソッド**:
    - `static async read(configPath?: string): Promise<ConfigRepository>`: 設定ファイルからインスタンスを生成します。
    - `getUserConfig(): GitActor | undefined`: ユーザー設定（名前・メールアドレス）を取得します。
    - `getCoreConfig(): { compression: number; fileMode: boolean }`: コア設定を取得します。

### `src/services/`

- **`gitService.ts`**
  - **役割**: 高レベルなGitの機能（ユースケース）を実装する指揮者です。
  - **主なメソッド**:
    - `constructor(workDir: string)`: 内部で各`Repository`をインスタンス化します。
    - `add(filepath: string): Promise<void>`: ファイルをステージングします。
    - `commit(message: string, author: GitActor): Promise<string>`: 新しいコミットを作成し、そのSHAを返します。
    - `log(): Promise<void>`: コミット履歴を表示します。
- **`statusService.ts`**
  - **役割**: ファイルの状態分析というビジネスロジックに特化します。
  - **主なメソッド**:
    - `getFileStatus(filepath: string): Promise<WorkdirStatus>`: 指定ファイルのステータス (`untracked`など) を返します。

### `src/commands/`

- **`add.ts` / `commit.ts` / `log.ts`**
  - **役割**: CLIと`GitService`のメソッド呼び出しの橋渡しをします。
  - **主な要素**:
    - `export async function addCommand(files: string[]): Promise<void>`
    - `export async function commitCommand(message: string): Promise<void>`

### `src/utils/`

- **`logger.ts`**
  - **役割**: アプリケーション全体のログ機能を提供します。
  - **主な要素**:
    - `enum LogLevel`: ログレベル（DEBUG, INFO, WARN, ERROR）を定義します。
    - `interface Logger`: ログ機能のインターフェースを定義します。
    - `class ConsoleLogger`: コンソール出力を行う具象実装です。
    - `export const logger`: シングルトンのロガーインスタンスです。

### `src/mygit.ts`

- **役割**: アプリケーションのエントリーポイントです。CLIライブラリを使い、`my-git commit <message>`のような引数形式のコマンドを定義し、処理を振り分けます。

## 5. シーケンス解説 (Command Execution Flow)

### `my-git add <file>` の実行フロー

`my-git add README.md` が実行された際の、主要なメソッド間のデータの流れです。

1.  **`commands/add.ts -> addCommand(files)`**

    - **受け取り**: `files: string[]` (例: `['README.md']`)
    - **処理**: `new GitService('.')` を生成し、`gitService.add('README.md')` を呼び出します。

2.  **`services/GitService.ts -> add(filepath)`**
    - **受け取り**: `filepath: string` (例: `'README.md'`)
    - **処理**:
      1.  `IndexRepository.read(gitDir)` を呼び出します。
          - **→ 返り値**: `indexRepo: IndexRepository` (現在のインデックス情報を持つインスタンス)
      2.  `new StatusService(gitDir, indexRepo)` を生成します。
      3.  `statusService.getFileStatus(filepath)` を呼び出します。
          - **→ 返り値**: `status: WorkdirStatus` (例: `'modified'`)
      4.  `status` に応じて処理を分岐し、必要であれば `objectRepo.write(blob)` を呼び出します。
          - **受け取り**: `blob: Blob`
          - **→ 返り値**: `sha: string` (BlobのSHA)
      5.  `indexRepo.add(...)` や `indexRepo.remove(...)` でメモリ上のインデックスを更新します。
      6.  `indexRepo.write()` を呼び出し、ディスク上の `.git/index` ファイルを更新します。
    - **→ 返り値**: `Promise<void>`

### `my-git commit <message>` の実行フロー

`my-git commit "Initial commit"` が実行された際のフローです。

1.  **`commands/commit.ts -> commitCommand(message)`**

    - **受け取り**: `message: string` (例: `"Initial commit"`)
    - **処理**: `new GitService('.')` を生成し、`gitService.commit(message, author)` を呼び出します。（`author`情報は環境変数などから取得）

2.  **`services/GitService.ts -> commit(message, author)`**
    - **受け取り**: `message: string`, `author: GitActor`
    - **処理**:
      1.  `indexRepo.read(gitDir)` を呼び出し、現在のインデックス情報を取得します。
      2.  内部でインデックス情報から`Tree`オブジェクトを再帰的に構築し、`objectRepo.write()`で全てDBに保存します。
          - **→ 結果**: `rootTreeSha: string` (最上位TreeのSHA)
      3.  `refRepo.resolveHead()` を呼び出します。
          - **→ 返り値**: `parentSha: string` (親コミットのSHA)
      4.  `rootTreeSha`, `parentSha`, `message`, `author` を元に `new Commit(...)` を生成します。
      5.  `objectRepo.write(commit)` を呼び出します。
          - **受け取り**: `commit: Commit`
          - **→ 返り値**: `newCommitSha: string` (新しいコミットのSHA)
      6.  `refRepo.updateHead(newCommitSha)` を呼び出し、現在のブランチ参照を更新します。
    - **→ 返り値**: `Promise<string>` (新しいコミットのSHA)

