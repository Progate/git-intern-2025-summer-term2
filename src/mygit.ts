import { addCommand } from "./commands/add.js";
import { commitCommand } from "./commands/commit.js";
import { logCommand } from "./commands/log.js";
import { hello } from "./hello.js";
import { findGitDirectory } from "./utils/gitUtils.js";

export const mygit = async (argv: Array<string>): Promise<void> => {
  const command = argv[2];

  // Git操作が必要なコマンドの場合、事前にGitディレクトリを確認
  if (command === "log" || command === "commit") {
    const gitDir = await findGitDirectory();
    if (!gitDir) {
      console.error(
        "Error: not a git repository (or any of the parent directories): .git",
      );
      process.exit(1);
    }
  }

  // コマンド実行
  if (command === "log") {
    await logCommand();
  } else if (argv[2] === "add") {
    // argv[3]以降がファイルパス
    const files = argv.slice(3);
    if (files.length === 0) {
      console.error("Error: No files specified");
      process.exit(1);
    }
    await addCommand(files);
  } else if (command === "commit") {
    // コミットメッセージの取得
    const message = argv[3];
    if (!message) {
      console.error(
        "Error: commit message is required. Use: mygit commit <message>",
      );
      process.exit(1);
    }
    await commitCommand(message);
  } else {
    console.log(hello());
  }
};
