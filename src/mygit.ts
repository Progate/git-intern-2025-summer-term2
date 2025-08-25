import { hello } from "./hello.js";
import { log } from "./log.js";

export const mygit = async (argv: Array<string>): Promise<void> => {
  if (argv[2] === "log") {
    await log();
  } else {
    console.log(hello());
  }
};
