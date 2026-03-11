import type { ScanResult } from "../scanner.ts";

import type { PythonDetectionResult } from "./types.ts";

function collectPythonManifest(scanResult: ScanResult): string {
  return [scanResult.requirementsTxt, scanResult.pyprojectToml, scanResult.poetryLock]
    .filter((content): content is string => Boolean(content))
    .join("\n")
    .toLowerCase();
}

export function detectPythonProject(scanResult: ScanResult): PythonDetectionResult | null {
  if (!scanResult.hasRequirementsTxt && !scanResult.hasPyprojectToml && !scanResult.hasPoetryLock && !scanResult.hasManagePy) {
    return null;
  }

  const manifest = collectPythonManifest(scanResult);

  if (scanResult.hasManagePy || manifest.includes("django")) {
    return {
      kind: "python",
      frameworks: ["Django"],
      services: [
        {
          name: "app",
          path: ".",
          command: "python manage.py runserver",
          runtime: "python",
          framework: "Django",
        },
      ],
    };
  }

  if (manifest.includes("fastapi")) {
    return {
      kind: "python",
      frameworks: ["FastAPI"],
      services: [
        {
          name: "app",
          path: ".",
          command: "uvicorn main:app --reload",
          runtime: "python",
          framework: "FastAPI",
        },
      ],
    };
  }

  if (manifest.includes("flask")) {
    return {
      kind: "python",
      frameworks: ["Flask"],
      services: [
        {
          name: "app",
          path: ".",
          command: "flask run",
          runtime: "python",
          framework: "Flask",
        },
      ],
    };
  }

  return null;
}
