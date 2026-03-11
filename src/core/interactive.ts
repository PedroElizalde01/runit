import { confirm, input, select } from "@inquirer/prompts";

import type { Action, Pane, RunitConfig, Task, Window } from "../types/config.ts";

type EditableService = {
  name: string;
  cwd: string;
  cmd: string;
};

function getEditableWindow(action: Action): Window | undefined {
  if (action.mode !== "tmux") {
    return undefined;
  }

  return action.windows.find((window) => window.name === "services") ?? action.windows[0];
}

function extractServices(action: Action): EditableService[] {
  if (action.mode === "tmux") {
    return (getEditableWindow(action)?.panes ?? []).map((pane) => ({
      name: pane.name,
      cwd: pane.cwd,
      cmd: pane.cmd,
    }));
  }

  return (action.tasks ?? []).map((task) => ({
    name: task.name,
    cwd: task.cwd,
    cmd: task.cmd,
  }));
}

function resolveTmuxLayout(serviceCount: number): string {
  if (serviceCount === 2) {
    return "even-horizontal";
  }

  if (serviceCount >= 3) {
    return "tiled";
  }

  return "even-horizontal";
}

function applyServicesToAction(
  action: Action,
  services: EditableService[],
  mode: "simple" | "tmux",
): Action {
  if (mode === "simple") {
    const tasks: Task[] = services.map((service) => ({
      name: service.name,
      cwd: service.cwd,
      cmd: service.cmd,
    }));

    return {
      mode: "simple",
      tasks,
    };
  }

  const serviceWindow: Window = {
    name: "services",
    layout: resolveTmuxLayout(services.length),
    panes: services.map(
      (service): Pane => ({
        name: service.name,
        cwd: service.cwd,
        cmd: service.cmd,
      }),
    ),
  };

  const extraWindows = action.mode === "tmux" ? action.windows.filter((window) => window !== getEditableWindow(action)) : [];

  return {
    mode: "tmux",
    windows: [serviceWindow, ...extraWindows],
  };
}

async function promptServiceSelection(services: EditableService[], message: string): Promise<number> {
  return select({
    message,
    choices: services.map((service, index) => ({
      name: `${service.name} -> ${service.cmd} (${service.cwd})`,
      value: index,
    })),
  });
}

export async function confirmAction(message: string, defaultValue = false): Promise<boolean> {
  return confirm({
    message,
    default: defaultValue,
  });
}

export async function promptForConfigEdits(config: RunitConfig): Promise<RunitConfig | null> {
  const defaultActionName = config.default;
  const defaultAction = config.actions[defaultActionName];

  if (!defaultAction) {
    return config;
  }

  let nextMode: "simple" | "tmux" = defaultAction.mode;
  let services = extractServices(defaultAction);
  const hasExtraTmuxWindows = defaultAction.mode === "tmux" && defaultAction.windows.length > 1;

  while (true) {
    const action = await select({
      message: `Edit action "${defaultActionName}"`,
      choices: [
        { name: "Add service", value: "add" },
        { name: "Remove service", value: "remove" },
        { name: "Change command", value: "command" },
        { name: "Change cwd", value: "cwd" },
        { name: `Toggle mode (current: ${nextMode})`, value: "mode" },
        { name: "Save changes", value: "save" },
        { name: "Cancel", value: "cancel" },
      ],
    });

    if (action === "cancel") {
      return null;
    }

    if (action === "save") {
      if (services.length === 0) {
        throw new Error('At least one service is required for the default action.');
      }

      return {
        ...config,
        actions: {
          ...config.actions,
          [defaultActionName]: applyServicesToAction(defaultAction, services, nextMode),
        },
      };
    }

    if (action === "add") {
      const name = await input({ message: "Service name", default: `service-${services.length + 1}` });
      const cwd = await input({ message: "Working directory", default: "." });
      const cmd = await input({ message: "Command", default: "npm start" });

      services = [...services, { name, cwd, cmd }];
      continue;
    }

    if (action === "mode") {
      nextMode = nextMode === "simple" ? "tmux" : "simple";

      if (hasExtraTmuxWindows && nextMode === "simple") {
        console.log('Warning: switching to "simple" keeps only the primary services window.');
      }

      continue;
    }

    if (services.length === 0) {
      console.log("No services available to edit.");
      continue;
    }

    const selectedIndex = await promptServiceSelection(services, "Select a service");

    if (action === "remove") {
      services = services.filter((_, index) => index !== selectedIndex);
      continue;
    }

    if (action === "command") {
      const cmd = await input({
        message: `Command for ${services[selectedIndex].name}`,
        default: services[selectedIndex].cmd,
      });
      services = services.map((service, index) =>
        index === selectedIndex ? { ...service, cmd } : service,
      );
      continue;
    }

    if (action === "cwd") {
      const cwd = await input({
        message: `Working directory for ${services[selectedIndex].name}`,
        default: services[selectedIndex].cwd,
      });
      services = services.map((service, index) =>
        index === selectedIndex ? { ...service, cwd } : service,
      );
    }
  }
}
