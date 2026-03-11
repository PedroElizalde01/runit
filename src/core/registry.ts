import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { getConfigDir, getRegistryPath } from "../utils/paths.ts";

type ProjectRegistry = Record<string, string>;

async function ensureRegistryDir(): Promise<void> {
  await mkdir(getConfigDir(), { recursive: true });
}

async function readRegistry(): Promise<ProjectRegistry> {
  await ensureRegistryDir();

  try {
    const raw = await readFile(getRegistryPath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Registry file is not a valid object.");
    }

    return Object.fromEntries(
      Object.entries(parsed).map(([alias, projectPath]) => {
        if (typeof projectPath !== "string") {
          throw new Error(`Registry entry for "${alias}" must be a string path.`);
        }

        return [alias, projectPath];
      }),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }

    throw error;
  }
}

async function writeRegistry(registry: ProjectRegistry): Promise<void> {
  await ensureRegistryDir();
  await writeFile(getRegistryPath(), `${JSON.stringify(registry, null, 2)}\n`, "utf8");
}

export async function registerProject(alias: string, projectPath: string): Promise<void> {
  const registry = await readRegistry();
  registry[alias] = path.resolve(projectPath);
  await writeRegistry(registry);
}

export async function removeProject(alias: string): Promise<void> {
  const registry = await readRegistry();
  delete registry[alias];
  await writeRegistry(registry);
}

export async function getProject(alias: string): Promise<string | undefined> {
  const registry = await readRegistry();
  return registry[alias];
}

export async function listProjects(): Promise<ProjectRegistry> {
  return readRegistry();
}
