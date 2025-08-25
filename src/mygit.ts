import { hello } from "./hello.js";
import { log } from "./log.js";

export const mygit = async (argv: Array<string>): Promise<void> => {
  console.log(hello());

  if (argv.includes("log")) {
    console.log(log());
  }

  console.log(argv);

  // Avoid eslint error by adding some async operation.
  await new Promise((resolve) => setTimeout(resolve, 1000));
};
