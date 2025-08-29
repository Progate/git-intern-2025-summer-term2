#!/bin/bash

echo "=== mygit ゴール達成確認テスト実行 ==="
echo "実行日時: $(date)"
echo ""

# プロジェクトのルートディレクトリに移動
cd /home/ry/project/git-intern-2025-summer-term2

# プロジェクトがビルドされているかチェック
if [ ! -d "dist" ]; then
    echo "distディレクトリが見つかりません。プロジェクトをビルドします..."
    npm run build
fi

# mygitバイナリに実行権限を付与
chmod +x bin/main.mjs

echo "テスト環境を準備完了しました。"
echo ""
echo "次のコマンドでテストを実行してください:"
echo "cd /home/ry/project/git-intern-2025-summer-term2/mygit-goal-verification"
echo "docker-compose up --build"
echo ""
echo "または、ローカル環境でテストを実行する場合:"
echo "export PATH=\"/home/ry/project/git-intern-2025-summer-term2/bin:\$PATH\""
echo "cd /home/ry/project/git-intern-2025-summer-term2/mygit-goal-verification"
echo "./tests/goal-verification.sh"
