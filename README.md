<div align="center">
<pre>
   ██████╗ ██╗   ██╗███╗   ██╗██╗████████╗
   ██╔══██╗██║   ██║████╗  ██║██║╚══██╔══╝
██████╔╝██║   ██║██╔██╗ ██║██║   ██║
██╔══██╗██║   ██║██║╚██╗██║██║   ██║
██║  ██║╚██████╔╝██║ ╚████║██║   ██║
╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝   ╚═╝
</pre>

Project environment launcher CLI
</div>

---

`runit` registers project aliases, generates a `.runit.yml`, and launches your dev environment from anywhere.

## Stack detection

`runit` currently detects these stack types:

- `node`
- `python`
- `docker`
- `mixed`
- `unknown`

Notes:

- `mixed` means more than one supported runtime was detected in the same project.
- `unknown` means no supported runtime matched, so you may need to edit the generated config manually.
- More coming soon.

## Install

Latest release:

```bash
curl -fsSL https://raw.githubusercontent.com/PedroElizalde01/runit/main/install.sh | bash
```

Then run:

```bash
runit --help
```

Install a specific version:

```bash
curl -fsSL https://raw.githubusercontent.com/PedroElizalde01/runit/main/install.sh | \
  bash -s -- --version v0.1.1
```

If `runit` is not found after install, add this to your shell profile:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

## Usage

Register the current project and create the alias command:

```bash
runit my-app
```

Then run it with the generated shim:

```bash
my-app
```

If the alias already exists, running `runit my-app` will only tell you that it is already registered.

Inspect and manage a registered project:

```bash
runit my-app --doctor
runit my-app --check
runit my-app --plan
runit my-app --graph
runit my-app --env
runit my-app --edit
runit my-app --edit --interactive
runit my-app --remove
```

Regenerate the config from the current project structure:

```bash
runit my-app --regenerate
```

List registered projects:

```bash
runit --list
```

## Commands

- `runit <alias>`: register if needed, otherwise report that the alias already exists
- `runit <alias> --regenerate`: rescan the repo and refresh `.runit.yml`
- `runit <alias> --doctor`: inspect config, stack detection, and tool availability
- `runit <alias> --check`: validate required tools and config paths
- `runit <alias> --plan`: print the execution plan
- `runit <alias> --graph`: show the dependency graph
- `runit <alias> --env`: show loaded environment variables with values masked
- `runit <alias> --edit`: open the config in `$EDITOR`
- `runit <alias> --edit --interactive`: edit the default action with prompts
- `runit <alias> --remove`: remove the registered project and generated shim
- `runit --list`: list registered projects

## Build

```bash
bun install
bun run check
bun run build
./dist/runit --help
```

## Release

```bash
git tag v0.1.1
git push origin main v0.1.1
```

Pushing a `v*` tag triggers GitHub Actions to build release binaries and publish a GitHub Release.

## Config

Generated projects use a `.runit.yml` file like this:

```yaml
name: my-app
root: .
default: dev
actions:
  dev:
    mode: simple
    tasks:
      - name: app
        cwd: .
        cmd: npm run dev
```
