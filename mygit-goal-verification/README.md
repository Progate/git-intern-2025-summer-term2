# mygit ゴール達成確認テスト環境

このディレクトリには、画像で示されたmygitのゴール達成を確認するためのDockerテスト環境が含まれています。

## テスト目的

- `mygit add <file or directory>` でファイルやディレクトリをインデックスに追加
- `git add` と `mygit add` で同じ結果が得られる
- `mygit add` を実行後、`git diff --staged` でステージされた変更が確認できる
- `mygit commit` 後に標準出力で `git log` 形式のコミット情報が表示される
- `mygit commit <commit message>` の引数がコミットメッセージとして保存される
- 本家gitとmygitのオブジェクト互換性がある

## 実行方法

> **注意**: すべてのコマンドはプロジェクトルートディレクトリ（`git-intern-2025-summer-term2/`）から実行してください。

### クイックスタート

```bash
# 1. テスト環境準備（プロジェクトルートから実行）
./mygit-goal-verification/prepare-test.sh

# 2. Dockerテスト実行
cd mygit-goal-verification
docker-compose up --build

# 3. 結果確認
cat results/goal-verification-report.md
```

### 詳細手順

#### 前提条件

1. プロジェクトがビルドされていることを確認：

   ```bash
   # プロジェクトルートから実行
   npm run build
   ```

2. mygitバイナリが実行可能であることを確認：
   ```bash
   chmod +x bin/main.mjs
   ```

### Dockerテストの実行

```bash
cd mygit-goal-verification
docker-compose up --build
```

### 個別テストの実行（ローカル）

Dockerを使わずに個別にテストを実行することも可能です：

```bash
cd mygit-goal-verification

# PATH に mygit を追加
export PATH="$(pwd)/../bin:$PATH"

# 個別テストスクリプトを実行
./tests/add-goals.sh
./tests/commit-goals.sh
./tests/integration-goals.sh
./test-scenarios/basic-add-commit.sh
./test-scenarios/git-compatibility.sh
./test-scenarios/error-cases.sh
./test-scenarios/edge-cases.sh
```

## テスト内容詳細

### 検証項目

#### mygit add の検証

- ファイル単体の追加機能
- ディレクトリの再帰的追加機能
- git addとの出力結果一致性
- git diff --stagedでのステージ確認
- git restore --stagedでの取り消し動作

#### mygit commit の検証

- コミット作成機能
- コミットメッセージの保存
- git logでの履歴確認
- git resetの動作確認
- 複数回コミットの履歴管理

#### 互換性テスト

- mygit → git方向の互換性
- git → mygit方向の互換性
- オブジェクトハッシュの一致性
- 混在ワークフローの動作

#### エラーハンドリング

- 存在しないファイルの処理
- Gitリポジトリ外での実行
- 読み取り権限のないファイル
- 引数なしでの実行

#### エッジケース

- .gitディレクトリ追加の無視
- バイナリファイルの処理
- 特殊文字を含むファイル名
- 大きなファイルの処理
- 深いディレクトリ構造
- 空ファイルの処理

## テスト結果

テスト実行後、`results/goal-verification-report.md` にレポートが生成されます。

### 成功基準

- **必須ゴール (100%達成必要)**: mygit addとmygit commitの基本機能
- **推奨ゴール (85%以上達成)**: エラーハンドリングとエッジケース

## トラブルシューティング

### mygitコマンドが見つからない場合

```bash
# mygitバイナリの実行権限を確認（プロジェクトルートから実行）
ls -la bin/main.mjs

# 実行権限を付与
chmod +x bin/main.mjs
```

### Node.jsの依存関係エラー

```bash
# プロジェクトルートでnpm install
npm install
npm run build
```

### Dockerビルドエラー

```bash
# Dockerイメージとコンテナをクリーンアップ
docker-compose down
docker system prune -f
docker-compose up --build
```

## テストファイル構造

```
mygit-goal-verification/
├── README.md                   # このファイル
├── prepare-test.sh             # テスト準備スクリプト
├── docker-compose.yml          # Docker Compose設定
├── docker/
│   └── Dockerfile              # テスト環境のDockerfile
├── tests/
│   ├── goal-verification.sh    # メインテストスクリプト
│   ├── add-goals.sh            # mygit add ゴール検証
│   ├── commit-goals.sh         # mygit commit ゴール検証
│   └── integration-goals.sh    # 統合ワークフロー検証
├── test-scenarios/
│   ├── basic-add-commit.sh     # 基本的なadd → commit フロー
│   ├── git-compatibility.sh   # 本家Gitとの互換性
│   ├── error-cases.sh         # エラーケース
│   └── edge-cases.sh          # エッジケース（意地悪ケース）
└── results/
    └── goal-verification-report.md  # テスト結果レポート
```
