#!/bin/bash
set -e

echo "=== エッジケーステスト ==="

echo "Test 6-1: .gitディレクトリの追加（意地悪ケース）"

# 作業ディレクトリをクリーンアップ
rm -rf edge-test
mkdir edge-test
cd edge-test

# Gitリポジトリを初期化
git init > /dev/null 2>&1

# mygit commit の動作に必要なユーザー設定
git config user.email "test@example.com"
git config user.name "Test User"

# 初期状態のインデックス内容を記録
initial_files=$(git ls-files | wc -l)
echo "初期インデックスファイル数: $initial_files"

# .gitディレクトリの追加を試行
echo ".gitディレクトリの追加を試行:"

git_dir_output=$(mygit add .git/ 2>&1 || true)
echo "mygit add .git/ の出力:"
echo "$git_dir_output"

# インデックスの内容を確認（.gitディレクトリ内のファイルが追加されていないことを確認）
after_files=$(git ls-files | wc -l)
git_internal_files=$(git ls-files | grep -E "^\.git/" | wc -l || echo "0")

echo "追加後のインデックスファイル数: $after_files"
echo ".gitディレクトリ内のファイル数: $git_internal_files"

if [[ $git_internal_files -eq 0 ]]; then
    echo "✅ .gitディレクトリ内のファイルがインデックスに追加されなかった"
else
    echo "❌ .gitディレクトリ内のファイルがインデックスに追加された（$git_internal_files files）"
    echo "Added .git files:"
    git ls-files | grep -E "^\.git/" || echo "None found"
    exit 1
fi

echo "Test 6-2: バイナリファイルの処理"

# バイナリファイルの処理テスト
echo "バイナリファイル（PNG形式）を作成:"

# 小さなPNGファイルを作成（1x1ピクセル）
printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\x0d\n-\xdb\x00\x00\x00\x00IEND\xaeB`\x82' > test.png

echo "バイナリファイルを追加:"
mygit add test.png

if git ls-files | grep -q "test.png"; then
    echo "✅ バイナリファイルがインデックスに追加された"

    # コミットしてからバイナリデータが保持されているか確認
    mygit commit "Add binary PNG file"
    
    # git cat-fileでバイナリデータが保持されているか確認
    binary_check=$(git cat-file -p HEAD:test.png | xxd | head -1 | grep "89504e47" || echo "")
    
    if [[ -n "$binary_check" ]]; then
        echo "✅ バイナリデータが正しく保存された"
        echo "PNG header found: $binary_check"
    else
        echo "❌ バイナリデータが破損している可能性がある"
        echo "File content check:"
        git cat-file -p HEAD:test.png | xxd | head -3
    fi
else
    echo "❌ バイナリファイルの処理に失敗"
    exit 1
fi

echo "Test 6-3: 特殊文字を含むファイル名"

# 特殊文字を含むファイル名のテスト
special_files=(
    "file with spaces.txt"
    "file-with-dashes.txt"
    "file_with_underscores.txt"
    "file.with.dots.txt"
    "ファイル名.txt"  # 日本語（UTF-8対応確認）
)

echo "特殊文字を含むファイル名のテスト:"

for file in "${special_files[@]}"; do
    echo "Creating: $file"
    echo "Content of $file" > "$file"
    
    if mygit add "$file"; then
        if git ls-files | grep -F "$file" > /dev/null; then
            echo "✅ '$file' が正しく処理された"
        else
            echo "❌ '$file' がインデックスに見つからない"
        fi
    else
        echo "❌ '$file' の追加に失敗"
    fi
done

# 特殊文字ファイルをコミット
mygit commit "Add files with special characters"

echo "Test 6-4: 大きなファイルの処理"

# 適度に大きなファイルを作成（1MB程度）
echo "大きなファイル（1MB）を作成:"
dd if=/dev/zero of=large-file.bin bs=1024 count=1024 > /dev/null 2>&1

large_file_size=$(wc -c < large-file.bin)
echo "Created file size: ${large_file_size} bytes"

echo "大きなファイルを追加:"
if mygit add large-file.bin; then
    if git ls-files | grep -q "large-file.bin"; then
        echo "✅ 大きなファイルが正しく処理された"
        
        # コミットして確認
        mygit commit "Add large binary file"
        
        # ファイルサイズが保持されているか確認
        committed_size=$(git cat-file -s HEAD:large-file.bin)
        if [[ $committed_size -eq $large_file_size ]]; then
            echo "✅ 大きなファイルのサイズが正しく保持された"
        else
            echo "❌ 大きなファイルのサイズが変更された"
            echo "Original: $large_file_size bytes"
            echo "Committed: $committed_size bytes"
        fi
    else
        echo "❌ 大きなファイルがインデックスに見つからない"
    fi
else
    echo "❌ 大きなファイルの追加に失敗"
fi

echo "Test 6-5: 深いディレクトリ構造"

# 深いディレクトリ構造を作成
echo "深いディレクトリ構造を作成:"
deep_path="level1/level2/level3/level4/level5"
mkdir -p "$deep_path"
echo "Deep file content" > "$deep_path/deep-file.txt"

if mygit add "$deep_path/"; then
    if git ls-files | grep -q "$deep_path/deep-file.txt"; then
        echo "✅ 深いディレクトリ構造のファイルが正しく処理された"
    else
        echo "❌ 深いディレクトリ構造のファイルがインデックスに見つからない"
        echo "Looking for: $deep_path/deep-file.txt"
        echo "Found in index:"
        git ls-files | grep -E "level[0-9]" || echo "None"
        exit 1
    fi
else
    echo "❌ 深いディレクトリ構造の追加に失敗"
    exit 1
fi

echo "Test 6-6: 空ファイルの処理"

# 空ファイルを作成
echo "空ファイルを作成:"
touch empty-file.txt

if mygit add empty-file.txt; then
    if git ls-files | grep -q "empty-file.txt"; then
        echo "✅ 空ファイルが正しく処理された"
        
        # コミットして確認
        mygit commit "Add empty file and deep directory"
        
        # 空ファイルのサイズ確認
        empty_size=$(git cat-file -s HEAD:empty-file.txt)
        if [[ $empty_size -eq 0 ]]; then
            echo "✅ 空ファイルのサイズが正しく保持された"
        else
            echo "❌ 空ファイルのサイズが0でない: $empty_size bytes"
        fi
    else
        echo "❌ 空ファイルがインデックスに見つからない"
    fi
else
    echo "❌ 空ファイルの追加に失敗"
fi

echo "Test 6-7: 最終統計"

# 最終的なファイル統計
total_indexed_files=$(git ls-files | wc -l)
total_commits=$(git log --oneline | wc -l)

echo "最終統計:"
echo "- 総インデックスファイル数: $total_indexed_files"
echo "- 総コミット数: $total_commits"
echo "- インデックス内容一覧:"
git ls-files | sort

cd ..
echo "✅ エッジケーステストが全て完了しました"
