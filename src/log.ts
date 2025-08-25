import { readFileSync } from "fs";
import { inflateSync } from "zlib";

class CommitObject {
  hash: string;
  parent?: string;
  author: string;
  date: string;
  message: string;

  constructor(content: string, hash: string) {
    this.hash = hash;

    const lines = content.split("\n");

    this.parent = lines[1]?.startsWith("parent ")
      ? lines[1].slice("parent ".length)
      : undefined;

    // author の抽出
    const authorLine = lines.find((line) => line.startsWith("author ")) || "";
    const authorMatch = authorLine.match(/^author (.+) (\d+) ([\+\-]\d{4})$/);
    if (authorMatch && authorMatch[1] && authorMatch[2]) {
      this.author = authorMatch[1];
      const unixTime = parseInt(authorMatch[2]);
      const timezone = authorMatch[3] || "";
      const date = new Date(unixTime * 1000);
      this.date = `${date.toString().slice(0, 24)} ${timezone}`;
    } else {
      this.author = "";
      this.date = "";
    }

    // message の抽出（空行以降）
    const emptyLineIndex = lines.findIndex((line) => line === "");
    this.message =
      emptyLineIndex !== -1
        ? lines
            .slice(emptyLineIndex + 1)
            .join("\n")
            .trim()
        : "";
  }

  logFormat(): string {
    return [
      `commit ${this.hash}`,
      `Author: ${this.author}`,
      `Date:   ${this.date}`,
      "",
      `    ${this.message}`,
    ].join("\n");
  }
}

const getCommitObject = (refHash: string): string => {
  const dirName = refHash.slice(0, 2);
  const fileName = refHash.slice(2);
  const path = `.git/objects/${dirName}/${fileName}`;
  const compressedObject = readFileSync(path);
  const decompressedObject = inflateSync(Uint8Array.from(compressedObject));
  const content = decompressedObject.toString("utf8");
  return content;
};

export const log = (): string => {
  const headContent = readFileSync(".git/HEAD", "utf8").trim();
  // memo: detached HEADを一旦考慮しない
  // if (headContent.startsWith("ref: ")) {
  const ref = headContent.replace("ref: ", "");
  // }
  const refContent = readFileSync(`.git/${ref}`, "utf8").trim();
  // const refContent = readFileSync(".git/refs/heads/f0rte/feature-mygit-log");

  const logs: string[] = [];
  let currentHash: string | undefined = refContent;

  while (currentHash !== undefined) {
    const content = getCommitObject(currentHash);
    const commitObj: CommitObject = new CommitObject(content, currentHash);
    logs.push(commitObj.logFormat());
    currentHash = commitObj.parent;
  }

  return logs.join("\n\n");
};
