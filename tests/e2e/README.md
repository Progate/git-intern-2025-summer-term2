# E2E (End-to-End) Tests

このディレクトリには、mygitコマンドのE2Eテストが含まれています。

## 目的

E2Eテストは、実際のユーザーの使い方と同じようにコマンドを実行し、システム全体の動作を確認します。

- 実際のファイルシステムを使用
- .gitディレクトリの読み書き
- コマンドライン引数の処理
- 標準出力/標準エラー出力の確認

## 利用可能なテスト

### mygit log コマンド

**ファイル**: `log.e2e.test.ts`

### mygit add コマンド

**注意**: mygit addコマンドのE2Eテストは、複雑性とメンテナンス性の理由により、手動テストスクリプトに移行されました。

**推奨テスト方法**:

- **手動テストスクリプト**: `npm run test:add:manual`
- **単体テスト**: `npm run test:unit -- tests/unittest/services/addService.test.ts`
- **詳細**: `docs/TESTING_ADD.md`を参照

## テストケース一覧

### mygit log コマンド（詳細）

     - 操作: `git init` → `mygit add <存在しないファイル>`
     - テスト内容: 適切なエラーメッセージが表示されることを確認

- **ファイル引数なしでエラー**

1. **正常系**

   - **複数のコミット履歴を表示**
     - Git操作: `git init` → ファイル作成・`git add .` → `git commit -m 'first commit'` → ファイル作成・`git add .` → `git commit -m 'add feature'` → ファイル作成・`git add .` → `git commit -m 'fix bug'`
     - テスト内容: 3つのコミット履歴が最新から順番に表示されることを確認
   - **単一のコミット履歴を表示**
     - Git操作: `git init` → ファイル作成・`git add .` → `git commit -m 'initial commit'`
     - テスト内容: 1つだけのコミットが正しく表示されることを確認
   - **長いコミットメッセージを正しく表示**
     - Git操作: `git init` → ファイル作成・`git add .` → `git commit -m '複数行にわたる長いコミットメッセージ'`
     - テスト内容: 複数行・複数段落のコミットメッセージが正しく表示されることを確認
   - **特殊文字を含むコミットメッセージを正しく表示**
     - Git操作: `git init` → ファイル作成・`git add .` → `git commit -m '日本語や記号(!@#$%^&*())を含むメッセージ'`
     - テスト内容: 日本語や特殊文字が含まれるコミットメッセージが正しく表示されることを確認

2. **エラー系**

   - **.gitディレクトリが存在しない場合**
     - Git操作: なし（空のディレクトリのまま）
     - テスト内容: Gitリポジトリではない場所で`mygit log`を実行した際のエラーハンドリングを確認
   - **空のリポジトリの場合（コミットが存在しない）**
     - Git操作: `git init`のみ（コミットなし）
     - テスト内容: コミットが1つも存在しないリポジトリでのエラーハンドリングを確認
   - **HEADファイルが存在しない場合**
     - Git操作: `git init` → コミット作成後、`.git/HEAD`ファイルを手動削除
     - テスト内容: リポジトリが破損した状態でのエラーハンドリングを確認

3. **境界値**

   - **マージコミット（複数の親を持つコミット）**
     - Git操作: `git init` → 初期コミット → `git checkout -b feature` → featureブランチでコミット → `git checkout master` → `git merge feature --no-ff`
     - テスト内容: マージコミットを含む履歴が正しく表示されることを確認
   - **作者名に特殊文字が含まれる場合**
     - Git操作: `git init` → `git config user.name '田中 太郎'` → `git config user.email 'tanaka@例え.jp'` → コミット作成
     - テスト内容: 日本語の作者名やメールアドレスが正しく表示されることを確認
   - **コミットメッセージに改行が含まれる場合**
     - Git操作: `git init` → ファイル作成・`git add .` → `git commit -m 'multiline message\n\nSecond line\nThird line'`
     - テスト内容: 改行を含むコミットメッセージが正しく表示されることを確認

### mygit commit コマンド

各テストケースは、一時ディレクトリ（tmpディレクトリ）に作成されたGitリポジトリに対して特定のGit操作を実行した状態で`mygit commit <message>`を実行し、その挙動をテストしています。

1. **正常系**

   - **単一ファイルのコミット作成（フラット構造）**
     - Git操作: `git init` → ユーザー設定 → ファイル作成・`git add README.md` → `mygit commit <message>`
     - テスト内容: 単一ファイルがステージングされた状態でコミットが正しく作成されることを確認
   - **複数ファイルのコミット作成（フラット構造）**
     - Git操作: `git init` → ユーザー設定 → 複数ファイル作成・`git add .` → `mygit commit <message>`
     - テスト内容: 複数ファイルがステージングされた状態でコミットが正しく作成され、全ファイルがコミットに含まれることを確認

2. **階層構造**

   - **単一階層サブディレクトリのコミット作成**
     - Git操作: `git init` → ユーザー設定 → `src/main.js`と`README.md`作成・`git add .` → `mygit commit <message>`
     - テスト内容: サブディレクトリを含む階層構造でコミットが正しく作成され、`git ls-tree -r HEAD`で階層が確認できることを検証
   - **深い階層構造のコミット作成**
     - Git操作: `git init` → ユーザー設定 → `src/components/ui/Button.js`等の深い階層ファイル作成・`git add .` → `mygit commit <message>`
     - テスト内容: 3階層以上の深い構造でコミットが正しく作成され、全てのファイルが適切に追跡されることを確認
   - **Git標準コマンドとの互換性確認**
     - Git操作: `git init` → ユーザー設定 → 混在構造（フラット+階層）のファイル作成・`git add .` → `mygit commit <message>`
     - テスト内容: `git ls-tree`, `git show --name-status`での表示が正しく、ディレクトリが`040000 tree`として表現されることを確認

3. **エラー系**

   - **空のコミットメッセージを指定した場合**
     - Git操作: `git init` → ユーザー設定 → ファイル作成・`git add .`
     - テスト内容: 空のコミットメッセージでコミット実行時のエラーハンドリングを確認
   - **ステージされたファイルが存在しない場合**
     - Git操作: `git init` → ユーザー設定 → ファイル作成（`git add`なし）
     - テスト内容: ステージング状態のファイルがない場合のエラーハンドリングを確認
   - **ユーザー設定が未設定の場合**
     - Git操作: `git init` → ユーザー設定削除 → ファイル作成・`git add .`
     - テスト内容: `user.name`または`user.email`が設定されていない場合のエラーハンドリングを確認

## 実行方法

### 前提条件

- Node.js とnpmがインストールされていること
- プロジェクトの依存関係がインストールされていること（`npm install`）
- TypeScriptがビルドされていること（`npm run build`）

### 個別テスト実行

```bash
# 特定のテストファイルを実行
npm test tests/e2e/log.e2e.test.ts
npm test tests/e2e/commit.e2e.test.ts

# 特定のテストケースを実行（Node.js test runnerではテストケース指定は--grep使用）
node --import tsx --test tests/e2e/log.e2e.test.ts --grep "複数のコミット履歴を表示"
node --import tsx --test tests/e2e/commit.e2e.test.ts --grep "should create commit with single file"
node --import tsx --test tests/e2e/commit.e2e.test.ts --grep "should create commit with single level subdirectory"
```

### 全E2Eテスト実行

```bash
# e2eディレクトリ内の全テストを実行
npm run test:e2e

# または直接実行
node --import tsx --test tests/e2e/**/*.test.ts
```

### 詳細ログ付き実行

```bash
# デバッグ情報を含めて実行
node --import tsx --test tests/e2e/**/*.test.ts --reporter=verbose
```

## テスト環境

- 各テストは独立した一時ディレクトリで実行されます
- テスト用のGitリポジトリが自動的に作成・削除されます
- 実際のgitコマンドを使用してテストデータを準備します

## 注意事項

- E2Eテストは実際のファイルシステムを使用するため、実行時間がかかる場合があります
- テスト実行中は一時ファイルが作成されますが、テスト終了後に自動削除されます
- 並列実行時に競合状態が発生しないよう、各テストは独立したディレクトリを使用します
