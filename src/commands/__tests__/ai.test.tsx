import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "ink-testing-library";
import React from "react";
import { AiCommand } from "../ai.js";

// Mock ai-init utilities
vi.mock("../../lib/ai-init.js", () => ({
  checkEniExists: vi.fn(),
  sparseCloneBoilerplate: vi.fn(),
  copyAiFiles: vi.fn(),
  ensureSpecsFolder: vi.fn(),
  cleanupTempDir: vi.fn(),
  checkBeadsInstalled: vi.fn(),
  installBeads: vi.fn(),
  initBeads: vi.fn(),
}));

import {
  checkEniExists,
  sparseCloneBoilerplate,
  copyAiFiles,
  ensureSpecsFolder,
  cleanupTempDir,
  checkBeadsInstalled,
  installBeads,
  initBeads,
} from "../../lib/ai-init.js";

const mockCheckEniExists = vi.mocked(checkEniExists);
const mockSparseCloneBoilerplate = vi.mocked(sparseCloneBoilerplate);
const mockCopyAiFiles = vi.mocked(copyAiFiles);
const mockEnsureSpecsFolder = vi.mocked(ensureSpecsFolder);
const mockCleanupTempDir = vi.mocked(cleanupTempDir);
const mockCheckBeadsInstalled = vi.mocked(checkBeadsInstalled);
const mockInstallBeads = vi.mocked(installBeads);
const mockInitBeads = vi.mocked(initBeads);

describe("AiCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCleanupTempDir.mockResolvedValue(undefined);
    // Default beads mocks - installed and initialized successfully
    mockCheckBeadsInstalled.mockResolvedValue(true);
    mockInitBeads.mockResolvedValue({ success: true });
  });

  describe("Initial State", () => {
    it("renders section header", () => {
      mockCheckEniExists.mockImplementation(() => new Promise(() => {}));

      const { lastFrame } = render(
        <AiCommand forceFlag={false} targetDir="/test/project" gitHost="github.com" />
      );

      expect(lastFrame()).toContain("AI Workflow Setup");
    });

    it("shows checking state initially", () => {
      mockCheckEniExists.mockImplementation(() => new Promise(() => {}));

      const { lastFrame } = render(
        <AiCommand forceFlag={false} targetDir="/test/project" gitHost="github.com" />
      );

      expect(lastFrame()).toContain("Checking");
    });
  });

  describe("When .eni does not exist", () => {
    it("proceeds directly to cloning without confirmation", async () => {
      mockCheckEniExists.mockResolvedValue(false);
      mockSparseCloneBoilerplate.mockImplementation(
        () => new Promise(() => {})
      );

      const { lastFrame } = render(
        <AiCommand forceFlag={false} targetDir="/test/project" gitHost="github.com" />
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(lastFrame()).toContain("Fetching");
      expect(lastFrame()).not.toContain("already exists");
    });
  });

  describe("When .eni exists", () => {
    it("asks for confirmation when .eni exists", async () => {
      mockCheckEniExists.mockResolvedValue(true);

      const { lastFrame } = render(
        <AiCommand forceFlag={false} targetDir="/test/project" gitHost="github.com" />
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(lastFrame()).toContain(".eni folder already exists");
      expect(lastFrame()).toContain("Update AI workflow files?");
    });

    it("skips confirmation with --force flag", async () => {
      mockCheckEniExists.mockResolvedValue(true);
      mockSparseCloneBoilerplate.mockImplementation(
        () => new Promise(() => {})
      );

      const { lastFrame } = render(
        <AiCommand forceFlag={true} targetDir="/test/project" gitHost="github.com" />
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(lastFrame()).toContain("Fetching");
      expect(lastFrame()).not.toContain("already exists");
    });
  });

  describe("Successful Initialization", () => {
    it("shows success message with copied files", async () => {
      mockCheckEniExists.mockResolvedValue(false);
      mockSparseCloneBoilerplate.mockResolvedValue({
        success: true,
        tempDir: "/tmp/test",
      });
      mockCopyAiFiles.mockResolvedValue({
        success: true,
        copiedFiles: [".eni/loop.sh", ".eni/PROMPT_plan.md", ".claude/settings.local.json"],
      });
      mockEnsureSpecsFolder.mockResolvedValue({
        success: true,
        created: true,
      });

      const { lastFrame } = render(
        <AiCommand forceFlag={false} targetDir="/test/project" gitHost="github.com" />
      );

      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(lastFrame()).toContain("AI workflow initialized!");
      expect(lastFrame()).toContain("Copied files:");
      expect(lastFrame()).toContain(".eni/loop.sh");
      expect(lastFrame()).toContain(".eni/PROMPT_plan.md");
      expect(lastFrame()).toContain(".claude/settings.local.json");
      expect(lastFrame()).toContain("specs/.gitkeep");
    });

    it("shows update message when updating existing workflow", async () => {
      mockCheckEniExists.mockResolvedValue(true);
      mockSparseCloneBoilerplate.mockResolvedValue({
        success: true,
        tempDir: "/tmp/test",
      });
      mockCopyAiFiles.mockResolvedValue({
        success: true,
        copiedFiles: [".eni/loop.sh"],
      });
      mockEnsureSpecsFolder.mockResolvedValue({
        success: true,
        created: false,
      });

      const { lastFrame } = render(
        <AiCommand forceFlag={true} targetDir="/test/project" gitHost="github.com" />
      );

      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(lastFrame()).toContain("AI workflow files updated!");
    });

    it("shows hint about loop.sh on success", async () => {
      mockCheckEniExists.mockResolvedValue(false);
      mockSparseCloneBoilerplate.mockResolvedValue({
        success: true,
        tempDir: "/tmp/test",
      });
      mockCopyAiFiles.mockResolvedValue({
        success: true,
        copiedFiles: [".eni/loop.sh"],
      });
      mockEnsureSpecsFolder.mockResolvedValue({
        success: true,
        created: false,
      });

      const { lastFrame } = render(
        <AiCommand forceFlag={false} targetDir="/test/project" gitHost="github.com" />
      );

      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(lastFrame()).toContain("./.eni/loop.sh plan");
    });

    it("does not show specs created message when specs already existed", async () => {
      mockCheckEniExists.mockResolvedValue(false);
      mockSparseCloneBoilerplate.mockResolvedValue({
        success: true,
        tempDir: "/tmp/test",
      });
      mockCopyAiFiles.mockResolvedValue({
        success: true,
        copiedFiles: [".eni/loop.sh"],
      });
      mockEnsureSpecsFolder.mockResolvedValue({
        success: true,
        created: false,
      });

      const { lastFrame } = render(
        <AiCommand forceFlag={false} targetDir="/test/project" gitHost="github.com" />
      );

      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(lastFrame()).not.toContain("Created specs/");
    });
  });

  describe("Error Handling", () => {
    it("shows error when clone fails", async () => {
      mockCheckEniExists.mockResolvedValue(false);
      mockSparseCloneBoilerplate.mockResolvedValue({
        success: false,
        tempDir: "",
        error: "Network error",
      });

      const { lastFrame } = render(
        <AiCommand forceFlag={false} targetDir="/test/project" gitHost="github.com" />
      );

      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(lastFrame()).toContain("Network error");
    });

    it("shows error when copy fails", async () => {
      mockCheckEniExists.mockResolvedValue(false);
      mockSparseCloneBoilerplate.mockResolvedValue({
        success: true,
        tempDir: "/tmp/test",
      });
      mockCopyAiFiles.mockResolvedValue({
        success: false,
        copiedFiles: [],
        error: "Permission denied",
      });

      const { lastFrame } = render(
        <AiCommand forceFlag={false} targetDir="/test/project" gitHost="github.com" />
      );

      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(lastFrame()).toContain("Permission denied");
    });

    it("shows error when specs folder creation fails", async () => {
      mockCheckEniExists.mockResolvedValue(false);
      mockSparseCloneBoilerplate.mockResolvedValue({
        success: true,
        tempDir: "/tmp/test",
      });
      mockCopyAiFiles.mockResolvedValue({
        success: true,
        copiedFiles: [".eni/loop.sh"],
      });
      mockEnsureSpecsFolder.mockResolvedValue({
        success: false,
        created: false,
        error: "Cannot create directory",
      });

      const { lastFrame } = render(
        <AiCommand forceFlag={false} targetDir="/test/project" gitHost="github.com" />
      );

      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(lastFrame()).toContain("Cannot create directory");
    });

    it("cleans up temp directory on error", async () => {
      mockCheckEniExists.mockResolvedValue(false);
      mockSparseCloneBoilerplate.mockResolvedValue({
        success: true,
        tempDir: "/tmp/test-cleanup",
      });
      mockCopyAiFiles.mockResolvedValue({
        success: false,
        copiedFiles: [],
        error: "Copy failed",
      });

      render(<AiCommand forceFlag={false} targetDir="/test/project" gitHost="github.com" />);

      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(mockCleanupTempDir).toHaveBeenCalledWith("/tmp/test-cleanup");
    });
  });
});
