---
name: check-license
description: Check the real license of an open-source package or GitHub repo before adding it as a dependency or copying its code. Use when choosing between libraries, adding a new dependency, or when the ossay-guard hook flags a package.
---

Before you add a new dependency, check what its license file actually says. The registry's license field can be out of date, and some popular repos are source-available (hosting or resale restricted), non-commercial, or have no license file at all.

Use ossay (Node 18+, no install needed):

- One package or repo: `npx -y github:hesong0222-dev/ossay check <owner/repo>`. Prints the license class, commercial use, hosting-as-a-service, and the evidence lines.
- A whole project: `npx -y github:hesong0222-dev/ossay deps <path>`. Reads direct dependencies in package.json, requirements.txt, pyproject.toml, go.mod and Cargo.toml. Add `--json` for machine-readable output.

How to act on the result:

- `permissive` (MIT, Apache-2.0, BSD, ISC): fine for most uses. Say nothing more unless asked.
- `NON_COMMERCIAL`, `SOURCE_AVAILABLE`, `PROPRIETARY`, `NO_LICENSE`, `CUSTOM_LICENSE`, `MODIFIED_PERMISSIVE`, `MIXED_LICENSE`, `REGISTRY_LICENSE_MISMATCH`: tell the user in one or two sentences what the restriction is, quote ossay's evidence line, and suggest a permissive alternative if you know one. Let the user decide; do not install it silently.
- `NETWORK_COPYLEFT` (AGPL): note that running a modified version as a network service obliges sharing the source.

ossay is a heuristic from public data, not legal advice. Say so when the decision matters.
