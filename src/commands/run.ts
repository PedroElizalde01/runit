import { readFile } from "node:fs/promises";
import path from "node:path";

import { configExists, getConfigPath, loadConfig, saveConfig, stringifyConfig } from "../core/config.ts";
import { buildDependencyGraph } from "../core/dependencies.ts";
import { detectProject } from "../core/detector.ts";
import { loadEnv } from "../core/env.ts";
import { executeAction } from "../core/executor.ts";
import { generateConfig } from "../core/generator.ts";
import { confirmAction } from "../core/interactive.ts";
import { getProject, registerProject } from "../core/registry.ts";
import { scanProject } from "../core/scanner.ts";
import { createShim, getShimPath } from "../core/shim.ts";
import { expandHome } from "../utils/paths.ts";

type RunProjectOptions = {
  regenerate?: boolean;
};

function logList(title: string, values: string[]): void {
  console.log(`[detect] ${title.toLowerCase()}:`);

  if (values.length === 0) {
    console.log("  - none");
    return;
  }

  for (const value of values) {
    console.log(`  - ${value}`);
  }
}

function logDetection(detection: ReturnType<typeof detectProject>): void {
  console.log(`[detect] stack: ${detection.stack}`);

  if (detection.packageManager) {
    console.log(`[detect] package manager: ${detection.packageManager}`);
  }

  logList("Frameworks", detection.frameworks);

  const serviceNames = [
    ...detection.services.map((service) => service.name),
  ];
  logList("Services", serviceNames);
}

async function scanAndGenerate(alias: string, projectRoot: string): Promise<void> {
  console.log("[scan] scanning project\n");

  const scanResult = await scanProject(projectRoot);
  const detection = detectProject(scanResult);
  logDetection(detection);

  console.log("\n[config] generating optimized .runit.yml");
  const config = generateConfig(scanResult, alias);
  await saveConfig(projectRoot, config);
  console.log("[config] generated .runit.yml\n");
}

function formatProposedChanges(currentConfig: string, nextConfig: string): string[] {
  const currentLines = new Set(currentConfig.split("\n").map((line) => line.trim()).filter(Boolean));
  const nextLines = new Set(nextConfig.split("\n").map((line) => line.trim()).filter(Boolean));
  const changes: string[] = [];

  for (const line of nextLines) {
    if (!currentLines.has(line)) {
      changes.push(`+ ${line}`);
    }
  }

  for (const line of currentLines) {
    if (!nextLines.has(line)) {
      changes.push(`- ${line}`);
    }
  }

  return changes;
}

async function regenerateWithPreview(alias: string, projectRoot: string): Promise<void> {
  const scanResult = await scanProject(projectRoot);
  const detection = detectProject(scanResult);
  const nextConfig = generateConfig(scanResult, alias);
  const nextYaml = stringifyConfig(nextConfig);
  const currentYaml = await readFile(getConfigPath(projectRoot), "utf8");
  const diffLines = formatProposedChanges(currentYaml, nextYaml);

  console.log("[scan] scanning project\n");
  logDetection(detection);
  console.log("\n[config] proposed changes:\n");

  if (diffLines.length === 0) {
    console.log("(no changes)\n");
    return;
  }

  for (const line of diffLines) {
    console.log(line);
  }

  console.log("");

  if (!(await confirmAction("Apply changes?", false))) {
    console.log("[config] regeneration cancelled");
    return;
  }

  await saveConfig(projectRoot, nextConfig);
  console.log("[config] updated .runit.yml\n");
}

async function bootstrapProject(alias: string, projectRoot: string, overwriteConfig: boolean): Promise<void> {
  if (overwriteConfig) {
    await scanAndGenerate(alias, projectRoot);
  }

  console.log(`[registry] registering project alias: ${alias}`);
  await registerProject(alias, projectRoot);

  const shimPath = getShimPath(alias);
  console.log(`[shim] creating ${shimPath.replace(expandHome("~"), "~")}`);
  await createShim(alias);

  console.log(`\n[registry] project registered as "${alias}"\n`);
}

async function ensureProjectReady(alias: string, options: RunProjectOptions): Promise<string> {
  const registeredProjectRoot = await getProject(alias);
  const projectRoot = registeredProjectRoot ? path.resolve(registeredProjectRoot) : process.cwd();
  const hasConfig = await configExists(projectRoot);

  if (!registeredProjectRoot) {
    await bootstrapProject(alias, projectRoot, !hasConfig || Boolean(options.regenerate));
    return projectRoot;
  }

  if (options.regenerate && hasConfig) {
    await regenerateWithPreview(alias, projectRoot);
  } else if (options.regenerate || !hasConfig) {
    await scanAndGenerate(alias, projectRoot);
  }

  return projectRoot;
}

export async function runProject(alias: string, options: RunProjectOptions = {}): Promise<void> {
  const projectRoot = await ensureProjectReady(alias, options);
  const config = await loadConfig(projectRoot);
  const action = config.actions[config.default];
  const env = await loadEnv(projectRoot, config.default);

  console.log("[env] loading environment variables");

  if (action.mode === "simple") {
    buildDependencyGraph(action.tasks ?? []);
  } else {
    buildDependencyGraph(action.windows.flatMap((window) => window.panes));
  }

  if (action?.mode !== "tmux") {
    console.log("[run] starting dev environment...");
  }

  await executeAction(projectRoot, config, config.default, {
    environment: env.values,
    sessionName: alias,
  });
}
