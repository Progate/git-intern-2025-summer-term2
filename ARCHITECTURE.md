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
│   ├── gitIndex.ts            # Gitインデックス(.git/index)のクラス
│   ├── constants.ts           # Git index関連の定数
│   └── types.ts               # 共有される型定義
├── repositories/              # データ永続化層
│   ├── objectRepository.ts    # Gitオブジェクト(.git/objects)の読み書き
│   ├── indexRepository.ts     # Gitインデックス(.git/index)の読み書き
│   ├── referenceRepository.ts # Git参照(.git/HEAD, refs/)の読み書き
│   └── configRepository.ts    # 設定ファイル(.git/config)の読み書き
├── services/                  # アプリケーション/ビジネスロジック層
│   ├── addService.ts          # addコマンドの専用ビジネスロジック（実装済み）
│   ├── commitService.ts       # commitコマンドの専用ビジネスロジック（実装済み）
│   └── logService.ts          # logコマンドの専用ビジネスロジック（実装済み）
├── commands/                  # UI層
│   ├── add.ts                 # addコマンドの実装
│   ├── commit.ts              # commitコマンドの実装
│   └── log.ts                 # logコマンドの実装
└── utils/                     # 共通ユーティリティ
    ├── logger.ts              # ログ機能
    └── gitUtils.ts            # Git関連のユーティリティ

```

## 4. コンポーネント詳細 (Component Details)

### `src/models/`

- **`types.ts`**

  - **役割**: プロジェクト全体で共有される型定義を管理します。
  - **主な要素**:
    - `type GitObjectType = 'blob' | 'tree' | 'commit';`
    - `interface TreeEntry`:
      - `mode: string`: ファイルモード
      - `name: string`: ファイル/ディレクトリ名
      - `sha: string`: 対応するBlob/TreeのSHA
    - `type GitActor`:
      - `name: string`: 作者/コミッター名
      - `email: string`: メールアドレス
      - `timestamp: Date`: タイムスタンプ
    - `interface IndexEntry`: インデックスエントリの型定義
      - `ctime: FileTime`: 作成時刻
      - `mtime: FileTime`: 変更時刻
      - `dev: number`, `ino: number`, `mode: number`, `uid: number`, `gid: number`, `size: number`: ファイル統計情報
      - `objectId: string`: 対応するオブジェクトのSHA
      - `flags: number`: フラグ情報
      - `path: string`: ファイルパス
    - `interface FileTime`: 高精度時刻型
      - `seconds: number`: Unix時刻（秒）
      - `nanoseconds: number`: ナノ秒部分
    - `interface IndexHeader`: インデックスヘッダー型
      - `signature: string`: ファイル署名（"DIRC"）
      - `version: number`: バージョン番号
      - `entryCount: number`: エントリ数
    - `interface TreeNode`: ディレクトリ階層を表現するインターフェース
      - `name: string`: ディレクトリ/ファイル名
      - `children: Map<string, TreeNode>`: 子ノード（ディレクトリの場合）
      - `entry?: IndexEntry`: インデックスエントリ（ファイルの場合）
      - `type: "directory" | "file"`: ノードの種別

- **`gitObject.ts`**

  - **役割**: 全Gitオブジェクト共通の振る舞いを定義する抽象基底クラスです。
  - **主な要素**:
    - `abstract class GitObject`:
      - `serialize(): Buffer`: オブジェクトをヘッダー付きバイナリに変換します。
      - `getSha(): string`: オブジェクトのSHA-1ハッシュを計算します。

- **`gitIndex.ts`**

  - **役割**: Gitインデックス（`.git/index`ファイル）を表現するクラスです。
  - **主な要素**:
    - `class Index`:
      - `static async fromFile(indexPath: string): Promise<Index>`: ファイルからIndexインスタンスを作成します。
      - `static deserialize(data: Buffer): Index`: バイナリデータからIndexインスタンスを作成します。
      - `addEntry(path: string, entry: IndexEntry): void`: エントリを追加・更新します。
      - `removeEntry(path: string): boolean`: エントリを削除します。
      - `getEntry(path: string): IndexEntry | undefined`: エントリを取得します。
      - `getAllEntries(): IndexEntry[]`: 全エントリをソート済みで取得します。
      - `getEntryCount(): number`: エントリ数を取得します。
      - `getHeader(): IndexHeader`: ヘッダー情報を取得します。
  - **設計判断**: 静的ファクトリーメソッド（`fromFile`, `deserialize`）をクラス内に配置し、低レベルなバイナリ操作をカプセル化しています。

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

- **`constants.ts`**
  - **役割**: Git index関連の定数を管理します。
  - **主な要素**:
    - `INDEX_SIGNATURE`: インデックスファイルの署名（"DIRC"）
    - `INDEX_VERSION`: サポートするインデックスバージョン（2）
    - `INDEX_ENTRY_SIZE`: エントリサイズ関連の定数（固定サイズ、アライメント等）
    - `INDEX_HEADER_SIZE`: インデックスヘッダーのサイズ
    - `INDEX_CHECKSUM_SIZE`: チェックサムのサイズ

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

各Gitコマンドに対応する専用のサービスクラスを配置し、コマンドごとのビジネスロジックを実装します。

- **`addService.ts`**（実装済み）

  - **役割**: `add`コマンドのビジネスロジックに特化した専用サービスです。ディレクトリの再帰的処理をサポートします。
  - **主なメソッド**:
    - `static async create(workDir?: string, logger?: Logger): Promise<AddService>`: ファクトリーメソッド。必要なRepositoryを初期化してインスタンスを作成します。
    - `async execute(files: Array<string>): Promise<void>`: ファイル/ディレクトリをステージングします。ディレクトリの場合は再帰的に処理します。
    - `private async processFile(filePath: string): Promise<FileProcessingResult | null>`: 個別ファイルの処理（Blob作成、インデックス更新）。
    - `private async collectFilesRecursively(dirPath: string): Promise<Array<string>>`: ディレクトリ内のファイルを再帰的に収集します。
    - `private async updateIndexFromResults(results: Array<FileProcessingResult>): Promise<void>`: 処理結果をもとにインデックスを一括更新します。

- **`commitService.ts`**（実装済み）

  - **役割**: `commit`コマンドのビジネスロジックに特化した専用サービスです。階層的なディレクトリ構造をサポートします。
  - **主なメソッド**:
    - `constructor(indexRepo, objectRepo, referenceRepo, configRepo, logger?)`: 必要なRepositoryインスタンスを受け取ります。
    - `async execute(message: string): Promise<string>`: 新しいコミットを作成し、そのSHAを返します。
    - `private async buildTreeFromIndex(entries: Array<IndexEntry>): Promise<string>`: インデックスエントリから階層的なTree構造を構築します。
    - `private buildDirectoryTree(entries: Array<IndexEntry>): TreeNode`: ディレクトリツリー構造を構築します。
    - `private async createTreeObject(node: TreeNode): Promise<string>`: TreeNodeからTreeオブジェクトを作成し、オブジェクトDBに保存します。

- **`logService.ts`**（実装済み）

  - **役割**: `log`コマンドのビジネスロジックに特化した専用サービスです。
  - **主なメソッド**:
    - `constructor(objectRepo, referenceRepo, logger?)`: 必要なRepositoryインスタンスを受け取ります。
    - `async execute(): Promise<void>`: コミット履歴を表示します。
    - `private formatCommit(commit: Commit, sha: string): string`: コミット情報を整形します。
    - `private async collectCommitHistory(startSha: string): Promise<Array<{sha: string, commit: Commit}>>`: コミット履歴を収集します。
    - `async getCommitStats(sha: string): Promise<{totalCommits: number, authors: Set<string>, dateRange: {earliest: Date, latest: Date}}>`: コミット履歴の統計情報を取得します（将来の拡張用）。

### `src/commands/`

- **`add.ts` / `commit.ts` / `log.ts`**（実装済み）
  - **役割**: CLIと各専用サービスクラスのメソッド呼び出しの橋渡しをします。
  - **設計方針**: 各コマンドは対応するサービス（例：`add`コマンド → `AddService`、`commit`コマンド → `CommitService`、`log`コマンド → `LogService`）を呼び出します。
  - **主な要素**:
    - `export async function addCommand(files: string[]): Promise<void>`: `AddService.create()`でサービスを初期化し、`execute()`を呼び出します。
    - `export async function commitCommand(message: string): Promise<void>`: 必要なRepositoryを直接インスタンス化し、`CommitService`を生成して実行します。
    - `export async function logCommand(): Promise<void>`: 必要なRepositoryを直接インスタンス化し、`LogService`を生成して実行します。

### `src/utils/`

- **`logger.ts`**

  - **役割**: アプリケーション全体のログ機能を提供します。
  - **主な要素**:
    - `type LogLevel`: ログレベル（"debug", "info", "warn", "error"）を定義します。
    - `interface Logger`: ログ機能のインターフェースを定義します。
    - `class ConsoleLogger`: コンソール出力を行う具象実装です。
    - `class MockLogger`: テスト用のモックロガー実装です。
    - `export const defaultLogger`: デフォルトのロガーインスタンスです。

- **`gitUtils.ts`**
  - **役割**: Git関連の共通ユーティリティ機能を提供します。
  - **主な要素**:
    - `findGitDirectory(startDir)`: 指定されたディレクトリから上位に向かって.gitディレクトリを探します。
    - `isGitRepository(dir)`: 現在のディレクトリがGitリポジトリかどうかを判定します。

### `src/mygit.ts`

- **役割**: アプリケーションのエントリーポイントです。CLIライブラリを使い、`my-git commit <message>`のような引数形式のコマンドを定義し、処理を振り分けます。

## 5. シーケンス解説 (Command Execution Flow)

### `my-git add <file>` の実行フロー

`my-git add README.md` または `my-git add src/` が実行された際の、主要なメソッド間のデータの流れです。

1.  **`commands/add.ts -> addCommand(files)`**

    - **受け取り**: `files: string[]` (例: `['README.md']` または `['src/']`)
    - **処理**: `AddService.create()`でサービスインスタンスを作成し、`addService.execute(files)` を呼び出します。

2.  **`services/addService.ts -> execute(files)`**
    - **処理**:
      1.  引数の検証を行います（`validateArguments()`）。
      2.  各ファイル/ディレクトリに対して処理を実行：
          - `.git`以下のパスは自動的にスキップします。
          - ディレクトリの場合は`collectFilesRecursively()`で再帰的にファイルを収集します。
          - ファイルの場合は`processFile()`で個別処理を行います。
      3.  `processFile()`内で：
          - ファイル内容を読み取り、`Blob`オブジェクトを作成します。
          - `objectRepo.write(blob)`でBlobオブジェクトをオブジェクトDBに保存し、SHAを取得します。
          - ファイルの統計情報（`fs.Stats`）を取得します。
      4.  `updateIndexFromResults()`で処理結果をもとにインデックスを一括更新します。
      5.  `indexRepo.write()`でインデックスファイルを永続化します。
    - **→ 返り値**: `Promise<void>`

### `my-git commit <message>` の実行フロー

`my-git commit "Initial commit"` が実行された際のフローです。

1.  **`commands/commit.ts -> commitCommand(message)`**

    - **受け取り**: `message: string` (例: `"Initial commit"`)
    - **処理**: 必要なRepository（IndexRepository、ObjectRepository、ReferenceRepository、ConfigRepository）を直接インスタンス化し、`CommitService`を作成して `commitService.execute(message)` を呼び出します。

2.  **`services/commitService.ts -> execute(message)`**
    - **処理**:
      1.  `indexRepo.getAllEntries()`でインデックスから全エントリを取得します。
      2.  `buildTreeFromIndex(entries)`でインデックスエントリから階層的なTree構造を構築：
          - `buildDirectoryTree()`でディレクトリツリー構造を構築します。
          - `createTreeObject()`で各TreeノードからTreeオブジェクトを作成し、オブジェクトDBに保存します。
      3.  `referenceRepo.resolveHead()`で現在のHEADコミット（親コミット）のSHAを取得します。
      4.  `configRepo.getUserConfig()`で作者・コミッター情報を取得します。
      5.  `Commit`オブジェクトを作成し、必要な情報（ツリーSHA、親コミットSHA、作者情報、メッセージ）を設定します。
      6.  `objectRepo.write(commit)`でCommitオブジェクトをオブジェクトDBに保存し、コミットSHAを取得します。
      7.  `referenceRepo.updateHead(commitSha)`でHEADが指すブランチの参照を新しいコミットに更新します。
    - **→ 返り値**: `Promise<string>` (新しいコミットのSHA)

### `my-git log` の実行フロー

`my-git log` が実行された際のフローです。

1.  **`commands/log.ts -> logCommand()`**

    - **処理**: 必要なRepositoryを直接インスタンス化し、`new LogService(objectRepo, referenceRepo)` を生成して `logService.execute()` を呼び出します。

2.  **`services/LogService.ts -> execute()`**
    - **処理**:
      1.  `refRepo.resolveHead()` を呼び出し、HEADが指すコミットのSHAを取得します。
          - **→ 返り値**: `headSha: string`
      2.  `collectCommitHistory(headSha)` を呼び出し、コミット履歴を収集します。
          - **→ 返り値**: `Array<{sha: string, commit: Commit}>`
      3.  各コミットを `formatCommit()` で整形し、標準出力に表示します。
    - **→ 返り値**: `Promise<void>`
