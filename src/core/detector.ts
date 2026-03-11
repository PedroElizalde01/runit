import { buildExecCommand, detectNodeProject } from "./detectors/node.ts";
import type { DetectedService, ProjectDetection, StackKind } from "./detectors/types.ts";
import { detectDockerProject } from "./detectors/docker.ts";
import { detectPythonProject } from "./detectors/python.ts";
import type { ScanResult } from "./scanner.ts";

function unique(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function resolveStack(kinds: StackKind[]): ProjectDetection["stack"] {
  const uniqueKinds = unique(kinds);

  if (uniqueKinds.length === 0) {
    return "unknown";
  }

  if (uniqueKinds.length === 1) {
    return uniqueKinds[0] as Exclude<ProjectDetection["stack"], "mixed" | "unknown">;
  }

  return "mixed";
}

function buildFallbackService(): DetectedService {
  return {
    name: "app",
    path: ".",
    command: "npm start",
    runtime: "node",
  };
}

function inferServiceDependencies(services: DetectedService[]): DetectedService[] {
  const dockerServices = services.filter((service) => service.runtime === "docker").map((service) => service.name);
  const backend = services.find((service) => ["api", "server", "backend"].includes(service.name));
  const frontendNames = new Set(["web", "frontend", "client"]);

  return services.map((service) => {
    const dependsOn = new Set(service.dependsOn ?? []);

    if (service.runtime !== "docker" && dockerServices.length > 0) {
      for (const dockerService of dockerServices) {
        dependsOn.add(dockerService);
      }
    }

    if (backend && frontendNames.has(service.name) && service.name !== backend.name) {
      dependsOn.add(backend.name);
    }

    return {
      ...service,
      dependsOn: dependsOn.size > 0 ? [...dependsOn] : undefined,
    };
  });
}

export function detectProject(scanResult: ScanResult): ProjectDetection {
  const nodeDetection = detectNodeProject(scanResult);
  const pythonDetection = detectPythonProject(scanResult);
  const dockerDetection = detectDockerProject(scanResult);

  const allServices = inferServiceDependencies([
    ...(dockerDetection?.services ?? []),
    ...(nodeDetection?.services ?? []),
    ...(pythonDetection?.services ?? []),
  ]);
  const frameworks = unique([
    ...(nodeDetection?.frameworks ?? []),
    ...(pythonDetection?.frameworks ?? []),
    ...(dockerDetection?.frameworks ?? []),
    ...(scanResult.prisma ? ["Prisma"] : []),
  ]);
  const stack = resolveStack(
    [nodeDetection?.kind, pythonDetection?.kind, dockerDetection?.kind].filter(
      (kind): kind is StackKind => Boolean(kind),
    ),
  );

  const fallbackUsed = allServices.length === 0;
  const packageManager = nodeDetection?.packageManager ?? (scanResult.prisma ? scanResult.packageManager : undefined);

  return {
    stack,
    packageManager,
    frameworks,
    services: fallbackUsed ? [buildFallbackService()] : allServices,
    prisma: scanResult.prisma,
    monorepo: scanResult.monorepo,
    defaultAction: dockerDetection && !nodeDetection && !pythonDetection ? "docker" : "dev",
    prismaCommands: scanResult.prisma
      ? {
          generate: buildExecCommand(packageManager, "prisma generate"),
          migrate: buildExecCommand(packageManager, "prisma migrate dev"),
        }
      : undefined,
    fallbackUsed,
  };
}
