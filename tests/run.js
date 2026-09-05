'use strict';

// Runs every *.test.js file under this directory (each one manages its
// own server/browser lifecycle) and exits non-zero if any of them
// failed. See README.md for setup and for running a single file.

const { spawnSync } = require('child_process');
const path = require('path');

const FILES = [
  'memoria/fast.test.js',
  'memoria/round-lifecycle.test.js',
  'memoria-leaderboard/leaderboard.test.js',
];

let failed = 0;

for (const file of FILES) {
  console.log('\n=== ' + file + ' ===');
  const result = spawnSync(process.execPath, [path.join(__dirname, file)], {
    stdio: 'inherit',
  });
  if (result.status !== 0) failed++;
}

console.log('');
if (failed) {
  console.log(failed + ' test file(s) failed.');
  process.exitCode = 1;
} else {
  console.log('All test files passed.');
}
