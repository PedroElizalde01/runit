import { execa } from "execa";

import type { Window } from "../types/config.ts";

type WindowTarget = {
  sessionName: string;
  windowIndex: number;
};

async function runTmux(args: string[]): Promise<void> {
  await execa("tmux", args);
}

function getWindowTarget({ sessionName, windowIndex }: WindowTarget): string {
  return `${sessionName}:${windowIndex}`;
}

function getPaneTarget(windowTarget: WindowTarget, paneIndex: number): string {
  return `${getWindowTarget(windowTarget)}.${paneIndex}`;
}

export async function createWindow(sessionName: string, windowIndex: number, window: Window): Promise<void> {
  if (windowIndex === 0) {
    await runTmux(["rename-window", "-t", `${sessionName}:0`, window.name]);
    return;
  }

  await runTmux(["new-window", "-t", sessionName, "-n", window.name]);
}

export async function createPanes(sessionName: string, windowIndex: number, paneCount: number): Promise<void> {
  if (paneCount <= 1) {
    return;
  }

  const windowTarget = getWindowTarget({ sessionName, windowIndex });

  for (let paneIndex = 1; paneIndex < paneCount; paneIndex += 1) {
    await runTmux(["split-window", "-t", windowTarget]);
  }
}

export async function applyWindowLayout(sessionName: string, windowIndex: number, layout?: string): Promise<void> {
  if (!layout) {
    return;
  }

  await runTmux(["select-layout", "-t", `${sessionName}:${windowIndex}`, layout]);
}

export function getPaneId(sessionName: string, windowIndex: number, paneIndex: number): string {
  return getPaneTarget({ sessionName, windowIndex }, paneIndex);
}
