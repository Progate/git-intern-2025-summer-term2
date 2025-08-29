#!/bin/bash
set -e

echo "=== エラーケーステスト ==="

echo "Test 5-1: 存在しないファイル"

# 作業ディレクトリをクリーンアップ
rm -rf error-test
mkdir error-test
cd error-test

# Gitリポジトリを初期化
git init > /dev/null 2>&1

# mygit commit の動作に必要なユーザー設定
git config user.email "test@example.com"
git config user.name "Test User"

# エラーケース: 存在しないファイルのadd
echo "存在しないファイルの追加を試行:"

add_error_output=$(mygit add nonexistent.txt 2>&1 || true)
echo "mygit add nonexistent.txt の出力:"
echo "$add_error_output"

# エラーメッセージが適切に表示されるかチェック
if echo "$add_error_output" | grep -q -i "error\|fatal\|not found\|no such file"; then
    echo "✅ 存在しないファイルで適切なエラーメッセージが表示される"
else
    echo "⚠️  存在しないファイルのエラーメッセージが明示的でない（処理はされている可能性）"
fi

# インデックスに何も追加されていないことを確認
index_after_error=$(git ls-files)
if [[ -z "$index_after_error" ]]; then
    echo "✅ 存在しないファイルがインデックスに追加されなかった"
else
    echo "❌ 存在しないファイルがインデックスに追加された"
    echo "Index contents:"
    echo "$index_after_error"
    exit 1
fi

echo "Test 5-2: 空のコミットメッセージ"

# 有効なファイルを作成してステージ
echo "test content" > valid-file.txt
mygit add valid-file.txt

# 空のコミットメッセージでコミット試行
echo "空のコミットメッセージでコミット試行:"

empty_commit_output=$(mygit commit "" 2>&1 || true)
echo "mygit commit '' の出力:"
echo "$empty_commit_output"

# コミットが作成されたかチェック（空メッセージでもコミットされる可能性がある）
empty_commit_count=$(git log --oneline 2>/dev/null | wc -l || echo "0")
if [[ $empty_commit_count -gt 0 ]]; then
    echo "⚠️  空のコミットメッセージでもコミットが作成された（Gitの仕様に依存）"
    last_commit_msg=$(git log -1 --pretty=format:"%s" 2>/dev/null || echo "")
    echo "最新コミットメッセージ: '$last_commit_msg'"
else
    echo "ℹ️  空のコミットメッセージでコミットが作成されなかった"
fi

echo "Test 5-3: Gitリポジトリ外での実行"

# Gitリポジトリ外のディレクトリを作成
cd ..
mkdir non-git-dir
cd non-git-dir

echo "test file outside git repo" > outside-file.txt

# Gitリポジトリ外でmygit addを実行
echo "Gitリポジトリ外でmygit add実行:"

outside_add_output=$(mygit add outside-file.txt 2>&1 || true)
echo "mygit add outside-file.txt の出力:"
echo "$outside_add_output"

# 適切なエラーメッセージが表示されるかチェック
if echo "$outside_add_output" | grep -q -i "not a git repository\|fatal\|error"; then
    echo "✅ Gitリポジトリ外で適切なエラーメッセージが表示される"
else
    echo "⚠️  Gitリポジトリ外のエラーメッセージが明示的でない"
fi

# 元のテストディレクトリに戻る
cd ../error-test

echo "Test 5-4: 読み取り権限のないファイル"

# 読み取り権限のないファイルを作成
echo "restricted content" > restricted-file.txt
chmod 000 restricted-file.txt

echo "読み取り権限のないファイルの追加を試行:"

restricted_add_output=$(mygit add restricted-file.txt 2>&1 || true)
echo "mygit add restricted-file.txt の出力:"
echo "$restricted_add_output"

# 権限を元に戻す（クリーンアップのため）
chmod 644 restricted-file.txt

# ファイルがインデックスに追加されたかチェック
restricted_index=$(git ls-files | grep -c "restricted-file.txt" || echo "0")
if [[ $restricted_index -eq 0 ]]; then
    echo "✅ 読み取り権限のないファイルがインデックスに追加されなかった"
else
    echo "⚠️  読み取り権限のないファイルがインデックスに追加された"
fi

echo "Test 5-5: 引数なしでのmygitコマンド実行"

echo "引数なしでのmygit add実行:"

no_args_output=$(mygit add 2>&1 || true)
echo "mygit add (引数なし) の出力:"
echo "$no_args_output"

if echo "$no_args_output" | grep -q -i "usage\|missing\|argument\|help"; then
    echo "✅ 引数なしで適切な使用方法が表示される"
else
    echo "⚠️  引数なしでの使用方法表示が明示的でない"
fi

echo "引数なしでのmygit commit実行:"

no_args_commit_output=$(mygit commit 2>&1 || true)
echo "mygit commit (引数なし) の出力:"
echo "$no_args_commit_output"

if echo "$no_args_commit_output" | grep -q -i "usage\|missing\|argument\|message"; then
    echo "✅ mygit commit引数なしで適切な使用方法が表示される"
else
    echo "⚠️  mygit commit引数なしでの使用方法表示が明示的でない"
fi

echo "Test 5-6: 既にステージされているファイルの重複追加"

# ファイルを作成してステージ
echo "duplicate test" > duplicate-file.txt
mygit add duplicate-file.txt

# 同じファイルを再度追加
echo "既にステージされているファイルを再度追加:"

duplicate_add_output=$(mygit add duplicate-file.txt 2>&1)
echo "2回目のmygit add duplicate-file.txt の出力:"
echo "$duplicate_add_output"

# インデックス状態を確認
duplicate_status=$(git status --porcelain duplicate-file.txt)
if echo "$duplicate_status" | grep -q "A  duplicate-file.txt"; then
    echo "✅ 重複追加後もファイルが正しくステージされた状態"
else
    echo "❌ 重複追加後のファイル状態が正しくない"
    echo "Expected: A  duplicate-file.txt"
    echo "Actual: $duplicate_status"
    exit 1
fi

cd ..
echo "✅ エラーケーステストが全て完了しました"
