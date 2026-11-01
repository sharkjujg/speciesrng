#!/usr/bin/env python3
"""Build data/pool-v1.json from Wikidata (CC0): well-documented species that carry a conservation status.

Eligible: an item whose taxon rank is "species" and that has exactly one conservation status, one scientific name and one English
label, linked from at least T Wikimedia pages, with T the largest threshold that still leaves >= TARGET species. Each species'
taxonomy (genus, family, order, class, phylum, kingdom) is read by walking Wikidata's parent-taxon links upward in batches.
Wikidata keeps changing, so a rerun gives a newer snapshot, not the same bytes.

Usage: python tools/build_pool.py   (network; several minutes; waits between requests)
"""
import collections
import datetime as dt
import json
import pathlib
import sys
import time
import urllib.parse
import urllib.request

UA = "SpeciesRNG-fan-prototype/0.1 (https://github.com/sharkjujg/speciesrng)"
ENDPOINT = "https://query.wikidata.org/sparql"
FLOOR, TARGET = 30, 3000
RANKS = ["genus", "family", "order", "class", "phylum", "kingdom"]


def sparql(q, tries=4):
    url = ENDPOINT + "?" + urllib.parse.urlencode({"query": q, "format": "json"})
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/sparql-results+json"})
            with urllib.request.urlopen(req, timeout=170) as r:
                rows = json.load(r)["results"]["bindings"]
            time.sleep(1.5)
            return rows
        except Exception as e:  # network hiccup or Wikidata timeout: back off and retry
            print("  retry", i, e, file=sys.stderr, flush=True)
            time.sleep(15 * (i + 1))
    raise SystemExit("Wikidata query failed")


def values(uris, body, size=400):
    out = collections.defaultdict(set)
    for i in range(0, len(uris), size):
        vals = " ".join("wd:" + u.rsplit("/", 1)[1] for u in uris[i:i + size])
        for r in sparql(f"SELECT DISTINCT ?f ?v WHERE {{ VALUES ?f {{ {vals} }} {body} }}"):
            out[r["f"]["value"]].add(r["v"]["value"])
    return out


EN = '?f rdfs:label ?v . FILTER(LANG(?v) = "en")'
label_of = lambda prop: f'?f wdt:{prop} ?x . ?x rdfs:label ?v . FILTER(LANG(?v) = "en")'

print("species list…", flush=True)
rows = sparql(f"SELECT DISTINCT ?s ?sl WHERE {{ ?s wdt:P105 wd:Q7432 ; wdt:P141 ?st ; wikibase:sitelinks ?sl . FILTER(?sl >= {FLOOR}) }}")
links = {r["s"]["value"]: int(r["sl"]["value"]) for r in rows}
uris = list(links)
print(len(uris), "candidates; fetching names and status…", flush=True)
names, sci, status, parent = values(uris, EN), values(uris, "?f wdt:P225 ?v"), values(uris, label_of("P141")), values(uris, "?f wdt:P171 ?v")

print("walking taxonomy upward…", flush=True)
node, frontier = {}, {p for ps in parent.values() for p in ps}
for hop in range(80):  # vertebrate lineages pass through dozens of unranked clades before reaching a kingdom
    frontier = {u for u in frontier if u not in node}
    if not frontier:
        break
    fl = sorted(frontier)
    lab, rank, par = values(fl, "?f wdt:P225 ?v"), values(fl, label_of("P105")), values(fl, "?f wdt:P171 ?v")  # taxon name (Mammalia), never the label ("mammal")
    for u in fl:
        node[u] = {"label": sorted(lab.get(u, [""]))[0], "rank": sorted(rank.get(u, [""]))[0], "parent": sorted(par.get(u, []))[0] if par.get(u) else None}
    frontier = {node[u]["parent"] for u in fl if node[u]["parent"]}
    print(f"  hop {hop}: {len(fl)} taxa", flush=True)


def lineage(u):
    ps = sorted(parent.get(u, []))
    cur, seen, out = ps[0] if ps else None, set(), {}
    while cur and cur in node and cur not in seen:
        seen.add(cur)
        n = node[cur]
        if n["rank"] in RANKS and n["label"] and n["rank"] not in out:
            out[n["rank"]] = n["label"]
        elif n["rank"] == "division" and n["label"] and "division" not in out:
            out["division"] = n["label"]
        cur = n["parent"]
    if out.get("kingdom") in ("Plantae", "Fungi") and "phylum" not in out and "division" in out:
        out["phylum"] = out["division"]  # botanists and mycologists say division; zoologists' divisions (fish clades) are not phyla
    return out


def title(s):
    return " ".join(w.capitalize() for w in s.split())


today = dt.datetime.now(dt.timezone.utc).date().isoformat()
species, dropped = [], collections.Counter()
for u in uris:
    nm, sc, st = names.get(u, set()), sci.get(u, set()), status.get(u, set())
    lin = lineage(u)
    if len(nm) != 1 or len(sc) != 1 or len(st) != 1:
        dropped["ambiguous or missing name, scientific name or status"] += 1
    elif "kingdom" not in lin or "class" not in lin and "phylum" not in lin:
        dropped["taxonomy could not be resolved"] += 1
    else:
        species.append({"id": u.rsplit("/", 1)[1], "name": next(iter(nm)), "sci": next(iter(sc)), "status": title(next(iter(st))),
                        "kingdom": lin.get("kingdom"), "phylum": lin.get("phylum"), "class": lin.get("class"), "order": lin.get("order"),
                        "family": lin.get("family"), "genus": lin.get("genus"), "links": links[u]})
print("dropped:", dict(dropped), "kept:", len(species), flush=True)

threshold = FLOOR
for t in range(FLOOR, 400):
    if sum(s["links"] >= t for s in species) >= TARGET:
        threshold = t
    else:
        break
species = sorted((s for s in species if s["links"] >= threshold), key=lambda s: int(s["id"][1:]))
n = len(species)
cov = lambda f: f"known for {sum(bool(s[f]) for s in species):,} of {n:,}; unknown never satisfies a badge"
meta = {"version": "v1", "publishedAt": today, "capturedAt": today, "source": "Wikidata, CC0 (https://www.wikidata.org)",
        "provenance": f"Snapshot of Wikidata taken {today} by tools/build_pool.py. Facts only; no photographs.",
        "selection": f"Species with exactly one conservation status, one scientific name and one English label, linked from at least {threshold} Wikimedia pages, with a resolved kingdom and class or phylum.",
        "sitelinkThreshold": threshold,
        "fieldStatus": {"id": "known", "name": "known (English label; equals the scientific name when no common name exists)", "sci": "known", "status": "known (IUCN category as recorded on Wikidata)",
                        "kingdom": "known", **{f: cov(f) for f in ("phylum", "class", "order", "family", "genus")}, "links": "known"}}
lines = ",\n".join("  " + json.dumps(s, ensure_ascii=False, separators=(",", ":")) for s in species)
out = '{"meta":' + json.dumps(meta, ensure_ascii=False) + ',\n"members":[\n' + lines + "\n]}\n"
path = pathlib.Path(__file__).resolve().parent.parent / "data" / "pool-v1.json"
path.parent.mkdir(exist_ok=True)
path.write_bytes(out.encode("utf-8"))
print(f"wrote {path}: {n} species, sitelink threshold {threshold}", flush=True)
