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
  } else {
    console.log(hello());
  }
};
