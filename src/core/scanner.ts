import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";

export type PackageManager = "pnpm" | "npm" | "yarn" | "bun" | "unknown";

export type PackageJsonData = {
  name?: string;
  bin?: string | Record<string, string>;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  workspaces?: unknown;
};

export type ServiceCandidate = {
  name: string;
  path: string;
  packageJson?: PackageJsonData;
};

export type ScanResult = {
  packageJson?: PackageJsonData;
  packageManager: PackageManager;
  monorepo: boolean;
  prisma: boolean;
  apps: string[];
  packages: string[];
  services: string[];
  hasSrc: boolean;
  hasAppDir: boolean;
  hasServerDir: boolean;
  hasTurbo: boolean;
  hasNx: boolean;
  hasServerJs: boolean;
  hasIndexJs: boolean;
  hasManagePy: boolean;
  hasRequirementsTxt: boolean;
  hasPyprojectToml: boolean;
  hasPoetryLock: boolean;
  requirementsTxt?: string;
  pyprojectToml?: string;
  poetryLock?: string;
  dockerComposeFile?: string;
  dockerComposeContent?: string;
  serviceCandidates: ServiceCandidate[];
};

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

async function readTextIfExists(targetPath: string): Promise<string | undefined> {
  try {
    return await readFile(targetPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

async function readPackageJson(targetPath: string): Promise<PackageJsonData | undefined> {
  const raw = await readTextIfExists(targetPath);

  if (!raw) {
    return undefined;
  }

  return JSON.parse(raw) as PackageJsonData;
}

async function readDirectoryNames(projectRoot: string, relativeDir: string): Promise<string[]> {
  const absoluteDir = path.join(projectRoot, relativeDir);

  try {
    const entries = await readdir(absoluteDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.posix.join(relativeDir, entry.name))
      .sort((left, right) => left.localeCompare(right));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function scanServiceCandidates(projectRoot: string, relativeDir: string): Promise<ServiceCandidate[]> {
  const directories = await readDirectoryNames(projectRoot, relativeDir);

  return Promise.all(
    directories.map(async (relativePath) => ({
      name: path.basename(relativePath),
      path: relativePath,
      packageJson: await readPackageJson(path.join(projectRoot, relativePath, "package.json")),
    })),
  );
}

async function detectPackageManager(projectRoot: string): Promise<PackageManager> {
  const packageManagerFiles: Array<[string, PackageManager]> = [
    ["pnpm-lock.yaml", "pnpm"],
    ["package-lock.json", "npm"],
    ["yarn.lock", "yarn"],
    ["bun.lockb", "bun"],
    ["bun.lock", "bun"],
  ];

  for (const [fileName, packageManager] of packageManagerFiles) {
    if (await pathExists(path.join(projectRoot, fileName))) {
      return packageManager;
    }
  }

  return "npm";
}

function hasWorkspaceField(packageJson: PackageJsonData | undefined): boolean {
  return Array.isArray(packageJson?.workspaces) || typeof packageJson?.workspaces === "object";
}

async function detectDockerComposeFile(projectRoot: string): Promise<string | undefined> {
  const composeFiles = ["docker-compose.yml", "docker-compose.yaml", "compose.yaml", "compose.yml"];

  for (const fileName of composeFiles) {
    if (await pathExists(path.join(projectRoot, fileName))) {
      return fileName;
    }
  }

  return undefined;
}

export async function scanProject(projectRoot: string): Promise<ScanResult> {
  const resolvedRoot = path.resolve(projectRoot);
  const [
    packageJson,
    apps,
    packages,
    services,
    appCandidates,
    serviceCandidates,
    packageCandidates,
    requirementsTxt,
    pyprojectToml,
    poetryLock,
    packageManager,
    hasPnpmWorkspace,
    hasTurbo,
    hasNx,
    prisma,
    hasSrc,
    hasAppDir,
    hasServerDir,
    hasServerJs,
    hasIndexJs,
    hasManagePy,
    dockerComposeFile,
  ] = await Promise.all([
    readPackageJson(path.join(resolvedRoot, "package.json")),
    readDirectoryNames(resolvedRoot, "apps"),
    readDirectoryNames(resolvedRoot, "packages"),
    readDirectoryNames(resolvedRoot, "services"),
    scanServiceCandidates(resolvedRoot, "apps"),
    scanServiceCandidates(resolvedRoot, "services"),
    scanServiceCandidates(resolvedRoot, "packages"),
    readTextIfExists(path.join(resolvedRoot, "requirements.txt")),
    readTextIfExists(path.join(resolvedRoot, "pyproject.toml")),
    readTextIfExists(path.join(resolvedRoot, "poetry.lock")),
    detectPackageManager(resolvedRoot),
    pathExists(path.join(resolvedRoot, "pnpm-workspace.yaml")),
    pathExists(path.join(resolvedRoot, "turbo.json")),
    pathExists(path.join(resolvedRoot, "nx.json")),
    pathExists(path.join(resolvedRoot, "prisma", "schema.prisma")),
    pathExists(path.join(resolvedRoot, "src")),
    pathExists(path.join(resolvedRoot, "app")),
    pathExists(path.join(resolvedRoot, "server")),
    pathExists(path.join(resolvedRoot, "server.js")),
    pathExists(path.join(resolvedRoot, "index.js")),
    pathExists(path.join(resolvedRoot, "manage.py")),
    detectDockerComposeFile(resolvedRoot),
  ]);

  return {
    packageJson,
    packageManager,
    monorepo:
      hasPnpmWorkspace ||
      hasTurbo ||
      hasNx ||
      hasWorkspaceField(packageJson) ||
      apps.length > 0 ||
      packages.length > 0 ||
      services.length > 0,
    prisma,
    apps,
    packages,
    services,
    hasSrc,
    hasAppDir,
    hasServerDir,
    hasTurbo,
    hasNx,
    hasServerJs,
    hasIndexJs,
    hasManagePy,
    hasRequirementsTxt: Boolean(requirementsTxt),
    hasPyprojectToml: Boolean(pyprojectToml),
    hasPoetryLock: Boolean(poetryLock),
    requirementsTxt,
    pyprojectToml,
    poetryLock,
    dockerComposeFile,
    dockerComposeContent: dockerComposeFile
      ? await readTextIfExists(path.join(resolvedRoot, dockerComposeFile))
      : undefined,
    serviceCandidates: [...appCandidates, ...serviceCandidates, ...packageCandidates],
  };
}
