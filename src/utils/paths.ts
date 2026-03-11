import { homedir } from "node:os";
import path from "node:path";

export function expandHome(inputPath: string): string {
  if (inputPath === "~") {
    return homedir();
  }

  if (inputPath.startsWith("~/")) {
    return path.join(homedir(), inputPath.slice(2));
  }

  return inputPath;
}

export function getConfigDir(): string {
  return path.join(homedir(), ".config", "runit");
}

export function getRegistryPath(): string {
  return path.join(getConfigDir(), "projects.json");
}

export function getShimDir(): string {
  return path.join(homedir(), ".local", "bin");
}
