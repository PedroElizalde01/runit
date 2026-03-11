import { detectDockerServices } from "../docker.ts";
import type { ScanResult } from "../scanner.ts";

import type { DockerDetectionResult } from "./types.ts";

export function detectDockerProject(scanResult: ScanResult): DockerDetectionResult | null {
  const services = detectDockerServices(scanResult);

  if (services.length === 0) {
    return null;
  }

  return {
    kind: "docker",
    frameworks: ["Docker Compose"],
    services: services.map((service) => ({
      name: service.name,
      path: ".",
      command: `docker compose up ${service.name}`,
      runtime: "docker",
      framework: "Docker Compose",
      dependsOn: service.dependsOn,
      delay: 3000,
    })),
  };
}
