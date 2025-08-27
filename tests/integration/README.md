# Integration Tests

このディレクトリには、`gitUtils.ts`と`referenceRepository.ts`が実際の`.git`ディレクトリに対して正常に動作することを確認するintegration testが含まれています。

## 概要

Integration testは、unit testとは異なり、実際のgitリポジトリ環境を使用してコンポーネント間の統合動作をテストします。一時ディレクトリ内に本物の`.git`ディレクトリを作成し、実際のgitコマンドを使用してテスト環境を構築します。

### 安全性の確保

- **完全に分離された環境**: テストは`/tmp/`下の一時ディレクトリで実行され、既存のプロジェクトに影響しません
- **自動クリーンアップ**: 各テスト後に一時ディレクトリは完全に削除されます
- **プロジェクトディレクトリへの影響なし**: 現在のプロジェクトの`.git`ディレクトリには一切アクセスしません

## テスト実行コマンド

```bash
# すべてのintegration testを実行
npm run test:integration

# または直接実行
node --import tsx --test tests/integration/**/*.test.ts
```

## テスト構成

### 1. gitUtils Integration Tests (`tests/integration/utils/gitUtils.integration.test.ts`)

`src/utils/gitUtils.ts`の以下の関数をテストします：

#### `findGitDirectory detects actual .git directory`

- **テスト内容**: 実際の`.git`ディレクトリを検出する
- **入力**:
  - `tempDir` (一時ディレクトリのパス)
  - 事前に`git init`で作成された`.git`ディレクトリ
- **探査対象**: `.git`ディレクトリの存在と場所
- **期待される戻り値**: `.git`ディレクトリの絶対パス（例: `/tmp/git-integration-test-xxx/.git`）
- **検証内容**:
  - 返されたパスが期待するパスと一致する
  - `.git`ディレクトリが実際に存在する
  - それがディレクトリである

#### `findGitDirectory returns null when no .git directory exists`

- **テスト内容**: `.git`ディレクトリが存在しない場合にnullを返す
- **入力**:
  - `tempDir` (一時ディレクトリのパス)
  - gitリポジトリが初期化されていない状態
- **探査対象**: `.git`ディレクトリの不存在
- **期待される戻り値**: `null`
- **検証内容**: 戻り値が厳密に`null`である

#### `isGitRepository returns true for actual git repository`

- **テスト内容**: 実際のgitリポジトリに対してtrueを返す
- **入力**:
  - `tempDir` (一時ディレクトリのパス)
  - 事前に`git init`で作成されたgitリポジトリ
- **探査対象**: gitリポジトリとしての有効性
- **期待される戻り値**: `true`
- **検証内容**: 戻り値が厳密に`true`である

#### `isGitRepository returns false when not a git repository`

- **テスト内容**: gitリポジトリでない場合にfalseを返す
- **入力**:
  - `tempDir` (一時ディレクトリのパス)
  - gitリポジトリが初期化されていない状態
- **探査対象**: gitリポジトリとしての無効性
- **期待される戻り値**: `false`
- **検証内容**: 戻り値が厳密に`false`である

### 2. ReferenceRepository Integration Tests (`tests/integration/repositories/referenceRepository.integration.test.ts`)

`src/repositories/referenceRepository.ts`の以下のメソッドをテストします：

#### `resolveHead returns correct SHA after initial commit`

- **テスト内容**: 初期コミット後にHEADの正しいSHAを取得する
- **入力**:
  - `.git`ディレクトリパス
  - `test.txt`ファイルを含む初期コミット
- **探査対象**: `.git/HEAD`ファイルとブランチ参照ファイル（例: `.git/refs/heads/master`）
- **期待される戻り値**: 40文字のSHA-1ハッシュ（例: `cce396ca7fc540ac47fcc83ee5613331be84c501`）
- **検証内容**:
  - 返されたSHAが`git rev-parse HEAD`の結果と一致する
  - SHA-1ハッシュの形式（40文字の16進数）が正しい

#### `getCurrentBranch returns default branch name`

- **テスト内容**: デフォルトブランチ名を取得する
- **入力**:
  - `.git`ディレクトリパス
  - 初期コミットを含むgitリポジトリ
- **探査対象**: `.git/HEAD`ファイルの内容（ブランチ参照）
- **期待される戻り値**: ブランチ名の文字列（通常は`"master"`または`"main"`）
- **検証内容**:
  - 戻り値がnullでない
  - 戻り値が文字列である
  - 文字列の長さが0より大きい

#### `resolveRef resolves branch reference correctly`

- **テスト内容**: ブランチ参照を正しく解決する
- **入力**:
  - ブランチ参照パス（例: `refs/heads/master`）
  - 初期コミットを含むgitリポジトリ
- **探査対象**: `.git/refs/heads/{ブランチ名}`ファイル
- **期待される戻り値**: ブランチが指すコミットのSHA-1ハッシュ
- **検証内容**: 返されたSHAが`git rev-parse HEAD`の結果と一致する

#### `resolveHead throws error when HEAD file does not exist`

- **テスト内容**: HEADファイルが存在しない場合にエラーを投げる
- **入力**:
  - `.git/HEAD`ファイルが削除された状態の`.git`ディレクトリ
- **探査対象**: 存在しない`.git/HEAD`ファイル
- **期待される戻り値**: `ReferenceRepositoryError`例外（エラーコード: `"HEAD_NOT_FOUND"`）
- **検証内容**:
  - `ReferenceRepositoryError`のインスタンスが投げられる
  - エラーコードが`"HEAD_NOT_FOUND"`である

#### `resolveRef throws error for non-existent reference`

- **テスト内容**: 存在しない参照に対してエラーを投げる
- **入力**:
  - 存在しないブランチ参照（`refs/heads/nonexistent`）
- **探査対象**: 存在しない`.git/refs/heads/nonexistent`ファイル
- **期待される戻り値**: `ReferenceRepositoryError`例外（エラーコード: `"REF_NOT_FOUND"`）
- **検証内容**:
  - `ReferenceRepositoryError`のインスタンスが投げられる
  - エラーコードが`"REF_NOT_FOUND"`である

## テスト環境の詳細

### セットアップ処理（beforeEach）

1. `/tmp/git-integration-test-{ランダムID}/`形式の一時ディレクトリを作成
2. `git init`でgitリポジトリを初期化
3. `git config`でユーザー情報を設定（ReferenceRepositoryテストのみ）
4. テスト用のReferenceRepositoryインスタンスを作成

### クリーンアップ処理（afterEach）

1. 一時ディレクトリとその中身を完全削除
2. メモリリークを防ぐためのリソース解放

## 実行例

```bash
$ node --import tsx --test tests/integration/**/*.test.ts

Created test git repository at: /tmp/git-integration-test-xyz123
🧪 Test: resolveHead returns correct SHA after initial commit
   Expected SHA from git: cce396ca7fc540ac47fcc83ee5613331be84c501
   ReferenceRepository result: cce396ca7fc540ac47fcc83ee5613331be84c501
   ✅ Test passed - resolveHead returned correct SHA
Cleaned up test repository: /tmp/git-integration-test-xyz123

✔ ReferenceRepository integration tests (192ms)
✔ gitUtils integration tests (73ms)
ℹ tests 9
ℹ suites 2
ℹ pass 9
ℹ fail 0
```

## トラブルシューティング

### よくある問題

1. **権限エラー**: `/tmp`ディレクトリに書き込み権限がない場合

   - 解決策: `/tmp`の権限を確認し、必要に応じて権限を修正

2. **gitコマンドが見つからない**: システムにgitがインストールされていない場合

   - 解決策: gitをインストール（`apt install git` など）

3. **一時ディレクトリの残留**: テスト中断時に一時ディレクトリが残る場合
   - 解決策: `/tmp/git-integration-test-*`を手動削除

### デバッグ情報

テスト実行中は以下の詳細ログが出力されます：

- 一時ディレクトリの作成・削除
- 各テストケースの実行状況
- 実際のSHA値と期待値の比較
- エラー発生時の詳細情報
