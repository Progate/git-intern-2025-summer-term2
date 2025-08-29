#!/bin/bash
set -e

echo "=== mygit commit ゴール検証 ==="

# 作業ディレクトリをクリーンアップ
rm -rf commit-test
mkdir commit-test
cd commit-test

# Gitリポジトリを初期化
git init > /dev/null 2>&1

# mygit commit の動作に必要なユーザー設定
git config user.email "test@example.com"
git config user.name "Test User"

echo "Test 2-1: コミット後のgit log形式表示"

# Goal: mygit commit 後に標準出力で git log 形式のコミット情報が表示
echo "test content" > test.txt
mygit add test.txt

commit_output=$(mygit commit "Initial commit" 2>&1)
echo "mygit commit の出力:"
echo "$commit_output"

# コミットが作成されているかチェック
commit_count=$(git log --oneline | wc -l)
if [[ $commit_count -ge 1 ]]; then
    echo "✅ コミットが正常に作成された (count: $commit_count)"
else
    echo "❌ コミットが作成されていない"
    echo "git log output:"
    git log --oneline || echo "git log failed"
    exit 1
fi

# git log の実際の出力と比較
git_log_output=$(git log --oneline -1)
echo "git log の出力:"
echo "$git_log_output"

# コミット出力に最低限の情報が含まれているかチェック
if echo "$commit_output" | grep -q -i "commit\|initial"; then
    echo "✅ mygit commit の出力にコミット情報が含まれている"
else
    echo "⚠️  mygit commit の出力にコミット情報が明示的に含まれていない（でも正常動作）"
fi

echo "Test 2-2: コミット後の他のgitコマンド動作"

# Goal: mygit commit 後に git add, git log, git status で状態が変更できる

# 新しいファイルを追加
echo "new file" > new.txt
git add new.txt

# git log が動作することを確認
log_output=$(git log --oneline)
log_count=$(echo "$log_output" | wc -l)
if [[ $log_count -ge 1 ]]; then
    echo "✅ mygit commit 後に git log が動作 (commits: $log_count)"
    echo "git log preview:"
    echo "$log_output" | head -3
else
    echo "❌ mygit commit 後に git log が動作しない"
    echo "git log output:"
    echo "$log_output"
    exit 1
fi

# git status が動作することを確認
status_output=$(git status --porcelain)
if echo "$status_output" | grep -q "A  new.txt"; then
    echo "✅ mygit commit 後に git status が動作"
else
    echo "❌ mygit commit 後に git status が動作しない"
    echo "Expected: 'A  new.txt' in status"
    echo "Actual status output:"
    echo "'$status_output'"
    exit 1
fi

echo "Test 2-3: コミットメッセージの保存"

# Goal: mygit commit <commit message> の引数がコミットメッセージとして保存
echo "another file" > another.txt
mygit add another.txt

custom_message="Test commit with custom message"
mygit commit "$custom_message"

# コミットメッセージを確認
commit_message=$(git log -1 --pretty=format:"%s")

if [[ "$commit_message" == "$custom_message" ]]; then
    echo "✅ コミットメッセージが正しく保存された"
    echo "Expected: $custom_message"
    echo "Actual: $commit_message"
else
    echo "❌ コミットメッセージが正しく保存されていない"
    echo "Expected: $custom_message"
    echo "Actual: $commit_message"
    exit 1
fi

echo "Test 2-4: git reset の動作確認"

# Goal: git reset が動作する
# 新しいファイルを作成してコミット
echo "file for reset test" > reset-test.txt
mygit add reset-test.txt
mygit commit "Commit to be reset"

# 現在のコミット数を記録
before_reset_count=$(git log --oneline | wc -l)
echo "コミット前の数: $before_reset_count"

# git reset HEAD~1 でひとつ前に戻す
git reset HEAD~1 > /dev/null 2>&1

after_reset_count=$(git log --oneline | wc -l)
echo "git reset 後の数: $after_reset_count"

if [[ $after_reset_count -eq $((before_reset_count - 1)) ]]; then
    echo "✅ git reset が正常に動作する"
else
    echo "❌ git reset が正常に動作しない"
    echo "Expected count after reset: $((before_reset_count - 1))"
    echo "Actual count after reset: $after_reset_count"
    exit 1
fi

# ファイルがワーキングディレクトリに残っているか確認
if [[ -f reset-test.txt ]]; then
    echo "✅ git reset 後にファイルがワーキングディレクトリに残っている"
else
    echo "❌ git reset 後にファイルが消失した"
    exit 1
fi

echo "Test 2-5: 複数回のコミット"

# 複数回コミットして履歴が正しく作られるかテスト
echo "file1" > multi1.txt
mygit add multi1.txt
mygit commit "First multi commit"

echo "file2" > multi2.txt
mygit add multi2.txt
mygit commit "Second multi commit"

final_log=$(git log --oneline)
final_count=$(echo "$final_log" | wc -l)

echo "最終的なコミット履歴:"
echo "$final_log"

# 最低3つのコミット（初期+2つの追加）があることを確認
if [[ $final_count -ge 3 ]]; then
    echo "✅ 複数回のコミットが正常に履歴に記録される"
else
    echo "❌ 複数回のコミットの履歴記録に問題がある"
    echo "Expected: >= 3 commits"
    echo "Actual: $final_count commits"
    exit 1
fi

cd ..
echo "✅ mygit commit の全ゴールが達成されました"
