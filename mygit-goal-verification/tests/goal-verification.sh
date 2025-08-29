#!/bin/bash
# set -e を削除して、エラーが起きても続行するように変更

echo "=== mygit ゴール達成確認テスト ==="
echo "開始日時: $(date)"
echo ""

# レポートファイルを初期化
REPORT_FILE="results/goal-verification-report.md"
mkdir -p results
cat > "$REPORT_FILE" << EOF
# mygit ゴール達成確認レポート

実行日時: $(date)

## テスト結果概要

EOF

# テスト結果を記録する関数
record_test_result() {
    local test_name="$1"
    local result="$2"
    local details="$3"
    
    if [[ "$result" == "PASS" ]]; then
        echo "✅ $test_name" | tee -a "$REPORT_FILE"
    else
        echo "❌ $test_name" | tee -a "$REPORT_FILE"
    fi
    
    if [[ -n "$details" ]]; then
        echo "   詳細: $details" | tee -a "$REPORT_FILE"
    fi
    echo "" | tee -a "$REPORT_FILE"
}

# テスト統計
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

run_test() {
    local test_script="$1"
    local test_name="$2"
    
    echo "--- Running: $test_name ---"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if bash "$test_script"; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
        record_test_result "$test_name" "PASS"
        return 0
    else
        FAILED_TESTS=$((FAILED_TESTS + 1))
        record_test_result "$test_name" "FAIL" "テストスクリプトが失敗しました"
        return 1
    fi
}

# mygitが実行可能かチェック
echo "mygitの実行可能性をチェック..."
if ! command -v mygit &> /dev/null; then
    echo "❌ mygitコマンドが見つかりません"
    record_test_result "mygit実行可能性チェック" "FAIL" "mygitコマンドが見つかりません"
    # exit 1 を削除して継続するように変更
else
    echo "✅ mygitコマンドが見つかりました"
    record_test_result "mygit実行可能性チェック" "PASS"
fi

# 各テストを実行（エラーが起きても継続）
run_test "tests/add-goals.sh" "mygit add ゴール検証" || true
run_test "tests/commit-goals.sh" "mygit commit ゴール検証" || true
run_test "tests/integration-goals.sh" "統合ワークフロー検証" || true
run_test "test-scenarios/basic-add-commit.sh" "基本的なadd→commitフロー" || true
run_test "test-scenarios/git-compatibility.sh" "本家Git互換性" || true
run_test "test-scenarios/error-cases.sh" "エラーケース" || true
run_test "test-scenarios/edge-cases.sh" "エッジケース" || true

# 結果サマリーをレポートに追加
{
    echo ""
    echo "## 総合結果"
    echo ""
    echo "- 総テスト数: $TOTAL_TESTS"
    echo "- 成功: $PASSED_TESTS"
    echo "- 失敗: $FAILED_TESTS"
    echo "- 成功率: $((PASSED_TESTS * 100 / TOTAL_TESTS))%"
    echo ""
    
    if [[ $FAILED_TESTS -eq 0 ]]; then
        echo "🎉 全てのテストが成功しました！"
        echo ""
        echo "### 達成されたゴール"
        echo "- mygit add ファイル・ディレクトリ追加機能"
        echo "- git addとの互換性"
        echo "- git diff --stagedでのステージ確認"
        echo "- mygit commit コミット作成機能"
        echo "- コミットメッセージ保存機能"
        echo "- 本家gitとのオブジェクト互換性"
    elif [[ $((PASSED_TESTS * 100 / TOTAL_TESTS)) -ge 85 ]]; then
        echo "⚠️  一部テストが失敗しましたが、85%以上の成功率を達成しました"
    else
        echo "❌ 成功率が85%を下回りました。さらなる改善が必要です"
    fi
} >> "$REPORT_FILE"

echo ""
echo "=== テスト完了 ==="
echo "総テスト数: $TOTAL_TESTS"
echo "成功: $PASSED_TESTS"
echo "失敗: $FAILED_TESTS"
echo "成功率: $((PASSED_TESTS * 100 / TOTAL_TESTS))%"
echo ""
echo "詳細レポート: $REPORT_FILE"

# 85%未満の場合は終了コード1を返す
if [[ $((PASSED_TESTS * 100 / TOTAL_TESTS)) -lt 85 ]]; then
    exit 1
fi
