import type { Pane, Task } from "../types/config.ts";

type Runnable = Task | Pane;

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export function buildDependencyGraph<T extends Runnable>(items: T[]): T[] {
  const itemMap = new Map(items.map((item) => [item.name, item]));
  const inDegree = new Map<string, number>(items.map((item) => [item.name, 0]));
  const adjacency = new Map<string, string[]>(items.map((item) => [item.name, []]));

  for (const item of items) {
    for (const dependency of item.dependsOn ?? []) {
      if (!itemMap.has(dependency)) {
        continue;
      }

      adjacency.get(dependency)?.push(item.name);
      inDegree.set(item.name, (inDegree.get(item.name) ?? 0) + 1);
    }
  }

  const queue = items
    .filter((item) => (inDegree.get(item.name) ?? 0) === 0)
    .map((item) => item.name);
  const orderedNames: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    orderedNames.push(current);

    for (const next of adjacency.get(current) ?? []) {
      const remaining = (inDegree.get(next) ?? 0) - 1;
      inDegree.set(next, remaining);

      if (remaining === 0) {
        queue.push(next);
      }
    }
  }

  if (orderedNames.length !== items.length) {
    const cycle = items
      .filter((item) => (inDegree.get(item.name) ?? 0) > 0)
      .map((item) => item.name);

    throw new Error(`circular dependency detected\n${cycle.join(" -> ")}`);
  }

  return orderedNames.map((name) => itemMap.get(name)!);
}

export function visualizeDependencyGraph<T extends Runnable>(items: T[]): string {
  const ordered = buildDependencyGraph(items);

  return ordered
    .map((item, index) => {
      if (index === ordered.length - 1) {
        return item.name;
      }

      return `${item.name}\n  ↓`;
    })
    .join("\n");
}

export function collectDependencies<T extends Runnable>(items: T[]): string[] {
  return unique(items.flatMap((item) => item.dependsOn ?? []));
}
