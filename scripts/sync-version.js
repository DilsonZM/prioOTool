// Syncs version strings across static assets from package.json
// Run: node scripts/sync-version.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, '..');

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}
function write(file, content) {
  fs.writeFileSync(path.join(root, file), content, 'utf8');
  console.log(`Updated ${file}`);
}

const pkg = JSON.parse(read('package.json'));
const version = pkg.version;

function replaceAll(str, replacements) {
  let out = str;
  for (const [search, repl] of replacements) {
    out = out.replace(search, repl);
  }
  return out;
}

// 1) main.js APP_VERSION
{
  const file = 'js/modules/main.js';
  const txt = read(file);
  const out = txt.replace(/const APP_VERSION = '[^']*';/, `const APP_VERSION = '${version}';`);
  if (txt !== out) write(file, out);
}

// 2) index.html querystrings
{
  const file = 'index.html';
  const txt = read(file);
  const out = replaceAll(txt, [
    [/js\/script.js\\?v=[^\"']+/g, `js/script.js?v=${version}`],
    [/js\/firebase-config.js\\?v=[^\"']+/g, `js/firebase-config.js?v=${version}`],
    [/js\/auth.js\\?v=[^\"']+/g, `js/auth.js?v=${version}`]
  ]);
  if (txt !== out) write(file, out);
}

// 3) auth.js import cachebuster
{
  const file = 'js/auth.js';
  const txt = read(file);
  const out = txt.replace(/main.js\\?v=[^\"']+/, `main.js?v=${version}`);
  if (txt !== out) write(file, out);
}

// 4) Service Worker cache name + assets
{
  const file = 'sw.js';
  const txt = read(file);
  const out = replaceAll(txt, [
    [/priotool-v[^']*'/, `priotool-v${version}'`],
    [/js\/script.js\\?v=[^\"']+/g, `js/script.js?v=${version}`],
    [/js\/auth.js\\?v=[^\"']+/g, `js/auth.js?v=${version}`],
    [/js\/firebase-config.js\\?v=[^\"']+/g, `js/firebase-config.js?v=${version}`]
  ]);
  if (txt !== out) write(file, out);
}

// 5) update_version_node.js log + payload
{
  const file = 'update_version_node.js';
  const txt = read(file);
  const out = txt
    .replace(/version en Firestore a [^']*'/, `version en Firestore a ${version}'`)
    .replace(/version: '[^']*'/, `version: '${version}'`);
  if (txt !== out) write(file, out);
}

console.log(`Version sync complete -> ${version}`);
