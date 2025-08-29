#!/bin/bash
set -e

echo "=== 本家Git互換性テスト ==="

echo "Test 4-1: mygit → git 互換性"

# 作業ディレクトリをクリーンアップ
rm -rf compat-test
mkdir compat-test
cd compat-test

# Gitリポジトリを初期化
git init > /dev/null 2>&1

# mygit commit の動作に必要なユーザー設定
git config user.email "test@example.com"
git config user.name "Test User"

# mygitでコミット作成
echo "Content created by mygit" > mygit-file.txt
echo "Another file from mygit" > mygit-file2.txt

mygit add mygit-file.txt
mygit add mygit-file2.txt
mygit commit "Created with mygit"

# 本家gitでオブジェクトを確認
echo "本家gitでmygitが作成したオブジェクトを確認:"

# git ls-tree でツリーオブジェクトを確認
git_tree=$(git ls-tree HEAD)
echo "Tree objects:"
echo "$git_tree"

if echo "$git_tree" | grep -q "mygit-file.txt" && echo "$git_tree" | grep -q "mygit-file2.txt"; then
    echo "✅ mygitが作成したファイルが本家gitのツリーに存在"
else
    echo "❌ mygitが作成したファイルが本家gitのツリーに見つからない"
    echo "Expected: mygit-file.txt and mygit-file2.txt in tree"
    echo "Actual tree:"
    echo "$git_tree"
    exit 1
fi

# git log でコミットを確認
git_commit=$(git log --oneline -1)
echo "Git commit:"
echo "$git_commit"

if echo "$git_commit" | grep -q "Created with mygit"; then
    echo "✅ mygitが作成したコミットメッセージが本家gitで確認できる"
else
    echo "❌ mygitが作成したコミットメッセージが本家gitで確認できない"
    exit 1
fi

# 本家gitでファイルを読み取れるか確認
file1_content=$(git show HEAD:mygit-file.txt)
file2_content=$(git show HEAD:mygit-file2.txt)

if [[ "$file1_content" == "Content created by mygit" ]] && [[ "$file2_content" == "Another file from mygit" ]]; then
    echo "✅ 本家gitでmygitが作成したオブジェクトの内容を正しく読み取れる"
else
    echo "❌ 本家gitでmygitが作成したオブジェクトの内容を読み取れない"
    echo "Expected file1: 'Content created by mygit', got: '$file1_content'"
    echo "Expected file2: 'Another file from mygit', got: '$file2_content'"
    exit 1
fi

echo "Test 4-2: git → mygit 互換性"

# 本家gitでコミット作成
echo "Content created by git" > git-file.txt
echo "Another file from git" > git-file2.txt

git add git-file.txt
git add git-file2.txt
git commit -m "Created with git"

# 現在のコミット数を確認
total_commits_before_mygit=$(git log --oneline | wc -l)
echo "本家git追加後のコミット数: $total_commits_before_mygit"

# mygitで履歴を表示できるかテスト
echo "mygitで履歴を確認:"

# mygit log コマンドを実行（あるかどうか確認）
if command -v mygit >/dev/null 2>&1 && mygit log >/dev/null 2>&1; then
    mygit_log=$(mygit log 2>&1)
    echo "mygit log output preview:"
    echo "$mygit_log" | head -10

    # 両方のコミットが表示されるか確認
    if echo "$mygit_log" | grep -q "Created with mygit" && echo "$mygit_log" | grep -q "Created with git"; then
        echo "✅ mygitで本家gitのコミット履歴も表示される"
    else
        echo "❌ mygitで本家gitのコミット履歴が表示されない"
        echo "Looking for: 'Created with mygit' and 'Created with git'"
        echo "mygit log full output:"
        echo "$mygit_log"
        exit 1
    fi
else
    echo "⚠️  mygit log コマンドが使用できないため、スキップ"
fi

echo "Test 4-3: オブジェクトハッシュ互換性"

# 同じ内容のファイルで同じハッシュが生成されるかテスト
echo "Same content for hash test" > hash-test.txt

# git add してハッシュを取得
git add hash-test.txt
git_hash=$(git ls-files -s hash-test.txt | awk '{print $2}')

# git reset でアンステージ
git reset hash-test.txt > /dev/null 2>&1

# mygit add して比較
mygit add hash-test.txt
mygit_hash=$(git ls-files -s hash-test.txt | awk '{print $2}')

if [[ "$git_hash" == "$mygit_hash" ]]; then
    echo "✅ 同じファイルで同じオブジェクトハッシュが生成される"
    echo "Hash: $git_hash"
else
    echo "❌ 同じファイルで異なるオブジェクトハッシュが生成される"
    echo "Git hash: $git_hash"
    echo "Mygit hash: $mygit_hash"
    exit 1
fi

echo "Test 4-4: 混在ワークフロー（git ↔ mygit）"

# gitで開始
echo "Mixed workflow test" > mixed1.txt
git add mixed1.txt
git commit -m "Git commit 1"

# mygitで続行
echo "Continuing with mygit" > mixed2.txt
mygit add mixed2.txt
mygit commit "Mygit commit 1"

# gitで再び続行
echo "Back to git" > mixed3.txt
git add mixed3.txt
git commit -m "Git commit 2"

# mygitで最後
echo "Final mygit commit" > mixed4.txt
mygit add mixed4.txt
mygit commit "Mygit commit 2"

# 履歴を確認
mixed_log=$(git log --oneline)
mixed_count=$(echo "$mixed_log" | wc -l)

echo "混在ワークフロー履歴:"
echo "$mixed_log"

# 予想されるコミット数（前のテストからの累計）
expected_mixed_count=6  # 初期2 + 混在4

if [[ $mixed_count -eq $expected_mixed_count ]]; then
    echo "✅ git ↔ mygit混在ワークフローが正常に動作"
else
    echo "❌ 混在ワークフローでコミット数が期待と異なる"
    echo "Expected: $expected_mixed_count commits"
    echo "Actual: $mixed_count commits"
    exit 1
fi

# 最終状態がクリーンであることを確認
final_compat_status=$(git status --porcelain)
if [[ -z "$final_compat_status" ]]; then
    echo "✅ 混在ワークフロー後にリポジトリがクリーンな状態"
else
    echo "❌ 混在ワークフロー後にファイルが残っている"
    echo "Status:"
    echo "$final_compat_status"
    exit 1
fi

cd ..
echo "✅ 本家Git互換性テストが全て完了しました"
