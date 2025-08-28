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

### 2. IndexRepository Integration Tests (`tests/integration/repositories/indexRepository.integration.test.ts`)

`src/repositories/indexRepository.ts`の以下のメソッドをテストします：

#### `read returns empty IndexRepository when no index file exists`

- **テスト内容**: インデックスファイルが存在しない場合に空のIndexRepositoryを返す
- **入力**:
  - `.git`ディレクトリパス
  - インデックスファイル（`.git/index`）が存在しない状態
- **探査対象**: 存在しない`.git/index`ファイル
- **期待される戻り値**: 空のIndexRepositoryインスタンス
- **検証内容**:
  - エントリ数が0である
  - `isEmpty()`がtrueを返す

#### `read returns IndexRepository with entries after git add`

- **テスト内容**: `git add`後のインデックスを正しく読み込む
- **入力**:
  - `test.txt`ファイルを`git add`で追加済み
  - `.git/index`ファイルが存在する状態
- **探査対象**: `.git/index`ファイルの内容
- **期待される戻り値**: エントリを含むIndexRepositoryインスタンス
- **検証内容**:
  - エントリ数が1である
  - `hasEntry("test.txt")`がtrueを返す
  - エントリのパス、サイズ、オブジェクトIDが正しい
  - オブジェクトIDが40文字の16進数である

#### `write creates valid index file that git can read`

- **テスト内容**: IndexRepositoryが書き込んだファイルをGitが正しく認識する
- **入力**:
  - 手動で作成したIndexRepositoryエントリ
  - ファイル統計情報とSHA-1ハッシュ
- **探査対象**: IndexRepositoryが生成した`.git/index`ファイル
- **期待される戻り値**: Gitコマンドで認識可能なインデックスファイル
- **検証内容**:
  - `git ls-files --cached`でファイルが表示される
  - インデックスファイルが正常に作成される

#### `add and remove operations work correctly`

- **テスト内容**: エントリの追加・削除操作が正しく動作する
- **入力**:
  - 複数のテストファイル（`file1.txt`, `file2.txt`, `file3.txt`）
  - 各ファイルの統計情報とSHA-1ハッシュ
- **探査対象**: IndexRepositoryの内部状態
- **期待される戻り値**: 正しく管理されたエントリ状態
- **検証内容**:
  - 全ファイル追加後にエントリ数が3である
  - 各ファイルが`hasEntry()`で確認できる
  - 1ファイル削除後にエントリ数が2である
  - 削除されたファイルが`hasEntry()`でfalseを返す

#### `getAllEntries returns sorted entries`

- **テスト内容**: エントリがパス名順にソートされて返される
- **入力**:
  - 意図的に順番を混ぜたファイル（`zebra.txt`, `apple.txt`, `banana.txt`）
- **探査対象**: `getAllEntries()`メソッドの戻り値
- **期待される戻り値**: パス名順にソートされたエントリ配列
- **検証内容**:
  - エントリ数が3である
  - 1番目のエントリのパスが`apple.txt`である
  - 2番目のエントリのパスが`banana.txt`である
  - 3番目のエントリのパスが`zebra.txt`である

#### `read throws error when index file is corrupted`

- **テスト内容**: 破損したインデックスファイルに対してエラーを投げる
- **入力**:
  - 不正なデータが書き込まれた`.git/index`ファイル
- **探査対象**: 破損した`.git/index`ファイル
- **期待される戻り値**: `IndexRepositoryError`例外（エラーコード: `"READ_ERROR"`）
- **検証内容**:
  - `IndexRepositoryError`のインスタンスが投げられる
  - エラーコードが`"READ_ERROR"`である

#### `roundtrip: write then read preserves data`

- **テスト内容**: 書き込み→読み込みのラウンドトリップでデータが保持される
- **入力**:
  - `roundtrip.txt`ファイルとそのメタデータ
  - 特定のSHA-1ハッシュ
- **探査対象**: ファイル書き込み後の再読み込み結果
- **期待される戻り値**: 元のデータと同じ内容のIndexRepository
- **検証内容**:
  - 再読み込み後のエントリ数が1である
  - ファイルパス、オブジェクトID、サイズが保持されている
  - 全ての属性が元の値と一致する

### 3. ReferenceRepository Integration Tests (`tests/integration/repositories/referenceRepository.integration.test.ts`)

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

Created test git repository at: /tmp/git-index-integration-test-xyz123
🧪 Test: read returns empty IndexRepository when no index file exists
   ✅ Test passed - empty IndexRepository created
Cleaned up test repository: /tmp/git-index-integration-test-xyz123

Created test git repository at: /tmp/git-index-integration-test-abc456
🧪 Test: read returns IndexRepository with entries after git add
   ✅ Test passed - IndexRepository read entries correctly
Cleaned up test repository: /tmp/git-index-integration-test-abc456

✔ IndexRepository integration tests (830ms)

Created test git repository at: /tmp/git-integration-test-xyz123
🧪 Test: resolveHead returns correct SHA after initial commit
   Expected SHA from git: cce396ca7fc540ac47fcc83ee5613331be84c501
   ReferenceRepository result: cce396ca7fc540ac47fcc83ee5613331be84c501
   ✅ Test passed - resolveHead returned correct SHA
Cleaned up test repository: /tmp/git-integration-test-xyz123

✔ ReferenceRepository integration tests (871ms)
✔ gitUtils integration tests (147ms)
ℹ tests 16
ℹ suites 3
ℹ pass 16
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
