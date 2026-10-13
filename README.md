# ossay-guard

**Your coding agent is about to `npm install` something. ossay-guard reads that package's actual license file first, and asks you before it adds a non-commercial, source-available or unlicensed dependency.**

A [Claude Code](https://code.claude.com) plugin. A `PreToolUse` hook watches Bash commands that add packages (`npm install`, `pnpm add`, `yarn add`, `pip install`, `uv add`, `uv pip install`, `poetry add`, `cargo add`, `go get`), finds each package's GitHub repo through its registry, and reads the license with [Ossay](https://github.com/hesong0222-dev/ossay). Permissive licenses pass silently. Restricted ones stop the command at a permission prompt so you decide.

## Install

Inside Claude Code:

```
/plugin marketplace add hesong0222-dev/ossay-guard
/plugin install ossay-guard@ossay-guard
```

Or from your shell:

```bash
claude plugin marketplace add hesong0222-dev/ossay-guard
claude plugin install ossay-guard@ossay-guard
```

To try it for one session without installing: `git clone https://github.com/hesong0222-dev/ossay-guard && claude --plugin-dir ./ossay-guard`.

Needs Node 18+ and `npx` on your PATH. The first check downloads Ossay through `npx` (no npm package, no dependencies). Set `GITHUB_TOKEN` (or be logged in with `gh`) to get 5,000 GitHub API requests per hour instead of 60.

## What you see

Real output of the hook script on 2026-10-13, fed the [documented `PreToolUse` input](https://code.claude.com/docs/en/hooks#pretooluse-input) for `npm install n8n`:

```json
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"ossay-guard: this package has license terms to read before adding it:\n- n8n (npm) → github.com/n8n-io/n8n: Sustainable Use License [source-available]; source-available, not open source: hosting/resale is restricted\nFull card: npx github:hesong0222-dev/ossay check n8n-io/n8n. Heuristic from public data, not legal advice.","additionalContext":"…same text…"}}
```

- `npm install express` (MIT): no output, exit 0. The install goes ahead.
- `ls -la` (not an install): no output, exit 0, no network call.
- `pip install requests && cargo add serde && go get github.com/spf13/cobra`: no output, exit 0 (all permissive), 4 s.
- `npx` missing (simulated with a PATH without it): no output, exit 0, and the log gets `error: spawn npx ENOENT`.

In a real non-interactive session (`claude -p --plugin-dir ./ossay-guard`, Claude Code 2.1.289, the same day), asking Claude to run `npm install n8n --dry-run` returned this tool result instead of running the command, and Claude relayed the restriction:

```
ossay-guard: this package has license terms to read before adding it:
- n8n (npm) → github.com/n8n-io/n8n: Sustainable Use License [source-available]; source-available, not open source: hosting/resale is restricted
Full card: npx github:hesong0222-dev/ossay check n8n-io/n8n. Heuristic from public data, not legal advice.
```

`npm install express --dry-run` in the same setup ran normally.

**Not yet verified:** the interactive permission prompt (the `ask` path in a terminal session). Per the docs it shows the reason above and lets you allow or deny; I have only run the non-interactive case.

## What counts as restricted

Ossay's License risks: no license file, non-commercial, source-available (BSL, SSPL, Elastic, Sustainable Use, FSL…), proprietary, custom text, permissive-plus-extra-conditions, mixed folders, and a registry license field that is more permissive than the repo's license file. AGPL and maintenance signals (archived, stale) do not trigger the hook. Run `npx github:hesong0222-dev/ossay check <owner/repo>` for the full card with evidence lines.

## Settings

| Option | Values | Effect |
|---|---|---|
| `mode` | `warn` (default) | Restricted package → `permissionDecision: "ask"`: you get a permission prompt with the reason, and Claude gets the same text as context. |
| | `block` | Restricted package → `permissionDecision: "deny"`: the command does not run, Claude reads the reason, and you see it as a system message. |

Set it with `/plugin configure ossay-guard@ossay-guard` or the `/config` panel. The hook reads it from `CLAUDE_PLUGIN_OPTION_MODE`.

Failures never block: on network errors, GitHub rate limits, packages with no GitHub repo, and timeouts (Ossay call capped at 50 s, hook at 60 s) the command goes ahead as if the plugin were not there. They are written to `ossay-guard.log` in the plugin data directory (`~/.claude/plugins/data/ossay-guard-ossay-guard/`).

The plugin also ships a `check-license` skill (`/ossay-guard:check-license`) that tells Claude to check a package's license before proposing it, and how to read Ossay's output.

## Limits

- Heuristic. It reads public registry metadata and the repo's license file; it is not legal advice.
- Only the packages named in the command, not their transitive dependencies. Bare `npm install`, `npm ci`, `pip install -r requirements.txt`, local paths, URLs and git sources are not checked.
- Command parsing is word-based: it splits on `&&`, `||`, `;`, `|`, and reads the words after a known install verb. Unusual flags that take a value may be mistaken for package names (the lookup then fails silently).
- A package resolves only when its registry metadata links a GitHub repo (npm `repository`, PyPI `project_urls`, crates.io `repository`, Go module paths on `github.com`). Others are skipped and logged.
- Adds about 2–6 s to each install command it checks (`npx` fetch plus registry and GitHub calls; Ossay caches GitHub responses for 24 h). Commands that are not installs cost one Node start.
- Tested on macOS only. Windows is untested (`npx` is spawned without a shell).

## Develop

```bash
npm test                         # command parsing (node:test, no dependencies)
claude plugin validate --strict . # marketplace + plugin manifest, hooks and skill
```

## Format sources

Everything in this plugin's layout and hook output was checked against the official docs on 2026-10-13:

- Plugin layout, `hooks/hooks.json`, skills, `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, `CLAUDE_PLUGIN_OPTION_<KEY>`: https://code.claude.com/docs/en/plugins/components
- `plugin.json` fields and `userConfig` (`options`, `default`): https://code.claude.com/docs/en/plugins/manifest-reference
- `PreToolUse` input (stdin JSON, `tool_input.command`), `permissionDecision` `ask`/`deny`, `additionalContext`, `systemMessage`, exit codes, matcher, timeouts: https://code.claude.com/docs/en/hooks
- Marketplace in the plugin's own repo (`source: "./"`), install commands: https://code.claude.com/docs/en/plugins/publish and https://code.claude.com/docs/en/plugins/marketplace-reference
- `claude plugin validate`: https://code.claude.com/docs/en/plugins/cli-reference

## License

Apache-2.0. Uses [Ossay](https://github.com/hesong0222-dev/ossay) (Apache-2.0) at run time through `npx`.
