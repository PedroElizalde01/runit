import { parseComposeServices } from "../docker/compose.ts";
import type { DockerComposeService } from "../docker/service.ts";
import type { ScanResult } from "./scanner.ts";

export function detectDockerServices(scanResult: ScanResult): DockerComposeService[] {
  if (!scanResult.dockerComposeContent) {
    return [];
  }

  return parseComposeServices(scanResult.dockerComposeContent);
}
