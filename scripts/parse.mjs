// Packages that a shell command would add as dependencies: [{ ecosystem: 'npm'|'pypi'|'cargo'|'go', name }].
// Heuristic: plain words after a known install verb. Paths, URLs, git sources and requirement files are skipped.

const words = (seg) => [...seg.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map((m) => m[1] ?? m[2] ?? m[3]);

// Flags that take the next word as their value, so that word is not a package.
const VALUE_FLAGS = {
  npm: ['--prefix', '--registry', '--tag', '-C', '--dir', '--filter', '-F', '--cwd', '--workspace', '-w'],
  pypi: ['-r', '--requirement', '-c', '--constraint', '-e', '--editable', '-i', '--index-url', '--extra-index-url', '-t', '--target', '--group', '-G', '--source', '--python', '-p', '--optional', '--extra', '--index', '-f', '--find-links'],
  cargo: ['-F', '--features', '--rename', '-p', '--package', '--registry', '--git', '--path', '--branch', '--tag', '--rev', '--manifest-path', '--target'],
  go: ['-modfile'],
};

function positionals(args, ecosystem) {
  const out = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('-')) { if (!a.includes('=') && VALUE_FLAGS[ecosystem].includes(a)) i++; continue; }
    out.push(a);
  }
  return out;
}

const isLocalOrUrl = (s) => /^[.~/]/.test(s) || /:\/\/|^(file|link|workspace|portal|git|github|git\+\w+):|\.(whl|tgz|tar\.gz|zip)$/i.test(s);

export function npmName(spec) {
  if (isLocalOrUrl(spec)) return null;
  const alias = spec.match(/@npm:(.+)$/);
  if (alias) spec = alias[1];
  // owner/repo without a leading @ is a GitHub shorthand, not a registry name.
  if (!spec.startsWith('@') && spec.includes('/')) return null;
  const m = spec.match(/^(@[^/@\s]+\/[^@\s]+|[^@\s]+)/);
  return m ? m[1] : null;
}

export const pypiName = (spec) => (isLocalOrUrl(spec) ? null : spec.split(/[\s[<>=!~;@(]/)[0] || null);
export const cargoName = (spec) => spec.split('@')[0] || null;
export const goName = (spec) => { const n = spec.split('@')[0]; return /^[\w-]+\.[\w.-]+\//.test(n) ? n : null; };

// Returns { ecosystem, args } for an install-like command, or null.
function match(w) {
  while (w.length && /^\w+=/.test(w[0])) w = w.slice(1); // FOO=bar npm i x
  if (w[0] === 'sudo') w = w.slice(1);
  const [tool, ...rest] = w;
  // The verb is the first word that is not a flag (or a value of an npm-family flag like `pnpm --filter web add x`).
  let sub = 0;
  while (sub < rest.length && rest[sub].startsWith('-')) sub += /^(npm|pnpm|yarn)$/.test(tool) && VALUE_FLAGS.npm.includes(rest[sub]) ? 2 : 1;
  const verb = rest[sub];
  const after = rest.slice(sub + 1);
  const before = rest.slice(0, sub);
  if (tool === 'npm' && ['install', 'i', 'add', 'in', 'isntall'].includes(verb)) return { ecosystem: 'npm', args: [...before, ...after] };
  if (tool === 'pnpm' && ['add', 'install', 'i'].includes(verb)) return { ecosystem: 'npm', args: after };
  if (tool === 'yarn' && verb === 'add') return { ecosystem: 'npm', args: after };
  if (/^pip3?$/.test(tool) && verb === 'install') return { ecosystem: 'pypi', args: after };
  if (/^python[\d.]*$/.test(tool) && rest[0] === '-m' && /^pip3?$/.test(rest[1]) && rest[2] === 'install') return { ecosystem: 'pypi', args: rest.slice(3) };
  if (tool === 'uv' && verb === 'add') return { ecosystem: 'pypi', args: after };
  if (tool === 'uv' && verb === 'pip' && after[0] === 'install') return { ecosystem: 'pypi', args: after.slice(1) };
  if (tool === 'poetry' && verb === 'add') return { ecosystem: 'pypi', args: after };
  if (tool === 'cargo' && verb === 'add') return { ecosystem: 'cargo', args: after };
  if (tool === 'go' && verb === 'get') return { ecosystem: 'go', args: after };
  return null;
}

const NAME = { npm: npmName, pypi: pypiName, cargo: cargoName, go: goName };

export function packagesIn(command) {
  const found = [];
  for (const seg of String(command).split(/&&|\|\||[;|&\n]/)) {
    const m = match(words(seg.trim()));
    if (!m) continue;
    // cargo add --git/--path takes the crate from somewhere other than crates.io.
    if (m.ecosystem === 'cargo' && m.args.some((a) => /^--(git|path)(=|$)/.test(a))) continue;
    for (const spec of positionals(m.args, m.ecosystem)) {
      const name = NAME[m.ecosystem](spec);
      if (name && !found.some((f) => f.ecosystem === m.ecosystem && f.name === name)) found.push({ ecosystem: m.ecosystem, name });
    }
  }
  return found;
}
