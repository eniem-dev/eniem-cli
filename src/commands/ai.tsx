import { Box, Text } from "ink";
import React, { useState, useEffect, useRef } from "react";
import {
  Spinner,
  Confirm,
  SectionHeader,
  StatusMessage,
} from "../components/index.js";
import {
  checkEniExists,
  sparseCloneBoilerplate,
  copyAiFiles,
  ensureSpecsFolder,
  cleanupTempDir,
  checkBeadsInstalled,
  installBeads,
  initBeads,
} from "../lib/ai-init.js";

type AiInitStep =
  | "checking"
  | "confirm_update"
  | "cloning"
  | "copying"
  | "check_beads"
  | "confirm_install"
  | "installing"
  | "init_beads"
  | "complete"
  | "error";

interface AiCommandProps {
  forceFlag: boolean;
  targetDir: string;
  gitHost: string;
}

export const AiCommand = ({ forceFlag, targetDir, gitHost }: AiCommandProps) => {
  const [step, setStep] = useState<AiInitStep>("checking");
  const [eniExists, setEniExists] = useState(false);
  const [copiedFiles, setCopiedFiles] = useState<string[]>([]);
  const [specsCreated, setSpecsCreated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tempDir, setTempDir] = useState<string | null>(null);
  const [beadsInstalled, setBeadsInstalled] = useState(false);
  const [beadsInitialized, setBeadsInitialized] = useState(false);
  const [beadsError, setBeadsError] = useState<string | null>(null);

  // Refs to prevent duplicate effect runs
  const isCheckingRef = useRef(false);
  const isCloningRef = useRef(false);
  const isCopyingRef = useRef(false);
  const isCheckingBeadsRef = useRef(false);
  const isInstallingRef = useRef(false);
  const isInitBeadsRef = useRef(false);

  // Step 1: Check if .eni exists
  useEffect(() => {
    if (step === "checking" && !isCheckingRef.current) {
      isCheckingRef.current = true;
      const check = async () => {
        const exists = await checkEniExists(targetDir);
        setEniExists(exists);

        if (exists && !forceFlag) {
          setStep("confirm_update");
        } else {
          setStep("cloning");
        }
        isCheckingRef.current = false;
      };
      check();
    }
  }, [step, targetDir, forceFlag]);

  // Step 2: Sparse clone boilerplate
  useEffect(() => {
    if (step === "cloning" && !isCloningRef.current) {
      isCloningRef.current = true;
      const clone = async () => {
        const result = await sparseCloneBoilerplate(gitHost);
        if (!result.success) {
          setError(result.error ?? "Failed to clone boilerplate");
          setStep("error");
          isCloningRef.current = false;
          return;
        }
        setTempDir(result.tempDir);
        setStep("copying");
        isCloningRef.current = false;
      };
      clone();
    }
  }, [step, gitHost]);

  // Step 3: Copy files and ensure specs folder
  useEffect(() => {
    if (step === "copying" && tempDir && !isCopyingRef.current) {
      isCopyingRef.current = true;
      const copy = async () => {
        // Copy .eni and .claude folders
        const copyResult = await copyAiFiles(tempDir, targetDir);
        if (!copyResult.success) {
          await cleanupTempDir(tempDir);
          setError(copyResult.error ?? "Failed to copy files");
          setStep("error");
          isCopyingRef.current = false;
          return;
        }

        // Ensure specs folder exists
        const specsResult = await ensureSpecsFolder(targetDir);
        if (!specsResult.success) {
          await cleanupTempDir(tempDir);
          setError(specsResult.error ?? "Failed to create specs folder");
          setStep("error");
          isCopyingRef.current = false;
          return;
        }

        // Add specs/.gitkeep to copied files if specs folder was created
        const allCopiedFiles = [...copyResult.copiedFiles];
        if (specsResult.created) {
          allCopiedFiles.push("specs/.gitkeep");
        }

        // Cleanup temp directory
        await cleanupTempDir(tempDir);

        setCopiedFiles(allCopiedFiles);
        setSpecsCreated(specsResult.created);
        setStep("check_beads");
        isCopyingRef.current = false;
      };
      copy();
    }
  }, [step, tempDir, targetDir]);

  // Step 4: Check if beads is installed
  useEffect(() => {
    if (step === "check_beads" && !isCheckingBeadsRef.current) {
      isCheckingBeadsRef.current = true;
      const check = async () => {
        const installed = await checkBeadsInstalled();
        setBeadsInstalled(installed);
        if (installed) {
          setStep("init_beads");
        } else {
          setStep("confirm_install");
        }
        isCheckingBeadsRef.current = false;
      };
      check();
    }
  }, [step]);

  // Step 5: Install beads
  useEffect(() => {
    if (step === "installing" && !isInstallingRef.current) {
      isInstallingRef.current = true;
      const install = async () => {
        const result = await installBeads();
        if (result.success) {
          setBeadsInstalled(true);
          setStep("init_beads");
        } else {
          setBeadsError(result.error ?? "Failed to install beads");
          setStep("complete");
        }
        isInstallingRef.current = false;
      };
      install();
    }
  }, [step]);

  // Step 6: Initialize beads in project
  useEffect(() => {
    if (step === "init_beads" && !isInitBeadsRef.current) {
      isInitBeadsRef.current = true;
      const init = async () => {
        const result = await initBeads(targetDir);
        if (result.success) {
          setBeadsInitialized(true);
        } else {
          setBeadsError(result.error ?? "Failed to initialize beads");
        }
        setStep("complete");
        isInitBeadsRef.current = false;
      };
      init();
    }
  }, [step, targetDir]);

  // Handle confirmation for update
  const handleConfirm = (confirmed: boolean) => {
    if (confirmed) {
      setStep("cloning");
    } else {
      process.exit(0);
    }
  };

  // Handle confirmation for beads install
  const handleBeadsConfirm = (confirmed: boolean) => {
    if (confirmed) {
      setStep("installing");
    } else {
      setStep("complete");
    }
  };

  return (
    <Box flexDirection="column">
      <SectionHeader title="AI Workflow Setup" />

      {step === "checking" && <Spinner label="Checking existing files..." />}

      {step === "confirm_update" && (
        <Box flexDirection="column">
          <Text color="yellow">
            .eni folder already exists in this project.
          </Text>
          <Box marginTop={1}>
            <Confirm
              label="Update AI workflow files? This will replace existing .eni and .claude folders"
              onConfirm={handleConfirm}
              defaultValue={false}
            />
          </Box>
        </Box>
      )}

      {step === "cloning" && (
        <Spinner label="Fetching latest AI workflow files from boilerplate..." />
      )}

      {step === "copying" && <Spinner label="Copying files to project..." />}

      {step === "check_beads" && <Spinner label="Checking beads installation..." />}

      {step === "confirm_install" && (
        <Box flexDirection="column">
          <Text color="yellow">
            Beads (bd) is not installed. Beads is required for the AI workflow.
          </Text>
          <Box marginTop={1}>
            <Confirm
              label="Install beads via npm? (npm install -g @beads/bd)"
              onConfirm={handleBeadsConfirm}
              defaultValue={true}
            />
          </Box>
        </Box>
      )}

      {step === "installing" && <Spinner label="Installing beads..." />}

      {step === "init_beads" && <Spinner label="Initializing beads in project..." />}

      {step === "complete" && (
        <Box flexDirection="column">
          <StatusMessage status="success">
            {eniExists
              ? "AI workflow files updated!"
              : "AI workflow initialized!"}
          </StatusMessage>

          <Box flexDirection="column" marginTop={1} marginLeft={2}>
            <Text bold>Copied files:</Text>
            {copiedFiles.map((file) => (
              <Text key={file} color="green">
                - {file}
              </Text>
            ))}
          </Box>

          {specsCreated && (
            <Box marginTop={1}>
              <Text dimColor>Created specs/ folder for feature specs</Text>
            </Box>
          )}

          {beadsInstalled && beadsInitialized && (
            <Box marginTop={1}>
              <StatusMessage status="success">Beads initialized</StatusMessage>
            </Box>
          )}

          {beadsInstalled && !beadsInitialized && beadsError && (
            <Box marginTop={1}>
              <StatusMessage status="warning">
                Beads installed but init failed: {beadsError}
              </StatusMessage>
              <Text dimColor>Run <Text color="cyan">bd init</Text> manually</Text>
            </Box>
          )}

          {!beadsInstalled && beadsError && (
            <Box marginTop={1}>
              <StatusMessage status="warning">
                Failed to install beads: {beadsError}
              </StatusMessage>
              <Text dimColor>
                Install manually: <Text color="cyan">npm install -g @beads/bd</Text>
              </Text>
            </Box>
          )}

          {!beadsInstalled && !beadsError && (
            <Box marginTop={1}>
              <StatusMessage status="warning">Beads not installed</StatusMessage>
              <Text dimColor>
                Install with: <Text color="cyan">npm install -g @beads/bd</Text>
              </Text>
              <Text dimColor>
                Then run: <Text color="cyan">bd init</Text>
              </Text>
            </Box>
          )}

          <Box marginTop={1}>
            <Text dimColor>
              Run <Text color="cyan">./.eni/loop.sh plan</Text> to start planning
              with AI
            </Text>
          </Box>
        </Box>
      )}

      {step === "error" && (
        <Box flexDirection="column">
          <StatusMessage status="error">{error}</StatusMessage>
        </Box>
      )}
    </Box>
  );
};
