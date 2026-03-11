import { readFile } from "node:fs/promises";

import { execa } from "execa";

import { configExists, formatConfigError, getConfigPath, loadConfig, saveConfig, stringifyConfig } from "../core/config.ts";
import { detectProject } from "../core/detector.ts";
import { validateConfigPaths } from "../core/health.ts";
import { promptForConfigEdits } from "../core/interactive.ts";
import { getProject } from "../core/registry.ts";
import { scanProject } from "../core/scanner.ts";
import type { Action, RunitConfig } from "../types/config.ts";

type EditProjectOptions = {
  interactive?: boolean;
};

function requireRegisteredProjectMessage(alias: string): string {
  return `Project alias "${alias}" not registered`;
}

function requireConfigMessage(alias: string): string {
  return `.runit.yml not found\nRegenerate using:\n\nrunit ${alias} -r`;
}

function buildFallbackCommand(packageManager?: string): string {
  switch (packageManager) {
    case "pnpm":
      return "pnpm start";
    case "yarn":
      return "yarn start";
    case "bun":
      return "bun run start";
    default:
      return "npm start";
  }
}

function applyActionFallbacks(action: Action, fallbackCommand: string): Action {
  if (action.mode === "tmux") {
    return {
      ...action,
      windows: action.windows.map((window) => ({
        ...window,
        panes: window.panes.map((pane) => ({
          ...pane,
          cmd: pane.cmd || fallbackCommand,
        })),
      })),
    };
  }

  return {
    ...action,
    tasks: (action.tasks ?? []).map((task) => ({
      ...task,
      cmd: task.cmd || fallbackCommand,
    })),
  };
}

async function applyAutoFixes(projectRoot: string, config: RunitConfig): Promise<{ config: RunitConfig; warnings: string[] }> {
  const detection = detectProject(await scanProject(projectRoot));
  const fallbackCommand = buildFallbackCommand(detection.packageManager);
  const nextConfig: RunitConfig = {
    ...config,
    actions: Object.fromEntries(
      Object.entries(config.actions).map(([name, action]) => [name, applyActionFallbacks(action, fallbackCommand)]),
    ),
  };
  const warnings = await validateConfigPaths(projectRoot, nextConfig);

  return {
    config: nextConfig,
    warnings,
  };
}

async function openInEditor(configPath: string): Promise<void> {
  const editor = process.env.EDITOR || "nano";
  await execa(editor, [configPath], { stdio: "inherit" });
}

export async function editProject(alias: string, options: EditProjectOptions = {}): Promise<void> {
  const projectRoot = await getProject(alias);

  if (!projectRoot) {
    throw new Error(requireRegisteredProjectMessage(alias));
  }

  if (!(await configExists(projectRoot))) {
    throw new Error(requireConfigMessage(alias));
  }

  const configPath = getConfigPath(projectRoot);

  if (!options.interactive) {
    await openInEditor(configPath);

    try {
      const raw = await readFile(configPath, "utf8");
      const config = await loadConfig(projectRoot);
      const fixed = await applyAutoFixes(projectRoot, config);

      if (stringifyConfig(fixed.config) !== raw) {
        await saveConfig(projectRoot, fixed.config);
      }

      if (fixed.warnings.length > 0) {
        console.log("\nWarnings:");

        for (const warning of fixed.warnings) {
          console.log(warning);
        }
      }
    } catch (error) {
      throw new Error(formatConfigError(error));
    }

    return;
  }

  let config;

  try {
    config = await loadConfig(projectRoot);
  } catch (error) {
    throw new Error(formatConfigError(error));
  }

  const updatedConfig = await promptForConfigEdits(config);

  if (!updatedConfig) {
    console.log("Edit cancelled.");
    return;
  }

  try {
    const fixed = await applyAutoFixes(projectRoot, updatedConfig);
    await saveConfig(projectRoot, fixed.config);

    if (fixed.warnings.length > 0) {
      console.log("\nWarnings:");

      for (const warning of fixed.warnings) {
        console.log(warning);
      }
    }
  } catch (error) {
    throw new Error(formatConfigError(error));
  }

  console.log(`Updated ${configPath}`);
}
