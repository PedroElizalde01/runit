import { access } from "node:fs/promises";
import path from "node:path";

import { execa } from "execa";

import type { ProjectDetection } from "./detectors/types.ts";
import type { RunitConfig } from "../types/config.ts";

export type ToolCheck = {
  name: string;
  installed: boolean;
  version?: string;
};

type ToolDefinition = {
  command: string;
  args: string[];
};

const TOOL_COMMANDS: Record<string, ToolDefinition> = {
  tmux: { command: "tmux", args: ["-V"] },
  docker: { command: "docker", args: ["-v"] },
  node: { command: "node", args: ["-v"] },
  python: { command: "python", args: ["-V"] },
  npm: { command: "npm", args: ["-v"] },
  pnpm: { command: "pnpm", args: ["-v"] },
  yarn: { command: "yarn", args: ["-v"] },
  bun: { command: "bun", args: ["-v"] },
};

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function getActionTaskPaths(config: RunitConfig): Array<{ name: string; cwd: string }> {
  return Object.values(config.actions).flatMap((action) => {
    if (action.mode === "tmux") {
      return action.windows.flatMap((window) =>
        window.panes.map((pane) => ({
          name: pane.name,
          cwd: pane.cwd,
        })),
      );
    }

    return (action.tasks ?? []).map((task) => ({
      name: task.name,
      cwd: task.cwd,
    }));
  });
}

export async function checkTool(name: string): Promise<ToolCheck> {
  const definition = TOOL_COMMANDS[name];

  if (!definition) {
    throw new Error(`Unknown tool check: ${name}`);
  }

  try {
    const result = await execa(definition.command, definition.args);
    return {
      name,
      installed: true,
      version: result.stdout.trim() || result.stderr.trim() || undefined,
    };
  } catch (error) {
    const errorCode = (error as NodeJS.ErrnoException).code;

    if (errorCode === "ENOENT") {
      return {
        name,
        installed: false,
      };
    }

    return {
      name,
      installed: false,
      version: error instanceof Error ? error.message : undefined,
    };
  }
}

export async function checkTools(names: string[]): Promise<ToolCheck[]> {
  return Promise.all(unique(names).map((name) => checkTool(name)));
}

export function inferRequiredTools(config: RunitConfig, detection: ProjectDetection): string[] {
  const tools = new Set<string>();

  for (const action of Object.values(config.actions)) {
    if (action.mode === "tmux") {
      tools.add("tmux");
    }
  }

  if (detection.services.some((service) => service.runtime === "node")) {
    tools.add("node");
  }

  if (detection.services.some((service) => service.runtime === "python")) {
    tools.add("python");
  }

  if (detection.services.some((service) => service.runtime === "docker")) {
    tools.add("docker");
  }

  if (detection.packageManager && detection.packageManager !== "unknown") {
    tools.add(detection.packageManager);
  }

  return [...tools];
}

export async function validateConfigPaths(projectRoot: string, config: RunitConfig): Promise<string[]> {
  const warnings: string[] = [];

  for (const task of getActionTaskPaths(config)) {
    const absolutePath = path.resolve(projectRoot, config.root, task.cwd);

    try {
      await access(absolutePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        warnings.push(`Service "${task.name}" cwd not found: ${task.cwd}`);
        continue;
      }

      throw error;
    }
  }

  return warnings;
}

export function collectToolWarnings(detection: ProjectDetection, tools: ToolCheck[]): string[] {
  const warnings: string[] = [];
  const toolMap = new Map(tools.map((tool) => [tool.name, tool]));

  if (detection.services.some((service) => service.runtime === "docker") && toolMap.get("docker")?.installed === false) {
    warnings.push("Docker not installed but docker-compose detected.");
  }

  if (tools.some((tool) => !tool.installed)) {
    for (const tool of tools.filter((entry) => !entry.installed)) {
      warnings.push(`${tool.name} is required but not installed.`);
    }
  }

  return unique(warnings);
}
