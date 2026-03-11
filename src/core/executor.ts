import path from "node:path";
import type { Readable } from "node:stream";

import { execa } from "execa";

import { buildDependencyGraph } from "./dependencies.ts";
import { launchTmuxWorkspace } from "../tmux/runner.ts";
import type { RunitConfig, SimpleAction, Task } from "../types/config.ts";

type ExecuteActionOptions = {
  environment?: NodeJS.ProcessEnv;
  sessionName?: string;
};

function pipePrefixedOutput(stream: Readable | undefined, prefix: string): void {
  if (!stream) {
    return;
  }

  let buffer = "";

  stream.on("data", (chunk: Buffer | string) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      process.stdout.write(`${prefix}${line}\n`);
    }
  });

  stream.on("end", () => {
    if (buffer.length > 0) {
      process.stdout.write(`${prefix}${buffer}\n`);
    }
  });
}

function resolveTaskCwd(projectRoot: string, config: RunitConfig, task: Task): string {
  const actionRoot = path.resolve(projectRoot, config.root);
  return path.resolve(actionRoot, task.cwd);
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function runSimpleAction(
  projectRoot: string,
  config: RunitConfig,
  action: SimpleAction,
  environment: NodeJS.ProcessEnv,
): Promise<void> {
  const tasks = buildDependencyGraph(action.tasks ?? []);
  const runningProcesses: Promise<void>[] = [];

  console.log("[deps] resolving dependencies");

  for (const task of tasks) {
    const prefix = `[${task.name}] `;
    const cwd = resolveTaskCwd(projectRoot, config, task);
    console.log(`${prefix}starting ${task.cmd}`);

    const subprocess = execa(task.cmd, {
      cwd,
      env: {
        ...environment,
        ...task.env,
      },
      shell: true,
      all: true,
    });

    pipePrefixedOutput(subprocess.all, prefix);

    runningProcesses.push(
      subprocess.then(
        () => undefined,
        (error) => {
          throw new Error(`${prefix}command failed: ${task.cmd}`, { cause: error });
        },
      ),
    );

    if (task.delay) {
      await delay(task.delay);
    }
  }

  await Promise.all(runningProcesses);
}

export async function executeAction(
  projectRoot: string,
  config: RunitConfig,
  actionName = config.default,
  options: ExecuteActionOptions = {},
): Promise<void> {
  const action = config.actions[actionName];

  if (!action) {
    throw new Error(`Action "${actionName}" is not defined.`);
  }

  if (action.mode === "tmux") {
    const sessionName = options.sessionName ?? config.name;
    await launchTmuxWorkspace(projectRoot, config, action, sessionName, options.environment ?? process.env);
    return;
  }

  await runSimpleAction(projectRoot, config, action, options.environment ?? process.env);
}
