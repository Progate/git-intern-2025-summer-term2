#!/bin/bash
set -e

echo "=== mygit add ゴール検証 ==="

# 作業ディレクトリをクリーンアップ
rm -rf test-repo
mkdir test-repo
cd test-repo

# Gitリポジトリを初期化
git init > /dev/null 2>&1

# テスト用ファイルを作成
echo "Hello World" > README.md
echo "console.log('test')" > app.js

echo "Test 1-1: ファイルをインデックスに追加"

# Goal: mygit add <file> でファイルをインデックスに追加
echo "Testing: mygit add README.md"
if ! mygit add README.md; then
    echo "❌ mygit add README.md が失敗しました"
    exit 1
fi

# 検証: git ls-files でステージされていることを確認
if git ls-files | grep -q "README.md"; then
    echo "✅ README.md がインデックスに追加された"
else
    echo "❌ README.md がインデックスに追加されていない"
    exit 1
fi

echo "Test 1-2: git add と mygit add の結果比較"

# Goal: git add と mygit add で同じ結果
echo "Testing: git add と mygit add の結果比較"
git add app.js
mygit_status=$(git status --porcelain)
echo "Status after mygit add README.md and git add app.js:"
echo "$mygit_status"

if echo "$mygit_status" | grep -q "A  README.md" && echo "$mygit_status" | grep -q "A  app.js"; then
    echo "✅ mygit add と git add で同じ結果"
else
    echo "❌ mygit add と git add で結果が異なる"
    echo "Expected: Both files should be in 'A ' (added) state"
    echo "Actual status:"
    echo "$mygit_status"
    exit 1
fi

echo "Test 1-3: ディレクトリをインデックスに追加"

# Goal: mygit add <directory> でディレクトリをインデックスに追加
mkdir src
echo "export const util = () => {}" > src/utils.js
echo "export const main = () => {}" > src/main.js

if ! mygit add src/; then
    echo "❌ mygit add src/ が失敗しました"
    exit 1
fi

# 検証
if git ls-files | grep -q "src/utils.js" && git ls-files | grep -q "src/main.js"; then
    echo "✅ ディレクトリが正しくインデックスに追加された"
else
    echo "❌ ディレクトリの追加に失敗"
    echo "Expected files: src/utils.js, src/main.js"
    echo "Actual indexed files:"
    git ls-files
    exit 1
fi

echo "Test 1-4: git diff --staged での確認"

# 新しいリポジトリで確認（前のテストの影響を避けるため）
cd ..
rm -rf test-repo2
mkdir test-repo2
cd test-repo2
git init > /dev/null 2>&1

# Goal: mygit add 実行後、git diff --staged でステージされた変更が確認できる
echo "initial content" > README.md
mygit add README.md

staged_diff=$(git diff --staged README.md)
if [[ -n "$staged_diff" ]]; then
    echo "✅ git diff --staged でステージされた変更を確認"
    echo "Staged changes preview:"
    echo "$staged_diff" | head -5
else
    echo "❌ ステージされた変更が git diff --staged で確認できない"
    echo "git diff --staged README.md の結果:"
    echo "'$staged_diff'"
    echo "git ls-files の結果:"
    git ls-files
    exit 1
fi

echo "Test 1-5: ステージ取り消し・再追加の動作"

# Goal: mygit add した後に git restore --staged, git commit, mygit add で元に戻せる
# 最初にコミットを作成（git restore --staged を使うためにHEADが必要）
git config user.email "test@example.com"
git config user.name "Test User"
git commit -m "Initial commit" > /dev/null 2>&1

echo "modified content" > README.md
mygit add README.md

# git restore --staged で取り消し
git restore --staged README.md
unstaged_status=$(git status --porcelain README.md)

if [[ "$unstaged_status" =~ ^\ M ]]; then
    echo "✅ git restore --staged でステージを取り消せる"
else
    echo "❌ git restore --staged でステージが取り消されていない"
    echo "Expected: ' M README.md' (modified, not staged)"
    echo "Actual: '$unstaged_status'"
    exit 1
fi

# 再度 mygit add
mygit add README.md
restaged_status=$(git status --porcelain README.md)

if [[ "$restaged_status" =~ ^M ]]; then
    echo "✅ 取り消し後の再追加が正常に動作"
else
    echo "❌ 取り消し後の再追加に失敗"
    echo "Expected: 'M  README.md' (modified, staged)"
    echo "Actual: '$restaged_status'"
    exit 1
fi

cd ..
echo "✅ mygit add の全ゴールが達成されました"
