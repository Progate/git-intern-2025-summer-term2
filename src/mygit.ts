import { addCommand } from "./commands/add.js";
import { logCommand } from "./commands/log.js";
import { hello } from "./hello.js";
import { findGitDirectory } from "./utils/gitUtils.js";

export const mygit = async (argv: Array<string>): Promise<void> => {
  // mygit実行時に常にGitディレクトリの存在を確認
  const gitDir = await findGitDirectory();

  if (!gitDir) {
    console.error(
      "Error: not a git repository (or any of the parent directories): .git",
    );
    process.exit(1);
  }

  if (argv[2] === "log") {
    await logCommand();
  } else if (argv[2] === "add") {
    // argv[3]以降がファイルパス
    const files = argv.slice(3);
    if (files.length === 0) {
      console.error("Error: No files specified");
      process.exit(1);
    }
    await addCommand(files);
  } else {
    console.log(hello());
  }
};
