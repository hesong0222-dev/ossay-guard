import { test } from 'node:test';
import assert from 'node:assert/strict';
import { packagesIn } from '../scripts/parse.mjs';

const names = (cmd) => packagesIn(cmd).map((p) => `${p.ecosystem}:${p.name}`);

test('npm, pnpm, yarn: names without versions, scoped names kept, flags skipped', () => {
  assert.deepEqual(names('npm install express@4 -D @types/node@20'), ['npm:express', 'npm:@types/node']);
  assert.deepEqual(names('npm i --save-exact lodash'), ['npm:lodash']);
  assert.deepEqual(names('pnpm --filter web add zod'), ['npm:zod']);
  assert.deepEqual(names('yarn add react react-dom'), ['npm:react', 'npm:react-dom']);
  assert.deepEqual(names('npm install my-alias@npm:chalk@5'), ['npm:chalk']);
});

test('pip, uv, poetry: extras and version specifiers removed, requirement files skipped', () => {
  assert.deepEqual(names('pip install "uvicorn[standard]>=0.30" requests==2.32'), ['pypi:uvicorn', 'pypi:requests']);
  assert.deepEqual(names('python3 -m pip install -U httpx'), ['pypi:httpx']);
  assert.deepEqual(names('pip install -r requirements.txt'), []);
  assert.deepEqual(names('uv add fastapi --group dev'), ['pypi:fastapi']);
  assert.deepEqual(names('uv pip install numpy'), ['pypi:numpy']);
  assert.deepEqual(names('poetry add pendulum@^3.0'), ['pypi:pendulum']);
});

test('cargo add and go get', () => {
  assert.deepEqual(names('cargo add serde@1 -F derive tokio'), ['cargo:serde', 'cargo:tokio']);
  assert.deepEqual(names('cargo add --git https://github.com/a/b foo'), []);
  assert.deepEqual(names('go get -u github.com/spf13/cobra@v1.8.0'), ['go:github.com/spf13/cobra']);
  assert.deepEqual(names('go get ./...'), []);
});

test('chained commands, env prefixes; installs from lockfiles, paths and URLs are not packages', () => {
  assert.deepEqual(names('cd app && NODE_ENV=dev npm i axios; pip install rich'), ['npm:axios', 'pypi:rich']);
  assert.deepEqual(names('npm install'), []);
  assert.deepEqual(names('npm ci'), []);
  assert.deepEqual(names('npm install ./local-pkg github:a/b https://x.org/p.tgz a/b'), []);
  assert.deepEqual(names('pip install -e .'), []);
  assert.deepEqual(names('git commit -m "npm install express"'), []);
  assert.deepEqual(names('ls -la'), []);
});
