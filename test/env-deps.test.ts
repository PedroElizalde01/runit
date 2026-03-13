import { afterEach, describe, expect, test } from "bun:test";

import { buildDependencyGraph, visualizeDependencyGraph } from "../src/core/dependencies.ts";
import { loadEnv } from "../src/core/env.ts";
import { cleanupTempDir, makeTempDir, writeProjectFile } from "./helpers.ts";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => cleanupTempDir(dir)));
});

describe("environment and dependency resolution", () => {
  test("loads env files in precedence order", async () => {
    const projectRoot = await makeTempDir("runit-env-");
    tempDirs.push(projectRoot);

    await writeProjectFile(projectRoot, ".env", "DATABASE_URL=base\n");
    await writeProjectFile(projectRoot, ".env.local", "DATABASE_URL=local\n");
    await writeProjectFile(projectRoot, ".env.development", "DATABASE_URL=development\n");
    await writeProjectFile(projectRoot, ".env.dev", "DATABASE_URL=dev\nREDIS_HOST=127.0.0.1\n");

    const env = await loadEnv(projectRoot, "dev");

    expect(env.files).toEqual([".env", ".env.local", ".env.development", ".env.dev"]);
    expect(env.values.DATABASE_URL).toBe("dev");
    expect(env.values.REDIS_HOST).toBe("127.0.0.1");
  });

  test("builds dependency order and graph output", () => {
    const ordered = buildDependencyGraph([
      { name: "web", cwd: ".", cmd: "echo web", dependsOn: ["api"] },
      { name: "api", cwd: ".", cmd: "echo api", dependsOn: ["database"] },
      { name: "database", cwd: ".", cmd: "echo db", delay: 1000 },
    ]);

    expect(ordered.map((item) => item.name)).toEqual(["database", "api", "web"]);
    expect(visualizeDependencyGraph(ordered)).toBe("database\n  ↓\napi\n  ↓\nweb");
  });

  test("detects circular dependencies", () => {
    expect(() =>
      buildDependencyGraph([
        { name: "api", cwd: ".", cmd: "echo api", dependsOn: ["web"] },
        { name: "web", cwd: ".", cmd: "echo web", dependsOn: ["api"] },
      ]),
    ).toThrow("circular dependency detected");
  });
});
