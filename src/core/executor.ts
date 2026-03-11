import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import type { Readable } from "node:stream";

import { execa } from "execa";

import { buildDependencyGraph } from "./dependencies.ts";
import { launchTmuxWorkspace } from "../tmux/runner.ts";
import type { RunitConfig, SimpleAction, Task } from "../types/config.ts";

type ExecuteActionOptions = {
  environment?: NodeJS.ProcessEnv;
  sessionName?: string;
};

type ExitSignal = "SIGINT" | "SIGTERM";

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

function isCanceledError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === "object" &&
    "isCanceled" in error &&
    (error as { isCanceled?: boolean }).isCanceled,
  );
}

function createTerminationController(): {
  abortController: AbortController;
  cleanup: () => void;
} {
  const abortController = new AbortController();

  const abortOnSignal = (signal: ExitSignal) => {
    if (!abortController.signal.aborted) {
      abortController.abort(new Error(`Received ${signal}`));
    }
  };

  const handleSigint = () => abortOnSignal("SIGINT");
  const handleSigterm = () => abortOnSignal("SIGTERM");

  process.once("SIGINT", handleSigint);
  process.once("SIGTERM", handleSigterm);

  return {
    abortController,
    cleanup: () => {
      process.off("SIGINT", handleSigint);
      process.off("SIGTERM", handleSigterm);
    },
  };
}

async function runSimpleAction(
  projectRoot: string,
  config: RunitConfig,
  action: SimpleAction,
  environment: NodeJS.ProcessEnv,
): Promise<void> {
  const tasks = buildDependencyGraph(action.tasks ?? []);
  const runningProcesses: Promise<void>[] = [];
  const { abortController, cleanup } = createTerminationController();

  console.log("[deps] resolving dependencies");

  try {
    for (const task of tasks) {
      if (abortController.signal.aborted) {
        break;
      }

      const prefix = `[${task.name}] `;
      const cwd = resolveTaskCwd(projectRoot, config, task);
      console.log(`${prefix}starting ${task.cmd}`);

      const subprocess = execa(`exec ${task.cmd}`, {
        cwd,
        env: {
          ...environment,
          ...task.env,
        },
        shell: true,
        all: true,
        cancelSignal: abortController.signal,
        cleanup: true,
        forceKillAfterDelay: 3000,
      });

      pipePrefixedOutput(subprocess.all, prefix);

      runningProcesses.push(
        subprocess.then(
          () => undefined,
          (error) => {
            if (abortController.signal.aborted && isCanceledError(error)) {
              return;
            }

            throw new Error(`${prefix}command failed: ${task.cmd}`, { cause: error });
          },
        ),
      );

      if (task.delay) {
        try {
          await delay(task.delay, undefined, { signal: abortController.signal });
        } catch (error) {
          if (!abortController.signal.aborted) {
            throw error;
          }
        }
      }
    }

    const results = await Promise.allSettled(runningProcesses);

    if (abortController.signal.aborted) {
      process.exitCode = 130;
      return;
    }

    const firstFailure = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );

    if (firstFailure) {
      throw firstFailure.reason;
    }
  } finally {
    cleanup();
  }
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
