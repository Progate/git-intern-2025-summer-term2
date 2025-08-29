import { AddService } from "../services/addService.js";
import { defaultLogger } from "../utils/logger.js";

/**
 * addコマンドの実装
 * @param files 追加対象のファイルパス配列
 */
export async function addCommand(files: Array<string>): Promise<void> {
  try {
    const addService = await AddService.create(process.cwd(), defaultLogger);
    await addService.execute(files);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error("An unknown error occurred");
    }
    process.exit(1);
  }
}
