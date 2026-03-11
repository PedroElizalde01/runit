import { homedir } from "node:os";

import { listProjects } from "../core/registry.ts";

function compactHome(projectPath: string): string {
  const home = homedir();
  return projectPath.startsWith(home) ? projectPath.replace(home, "~") : projectPath;
}

export async function listRegisteredProjects(): Promise<void> {
  const projects = await listProjects();
  const entries = Object.entries(projects).sort(([left], [right]) => left.localeCompare(right));

  if (entries.length === 0) {
    console.log("Registered projects:\n");
    console.log("(none)");
    return;
  }

  console.log("Registered projects:\n");

  for (const [alias, projectPath] of entries) {
    console.log(`${alias} -> ${compactHome(projectPath)}`);
  }
}
