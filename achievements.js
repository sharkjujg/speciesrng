// Achievements are derived, never stored: replaying a player's rolls against the immutable pool gives the same answer every time.
// Every goal is scaled from the pool: bigger pools get more shelves, bigger discovery goals and bigger point goals.
import { LEVELS, fmtNum, fmtPct } from './engine.js';

export const TIER_RANK = { Mythic: 0, Anomaly: 1, Epic: 2, Rare: 3, Uncommon: 4, Common: 5, 'Low Roll': 6 };
const TIER_NAMES = Object.keys(TIER_RANK);
const DAYS = [1, 3, 7, 14, 30, 60, 100, 200, 365, 500, 730, 1000];
const STREAK = [2, 3, 5, 7, 14, 30, 60, 100, 200, 365];
const FIXED = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000];
const FRACTIONS = [0.01, 0.02, 0.05, 0.1, 0.25, 0.5, 1];
const RP_MULT = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000];
const MIN_SHELF = 3;
const uniq = (xs) => [...new Set(xs)].sort((a, b) => a - b);
const plural = (n, one, many) => (n === 1 ? one : many);

// shelvesOf(member) -> [[group, label], ...]. Returns { list, shelfOf } where shelfOf[i] are the shelf keys of pool member i.
export function buildAchievements(pool, rules, shelvesOf, site) {
  const n = pool.n, { noun, nouns } = site, list = [];
  const add = (a) => list.push({ ...a, id: `${a.kind}:${a.p ?? ''}:${a.goal}` });

  for (const g of DAYS) add({ kind: 'days', group: 'Rolling', goal: g, name: `Roll on ${g} ${plural(g, 'day', 'different days')}`, desc: `Make a daily roll on ${g} different UTC ${plural(g, 'day', 'days')}.` });
  for (const g of STREAK) add({ kind: 'streak', group: 'Rolling', goal: g, name: `${g}-day streak`, desc: `Roll on ${g} UTC days in a row.` });
  for (const g of [2, 3, 5]) add({ kind: 'repeat', group: 'Rolling', goal: g, name: `Old friend ×${g}`, desc: `Draw the very same ${noun} ${g} times.` });

  const distinct = uniq([...FIXED.filter((g) => g <= n), ...FRACTIONS.map((f) => Math.max(1, Math.round(f * n)))]);
  for (const g of distinct) add({ kind: 'distinct', group: 'Discovery', goal: g, name: `Discover ${fmtNum(g)} ${plural(g, noun, nouns)}`, desc: `Draw ${fmtNum(g)} different ${nouns}: ${fmtPct(g, n)} of the pool.` });

  const med = Math.max(1, pool.scores.median);
  for (const m of RP_MULT) add({ kind: 'rp', group: 'Points', goal: m * med, name: `Reach ${fmtNum(m * med)} RP`, desc: `Earn ${fmtNum(m * med)} rarity points in total (${m}× this pool's median roll).` });

  const above = (r) => TIER_NAMES.slice(0, r + 1).reduce((s, t) => s + (pool.tierCounts[t] || 0), 0); // pool members at this tier or better
  for (const t of ['Uncommon', 'Rare', 'Epic', 'Anomaly', 'Mythic']) {
    if (!above(TIER_RANK[t])) continue;
    for (const g of [1, 5, 25]) add({ kind: 'tier', p: TIER_RANK[t], group: 'Rarity', goal: g, name: g === 1 ? `A ${t} roll` : `${g} ${t} rolls`, desc: `Make ${g} ${plural(g, 'roll', 'rolls')} of ${t} rarity or better.` });
  }
  if (pool.tierCounts['Low Roll']) for (const g of [1, 5, 10]) add({ kind: 'exact', p: TIER_RANK['Low Roll'], group: 'Rarity', goal: g, name: g === 1 ? 'A Low Roll' : `${g} Low Rolls`, desc: `Make ${g} ${plural(g, 'roll', 'rolls')} in the bottom 1%. Every discovery still counts.` });

  const active = rules.filter((r) => pool.stats[r.id].k > 0);
  for (const r of active) {
    const p = pool.stats[r.id].k / n;
    const reachable = Math.max(1, Math.round(p * 1000)); // levels a player could plausibly reach within about a thousand rolls
    LEVELS.filter((g) => g <= reachable).forEach((g, i) => add({ kind: 'badge', p: r.id, group: 'Badges', goal: g, name: i === 0 ? `Earn ${r.name}` : `${r.name}: level ${i + 1}`, desc: `Earn the ${r.name} badge ${g} ${plural(g, 'time', 'times')}.` }));
  }
  for (const g of uniq([1, 3, 5, 10, 15, active.length].filter((x) => x <= active.length))) add({ kind: 'badges', group: 'Badges', goal: g, name: g === active.length ? 'Every badge' : `${g} different badges`, desc: `Earn ${g} different badges (${active.length} are active in this pool).` });
  const families = new Map();
  for (const r of active) families.set(r.family, [...(families.get(r.family) || []), r.id]);
  for (const [fam, ids] of families) if (ids.length > 1) add({ kind: 'family', p: ids, group: 'Families', goal: ids.length, name: `Complete ${fam}`, desc: `Earn every badge in the ${fam} family (${ids.length}).` });

  const shelfOf = pool.members.map((m) => shelvesOf(m).map(([g, l]) => `${g}\u0001${l}`));
  const sizes = new Map();
  for (const keys of shelfOf) for (const k of keys) sizes.set(k, (sizes.get(k) || 0) + 1);
  for (const [key, s] of [...sizes].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (s < MIN_SHELF) continue; // a shelf of one or two would make "first" and "complete" the same trivial goal
    const [group, label] = key.split('\u0001');
    for (const g of uniq([1, ...[0.05, 0.1, 0.25, 0.5].map((f) => Math.ceil(f * s)), s]).filter((x) => x >= 1 && x <= s)) {
      const name = g === 1 ? `${label}: first ${noun}` : g === s ? `${label}: complete shelf` : `${label}: ${g} ${nouns}`;
      add({ kind: 'shelf', p: key, group, goal: g, name, desc: `Draw ${g} different ${plural(g, noun, nouns)} from ${group.toLowerCase()} "${label}" (${s} in the pool).` });
    }
  }
  return { list, shelfOf };
}

// Everything achievements can read from a player's history.
export function progressOf(cat, rolls) {
  const rs = [...rolls].sort((a, b) => a.day.localeCompare(b.day));
  const idx = new Map(), badges = new Map(), shelves = new Map(), exact = Array(7).fill(0);
  let rp = 0;
  for (const r of rs) {
    idx.set(r.index, (idx.get(r.index) || 0) + 1);
    rp += r.rp;
    for (const a of r.awards) badges.set(a.id, (badges.get(a.id) || 0) + 1);
    for (const k of cat.shelfOf[r.index] || []) { if (!shelves.has(k)) shelves.set(k, new Set()); shelves.get(k).add(r.index); }
    exact[TIER_RANK[r.tier]]++;
  }
  let streak = 0, run = 0, prev = null;
  for (const d of new Set(rs.map((r) => r.day))) {
    run = prev !== null && Date.parse(d) - prev === 86400000 ? run + 1 : 1;
    prev = Date.parse(d);
    streak = Math.max(streak, run);
  }
  const atOrAbove = exact.map((_, i) => exact.slice(0, i + 1).reduce((s, x) => s + x, 0));
  return { days: new Set(rs.map((r) => r.day)).size, streak, distinct: idx.size, repeat: Math.max(0, ...idx.values()), rp, badges, shelves, exact, atOrAbove };
}

export function valueOf(a, st) {
  switch (a.kind) {
    case 'days': return st.days;
    case 'streak': return st.streak;
    case 'repeat': return st.repeat;
    case 'distinct': return st.distinct;
    case 'rp': return st.rp;
    case 'tier': return st.atOrAbove[a.p];
    case 'exact': return st.exact[a.p];
    case 'badge': return st.badges.get(a.p) || 0;
    case 'badges': return st.badges.size;
    case 'family': return a.p.filter((id) => st.badges.has(id)).length;
    case 'shelf': return st.shelves.get(a.p)?.size || 0;
    default: return 0;
  }
}

export const unlockedIds = (list, st) => new Set(list.filter((a) => valueOf(a, st) >= a.goal).map((a) => a.id));
