import YAML from "js-yaml";

import type { DockerComposeService } from "./service.ts";

type ComposeDocument = {
  services?: Record<
    string,
    {
      image?: string;
      depends_on?: string[] | Record<string, unknown>;
    }
  >;
};

type ComposeDependsOn = string[] | Record<string, unknown> | undefined;

function normalizeDependsOn(value: ComposeDependsOn): string[] {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  return Object.keys(value);
}

export function parseComposeServices(raw: string): DockerComposeService[] {
  const parsed = (YAML.load(raw) as ComposeDocument | undefined) ?? {};
  const services = parsed.services ?? {};

  return Object.entries(services)
    .map(([name, definition]) => ({
      name,
      dependsOn: normalizeDependsOn(definition.depends_on),
      image: definition.image,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}
