#!/usr/bin/env python3
"""Static file server for the Playwright suite - a drop-in for
`python3 -m http.server` (same SimpleHTTPRequestHandler, so identical
directory serving, content types and trailing-slash index resolution),
with ONE exception: it 404s /vendor/firebase/*.

The Firebase SDK is vendored same-origin in production (vendor/firebase/),
but this sandbox can't reach Firestore at all, and the whole suite is
written around `firebase` being undefined and the leaderboard degrading
gracefully - the same condition a real player with an ad blocker (or this
sandbox, which couldn't reach the old gstatic.com CDN) sees. Serving the
vendored SDK here would instead define `firebase`, and a real Firestore
read/write would then hang forever against the unreachable backend. So we
withhold just those files and keep the prior, intended test condition.

A test that needs to drive the SDK's load outcome itself (e.g. the probe
tests) does so with page.route(), which intercepts before this server.
"""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8930


class Handler(SimpleHTTPRequestHandler):
    def _blocked(self):
        return self.path.startswith('/vendor/firebase/')

    def do_GET(self):
        if self._blocked():
            self.send_error(404)
            return
        return super().do_GET()

    def do_HEAD(self):
        if self._blocked():
            self.send_error(404)
            return
        return super().do_HEAD()

    def log_message(self, *args):
        pass  # quiet, like `http.server` under the harness' stdio: 'ignore'


if __name__ == '__main__':
    # Threaded, like `python3 -m http.server` (Python 3.7+), so concurrent
    # sessions/assets aren't serialized into timeouts.
    ThreadingHTTPServer(('', PORT), Handler).serve_forever()
