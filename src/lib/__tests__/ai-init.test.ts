import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import {
  checkEniExists,
  sparseCloneBoilerplate,
  copyAiFiles,
  ensureSpecsFolder,
  cleanupTempDir,
  checkBeadsInstalled,
  installBeads,
  initBeads,
} from "../ai-init.js";

vi.mock("execa", () => ({
  execa: vi.fn(),
}));

import { execa } from "execa";

describe("ai-init", () => {
  let tempDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-init-test-"));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("checkEniExists", () => {
    it("returns true when .eni folder exists", async () => {
      const eniPath = path.join(tempDir, ".eni");
      await fs.mkdir(eniPath);

      const result = await checkEniExists(tempDir);
      expect(result).toBe(true);
    });

    it("returns false when .eni folder does not exist", async () => {
      const result = await checkEniExists(tempDir);
      expect(result).toBe(false);
    });
  });

  describe("sparseCloneBoilerplate", () => {
    it("runs git commands for sparse clone", async () => {
      // Mock execa to simulate git commands and create the sparse-checkout directory
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(execa).mockImplementation((async (...mockArgs: any[]) => {
        const [cmd, args, options] = mockArgs;
        // When git init is called, create the .git/info directory structure
        if (
          cmd === "git" &&
          Array.isArray(args) &&
          args[0] === "init" &&
          options?.cwd
        ) {
          const gitInfoPath = path.join(options.cwd as string, ".git", "info");
          await fs.mkdir(gitInfoPath, { recursive: true });
        }
        return {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any);

      const result = await sparseCloneBoilerplate("github.com");

      expect(result.success).toBe(true);
      expect(result.tempDir).toBeTruthy();

      // Verify git commands were called
      expect(execa).toHaveBeenCalledWith("git", ["init"], expect.any(Object));
      expect(execa).toHaveBeenCalledWith(
        "git",
        ["remote", "add", "origin", "git@github.com:eniem-dev/eniem-boilerplate.git"],
        expect.any(Object)
      );
      expect(execa).toHaveBeenCalledWith(
        "git",
        ["config", "core.sparseCheckout", "true"],
        expect.any(Object)
      );
      expect(execa).toHaveBeenCalledWith(
        "git",
        ["fetch", "--depth", "1", "origin", "main"],
        expect.any(Object)
      );
      expect(execa).toHaveBeenCalledWith(
        "git",
        ["checkout", "main"],
        expect.any(Object)
      );

      // Clean up the temp dir created by the function
      await cleanupTempDir(result.tempDir);
    });

    it("returns error when git commands fail", async () => {
      vi.mocked(execa).mockRejectedValue(new Error("git command failed"));

      const result = await sparseCloneBoilerplate("github.com");

      expect(result.success).toBe(false);
      expect(result.error).toContain("git command failed");
    });
  });

  describe("copyAiFiles", () => {
    it("copies files from source to target", async () => {
      // Create source structure
      const sourceDir = path.join(tempDir, "source");
      const targetDir = path.join(tempDir, "target");
      await fs.mkdir(sourceDir);
      await fs.mkdir(targetDir);

      // Create .eni folder with files
      const eniDir = path.join(sourceDir, ".eni");
      await fs.mkdir(eniDir);
      await fs.writeFile(path.join(eniDir, "loop.sh"), "#!/bin/bash\n");
      await fs.writeFile(path.join(eniDir, "PROMPT_plan.md"), "# Plan\n");

      // Create .claude folder with nested structure
      const claudeDir = path.join(sourceDir, ".claude");
      const commandsDir = path.join(claudeDir, "commands");
      await fs.mkdir(commandsDir, { recursive: true });
      await fs.writeFile(path.join(claudeDir, "settings.local.json"), "{}");
      await fs.writeFile(path.join(commandsDir, "test.md"), "# Test\n");

      const result = await copyAiFiles(sourceDir, targetDir);

      expect(result.success).toBe(true);
      expect(result.copiedFiles).toContain(".eni/loop.sh");
      expect(result.copiedFiles).toContain(".eni/PROMPT_plan.md");
      expect(result.copiedFiles).toContain(".claude/settings.local.json");
      expect(result.copiedFiles).toContain(".claude/commands/test.md");

      // Verify files exist in target
      expect(
        await fs.stat(path.join(targetDir, ".eni", "loop.sh"))
      ).toBeTruthy();
      expect(
        await fs.stat(path.join(targetDir, ".claude", "commands", "test.md"))
      ).toBeTruthy();
    });

    it("replaces existing target folders", async () => {
      const sourceDir = path.join(tempDir, "source");
      const targetDir = path.join(tempDir, "target");
      await fs.mkdir(sourceDir);
      await fs.mkdir(targetDir);

      // Create source .eni
      const sourceEni = path.join(sourceDir, ".eni");
      await fs.mkdir(sourceEni);
      await fs.writeFile(path.join(sourceEni, "new.txt"), "new content");

      // Create existing target .eni with different content
      const targetEni = path.join(targetDir, ".eni");
      await fs.mkdir(targetEni);
      await fs.writeFile(path.join(targetEni, "old.txt"), "old content");

      await copyAiFiles(sourceDir, targetDir);

      // Old file should be removed
      await expect(
        fs.access(path.join(targetDir, ".eni", "old.txt"))
      ).rejects.toThrow();

      // New file should exist
      const content = await fs.readFile(
        path.join(targetDir, ".eni", "new.txt"),
        "utf-8"
      );
      expect(content).toBe("new content");
    });

    it("skips folders that do not exist in source", async () => {
      const sourceDir = path.join(tempDir, "source");
      const targetDir = path.join(tempDir, "target");
      await fs.mkdir(sourceDir);
      await fs.mkdir(targetDir);

      // Only create .eni, not .claude
      const eniDir = path.join(sourceDir, ".eni");
      await fs.mkdir(eniDir);
      await fs.writeFile(path.join(eniDir, "file.txt"), "content");

      const result = await copyAiFiles(sourceDir, targetDir);

      expect(result.success).toBe(true);
      expect(result.copiedFiles).toContain(".eni/file.txt");
      expect(result.copiedFiles.some((f) => f.startsWith(".claude"))).toBe(
        false
      );
    });
  });

  describe("ensureSpecsFolder", () => {
    it("creates specs folder with .gitkeep when it does not exist", async () => {
      const result = await ensureSpecsFolder(tempDir);

      expect(result.success).toBe(true);
      expect(result.created).toBe(true);

      const specsPath = path.join(tempDir, "specs");
      const gitkeepPath = path.join(specsPath, ".gitkeep");

      expect(await fs.stat(specsPath)).toBeTruthy();
      expect(await fs.stat(gitkeepPath)).toBeTruthy();
    });

    it("does not modify specs folder when it has content", async () => {
      const specsPath = path.join(tempDir, "specs");
      await fs.mkdir(specsPath);
      await fs.writeFile(path.join(specsPath, "existing-spec.md"), "# Spec\n");

      const result = await ensureSpecsFolder(tempDir);

      expect(result.success).toBe(true);
      expect(result.created).toBe(false);

      // Existing file should still be there
      const content = await fs.readFile(
        path.join(specsPath, "existing-spec.md"),
        "utf-8"
      );
      expect(content).toBe("# Spec\n");

      // .gitkeep should not have been added
      await expect(
        fs.access(path.join(specsPath, ".gitkeep"))
      ).rejects.toThrow();
    });

    it("adds .gitkeep to empty specs folder", async () => {
      const specsPath = path.join(tempDir, "specs");
      await fs.mkdir(specsPath);

      const result = await ensureSpecsFolder(tempDir);

      expect(result.success).toBe(true);
      expect(result.created).toBe(false);

      // .gitkeep should have been added
      expect(await fs.stat(path.join(specsPath, ".gitkeep"))).toBeTruthy();
    });
  });

  describe("cleanupTempDir", () => {
    it("removes temporary directory", async () => {
      const testTempDir = await fs.mkdtemp(
        path.join(os.tmpdir(), "cleanup-test-")
      );
      await fs.writeFile(path.join(testTempDir, "test.txt"), "content");

      await cleanupTempDir(testTempDir);

      await expect(fs.access(testTempDir)).rejects.toThrow();
    });

    it("does not throw on non-existent directory", async () => {
      await expect(
        cleanupTempDir("/non/existent/path")
      ).resolves.not.toThrow();
    });
  });

  describe("checkBeadsInstalled", () => {
    it("returns true when bd command succeeds", async () => {
      vi.mocked(execa).mockResolvedValue({} as never);

      const result = await checkBeadsInstalled();

      expect(result).toBe(true);
      expect(execa).toHaveBeenCalledWith("bd", ["--version"]);
    });

    it("returns false when bd command fails", async () => {
      vi.mocked(execa).mockRejectedValue(new Error("Command not found"));

      const result = await checkBeadsInstalled();

      expect(result).toBe(false);
    });
  });

  describe("installBeads", () => {
    it("runs npm install -g @beads/bd", async () => {
      vi.mocked(execa).mockResolvedValue({} as never);

      const result = await installBeads();

      expect(result.success).toBe(true);
      expect(execa).toHaveBeenCalledWith("npm", ["install", "-g", "@beads/bd"]);
    });

    it("returns error when npm is not found", async () => {
      vi.mocked(execa).mockRejectedValue(new Error("ENOENT: npm not found"));

      const result = await installBeads();

      expect(result.success).toBe(false);
      expect(result.error).toContain("npm not found");
    });

    it("returns error message on other failures", async () => {
      vi.mocked(execa).mockRejectedValue(new Error("Permission denied"));

      const result = await installBeads();

      expect(result.success).toBe(false);
      expect(result.error).toContain("Permission denied");
    });
  });

  describe("initBeads", () => {
    it("runs bd init in target directory", async () => {
      vi.mocked(execa).mockResolvedValue({} as never);

      const result = await initBeads("/test/project");

      expect(result.success).toBe(true);
      expect(execa).toHaveBeenCalledWith("bd", ["init"], {
        cwd: "/test/project",
      });
    });

    it("returns error on failure", async () => {
      vi.mocked(execa).mockRejectedValue(new Error("Already initialized"));

      const result = await initBeads("/test/project");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Already initialized");
    });
  });
});
