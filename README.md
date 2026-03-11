# runit

`runit` lets you register a project alias and launch its configured environment from anywhere.

## Usage

Run a registered project by alias:

```bash
runit jims
```

If `jims` is not registered yet, `runit` will scan the current directory, generate `.runit.yml`, register the alias, create a shim, and then start the project.

After registration creates a shim, the alias can also be run directly:

```bash
jims
```

Regenerate `.runit.yml` from the current project structure:

```bash
runit jims --regenerate
```

List registered projects:

```bash
runit --list
```

Inspect a project configuration:

```bash
runit jims --doctor
```

Remove a registered project and its shim:

```bash
runit jims --remove
```
