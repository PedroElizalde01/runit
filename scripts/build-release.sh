#!/usr/bin/env bash

set -euo pipefail

OUTPUT=""

usage() {
  cat <<'EOF'
Build a standalone runit binary for the current host platform.

Usage:
  scripts/build-release.sh [--output PATH]

Examples:
  scripts/build-release.sh
  scripts/build-release.sh --output dist/runit
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --output)
      OUTPUT="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

detect_os() {
  case "$(uname -s)" in
    Linux) echo "linux" ;;
    Darwin) echo "darwin" ;;
    MINGW*|MSYS*|CYGWIN*) echo "windows" ;;
    *)
      echo "Unsupported operating system: $(uname -s)" >&2
      exit 1
      ;;
  esac
}

detect_arch() {
  case "$(uname -m)" in
    x86_64|amd64) echo "x64" ;;
    arm64|aarch64) echo "arm64" ;;
    *)
      echo "Unsupported architecture: $(uname -m)" >&2
      exit 1
      ;;
  esac
}

OS="$(detect_os)"
ARCH="$(detect_arch)"
EXTENSION=""

if [[ "${OS}" == "windows" ]]; then
  EXTENSION=".exe"
fi

if [[ -z "${OUTPUT}" ]]; then
  OUTPUT="dist/runit-${OS}-${ARCH}${EXTENSION}"
fi

mkdir -p "$(dirname "${OUTPUT}")"

echo "Building ${OUTPUT}"
bun build src/cli.ts --compile --outfile "${OUTPUT}"
