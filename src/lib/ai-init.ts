import { execa } from "execa";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

const REPO_PATH = "eniem-dev/eniem-boilerplate.git";
const FOLDERS_TO_COPY = [".eni", ".claude"];

export interface AiInitResult {
  success: boolean;
  copiedFiles: string[];
  error?: string;
}

/**
 * Checks if .eni folder exists in the target directory
 */
export async function checkEniExists(targetDir: string): Promise<boolean> {
  try {
    const eniPath = path.join(targetDir, ".eni");
    await fs.access(eniPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sparse clones only .eni and .claude folders from eniem-boilerplate
 * Returns the path to the temp directory containing the cloned folders
 */
export async function sparseCloneBoilerplate(gitHost: string): Promise<{
  success: boolean;
  tempDir: string;
  error?: string;
}> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "eniem-ai-init-"));
  const repoUrl = `git@${gitHost}:${REPO_PATH}`;

  try {
    // Initialize empty repo
    await execa("git", ["init"], { cwd: tempDir });

    // Add remote
    await execa("git", ["remote", "add", "origin", repoUrl], { cwd: tempDir });

    // Enable sparse checkout
    await execa("git", ["config", "core.sparseCheckout", "true"], {
      cwd: tempDir,
    });

    // Set sparse checkout paths
    const sparseCheckoutPath = path.join(
      tempDir,
      ".git",
      "info",
      "sparse-checkout"
    );
    await fs.writeFile(sparseCheckoutPath, FOLDERS_TO_COPY.join("\n") + "\n");

    // Fetch and checkout
    await execa("git", ["fetch", "--depth", "1", "origin", "main"], {
      cwd: tempDir,
    });
    await execa("git", ["checkout", "main"], { cwd: tempDir });

    return { success: true, tempDir };
  } catch (error) {
    // Clean up temp dir on error
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return { success: false, tempDir: "", error: errorMessage };
  }
}

/**
 * Copies .eni and .claude folders from source to target directory
 * Returns list of copied file paths (relative to target)
 */
export async function copyAiFiles(
  sourceDir: string,
  targetDir: string
): Promise<{ success: boolean; copiedFiles: string[]; error?: string }> {
  const copiedFiles: string[] = [];

  try {
    for (const folder of FOLDERS_TO_COPY) {
      const sourcePath = path.join(sourceDir, folder);
      const targetPath = path.join(targetDir, folder);

      // Check if source folder exists
      try {
        await fs.access(sourcePath);
      } catch {
        continue; // Skip if folder doesn't exist in source
      }

      // Remove existing folder in target (to ensure clean copy)
      try {
        await fs.rm(targetPath, { recursive: true, force: true });
      } catch {
        // Ignore if doesn't exist
      }

      // Recursively copy folder
      await copyDir(sourcePath, targetPath, folder, copiedFiles);
    }

    return { success: true, copiedFiles };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return { success: false, copiedFiles, error: errorMessage };
  }
}

/**
 * Recursively copies a directory and tracks copied files
 */
async function copyDir(
  src: string,
  dest: string,
  basePath: string,
  copiedFiles: string[]
): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    const relativePath = path.join(basePath, entry.name);

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath, relativePath, copiedFiles);
    } else {
      await fs.copyFile(srcPath, destPath);
      copiedFiles.push(relativePath);
    }
  }
}

/**
 * Ensures specs folder exists with .gitkeep if empty
 */
export async function ensureSpecsFolder(targetDir: string): Promise<{
  success: boolean;
  created: boolean;
  error?: string;
}> {
  const specsPath = path.join(targetDir, "specs");
  const gitkeepPath = path.join(specsPath, ".gitkeep");

  try {
    // Check if specs folder exists
    try {
      await fs.access(specsPath);
      // Folder exists, check if it's empty
      const entries = await fs.readdir(specsPath);
      if (entries.length === 0) {
        // Empty folder, add .gitkeep
        await fs.writeFile(gitkeepPath, "");
      }
      return { success: true, created: false };
    } catch {
      // Folder doesn't exist, create it with .gitkeep
      await fs.mkdir(specsPath, { recursive: true });
      await fs.writeFile(gitkeepPath, "");
      return { success: true, created: true };
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return { success: false, created: false, error: errorMessage };
  }
}

/**
 * Cleans up temporary directory
 */
export async function cleanupTempDir(tempDir: string): Promise<void> {
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Checks if beads (bd) CLI is installed
 */
export async function checkBeadsInstalled(): Promise<boolean> {
  try {
    await execa("bd", ["--version"]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Installs beads via npm globally
 */
export async function installBeads(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    await execa("npm", ["install", "-g", "@beads/bd"]);
    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    if (errorMessage.includes("ENOENT")) {
      return {
        success: false,
        error: "npm not found. Please install beads manually.",
      };
    }
    return { success: false, error: errorMessage };
  }
}

/**
 * Initializes beads in the target directory
 */
export async function initBeads(
  targetDir: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    await execa("bd", ["init"], { cwd: targetDir });
    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: errorMessage };
  }
}
