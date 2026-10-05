// StructCap deploy guard: the published index.html must be a full page that loads config.js (cloud mode).
// Without config.js the site silently runs in local test mode: settings such as "Pro free for all", accounts and
// registrations stay in each visitor's own browser instead of the server. Run: node tests/site.test.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let bad = 0; const T = (lbl, ok) => { if (!ok) bad++; console.log(ok ? 'OK ' : 'BAD', lbl); };
const srcs = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
T('starts with <!doctype html>', /^<!doctype html>/i.test(html));
T('declares utf-8 (Thai text)', /<meta charset="utf-8">/i.test(html));
T('has a mobile viewport', /<meta name="viewport"/.test(html));
T('loads config.js', srcs.includes('config.js'));
T('config.js loads before app.js', srcs.indexOf('config.js') >= 0 && srcs.indexOf('config.js') < srcs.indexOf('app.js'));
T('app.js is the last script', srcs[srcs.length - 1] === 'app.js');
T('every script file exists', srcs.every(s => fs.existsSync(path.join(root, s))));
T('config.js sets an apiUrl', /apiUrl:\s*'https:\/\/[^']+'/.test(fs.readFileSync(path.join(root, 'config.js'), 'utf8')));
console.log(bad ? `\n${bad} check(s) FAILED` : '\nall site checks passed');
process.exit(bad ? 1 : 0);
