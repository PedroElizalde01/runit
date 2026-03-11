import { readFile } from "node:fs/promises";
import path from "node:path";

import dotenv from "dotenv";

export type LoadedEnv = {
  files: string[];
  values: Record<string, string>;
  mergedEnv: NodeJS.ProcessEnv;
};

async function readEnvFile(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

export async function loadEnv(projectRoot: string, action: string): Promise<LoadedEnv> {
  const candidates = [".env", ".env.local", ".env.development", `.env.${action}`];
  const values: Record<string, string> = {};
  const files: string[] = [];

  for (const candidate of candidates) {
    const filePath = path.join(projectRoot, candidate);
    const raw = await readEnvFile(filePath);

    if (!raw) {
      continue;
    }

    Object.assign(values, dotenv.parse(raw));
    files.push(candidate);
  }

  Object.assign(process.env, values);

  return {
    files,
    values,
    mergedEnv: {
      ...process.env,
      ...values,
    },
  };
}
