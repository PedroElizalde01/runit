import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export async function makeTempDir(prefix: string): Promise<string> {
  return mkdtemp(path.join(tmpdir(), prefix));
}

export async function cleanupTempDir(target: string): Promise<void> {
  await rm(target, { recursive: true, force: true });
}

export async function writeProjectFile(projectRoot: string, relativePath: string, contents: string): Promise<void> {
  const absolutePath = path.join(projectRoot, relativePath);
  await Bun.write(absolutePath, contents);
}
