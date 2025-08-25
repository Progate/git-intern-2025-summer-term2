import { readFileSync } from "fs";
import { inflateSync } from "zlib";

const getCommitObject = (refHash: string) : string => {
    const dirName = refHash.slice(0, 2);
    const fileName = refHash.slice(2);
    const path = `.git/objects/${dirName}/${fileName}`;
    const compressedObject = readFileSync(path);
    const decompressedObject = inflateSync(Uint8Array.from(compressedObject));
    const content = decompressedObject.toString("utf8");
    return content;
}

export const log = (): string => {
    const headContent = readFileSync(".git/HEAD", "utf8").trim();
    // memo: detached HEADを一旦考慮しない
    // if (headContent.startsWith("ref: ")) {
        const ref = headContent.replace("ref: ", "");
    // }
    const refContent = readFileSync(`.git/${ref}`, "utf8").trim();
    // const refContent = readFileSync(".git/refs/heads/f0rte/feature-mygit-log");
    const content = getCommitObject(refContent);
    console.log(content);

    return "log";
};
