// Everything specific to SpeciesRNG: names, copy, card art, and which facts the result card shows. app.js is generic.
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmt = (n) => n.toLocaleString('en');
const band = (x, cuts) => cuts.find(([max]) => x < max)[1];
const unknown = 'not in Wikidata';
const DIAL = ['Least Concern', 'Near Threatened', 'Vulnerable', 'Endangered', 'Critically Endangered', 'Extinct In The Wild', 'Extinct'];
const DIAL_COLORS = ['#3fa34d', '#9bc23a', '#e0c030', '#f08a24', '#d83a2a', '#8a2a6a', '#222222'];

export default {
  key: 'speciesrng',
  name: 'SpeciesRNG',
  pageTitle: 'SpeciesRNG: a daily species discovery game',
  noun: 'species', nouns: 'species', thing: 'Species',
  worldNote: 'every species on Earth',
  repo: 'https://github.com/sharkjujg/speciesrng',
  headline: 'Discover a species. Once a day.',
  intro: (n) => `Roll once to draw one species from a pool of <b>${fmt(n)}</b> that carry a conservation status. Every species has the same 1-in-${fmt(n)} chance, famous or obscure. Badges explain what is unusual about it, and rarer badges earn more rarity points (RP). The daily limit resets at 00:00 UTC.`,
  notice: 'Prototype: the species facts are real (from Wikidata), but there are no photos or accounts yet, and your results are saved only in this browser. A conservation status is a record, not a prediction. <a href="#/about">What that means</a>',
  header: (m) => ({ title: m.name, sub: `${m.sci} · ${m.status}` }),
  label: (m) => m.name,
  shelves: (m) => [
    ['Kingdom', m.kingdom], ['Status', m.status],
    ...(m.phylum ? [['Phylum', m.phylum]] : []), ...(m.class ? [['Class', m.class]] : []), ...(m.order ? [['Order', m.order]] : []),
    ...(m.family ? [['Family', m.family]] : []), ...(m.genus ? [['Genus', m.genus]] : []),
    ['Name starts with', (m.name.trim()[0] || '?').toUpperCase()],
    ['Wikipedia coverage', band(m.links, [[40, '30 to 39 editions'], [60, '40 to 59 editions'], [100, '60 to 99 editions'], [Infinity, '100 or more editions']])],
  ],
  facts: (m) => [
    ['Scientific name', m.sci], ['Conservation status', m.status], ['Kingdom', m.kingdom], ['Phylum', m.phylum || unknown], ['Class', m.class || unknown],
    ['Order', m.order || unknown], ['Family', m.family || unknown], ['Genus', m.genus || unknown], ['Wikimedia pages about it', String(m.links)],
    ['Source', `Wikidata ${m.id}`, `https://www.wikidata.org/wiki/${m.id}`],
  ],
  art(m) { // original conservation dial: the lit segment is the species' recorded category; it never affects scoring and is not a photograph
    const st = DIAL.indexOf(m.status), seg = DIAL.length, a0 = -Math.PI / 2;
    const arcs = DIAL.map((_, i) => {
      const s = a0 + (i / seg) * Math.PI * 2 + 0.05, e = a0 + ((i + 1) / seg) * Math.PI * 2 - 0.05, R = 38, r = 24;
      const p = (rad, a) => `${(50 + rad * Math.cos(a)).toFixed(2)} ${(50 + rad * Math.sin(a)).toFixed(2)}`;
      return `<path d="M${p(R, s)} A${R} ${R} 0 0 1 ${p(R, e)} L${p(r, e)} A${r} ${r} 0 0 0 ${p(r, s)} Z" fill="${DIAL_COLORS[i]}" opacity="${i === st ? 1 : 0.28}"${i === st ? ' stroke="#fff" stroke-width="1.4"' : ''}/>`;
    }).join('');
    const label = esc((m.class || m.kingdom).slice(0, 14));
    return `<svg class="avatar" viewBox="0 0 100 100" role="img" aria-label="Generated conservation dial for the species: ${esc(m.status)}. Not a photograph.">
      <rect width="100" height="100" rx="8" fill="#101a14"/>${arcs}
      <text x="50" y="52" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="700" font-size="7" fill="#e6f2e8">${label}</text>
      <text x="50" y="94" text-anchor="middle" font-family="system-ui,sans-serif" font-size="5.5" letter-spacing=".6" fill="#8fa896">GENERATED DIAL</text></svg>`;
  },
  poolNotice: 'Every species comes from <a href="https://www.wikidata.org">Wikidata</a>, whose data is released under CC0, as a snapshot: species with exactly one recorded IUCN conservation category, one scientific name and one English label, covered by many Wikipedia editions. No photographs are shown. The pool leans toward famous animals, so its odds describe this pool, not life on Earth. A status here is what Wikidata records, which may lag the current IUCN Red List.',
  poolExtra(pool) {
    const tally = (get) => { const c = new Map(); for (const m of pool.members) for (const v of get(m)) c.set(v, (c.get(v) || 0) + 1); return [...c]; };
    const table = (title, rows) => `<table><thead><tr><th>${title}</th><th class="n">Species</th></tr></thead><tbody>${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="n">${fmt(v)}</td></tr>`).join('')}</tbody></table>`;
    const top = (rows, k) => rows.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, k);
    return `<h2>What is in the pool</h2><p class="small muted">Disclosed because a badge is only rare relative to this mix.</p>
      ${table('Status', top(tally((m) => [m.status]), 8))}${table('Class', top(tally((m) => (m.class ? [m.class] : [m.kingdom])), 10))}`;
  },
  aboutData: `<h2>Where the facts come from</h2>
    <p>Common name, scientific name, conservation status, taxonomy (genus, family, order, class, phylum, kingdom) and the number of Wikimedia pages come from <a href="https://www.wikidata.org">Wikidata</a>, whose data is released under CC0, fetched once as a snapshot. A species appears only when Wikidata gives it exactly one conservation category, name and label, so conflicting records are left out. The taxonomy is read by following Wikidata's parent-taxon links, so a missing link leaves that rank unknown, never guessed. "Latin Only" means Wikidata has no separate common name. The artwork is a generated dial, not a photograph, and a status is a record of an assessment, not a forecast.</p>`,
  terms: 'It is not affiliated with Wikimedia or the IUCN. Badges describe catalog facts, not how much a species matters.',
};
