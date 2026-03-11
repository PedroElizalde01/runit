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

`runit` lets you register a project alias, generate a `.runit.yml` from the current repo, and launch that environment from anywhere.

## Install

Clone the repo and install dependencies:

```bash
bun install
```

Run it directly during development:

```bash
bun run src/cli.ts --help
```

If you want a local `runit` command, link it with Bun:

```bash
bun link
```

Then run:

```bash
runit --help
```

## Usage

Register the current project and start it:

```bash
runit my-app
```

Once registered, the generated shim can also be used directly:

```bash
my-app
```

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

- `runit <alias>`: register if needed and run the default action
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
bun run check
bun run src/cli.ts --help
```

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
