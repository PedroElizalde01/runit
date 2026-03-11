import type { PackageManager } from "../scanner.ts";

export type RuntimeKind = "node" | "python" | "docker";
export type StackKind = RuntimeKind;

export type DetectedService = {
  name: string;
  path: string;
  command: string;
  runtime: RuntimeKind;
  framework?: string;
  dependsOn?: string[];
  delay?: number;
  env?: Record<string, string>;
};

export type BaseDetectorResult = {
  frameworks: string[];
  services: DetectedService[];
};

export type NodeDetectionResult = BaseDetectorResult & {
  kind: "node";
  packageManager: PackageManager;
};

export type PythonDetectionResult = BaseDetectorResult & {
  kind: "python";
};

export type DockerDetectionResult = BaseDetectorResult & {
  kind: "docker";
};

export type ProjectDetection = {
  stack: "node" | "python" | "docker" | "mixed" | "unknown";
  packageManager?: PackageManager;
  frameworks: string[];
  services: DetectedService[];
  prisma: boolean;
  monorepo: boolean;
  defaultAction: "dev" | "docker";
  prismaCommands?: {
    generate: string;
    migrate: string;
  };
  fallbackUsed: boolean;
};
