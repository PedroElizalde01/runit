import { describe, expect, test } from "bun:test";

import { formatConfigError, parseConfig } from "../src/core/config.ts";

describe("config validation", () => {
  test("rejects duplicate service names in simple actions", () => {
    const raw = [
      "name: jims",
      "root: .",
      "default: dev",
      "actions:",
      "  dev:",
      "    mode: simple",
      "    tasks:",
      "      - name: api",
      "        cwd: .",
      "        cmd: pnpm dev",
      "      - name: api",
      "        cwd: .",
      "        cmd: pnpm dev",
    ].join("\n");

    expect(() => parseConfig(raw)).toThrow();
  });

  test("formats missing command errors clearly", () => {
    const raw = [
      "name: jims",
      "root: .",
      "default: dev",
      "actions:",
      "  dev:",
      "    mode: simple",
      "    tasks:",
      "      - name: api",
      "        cwd: .",
    ].join("\n");

    try {
      parseConfig(raw);
      throw new Error("Expected parse to fail");
    } catch (error) {
      expect(formatConfigError(error)).toContain("actions.dev.tasks.0.cmd");
    }
  });
});
