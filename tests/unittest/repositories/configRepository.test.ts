import * as fs from "fs/promises";
import assert from "node:assert";
import { afterEach, beforeEach, describe, it } from "node:test";
import * as os from "os";
import * as path from "path";

import { ConfigRepository } from "../../../src/repositories/configRepository.js";

describe("ConfigRepository", () => {
  let tempDir: string;
  let configPath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "config-test-"));
    configPath = path.join(tempDir, "config");
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("static read() method", () => {
    describe("正常系", () => {
      it("should create ConfigRepository from valid config file", async () => {
        const configContent = `[user]
    name = Test User
    email = test@example.com

[core]
    filemode = true
    bare = false`;

        await fs.writeFile(configPath, configContent, "utf-8");

        const configRepo = await ConfigRepository.read(configPath);

        assert.strictEqual(configRepo.getConfigPath(), configPath);
        assert.strictEqual(configRepo.getValue("user", "name"), "Test User");
        assert.strictEqual(
          configRepo.getValue("user", "email"),
          "test@example.com",
        );
      });

      it("should create empty ConfigRepository when file does not exist", async () => {
        const nonExistentPath = path.join(tempDir, "nonexistent-config");

        const configRepo = await ConfigRepository.read(nonExistentPath);

        assert.strictEqual(configRepo.getConfigPath(), nonExistentPath);
        assert.deepStrictEqual(configRepo.getSectionNames(), []);
        assert.strictEqual(configRepo.getUserConfig(), undefined);
      });

      it("should handle empty config file", async () => {
        await fs.writeFile(configPath, "", "utf-8");

        const configRepo = await ConfigRepository.read(configPath);

        assert.deepStrictEqual(configRepo.getSectionNames(), []);
        assert.strictEqual(configRepo.getUserConfig(), undefined);
      });
    });

    describe("異常系", () => {
      it("should throw error for permission denied", async () => {
        // ディレクトリに読み取り権限を削除して権限エラーをシミュレート
        const restrictedDir = path.join(tempDir, "restricted");
        await fs.mkdir(restrictedDir, { mode: 0o000 });
        const restrictedConfigPath = path.join(restrictedDir, "config");

        try {
          await assert.rejects(
            async () => await ConfigRepository.read(restrictedConfigPath),
            (error: NodeJS.ErrnoException) => {
              return error.code === "EACCES" || error.code === "ENOENT";
            },
          );
        } finally {
          // クリーンアップのため権限を復元
          await fs.chmod(restrictedDir, 0o755);
        }
      });
    });
  });

  describe("INI形式パース", () => {
    describe("正常系", () => {
      it("should parse basic INI format with sections and key-values", async () => {
        const configContent = `[user]
name = John Doe
email = john@example.com

[core]
filemode = true
compression = 1`;

        await fs.writeFile(configPath, configContent, "utf-8");
        const configRepo = await ConfigRepository.read(configPath);

        assert.strictEqual(configRepo.getValue("user", "name"), "John Doe");
        assert.strictEqual(
          configRepo.getValue("user", "email"),
          "john@example.com",
        );
        assert.strictEqual(configRepo.getValue("core", "filemode"), "true");
        assert.strictEqual(configRepo.getValue("core", "compression"), "1");
      });

      it("should handle quoted values", async () => {
        const configContent = `[user]
name = "John Doe"
email = 'john@example.com'
description = "Software Engineer at Company"`;

        await fs.writeFile(configPath, configContent, "utf-8");
        const configRepo = await ConfigRepository.read(configPath);

        assert.strictEqual(configRepo.getValue("user", "name"), "John Doe");
        assert.strictEqual(
          configRepo.getValue("user", "email"),
          "john@example.com",
        );
        assert.strictEqual(
          configRepo.getValue("user", "description"),
          "Software Engineer at Company",
        );
      });

      it("should ignore comment lines with # and ;", async () => {
        const configContent = `# This is a comment
; This is also a comment
[user]
    # User configuration
    name = Test User
    ; User email
    email = test@example.com

[core]
    # Core settings
    filemode = true`;

        await fs.writeFile(configPath, configContent, "utf-8");
        const configRepo = await ConfigRepository.read(configPath);

        assert.strictEqual(configRepo.getValue("user", "name"), "Test User");
        assert.strictEqual(
          configRepo.getValue("user", "email"),
          "test@example.com",
        );
        assert.strictEqual(configRepo.getValue("core", "filemode"), "true");
      });

      it("should handle empty lines and whitespace", async () => {
        const configContent = `
[user]

    name = Test User   
    
    email = test@example.com   

[core]
    
    filemode = true   
    
`;

        await fs.writeFile(configPath, configContent, "utf-8");
        const configRepo = await ConfigRepository.read(configPath);

        assert.strictEqual(configRepo.getValue("user", "name"), "Test User");
        assert.strictEqual(
          configRepo.getValue("user", "email"),
          "test@example.com",
        );
        assert.strictEqual(configRepo.getValue("core", "filemode"), "true");
      });

      it("should convert section and key names to lowercase", async () => {
        const configContent = `[USER]
NAME = Test User
EMAIL = test@example.com

[Core]
FileMode = true`;

        await fs.writeFile(configPath, configContent, "utf-8");
        const configRepo = await ConfigRepository.read(configPath);

        // 小文字でアクセス可能
        assert.strictEqual(configRepo.getValue("user", "name"), "Test User");
        assert.strictEqual(
          configRepo.getValue("user", "email"),
          "test@example.com",
        );
        assert.strictEqual(configRepo.getValue("core", "filemode"), "true");

        // 大文字でもアクセス可能
        assert.strictEqual(configRepo.getValue("USER", "NAME"), "Test User");
        assert.strictEqual(configRepo.getValue("Core", "FileMode"), "true");
      });
    });

    describe("エッジケース", () => {
      it("should handle key-value pairs with multiple equals signs", async () => {
        const configContent = `[remote "origin"]
url = https://user:pass@github.com/user/repo.git
fetch = +refs/heads/*:refs/remotes/origin/*

[alias]
command = git log --oneline --graph --all`;

        await fs.writeFile(configPath, configContent, "utf-8");
        const configRepo = await ConfigRepository.read(configPath);

        assert.strictEqual(
          configRepo.getValue('remote "origin"', "url"),
          "https://user:pass@github.com/user/repo.git",
        );
        assert.strictEqual(
          configRepo.getValue("alias", "command"),
          "git log --oneline --graph --all",
        );
      });

      it("should handle sections with special characters", async () => {
        const configContent = `[remote "origin"]
url = https://github.com/user/repo.git

[branch "feature/new-feature"]
remote = origin
merge = refs/heads/feature/new-feature`;

        await fs.writeFile(configPath, configContent, "utf-8");
        const configRepo = await ConfigRepository.read(configPath);

        assert.strictEqual(
          configRepo.getValue('remote "origin"', "url"),
          "https://github.com/user/repo.git",
        );
        assert.strictEqual(
          configRepo.getValue('branch "feature/new-feature"', "remote"),
          "origin",
        );
      });

      it("should skip malformed lines gracefully", async () => {
        const configContent = `[user]
name = Test User
invalid line without equals
email = test@example.com
another invalid = = line
= invalid key
valid = value`;

        await fs.writeFile(configPath, configContent, "utf-8");
        const configRepo = await ConfigRepository.read(configPath);

        // 正常な行のみが処理される
        assert.strictEqual(configRepo.getValue("user", "name"), "Test User");
        assert.strictEqual(
          configRepo.getValue("user", "email"),
          "test@example.com",
        );
        assert.strictEqual(configRepo.getValue("user", "valid"), "value");
      });
    });

    describe("異常系", () => {
      it("should warn about key-value pairs outside sections", async () => {
        const configContent = `name = Test User
email = test@example.com

[user]
name = Another User`;

        // console.warnをモック
        const originalWarn = console.warn;
        const warnings: Array<string> = [];
        console.warn = (message: string) => warnings.push(message);

        try {
          await fs.writeFile(configPath, configContent, "utf-8");
          const configRepo = await ConfigRepository.read(configPath);

          // セクション外のキー-値ペアは無視される
          assert.strictEqual(
            configRepo.getValue("user", "name"),
            "Another User",
          );

          // 警告が出力される
          assert.strictEqual(warnings.length, 2);
          assert(warnings[0]?.includes("Config parse warning"));
          assert(warnings[1]?.includes("Config parse warning"));
        } finally {
          console.warn = originalWarn;
        }
      });
    });
  });

  describe("getUserConfig() method", () => {
    describe("正常系", () => {
      it("should return GitActor when both name and email are present", async () => {
        const configContent = `[user]
name = John Doe
email = john@example.com`;

        await fs.writeFile(configPath, configContent, "utf-8");
        const configRepo = await ConfigRepository.read(configPath);

        const userConfig = configRepo.getUserConfig();

        assert(userConfig !== undefined);
        assert.strictEqual(userConfig.name, "John Doe");
        assert.strictEqual(userConfig.email, "john@example.com");
        assert(userConfig.timestamp instanceof Date);
      });

      it("should trim whitespace from name and email", async () => {
        const configContent = `[user]
name = "  John Doe  "
email =   john@example.com   `;

        await fs.writeFile(configPath, configContent, "utf-8");
        const configRepo = await ConfigRepository.read(configPath);

        const userConfig = configRepo.getUserConfig();

        assert(userConfig !== undefined);
        assert.strictEqual(userConfig.name, "John Doe");
        assert.strictEqual(userConfig.email, "john@example.com");
      });

      it("should set timestamp to current date", async () => {
        const configContent = `[user]
name = John Doe
email = john@example.com`;

        await fs.writeFile(configPath, configContent, "utf-8");
        const configRepo = await ConfigRepository.read(configPath);

        const beforeTime = new Date();
        const userConfig = configRepo.getUserConfig();
        const afterTime = new Date();

        assert(userConfig !== undefined);
        assert(userConfig.timestamp >= beforeTime);
        assert(userConfig.timestamp <= afterTime);
      });
    });

    describe("異常系", () => {
      it("should return undefined when user section does not exist", async () => {
        const configContent = `[core]
filemode = true`;

        await fs.writeFile(configPath, configContent, "utf-8");
        const configRepo = await ConfigRepository.read(configPath);

        const userConfig = configRepo.getUserConfig();

        assert.strictEqual(userConfig, undefined);
      });

      it("should return undefined when name is missing", async () => {
        const configContent = `[user]
email = john@example.com`;

        await fs.writeFile(configPath, configContent, "utf-8");
        const configRepo = await ConfigRepository.read(configPath);

        const userConfig = configRepo.getUserConfig();

        assert.strictEqual(userConfig, undefined);
      });

      it("should return undefined when email is missing", async () => {
        const configContent = `[user]
name = John Doe`;

        await fs.writeFile(configPath, configContent, "utf-8");
        const configRepo = await ConfigRepository.read(configPath);

        const userConfig = configRepo.getUserConfig();

        assert.strictEqual(userConfig, undefined);
      });

      it("should return undefined when both name and email are empty", async () => {
        const configContent = `[user]
name = 
email = `;

        await fs.writeFile(configPath, configContent, "utf-8");
        const configRepo = await ConfigRepository.read(configPath);

        const userConfig = configRepo.getUserConfig();

        assert.strictEqual(userConfig, undefined);
      });
    });
  });

  describe("getCoreConfig() method", () => {
    describe("正常系", () => {
      it("should return core config with custom values", async () => {
        const configContent = `[core]
compression = 2
filemode = false`;

        await fs.writeFile(configPath, configContent, "utf-8");
        const configRepo = await ConfigRepository.read(configPath);

        const coreConfig = configRepo.getCoreConfig();

        assert.strictEqual(coreConfig.compression, 2);
        assert.strictEqual(coreConfig.fileMode, false);
      });

      it("should return default values when core section does not exist", async () => {
        const configContent = `[user]
name = John Doe`;

        await fs.writeFile(configPath, configContent, "utf-8");
        const configRepo = await ConfigRepository.read(configPath);

        const coreConfig = configRepo.getCoreConfig();

        assert.strictEqual(coreConfig.compression, 1);
        assert.strictEqual(coreConfig.fileMode, true);
      });

      it("should parse boolean filemode correctly", async () => {
        const testCases = [
          { input: "true", expected: true },
          { input: "True", expected: true },
          { input: "TRUE", expected: true },
          { input: "false", expected: false },
          { input: "False", expected: false },
          { input: "FALSE", expected: false },
        ];

        for (const testCase of testCases) {
          const configContent = `[core]
filemode = ${testCase.input}`;

          await fs.writeFile(configPath, configContent, "utf-8");
          const configRepo = await ConfigRepository.read(configPath);

          const coreConfig = configRepo.getCoreConfig();

          assert.strictEqual(coreConfig.fileMode, testCase.expected);
        }
      });

      it("should parse integer compression correctly", async () => {
        const testCases = [0, 1, 2, 9];

        for (const compression of testCases) {
          const configContent = `[core]
compression = ${String(compression)}`;

          await fs.writeFile(configPath, configContent, "utf-8");
          const configRepo = await ConfigRepository.read(configPath);

          const coreConfig = configRepo.getCoreConfig();

          assert.strictEqual(coreConfig.compression, compression);
        }
      });
    });

    describe("エッジケース", () => {
      it("should handle invalid compression values", async () => {
        const configContent = `[core]
compression = invalid`;

        await fs.writeFile(configPath, configContent, "utf-8");
        const configRepo = await ConfigRepository.read(configPath);

        const coreConfig = configRepo.getCoreConfig();

        // NaNの場合はデフォルト値を使用
        assert.strictEqual(coreConfig.compression, 1);
      });

      it("should handle invalid filemode values", async () => {
        const configContent = `[core]
filemode = invalid`;

        await fs.writeFile(configPath, configContent, "utf-8");
        const configRepo = await ConfigRepository.read(configPath);

        const coreConfig = configRepo.getCoreConfig();

        // 不正な値の場合はデフォルト値を使用
        assert.strictEqual(coreConfig.fileMode, true);
      });
    });
  });

  describe("汎用設定取得メソッド", () => {
    beforeEach(async () => {
      const configContent = `[user]
name = Test User
email = test@example.com

[core]
filemode = true
compression = 1

[remote "origin"]
url = https://github.com/user/repo.git`;

      await fs.writeFile(configPath, configContent, "utf-8");
    });

    describe("getSection() method", () => {
      it("should return section map when section exists", async () => {
        const configRepo = await ConfigRepository.read(configPath);

        const userSection = configRepo.getSection("user");

        assert(userSection !== undefined);
        assert.strictEqual(userSection.get("name"), "Test User");
        assert.strictEqual(userSection.get("email"), "test@example.com");
      });

      it("should return undefined when section does not exist", async () => {
        const configRepo = await ConfigRepository.read(configPath);

        const nonExistentSection = configRepo.getSection("nonexistent");

        assert.strictEqual(nonExistentSection, undefined);
      });

      it("should be case insensitive for section names", async () => {
        const configRepo = await ConfigRepository.read(configPath);

        const userSection1 = configRepo.getSection("user");
        const userSection2 = configRepo.getSection("USER");
        const userSection3 = configRepo.getSection("User");

        assert(userSection1 !== undefined);
        assert(userSection2 !== undefined);
        assert(userSection3 !== undefined);
        assert.strictEqual(userSection1.get("name"), userSection2.get("name"));
        assert.strictEqual(userSection2.get("name"), userSection3.get("name"));
      });
    });

    describe("getValue() method", () => {
      it("should return value when key exists", async () => {
        const configRepo = await ConfigRepository.read(configPath);

        assert.strictEqual(configRepo.getValue("user", "name"), "Test User");
        assert.strictEqual(configRepo.getValue("core", "filemode"), "true");
        assert.strictEqual(
          configRepo.getValue('remote "origin"', "url"),
          "https://github.com/user/repo.git",
        );
      });

      it("should return undefined when key does not exist", async () => {
        const configRepo = await ConfigRepository.read(configPath);

        assert.strictEqual(
          configRepo.getValue("user", "nonexistent"),
          undefined,
        );
        assert.strictEqual(
          configRepo.getValue("nonexistent", "key"),
          undefined,
        );
      });

      it("should be case insensitive for section and key names", async () => {
        const configRepo = await ConfigRepository.read(configPath);

        // 異なる大文字小文字の組み合わせで同じ値を取得
        assert.strictEqual(configRepo.getValue("user", "name"), "Test User");
        assert.strictEqual(configRepo.getValue("USER", "NAME"), "Test User");
        assert.strictEqual(configRepo.getValue("User", "Name"), "Test User");
        assert.strictEqual(configRepo.getValue("CORE", "FILEMODE"), "true");
      });
    });

    describe("getSectionNames() method", () => {
      it("should return array of section names", async () => {
        const configRepo = await ConfigRepository.read(configPath);

        const sectionNames = configRepo.getSectionNames();

        assert.strictEqual(sectionNames.length, 3);
        assert(sectionNames.includes("user"));
        assert(sectionNames.includes("core"));
        assert(sectionNames.includes('remote "origin"'));
      });

      it("should return empty array for empty config", async () => {
        await fs.writeFile(configPath, "", "utf-8");
        const configRepo = await ConfigRepository.read(configPath);

        const sectionNames = configRepo.getSectionNames();

        assert.deepStrictEqual(sectionNames, []);
      });
    });
  });

  describe("実際のGit設定ファイル形式", () => {
    it("should parse real Git config file format", async () => {
      const realConfigContent = `[core]
	repositoryformatversion = 0
	filemode = true
	bare = false
	logallrefupdates = true
	ignorecase = true
	precomposeunicode = true
[remote "origin"]
	url = https://github.com/user/repo.git
	fetch = +refs/heads/*:refs/remotes/origin/*
[branch "main"]
	remote = origin
	merge = refs/heads/main
[user]
	name = Developer Name
	email = developer@example.com
[alias]
	st = status
	co = checkout
	br = branch
	ci = commit`;

      await fs.writeFile(configPath, realConfigContent, "utf-8");
      const configRepo = await ConfigRepository.read(configPath);

      // コア設定の確認
      assert.strictEqual(
        configRepo.getValue("core", "repositoryformatversion"),
        "0",
      );
      assert.strictEqual(configRepo.getValue("core", "filemode"), "true");
      assert.strictEqual(configRepo.getValue("core", "bare"), "false");

      // リモート設定の確認
      assert.strictEqual(
        configRepo.getValue('remote "origin"', "url"),
        "https://github.com/user/repo.git",
      );

      // ブランチ設定の確認
      assert.strictEqual(
        configRepo.getValue('branch "main"', "remote"),
        "origin",
      );

      // ユーザー設定の確認
      const userConfig = configRepo.getUserConfig();
      assert(userConfig !== undefined);
      assert.strictEqual(userConfig.name, "Developer Name");
      assert.strictEqual(userConfig.email, "developer@example.com");

      // エイリアス設定の確認
      assert.strictEqual(configRepo.getValue("alias", "st"), "status");
      assert.strictEqual(configRepo.getValue("alias", "co"), "checkout");
    });

    it("should handle complex multi-section config", async () => {
      const complexConfigContent = `[core]
	editor = vim
	autocrlf = input
	safecrlf = true

[user]
	name = John Doe
	email = john@example.com
	signingkey = ABC123

[remote "origin"]
	url = git@github.com:user/repo.git
	fetch = +refs/heads/*:refs/remotes/origin/*
	pushurl = git@github.com:user/repo.git

[remote "upstream"]
	url = git@github.com:upstream/repo.git
	fetch = +refs/heads/*:refs/remotes/upstream/*

[branch "main"]
	remote = origin
	merge = refs/heads/main
	rebase = true

[branch "develop"]
	remote = origin
	merge = refs/heads/develop

[alias]
	lg = log --graph --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset'
	unstage = reset HEAD --`;

      await fs.writeFile(configPath, complexConfigContent, "utf-8");
      const configRepo = await ConfigRepository.read(configPath);

      // セクション数の確認
      const sectionNames = configRepo.getSectionNames();
      assert.strictEqual(sectionNames.length, 7);

      // 各セクションの存在確認
      assert(sectionNames.includes("core"));
      assert(sectionNames.includes("user"));
      assert(sectionNames.includes('remote "origin"'));
      assert(sectionNames.includes('remote "upstream"'));
      assert(sectionNames.includes('branch "main"'));
      assert(sectionNames.includes('branch "develop"'));
      assert(sectionNames.includes("alias"));

      // ユーザー設定の確認
      const userConfig = configRepo.getUserConfig();
      assert(userConfig !== undefined);
      assert.strictEqual(userConfig.name, "John Doe");
      assert.strictEqual(userConfig.email, "john@example.com");

      // 複雑なエイリアスの確認
      assert.strictEqual(
        configRepo.getValue("alias", "lg"),
        "log --graph --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset'",
      );
    });
  });
});
