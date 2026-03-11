import { getProject, removeProject } from "../core/registry.ts";
import { removeShim } from "../core/shim.ts";

export async function removeRegisteredProject(alias: string): Promise<void> {
  const projectRoot = await getProject(alias);

  if (!projectRoot) {
    throw new Error(`Project "${alias}" is not registered.`);
  }

  await removeProject(alias);
  await removeShim(alias);

  console.log(`Removed project "${alias}" (${projectRoot})`);
}
