import type { PackageJsonData, PackageManager, ScanResult, ServiceCandidate } from "../scanner.ts";

import type { DetectedService, NodeDetectionResult } from "./types.ts";

const FRAMEWORK_DEPENDENCIES: Array<[string, string]> = [
  ["@nestjs/core", "NestJS"],
  ["next", "Next.js"],
  ["vite", "Vite"],
  ["react", "React"],
  ["express", "Express"],
  ["fastify", "Fastify"],
];

function hasDependency(packageJson: PackageJsonData | undefined, dependencyName: string): boolean {
  return Boolean(
    packageJson?.dependencies?.[dependencyName] || packageJson?.devDependencies?.[dependencyName],
  );
}

export function buildScriptCommand(
  packageManager: PackageManager | undefined,
  scriptName: string,
): string {
  switch (packageManager) {
    case "pnpm":
      return `pnpm ${scriptName}`;
    case "yarn":
      return `yarn ${scriptName}`;
    case "bun":
      return `bun run ${scriptName}`;
    case "npm":
    case "unknown":
    case undefined:
      return scriptName === "start" ? "npm start" : `npm run ${scriptName}`;
  }
}

export function buildExecCommand(
  packageManager: PackageManager | undefined,
  command: string,
): string {
  switch (packageManager) {
    case "pnpm":
      return `pnpm exec ${command}`;
    case "yarn":
      return `yarn exec ${command}`;
    case "bun":
      return `bunx ${command}`;
    case "npm":
    case "unknown":
    case undefined:
      return `npm exec ${command}`;
  }
}

function detectFrameworks(packageJson: PackageJsonData | undefined): string[] {
  return FRAMEWORK_DEPENDENCIES.filter(([dependencyName]) => hasDependency(packageJson, dependencyName))
    .map(([, frameworkName]) => frameworkName);
}

function resolveFrameworkLabel(frameworks: string[]): string | undefined {
  const preferredOrder = ["NestJS", "Next.js", "Vite", "Express", "Fastify", "React"];

  return preferredOrder.find((framework) => frameworks.includes(framework));
}

function resolveNodeFallback(scanResult: ScanResult): string | undefined {
  if (scanResult.hasServerJs) {
    return "node server.js";
  }

  if (scanResult.hasIndexJs) {
    return "node index.js";
  }

  return undefined;
}

function normalizeCommand(command: string): string {
  return command.trim().replace(/\s+/g, " ");
}

function getBinEntryPaths(packageJson: PackageJsonData | undefined): string[] {
  if (!packageJson?.bin) {
    return [];
  }

  if (typeof packageJson.bin === "string") {
    return [packageJson.bin];
  }

  return Object.values(packageJson.bin);
}

function isSelfReferentialCliScript(
  packageJson: PackageJsonData | undefined,
  scriptCommand: string | undefined,
): boolean {
  if (!scriptCommand) {
    return false;
  }

  const normalizedCommand = normalizeCommand(scriptCommand);

  return getBinEntryPaths(packageJson).some((binPath) => {
    const variants = [binPath, `./${binPath}`];

    return variants.some((variant) => {
      const normalizedVariant = normalizeCommand(variant);
      return [
        `bun run ${normalizedVariant}`,
        `bun ${normalizedVariant}`,
        `node ${normalizedVariant}`,
        `tsx ${normalizedVariant}`,
        `ts-node ${normalizedVariant}`,
      ].includes(normalizedCommand);
    });
  });
}

function resolveCommand(
  packageJson: PackageJsonData | undefined,
  packageManager: PackageManager,
  rootFallback?: string,
): string | undefined {
  const scripts = packageJson?.scripts ?? {};
  const frameworks = detectFrameworks(packageJson);

  if (frameworks.includes("NestJS") && scripts["start:dev"]) {
    return buildScriptCommand(packageManager, "start:dev");
  }

  for (const scriptName of ["dev", "start", "serve", "check", "test"] as const) {
    if (!scripts[scriptName]) {
      continue;
    }

    if (isSelfReferentialCliScript(packageJson, scripts[scriptName])) {
      continue;
    }

    return buildScriptCommand(packageManager, scriptName);
  }

  return rootFallback;
}

function resolveService(candidate: ServiceCandidate, packageManager: PackageManager): DetectedService | undefined {
  if (!candidate.packageJson) {
    return undefined;
  }

  const command = resolveCommand(candidate.packageJson, packageManager);

  if (!command) {
    return undefined;
  }

  return {
    name: candidate.name,
    path: candidate.path,
    command,
    runtime: "node",
    framework: resolveFrameworkLabel(detectFrameworks(candidate.packageJson)),
  };
}

export function detectNodeProject(scanResult: ScanResult): NodeDetectionResult | null {
  if (!scanResult.packageJson && scanResult.serviceCandidates.length === 0) {
    return null;
  }

  if (scanResult.monorepo) {
    const services = scanResult.serviceCandidates
      .map((candidate) => resolveService(candidate, scanResult.packageManager))
      .filter((service): service is DetectedService => Boolean(service))
      .sort((left, right) => left.name.localeCompare(right.name));

    if (services.length === 0) {
      return null;
    }

    const frameworks = [
      ...new Set(
        services.flatMap((service) => (service.framework ? [service.framework] : [])),
      ),
    ];

    return {
      kind: "node",
      packageManager: scanResult.packageManager,
      frameworks,
      services,
    };
  }

  if (!scanResult.packageJson) {
    return null;
  }

  const frameworks = detectFrameworks(scanResult.packageJson);
  const command = resolveCommand(scanResult.packageJson, scanResult.packageManager, resolveNodeFallback(scanResult));

  if (!command) {
    return null;
  }

  return {
    kind: "node",
    packageManager: scanResult.packageManager,
    frameworks,
    services: [
      {
        name: "app",
        path: ".",
        command,
        runtime: "node",
        framework: resolveFrameworkLabel(frameworks),
      },
    ],
  };
}
