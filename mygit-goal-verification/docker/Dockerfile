FROM ubuntu:22.04

# 必要なツールをインストール
RUN apt-get update && apt-get install -y \
    git \
    curl \
    diffutils \
    tree \
    xxd \
    && rm -rf /var/lib/apt/lists/*

# Node.js 18.x をインストール（node: プレフィックスをサポート）
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs

# テストユーザーを作成
RUN useradd -m -s /bin/bash testuser
USER testuser
WORKDIR /home/testuser

# Gitの初期設定
RUN git config --global user.name "Test User" && \
    git config --global user.email "test@example.com"

# テストスクリプトをコピー
COPY --chown=testuser:testuser mygit-goal-verification/tests/ ./tests/
COPY --chown=testuser:testuser mygit-goal-verification/test-scenarios/ ./test-scenarios/

# mygitバイナリディレクトリを作成
RUN mkdir -p ./bin

# mygit実行用のラッパースクリプトを作成
RUN echo '#!/bin/bash' > ./bin/mygit && \
    echo 'exec node /home/testuser/bin/main.mjs "$@"' >> ./bin/mygit && \
    chmod +x ./bin/mygit

CMD ["bash", "tests/goal-verification.sh"]
