'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const files = fs.readdirSync(root).filter(f => f.endsWith('.js'));
for (const dir of ['scripts', 'tests']) {
  for (const file of fs.readdirSync(path.join(root, dir))) {
    if (file.endsWith('.js')) files.push(`${dir}/${file}`);
  }
}
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, file)], { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.exit(result.status || 1);
  }
}
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const [, resource] of html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)) {
  if (/^(?:https?:)?\/\//.test(resource) || !fs.existsSync(path.join(root, resource))) {
    throw new Error(`Missing or external runtime resource: ${resource}`);
  }
}
if (!fs.existsSync(path.join(root, '.nojekyll'))) throw new Error('Missing Pages .nojekyll marker');
console.log(`Syntax OK: ${files.length} JavaScript files; local HTML resources and Pages marker OK.`);
