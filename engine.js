// Generic game logic, no DOM and no network. Identical in every RNG-style site; the badge rules live in rules.js.
// Weights, tiers, and the day boundary follow the building plans (RP = 100 / p, integer tier maths, UTC reset).
import * as site from './rules.js';
export { RULES, norm } from './rules.js';

const { RULES, prep } = site;
export const RULESET = site.RULESET ?? '1'; // a site bumps this in rules.js when its badge list changes
export const TIERS = ['Mythic', 'Anomaly', 'Epic', 'Rare', 'Uncommon', 'Common'];
export const LEVELS = [1, 2, 5, 10, 25, 50, 100];

// Integer arithmetic only, so a boundary value is never decided by rounding.
export function badgeTier(k, n) {
  if (k * 10 > n) return 'Common';
  if (k * 100 > n) return 'Uncommon';
  if (k * 1000 > n) return 'Rare';
  if (k * 10000 > n) return 'Epic';
  if (k * 100000 >= n) return 'Anomaly'; // exactly 0.001% is Anomaly
  return 'Mythic';
}

// c = members scoring >= this score; q = c/n. A pool where everyone ties is Common.
export function rollTier(c, n, allEqual = false) {
  if (allEqual) return 'Common';
  if (c * 100 <= n) return 'Mythic';
  if (c * 20 <= n) return 'Anomaly';
  if (c * 10 <= n) return 'Epic';
  if (c * 4 <= n) return 'Rare';
  if (c * 2 <= n) return 'Uncommon';
  if (c * 100 <= n * 99) return 'Common';
  return 'Low Roll';
}

// Rules marked `deferred` stay in the catalog but never match: their evidence does not exist yet.
export function evaluatePool({ meta, members }, rules = RULES, prepare = prep) {
  const n = members.length;
  const ms = members.map(prepare);
  const hits = ms.map((m) => rules.filter((r) => !r.deferred && r.test(m, meta.publishedAt)).map((r) => r.id));
  const k = Object.fromEntries(rules.map((r) => [r.id, 0]));
  hits.forEach((ids) => ids.forEach((id) => k[id]++));
  const stats = Object.fromEntries(rules.map((r) => [r.id, {
    k: k[r.id], nominal: k[r.id] ? Math.round((100 * n) / k[r.id]) : 0, tier: k[r.id] ? badgeTier(k[r.id], n) : null,
  }]));
  const family = Object.fromEntries(rules.map((r) => [r.id, r.family]));

  const evals = hits.map((ids) => {
    const best = {}; // family -> winning badge id; registry order breaks equal weights
    for (const id of ids) if (!best[family[id]] || stats[id].nominal > stats[best[family[id]]].nominal) best[family[id]] = id;
    const awards = ids.map((id) => ({ id, nominal: stats[id].nominal, rp: best[family[id]] === id ? stats[id].nominal : 0 }));
    return { awards, rp: awards.reduce((s, a) => s + a.rp, 0) };
  });

  const sorted = evals.map((e) => e.rp).sort((a, b) => b - a);
  const atOrAbove = new Map(); // descending order: the last tie overwrites, leaving the count of scores >= s
  sorted.forEach((s, i) => atOrAbove.set(s, i + 1));
  const allEqual = sorted[0] === sorted[n - 1];
  const tierCounts = {};
  for (const e of evals) {
    e.c = atOrAbove.get(e.rp);
    e.tier = rollTier(e.c, n, allEqual);
    tierCounts[e.tier] = (tierCounts[e.tier] || 0) + 1;
  }
  return { meta, n, members: ms, stats, evals, tierCounts, scores: { min: sorted[n - 1], median: sorted[n >> 1], max: sorted[0] } };
}

// Uniform integer in [0, n). Values at or above the largest multiple of n are rejected (no modulo bias).
export function randomIndex(n, next32 = () => crypto.getRandomValues(new Uint32Array(1))[0]) {
  const limit = 2 ** 32 - (2 ** 32 % n);
  let x;
  do x = next32(); while (x >= limit);
  return x % n;
}

export const dayKey = (ms) => new Date(ms).toISOString().slice(0, 10);
export const nextReset = (ms) => { const d = new Date(ms); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1); };
export function weekStartKey(ms) { // Monday 00:00 UTC
  const d = new Date(ms);
  return dayKey(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7)));
}

export const rollId = (pool, day, index) => `${pool}.${day.replaceAll('-', '')}.${index}`;
export function parseRollId(id) {
  const m = /^(v\d+)\.(\d{4})(\d{2})(\d{2})\.(\d{1,9})$/.exec(id || '');
  return m && { pool: m[1], day: `${m[2]}-${m[3]}-${m[4]}`, index: +m[5] };
}

export function level(count) {
  const lv = LEVELS.filter((t) => count >= t).length;
  return { level: lv, next: LEVELS[lv] ?? null };
}

export const fmtPct = (k, n) => {
  const v = (100 * k) / n;
  return v.toLocaleString('en', { maximumSignificantDigits: v < 10 ? 2 : 3 }) + '%';
};
export const fmtNum = (x) => x.toLocaleString('en');
export const oneIn = (k, n) => (n / k < 10 ? String(Number((n / k).toFixed(1))) : fmtNum(Math.round(n / k)));

export function shareText(roll, url, name) {
  const fresh = roll.fresh.length;
  const news = fresh ? `, ${fresh} new badge${fresh === 1 ? '' : 's'}` : '';
  return `${name} daily roll, ${roll.tier}, top ${fmtPct(roll.c, roll.n)} of eligible pool, ${fmtNum(roll.rp)} RP${news}\n${url}`;
}
