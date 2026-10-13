const assert = require('assert');
const path = require('path');
const fs = require('fs');

// 1. Zoom cycling test
const levels = ['list', 'small', 'medium', 'large'];
function stepZoom(current, deltaY) {
  const idx = levels.indexOf(current);
  if (deltaY < 0 && idx < levels.length - 1) return levels[idx + 1];
  if (deltaY > 0 && idx > 0) return levels[idx - 1];
  return current;
}

assert.strictEqual(stepZoom('list', -100), 'small');
assert.strictEqual(stepZoom('small', -100), 'medium');
assert.strictEqual(stepZoom('medium', -100), 'large');
assert.strictEqual(stepZoom('large', -100), 'large'); // clamp at max
assert.strictEqual(stepZoom('large', 100), 'medium');
assert.strictEqual(stepZoom('medium', 100), 'small');
assert.strictEqual(stepZoom('small', 100), 'list');
assert.strictEqual(stepZoom('list', 100), 'list'); // clamp at min
console.log('✓ Zoom step logic test passed.');

// 2. Test local path candidate resolution
const baseDropbox = 'C:\\Users\\nanoc\\Dropbox';
const filePath = 'C:\\Users\\nanoc\\Dropbox\\DRX\\agapetoursconcordia.Carpeta\\agapetoursconcordia.com.biblioteca\\agapetoursconcordia.com\\0_Mua5Y2uq4a-XiK6j.jpg';

const absCandidates = [
  filePath,
  filePath.replace(/\.carpeta\b/gi, '.proyecto'),
  filePath.replace(/\.carpeta\b/gi, '.programa'),
  filePath.replace(/\.carpeta\b/gi, '.webs'),
];

let resolved = null;
for (const cand of absCandidates) {
  if (fs.existsSync(cand) && !fs.statSync(cand).isDirectory()) {
    resolved = cand;
    break;
  }
}

assert(resolved !== null, 'Candidate must resolve to an existing file on disk');
assert(resolved.includes('.proyecto'), 'Must resolve with .proyecto substitution');
console.log('✓ File preview local candidate substitution passed:', resolved);
console.log('ALL TESTS PASSED.');
