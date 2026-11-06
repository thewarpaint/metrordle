# Leaderboards

Each game has its own daily Firestore leaderboard:
`{collection}/{dateKey}/entries/{aliasDocId}`, collections
`metrordle-leaderboard` / `laberinto-leaderboard` / `memoria-leaderboard` /
`metroguessr-leaderboard` / `metrocrush-leaderboard` /
`clasificador-leaderboard` / `copo-de-nieve-leaderboard`.
Alias is a free-text nickname (site-wide `metrordle:alias` localStorage
key, shared across all games), changeable from `/configurar/` (see
"Site config" below) - but still no way to carry old entries forward
when you do: the alias *is* the document ID (lowercased), so renaming
only changes what *future* submissions use, leaving every
already-submitted entry under the old alias orphaned, permanently
(nothing re-keys past documents - there is no bulk-rename operation on
Firestore data here). Two players choosing the same alias still
silently share/overwrite one entry too (both known, accepted
limitations).

Per-game conventions, each with its own ranking rule baked into
`orderBySpecs` (an ordered `[field, 'asc'|'desc']` list; `submittedAt`
asc is always the final tiebreak). **Only `orderBySpecs[0]` is ever
passed to Firestore's own `.orderBy()`** - `getTopLeaderboardScores()`
fetches ordered (and capped) by that one field alone, then applies the
*whole* `orderBySpecs` list (plus the `submittedAt` tiebreak) itself
client-side via `compareByOrderSpecs()`. This is deliberate, not an
optimization to undo: Firestore's `.orderBy(field)` silently **excludes**
any document missing that field from the query's results entirely (no
error, just fewer rows) - ordering server-side by every field in
`orderBySpecs` would silently drop any entry submitted before a later
field existed on that collection. This isn't hypothetical - it's
exactly what broke `/admin/`'s Metroguessr leaderboard the day
`hardMode` was added to its `orderBySpecs`: every entry from earlier
that same day (before that field existed on writes) vanished from
every query ordering by it, with nothing visibly erroring anywhere.
**Adding a new field to an existing collection's `orderBySpecs`
requires no code changes to stay safe** (the split above already
handles it, and `compareByOrderSpecs()` treats a missing field as
`false`/`0` rather than crashing) - just be aware that any entry
submitted before that PR won't have the new field, and will rank
accordingly (lowest) until/unless it's backfilled. `orderBySpecs[0]`
itself doesn't have this risk, since it's each collection's original
ranking field, present since the collection was created.

A field that's purely informational - rendered somewhere, never
sorted/tie-broken on (Metroguessr's own `hintsUsed`/🪄 badge, every
game's `streak`/🔥 one, see below) - should almost never go in
`orderBySpecs` at all, exactly to sidestep the exclusion risk above.
But `getTopLeaderboardScores()` only ever copies `orderBySpecs` fields
(plus `id`/`alias`/`submittedAt`) from the Firestore document into the
entry object it hands back - **a field left out of `orderBySpecs` still
needs to be named in `options.extraFields` (an array of field names) to
reach the caller at all**, or it reads `undefined` even on an entry
that has it. This bit Metroguessr's own `hintsUsed` field for a full
PR: it was submitted correctly and rendered via `entry.hintsUsed` in
that page's own `renderLeaderboard()`, but nothing ever asked
`getTopLeaderboardScores()` to actually copy it over, so every real,
Firestore-backed entry's 🪄 badge silently stayed empty in production
the whole time - caught only once `streak` needed the exact same
plumbing and a test (`tests/shared/leaderboard-query.test.js`) was
added to lock the fix in.
- Metrordle: fewest attempts, a loss always after every win, hard-mode
  beats normal-mode at a tie
  (`[['attempts','asc'],['lost','asc'],['hardMode','desc']]`). See
  "Losses" below for the `lost` field and why it's second, not first,
  in that list.
- Laberinto: fewest stations, then fewest transfers, both ascending -
  but from `SCORING_CUTOVER_DATE_KEY` (`2026-10-23`) on, a round is
  scored as the single sum `stations + transfers` (each line switch a
  point), ranked ascending with submission time as the only tiebreak,
  submitted as its own `score` field and displayed as "15+3" (vs the
  older "15-3"); the shortest-path search minimizes that same sum on
  those days, and an `.notice--info` on the page announces the change.
  Branching on dateKey keeps earlier days exactly as they were, same
  replay-safety convention as `PATH_DIFFICULTY_CUTOVER_DATE_KEY`.
  `firestore.rules`' laberinto block allows `score` as an *optional*
  field (bounded 0-600) - optional so a stale pre-cutover cached client,
  still writing without it, isn't rejected; the `score` field shipped
  after the rule originally did, so its deploy was the follow-up that
  stopped the cutover-day `permission-denied` writes (rules are a manual
  deploy - see the `firestore.rules` bullet). `/admin/`'s own Laberinto
  board now branches the same way per shown date
  (`LABERINTO_SCORING_CUTOVER_DATE_KEY`): on/after the cutover it ranks by
  the single `score` and shows "15+3", before it the old
  stations-then-transfers order shown "15-3" - `renderGame()` resolves a
  game's `orderBySpecs`/`extraFields` per date when they're supplied as
  functions (Laberinto is the only one so far) and passes `dateKey` to
  `scoreCell`, so date-nav into an earlier day still renders as that day
  was scored. Unlike Metrordle/Metroguessr, a give-up here still has
  nothing meaningful to rank (no route at all, not just a worse one) -
  it still only ever submits on a win.
- Memoria: highest score, descending.
- Metroguessr: fewest attempts, a loss always after every win,
  hard-mode beats normal-mode at a tie - same shape as Metrordle's own
  combined ranking
  (`[['attempts','asc'],['lost','asc'],['hardMode','desc']]`).
- Metro Crush: highest score, descending - same shape as Memoria's, but
  a cumulative round total rather than a fixed-size puzzle's score, so
  its Firestore rule bounds `score` generously (20000) instead of
  tightly (see `firestore.rules`).
- Clasificador: highest score, descending - same shape as Memoria's and
  Metro Crush's, including a display-only `hardMode` field (not part
  of `orderBySpecs`, same as Metro Crush's own). `score` is the
  round's own `total` (stations correctly classified) - open-ended
  like Metro Crush's own, so its Firestore rule bounds it generously
  (500) rather than tightly.
- Copo de nieve: highest score, descending - same shape as Memoria's/
  Metro Crush's/Clasificador's own. `score` is how many "special"
  stations were tapped in the 60-second round. Open-ended and
  faster-paced than Clasificador (pure tapping, no per-placement delay),
  so its Firestore rule bounds `score` at a generous 1000. Has a
  display-only `hardMode` field now (🧠 badge, not part of `orderBySpecs`,
  same as Clasificador's own) - but, unlike Clasificador's, it's an
  *optional* field in `firestore.rules` (it shipped after the collection
  did, so a stale cached client still submitting without it mustn't be
  rejected - same optional-field reasoning as Laberinto's own `score`;
  deploy the rule before/with the code).

## High score records

Memoria, Metro Crush, Clasificador, and Copo de nieve - the games ranked
by a raw score rather than a fixed day's puzzle outcome - also track an
all-time high score, separate from (and never cleared by) the daily
leaderboards above: a single long-lived `records/{gameKey}` Firestore
document (`MetroShared.updateHighScoreRecord()`/`getHighScoreRecord()`/
`formatHighScoreRecord()` in `shared.js`, `{score, alias, dateKey,
gameNumber, submittedAt}`), only ever overwritten by a genuinely higher
score - `firestore.rules`' own `request.resource.data.score >
resource.data.score` on `update` makes that a server-enforced
guarantee, not just well-behaved client code's own restraint. Each
game's `submitScore()` calls `updateHighScoreRecord(gameKey,
state.score, alias, state.dateKey, state.gameNumber)` as a best-effort
side effect of a successful leaderboard submission (never rejects, so
it can't turn an otherwise-successful submission into a visible
error). `getHighScoreRecord(gameKey)` + `formatHighScoreRecord()`
(`'🏆 N por alias · #N · date'`) render it in two places: each
game's own reveal-screen leaderboard (`.leaderboard__record`, a golden
row-shaped card on top of the list, shared markup/CSS - see
`shared.css`) and `/admin/`'s matching board, both
loading it once (no date dimension to re-fetch on date-nav) rather than
per-render like the per-day leaderboard lists above. Clasificador's own
`records/clasificador` was seeded from its real leaderboard's own
highest entry to date, rather than starting empty.

## Losses

Metrordle and Metroguessr both submit a loss to the leaderboard now,
not just a win - relies on `attempts` for a loss always being exactly
`TOTAL_ATTEMPTS` (5 for both games: Metrordle's own guess limit,
Metroguessr's `guesses.length + hintsUsed` when the round ends without
a correct guess), which is already >= any win's own attempts count.
That alone puts every loss last in `attempts asc` order EXCEPT the one
case where a win also happens on the very last possible attempt - tied
with a loss at that same value. `lost` (bool, `true` for a loss) is
the tiebreak for exactly that collision, which is why it's
`orderBySpecs[1]`, not `[0]`: `orderBySpecs[0]` is the one field
Firestore's own `.orderBy()` uses server-side (see above), and any
document missing that field is silently excluded from the query
entirely - `attempts` has been on every entry since each collection's
creation, so keeping it first means introducing `lost` can't
accidentally drop older entries from the results the way changing
`orderBySpecs[0]` itself would. A missing `lost` field (any entry from
before this shipped) is treated as `false` by `compareByOrderSpecs()`
- exactly correct, since every entry that predates this only ever got
submitted on a win in the first place (see "Submission pattern"
below). `renderLeaderboard()`'s own row-building renders a bare `-`
for `entry.lost`'s score number instead of the (constant, so
meaningless to actually show) attempts count - `/admin/`'s matching
`GAMES` entries do the same in their own `scoreCell()`. A loss also
resets that game's streak to 0 (see "Streaks" below) and now submits
`streak: 0` rather than skipping submission altogether, which is why
both collections' `firestore.rules` bound relaxed from `streak >= 1`
to `>= 0`, matching Memoria's own bound.

Submission pattern (identical across all 6 games): a
`leaderboardSubmitted` flag persisted alongside the game result, so a
reload never resubmits; `submitScore()` no-ops without an alias or
under `?debug=true`. Laberinto is the only one of the three
attempts/route-based games left where a loss (give-up, there) still
has nothing meaningful to submit - `renderAliasRow()` there still
hides the whole `#leaderboard-alias-row` on one, rather than a
no-alias player seeing an entry form that would silently do nothing if
filled in. Metrordle/Metroguessr's own `renderAliasRow()` always shows
now, win or loss, since both have a meaningful leaderboard entry to
submit - same as Memoria/Metro Crush/Clasificador's own alias row,
which always showed regardless of outcome already. `renderLeaderboard()` never
clears the DOM before its fetch resolves (avoids a flicker on reload),
guarded by a monotonically increasing request-id so a stale response
can't paint over a newer one.

## Streaks

Metrordle, Laberinto, Memoria, Metroguessr, Metro Crush,
Clasificador, and Copo de nieve all track a consecutive-days streak
(`MetroShared.loadStreak`/`saveStreak`/`updateStreakForResult`/
`formatStreak`/`formatMaxStreak` in `shared.js`, one `'<key>:streak'`
localStorage entry per game, separate from that day's own
`'<key>:' + dateKey` round-result entry), shown on that game's own
reveal banner/share text (`🔥 Racha: N días`, plus a "máxima: M días"
mention only when the best-ever streak is still ahead of today's - not
yet true of Clasificador's own reveal screen, which doesn't show the
streak anywhere in its own banner/text yet, only via its leaderboard
rows' badge). Copo de nieve does show it, right in its success notice
(`🔥 Racha: N días` + the máxima mention when ahead). The first four
extend it on a win and reset it to 0 on a loss/give-up; Metro Crush,
Clasificador, and Copo de nieve have no daily win/loss puzzle outcome to
hook that into (their games are scored per-round, not "won" day to day),
so each extends its own streak on any round that ends with a non-zero
score instead, and resets it only on a genuine 0-point round (still a
real result - it submits and resets the streak, rather than being
skipped) - see `metrocrush/index.html`'s own `STREAK_STORAGE_KEY`
comment (Clasificador's and Copo de nieve's own mirror it).

Each of those seven games' own `submitScore()` also submits `streak` as
a leaderboard field now, purely for display - like `hintsUsed` above,
it's deliberately never part of `orderBySpecs`, so a query's
ranking/results are identical whether or not a given entry (old or
new) happens to have it. `MetroShared.buildStreakBadge(streak)` in
`shared.js` is the one shared renderer for it - a `<span
class="leaderboard__streak">` (styled in `shared.css`, shared since
this is no longer a single page's own thing) reading **`🔥 × N` when
`N > 1`, nothing otherwise** (a streak of 0 or 1 isn't yet "a streak"
worth calling out), always returned (even empty) so a row's score
column still lands in the same spot whether or not it has one.
`/admin/`'s own `renderGame()` appends one to every row for all seven
collections now; Metrordle's, Laberinto's, Memoria's, Metroguessr's,
Clasificador's, and Copo de nieve's own `renderLeaderboard()` do the same
on their own in-page leaderboards (only Metro Crush's own leaderboard
doesn't yet - nothing architectural stops it, this just hasn't been
asked for).
Metroguessr's own call carries both `hintsUsed` and `streak` in
`extraFields`, since it renders the 🪄 badge and the 🔥 one. Every one
of those `getTopLeaderboardScores()` calls needs
`extraFields: ['streak']` for the value to actually reach
`entry.streak` at all (see `extraFields` above) - `buildStreakBadge()`
itself doesn't guard against a missing field beyond `streak > 1`
already being false for `undefined`, so a call that forgets
`extraFields` just silently renders an always-empty badge, the same
failure mode `hintsUsed` hit before. Metro Crush's and Clasificador's
own leaderboard rules both bound `streak` the same generous `>= 0`/
`<= 5000` as Memoria's (see `firestore.rules`) - **this bound is a
manual deploy, not something CI applies** (see "Firebase credential
safety"/`firestore.rules`'s own bullet above); a PR that changes this
file still needs someone to actually paste it into the Firebase console
(or run `firebase deploy --only firestore:rules`) after merging, or
every real submission to a collection whose rule just changed will
fail closed against the *old* rule until that happens.
