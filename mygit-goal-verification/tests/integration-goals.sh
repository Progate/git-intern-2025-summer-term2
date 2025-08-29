#!/bin/bash
set -e

echo "=== 統合ワークフロー検証 ==="

# 作業ディレクトリをクリーンアップ
rm -rf integration-test
mkdir integration-test
cd integration-test

# Gitリポジトリを初期化
git init > /dev/null 2>&1

# mygit commit の動作に必要なユーザー設定
git config user.email "test@example.com"
git config user.name "Test User"

echo "Test 3-1: 完全なadd→commit→log ワークフロー"

# 複数ファイルを作成
echo "# Project Title" > README.md
echo "console.log('Hello, World!');" > main.js
mkdir -p src
echo "export function helper() { return 'helper'; }" > src/helper.js

# Step 1: 複数ファイルを一度に追加
echo "Step 1: 複数ファイルの追加"
mygit add README.md
mygit add main.js
mygit add src/

# インデックスの確認
indexed_files=$(git ls-files | sort)
expected_files="README.md
main.js
src/helper.js"

echo "インデックスされたファイル:"
echo "$indexed_files"

if [[ "$indexed_files" == "$expected_files" ]]; then
    echo "✅ 複数ファイル・ディレクトリが正しくインデックスされた"
else
    echo "❌ インデックスされたファイルが期待と異なる"
    echo "Expected:"
    echo "$expected_files"
    echo "Actual:"
    echo "$indexed_files"
    exit 1
fi

# Step 2: コミット実行
echo "Step 2: コミット実行"
commit_message="Initial project setup with multiple files"
mygit commit "$commit_message"

# Step 3: コミット後の状態確認
echo "Step 3: コミット後の状態確認"

# git status はクリーンである
status_clean=$(git status --porcelain)
if [[ -z "$status_clean" ]]; then
    echo "✅ コミット後のgit statusがクリーン"
else
    echo "❌ コミット後のgit statusにファイルが残っている"
    echo "Status:"
    echo "$status_clean"
    exit 1
fi

# git log でコミットが確認できる
log_message=$(git log -1 --pretty=format:"%s")
if [[ "$log_message" == "$commit_message" ]]; then
    echo "✅ git logでコミットメッセージを確認"
else
    echo "❌ git logのコミットメッセージが一致しない"
    echo "Expected: $commit_message"
    echo "Actual: $log_message"
    exit 1
fi

echo "Test 3-2: 変更→追加→コミットのサイクル"

# ファイルを変更
echo "# Updated Project Title" > README.md
echo "// Updated comment
console.log('Hello, Updated World!');" > main.js

# 新ファイルを追加
echo "export function newFeature() { return 'new'; }" > src/feature.js

# 段階的にadd
mygit add README.md
mygit add main.js
mygit add src/feature.js

# 部分的なステージ状態を確認
partial_status=$(git status --porcelain)
echo "部分的ステージ状態:"
echo "$partial_status"

# すべてのファイルがステージされているか確認
if echo "$partial_status" | grep -q "M  README.md" && \
   echo "$partial_status" | grep -q "M  main.js" && \
   echo "$partial_status" | grep -q "A  src/feature.js"; then
    echo "✅ ファイル変更と新規追加が正しくステージされた"
else
    echo "❌ ステージ状態が期待と異なる"
    echo "Expected: M  README.md, M  main.js, A  src/feature.js"
    echo "Actual:"
    echo "$partial_status"
    exit 1
fi

# コミット
mygit commit "Update existing files and add new feature"

# 最終的なログ確認
final_log=$(git log --oneline)
final_count=$(echo "$final_log" | wc -l)

if [[ $final_count -eq 2 ]]; then
    echo "✅ 2回のコミットが履歴に正しく記録された"
    echo "コミット履歴:"
    echo "$final_log"
else
    echo "❌ コミット履歴の数が期待と異なる"
    echo "Expected: 2 commits"
    echo "Actual: $final_count commits"
    echo "Log:"
    echo "$final_log"
    exit 1
fi

echo "Test 3-3: 空のディレクトリとサブディレクトリの処理"

# 空のディレクトリとファイル付きディレクトリを作成
mkdir -p empty-dir
mkdir -p deep/nested/structure
echo "deep file" > deep/nested/structure/deep.txt
mkdir -p another/path
echo "another file" > another/path/file.txt

# ディレクトリを追加
mygit add deep/
mygit add another/

# 空のディレクトリは無視される（gitの仕様）
indexed_after_dir=$(git ls-files | grep -E "(deep|another)" | sort)
expected_dir_files="another/path/file.txt
deep/nested/structure/deep.txt"

if [[ "$indexed_after_dir" == "$expected_dir_files" ]]; then
    echo "✅ サブディレクトリのファイルが正しく追加された"
else
    echo "❌ サブディレクトリの処理に問題がある"
    echo "Expected:"
    echo "$expected_dir_files"
    echo "Actual:"
    echo "$indexed_after_dir"
    exit 1
fi

# 最終コミット
mygit commit "Add nested directory structures"

# すべてがクリーンな状態で終了することを確認
final_status=$(git status --porcelain)
if [[ -z "$final_status" ]]; then
    echo "✅ 統合ワークフローが完了し、リポジトリがクリーンな状態"
else
    echo "❌ 統合ワークフロー完了後にファイルが残っている"
    echo "Final status:"
    echo "$final_status"
    exit 1
fi

# 最終的なコミット数確認
total_commits=$(git log --oneline | wc -l)
echo "総コミット数: $total_commits"

cd ..
echo "✅ 統合ワークフロー検証が全て完了しました"
