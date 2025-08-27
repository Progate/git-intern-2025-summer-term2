import { logCommand } from "./commands/log.js";
import { hello } from "./hello.js";

export const mygit = async (argv: Array<string>): Promise<void> => {
  if (argv[2] === "log") {
    await logCommand();
  } else {
    console.log(hello());
  };
};
