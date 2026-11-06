# Git workflow

Branch off latest `main` for every change, one PR per logical change,
never push directly to `main`. Commit messages and PR bodies end with
the attribution footer from the session's system prompt. **Keep commit
messages, PR descriptions, and GitHub comments succinct** - a few lines
on what changed and why, not an essay; the diff is the record. Known open
PRs as of this writing: **#33** (service-worker cache-consistency,
already bumped `CACHE_NAME` on its own branch - expect a collision) and
**#13** (Laberinto neighbor-fan layout, unrelated/stale). Re-check
current PR state via the GitHub MCP tools before assuming either is
still open - this list goes stale.
