#!/usr/bin/env node
// PreToolUse hook for Bash: when the command adds packages, read their real license with ossay.
// Restricted license → ask the user first (mode "warn", default) or deny (mode "block"). Anything else, including
// failures (network, rate limit, timeout), exits 0 silently; failures are written to the log file.
import { readFileSync, writeFileSync, appendFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { packagesIn } from './parse.mjs';

const OSSAY = ['-y', 'github:hesong0222-dev/ossay'];
const dataDir = process.env.CLAUDE_PLUGIN_DATA || tmpdir();
const log = (msg) => { try { mkdirSync(dataDir, { recursive: true }); appendFileSync(join(dataDir, 'ossay-guard.log'), `${new Date().toISOString()} ${msg}\n`); } catch {} };

const WHY = {
  NO_LICENSE: 'no license file, so no right to use, modify or redistribute',
  NON_COMMERCIAL: 'license restricts commercial use',
  SOURCE_AVAILABLE: 'source-available, not open source: hosting/resale is restricted',
  MODIFIED_PERMISSIVE: 'permissive base with extra conditions (check hosting and branding terms)',
  MIXED_LICENSE: 'part of the repo is under a source-available license',
  PROPRIETARY: 'all rights reserved',
  CUSTOM_LICENSE: 'custom license text',
};

function manifests(dir, pkgs) {
  const of = (e) => pkgs.filter((p) => p.ecosystem === e).map((p) => p.name);
  if (of('npm').length) writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: Object.fromEntries(of('npm').map((n) => [n, 'latest'])) }));
  if (of('pypi').length) writeFileSync(join(dir, 'requirements.txt'), of('pypi').join('\n') + '\n');
  if (of('cargo').length) writeFileSync(join(dir, 'Cargo.toml'), `[dependencies]\n${of('cargo').map((n) => `${n} = "*"`).join('\n')}\n`);
  if (of('go').length) writeFileSync(join(dir, 'go.mod'), `module guard\n\nrequire (\n${of('go').map((n) => `\t${n} latest`).join('\n')}\n)\n`);
}

const ossayDeps = (dir) => new Promise((resolve, reject) => {
  execFile('npx', [...OSSAY, 'deps', dir, '--json'], { timeout: 50000, maxBuffer: 8 << 20 }, (err, stdout, stderr) => {
    if (err && !stdout) return reject(new Error(`${err.message.split('\n')[0]} ${String(stderr).trim().split('\n').pop() || ''}`));
    try { resolve(JSON.parse(stdout)); } catch { reject(new Error(`ossay output was not JSON: ${String(stdout).slice(0, 200)}`)); }
  });
});

function line(d) {
  const why = d.flags.filter((f) => f.level === 'risk').map((f) => f.id === 'REGISTRY_LICENSE_MISMATCH'
    ? `registry says "${d.mismatch.registry}" but the repo's license file reads ${d.mismatch.repo_class}`
    : WHY[f.id] || f.id);
  return `- ${d.name} (${d.ecosystem}) → github.com/${d.repo}: ${d.repo_license.label || d.repo_license.class} [${d.repo_license.class}]; ${why.join('; ')}`;
}

async function main() {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  if (input.tool_name !== 'Bash') return;
  const pkgs = packagesIn(input.tool_input?.command || '');
  if (!pkgs.length) return;
  const dir = mkdtempSync(join(tmpdir(), 'ossay-guard-'));
  let out;
  try { manifests(dir, pkgs); out = await ossayDeps(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
  for (const d of out.deps.filter((x) => x.status === 'unresolved' || x.status === 'error')) log(`not checked: ${d.ecosystem} ${d.name} (${d.reason})`);
  const risky = out.deps.filter((d) => d.status === 'risk');
  if (!risky.length) return;
  const reason = [`ossay-guard: ${risky.length === 1 ? 'this package has' : `${risky.length} packages have`} license terms to read before adding ${risky.length === 1 ? 'it' : 'them'}:`,
    ...risky.map(line),
    `Full card: npx github:hesong0222-dev/ossay check ${risky[0].repo}. Heuristic from public data, not legal advice.`].join('\n');
  const block = process.env.CLAUDE_PLUGIN_OPTION_MODE === 'block';
  const output = {
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: block ? 'deny' : 'ask', permissionDecisionReason: reason, ...(block ? {} : { additionalContext: reason }) },
    ...(block ? { systemMessage: reason } : {}),
  };
  process.stdout.write(JSON.stringify(output));
}

main().catch((e) => log(`error: ${e.message}`));
