import { chmod, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { getShimDir } from "../utils/paths.ts";

export function getShimPath(alias: string): string {
  return path.join(getShimDir(), alias);
}

export async function createShim(alias: string): Promise<void> {
  await mkdir(getShimDir(), { recursive: true });

  const contents = `#!/usr/bin/env bash\nrunit --start "${alias}" "$@"\n`;
  const shimPath = getShimPath(alias);

  await writeFile(shimPath, contents, "utf8");
  await chmod(shimPath, 0o755);
}

export async function removeShim(alias: string): Promise<void> {
  await rm(getShimPath(alias), { force: true });
}
