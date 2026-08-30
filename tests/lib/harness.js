'use strict';

// Minimal test harness shared by every test file - no framework beyond
// Playwright itself and Node's built-in assert, matching the rest of
// this repo's no-build-system, no-dependencies approach. Each test file
// registers checks with test(name, fn), then calls runAll() once at the
// end and exits with the right status code.

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

function waitForServer(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    (function attempt() {
      const req = http.get({ host: 'localhost', port: port, path: '/memoria/' }, function (res) {
        res.resume();
        resolve();
      });
      req.on('error', function () {
        if (Date.now() > deadline) {
          reject(new Error('Local static server did not come up on port ' + port + ' within ' + timeoutMs + 'ms'));
          return;
        }
        setTimeout(attempt, 150);
      });
    })();
  });
}

// Spins up a plain `python3 -m http.server` rooted at the repo, since
// every page here uses absolute paths like /shared.js and /station-icons.svg
// - opening index.html straight from disk (file://) won't resolve those.
async function startServer(port) {
  port = port || Number(process.env.METRORDLE_TEST_PORT) || 8930;
  const proc = spawn('python3', ['-m', 'http.server', String(port)], {
    cwd: REPO_ROOT,
    stdio: 'ignore',
  });
  await waitForServer(port, 10000);
  return {
    port: port,
    baseUrl: 'http://localhost:' + port,
    stop: function () {
      proc.kill();
    },
  };
}

var registered = [];

function test(name, fn) {
  registered.push({ name: name, fn: fn });
}

// Runs every registered check in order, printing a line per check, and
// returns the number that failed (0 = all good). Import this and call
// it as the last thing in a test file's main().
async function runAll() {
  var failed = 0;
  for (var i = 0; i < registered.length; i++) {
    var t = registered[i];
    process.stdout.write('  ' + t.name + ' ... ');
    try {
      await t.fn();
      console.log('ok');
    } catch (err) {
      failed++;
      console.log('FAILED');
      console.error('    ' + (err && err.stack ? err.stack.split('\n').join('\n    ') : err));
    }
  }
  return failed;
}

module.exports = {
  REPO_ROOT: REPO_ROOT,
  startServer: startServer,
  test: test,
  runAll: runAll,
};
