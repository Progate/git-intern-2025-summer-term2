#!/bin/bash
set -e

echo "=== 基本的なadd→commitフロー ==="

# 作業ディレクトリをクリーンアップ
rm -rf basic-flow-test
mkdir basic-flow-test
cd basic-flow-test

echo "Scenario 1: 単一ファイルの基本フロー"

# Gitリポジトリを初期化
git init > /dev/null 2>&1

# mygit commit の動作に必要なユーザー設定
git config user.email "test@example.com"
git config user.name "Test User"

# 単一ファイルを作成
echo "Hello, Git World!" > hello.txt

# 初期状態の確認
initial_status=$(git status --porcelain)
if echo "$initial_status" | grep -q "?? hello.txt"; then
    echo "✅ 新規ファイルがuntracked状態で認識された"
else
    echo "❌ 新規ファイルの初期状態が正しくない"
    echo "Expected: ?? hello.txt"
    echo "Actual status:"
    echo "$initial_status"
    exit 1
fi

# mygit add で追加
mygit add hello.txt

# ステージ後の状態確認
staged_status=$(git status --porcelain)
if echo "$staged_status" | grep -q "A  hello.txt"; then
    echo "✅ ファイルがステージされた"
else
    echo "❌ ファイルがステージされていない"
    echo "Expected: A  hello.txt"
    echo "Actual status:"
    echo "$staged_status"
    exit 1
fi

# コミット実行
mygit commit "Add hello.txt with greeting message"

# コミット後の状態確認
commit_status=$(git status --porcelain)
if [[ -z "$commit_status" ]]; then
    echo "✅ コミット後にリポジトリがクリーンな状態"
else
    echo "❌ コミット後にファイルが残っている"
    echo "Status:"
    echo "$commit_status"
    exit 1
fi

echo "Scenario 2: 複数ファイルの段階的フロー"

# 複数ファイルを作成
echo "# My Project" > README.md
echo "const message = 'Hello World';" > app.js
echo "body { margin: 0; }" > style.css

# 段階的に追加
echo "Step 1: README.md を追加"
mygit add README.md

step1_status=$(git status --porcelain)
if echo "$step1_status" | grep -q "A  README.md" && \
   echo "$step1_status" | grep -q "?? app.js" && \
   echo "$step1_status" | grep -q "?? style.css"; then
    echo "✅ 1つのファイルがステージされ、他はuntrackedのまま"
else
    echo "❌ 段階的追加の状態が正しくない"
    echo "Expected: A  README.md, ?? app.js, ?? style.css"
    echo "Actual:"
    echo "$step1_status"
    exit 1
fi

echo "Step 2: 残りのファイルを追加"
mygit add app.js
mygit add style.css

step2_status=$(git status --porcelain)
if echo "$step2_status" | grep -q "A  README.md" && \
   echo "$step2_status" | grep -q "A  app.js" && \
   echo "$step2_status" | grep -q "A  style.css"; then
    echo "✅ 全てのファイルがステージされた"
else
    echo "❌ 全ファイル追加後の状態が正しくない"
    echo "Expected: All files with 'A ' status"
    echo "Actual:"
    echo "$step2_status"
    exit 1
fi

echo "Step 3: コミット実行"
mygit commit "Add project files: README, JavaScript, and CSS"

# 最終状態確認
final_status=$(git status --porcelain)
if [[ -z "$final_status" ]]; then
    echo "✅ 全ファイルコミット後にリポジトリがクリーンな状態"
else
    echo "❌ コミット後にファイルが残っている"
    echo "Final status:"
    echo "$final_status"
    exit 1
fi

echo "Scenario 3: ファイル変更と新規ファイル混在フロー"

# 既存ファイルを変更
echo "# My Updated Project
This is an updated version." > README.md

# 新規ファイルを作成
echo "test('should work', () => { expect(true).toBe(true); });" > app.test.js

# 混在状態の確認
mixed_status=$(git status --porcelain)
if echo "$mixed_status" | grep -q " M README.md" && \
   echo "$mixed_status" | grep -q "?? app.test.js"; then
    echo "✅ ファイル変更と新規ファイルが正しく検出された"
else
    echo "❌ 混在状態の検出が正しくない"
    echo "Expected: ' M README.md', '?? app.test.js'"
    echo "Actual:"
    echo "$mixed_status"
    exit 1
fi

# 両方を追加
mygit add README.md
mygit add app.test.js

# ステージ状態確認
mixed_staged=$(git status --porcelain)
if echo "$mixed_staged" | grep -q "M  README.md" && \
   echo "$mixed_staged" | grep -q "A  app.test.js"; then
    echo "✅ 変更されたファイルと新規ファイルが正しくステージされた"
else
    echo "❌ 混在ステージ状態が正しくない"
    echo "Expected: 'M  README.md', 'A  app.test.js'"
    echo "Actual:"
    echo "$mixed_staged"
    exit 1
fi

# 最終コミット
mygit commit "Update README and add test file"

# 履歴確認
total_commits=$(git log --oneline | wc -l)
if [[ $total_commits -eq 3 ]]; then
    echo "✅ 3回のコミットが履歴に記録された"
else
    echo "❌ コミット履歴の数が期待と異なる"
    echo "Expected: 3 commits"
    echo "Actual: $total_commits commits"
    exit 1
fi

# 最終ログ出力
echo "最終的なコミット履歴:"
git log --oneline

cd ..
echo "✅ 基本的なadd→commitフローの全シナリオが完了しました"
