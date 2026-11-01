# SpeciesRNG

A daily species discovery game: roll once per UTC day, draw one species that carries an IUCN conservation status from a Wikidata snapshot, and see which badges make it unusual. A sibling of CinemaRNG, BrickRNG, ExoRNG, QuakeRNG, PeakRNG, AsteroidRNG and BookRNG on the same engine.

**This is a prototype.** Species facts are a snapshot of [Wikidata](https://www.wikidata.org) (CC0). There is no backend, so results live in the player's browser. No photographs are used. A status is what Wikidata records, not a forecast. Unofficial fan project, not affiliated with Wikimedia or the IUCN.

## What is built

| Area | Status |
| --- | --- |
| Daily roll, unbiased secure draw, one per UTC day, retry-safe | Done, browser-local (the day comes from the host's `Date` header, not the device clock) |
| 31 badge rules, families, RP = 100 / p, overall rarity tiers, tie rules | Done, tested in `rules.js` |
| Animated reveal (name reel, count-up, rarity pulse and burst), skippable, reduced-motion aware | Done |
| Hundreds of achievements derived from your rolls, with goals scaled to the pool size | Done (`achievements.js`) |
| Badge catalog, badge pages, levels, history, export, delete, pool page | Done |
| Sign-in, ranked limit, leaderboards, friends, hearts, poems, Discord, moderation | Needs a server |

## Run it

No build step.

```
python -m http.server 8765
```

Open <http://localhost:8765>. Open `/check.html` for the self-check; its title becomes `PASS` or `FAIL n`.

## Layout

- `engine.js` and `achievements.js` generic scoring, tiers, sampling, day helpers and achievements (shared with sibling RNG games)
- `rules.js` this game's badge rules; `site.js` its names, copy, art and shelves; `fixtures.js` rule fixtures for `check.html`
- `app.js`, `index.html`, `style.css` the site (hash routes, so it works on any static host)
- `data/pool-v1.json` the published pool; `tools/build_pool.py` rebuilds it from Wikidata (a rerun gives a newer snapshot). It walks each species' parent-taxon links upward in batches to read its genus, family, order and class; a missing link leaves that rank unknown (null), never guessed.

## Publishing

GitHub Pages serves the repository root from `main`. Push to `main` to update the site.
