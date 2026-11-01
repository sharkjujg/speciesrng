// SpeciesRNG fixtures for check.html: one row per case, [rule id, field overrides, expected match].
export const V = '2026-11-01';
export const base = { id: 'Q1', name: 'Sample Fox', sci: 'Vulpes exempli', status: 'Least Concern', kingdom: 'Animalia', phylum: 'Chordata', class: 'Mammalia',
  order: 'Carnivora', family: 'Canidae', genus: 'Vulpes', links: 40 };

const statuses = [['least-concern', 'Least Concern'], ['near-threatened', 'Near Threatened'], ['vulnerable', 'Vulnerable'], ['endangered', 'Endangered'],
  ['critically-endangered', 'Critically Endangered'], ['extinct-in-the-wild', 'Extinct In The Wild'], ['extinct', 'Extinct'], ['data-deficient', 'Data Deficient']];
const classes = [['mammal', 'Mammalia'], ['bird', 'Aves'], ['reptile', 'Reptilia'], ['amphibian', 'Amphibia'], ['fish', 'Actinopterygii'], ['shark-or-ray', 'Chondrichthyes'], ['insect', 'Insecta']];

export const cases = [
  ...statuses.flatMap(([id, label]) => [[id, { status: label }, true], [id, { status: 'Something Else' }, false], [id, { status: null }, false]]),
  ['extinct', { status: 'Extinct In The Wild' }, false], ['endangered', { status: 'Critically Endangered' }, false], // exact category only
  ...classes.flatMap(([id, label]) => [[id, { class: label }, true], [id, { class: 'Other' }, false], [id, { class: null }, false]]),
  ['mammal', { class: 'mammalia' }, true], ['fish', { class: 'Actinopteri' }, true], ['fish', { class: 'Teleostei' }, true], ['fish', { class: 'Amphibia' }, false],
  ['plant', { kingdom: 'Plantae', class: null }, true], ['plant', { kingdom: 'Animalia' }, false], ['plant', { kingdom: null }, false],
  ['tautonym', { sci: 'Gorilla gorilla' }, true], ['tautonym', { sci: 'Gorilla beringei' }, false], ['tautonym', { sci: 'Gorilla gorilla gorilla' }, false], ['tautonym', { sci: null }, false],
  ['long-latin-name', { sci: 'a'.repeat(24) }, true], ['long-latin-name', { sci: 'a'.repeat(23) }, false],
  ['latin-only', { name: 'Vulpes exempli' }, true], ['latin-only', { name: 'VULPES EXEMPLI' }, true], ['latin-only', { name: 'Sample Fox' }, false], ['latin-only', { name: undefined }, false],
  ['one-word-name', { name: 'Aardvark' }, true], ['one-word-name', { name: 'Sample Fox' }, false], ['one-word-name', { name: 'Vulpes exempli' }, false],
  ['hyphenated-name', { name: 'Red-bellied lemur' }, true], ['hyphenated-name', { name: 'Red lemur' }, false],
  ['long-common-name', { name: 'one two three four' }, true], ['long-common-name', { name: 'one two three' }, false],
  ['colorful-name', { name: 'Red fox' }, true], ['colorful-name', { name: 'Redwood sorrel' }, false], ['colorful-name', { name: 'Arctic fox' }, false],
  ['giant-name', { name: 'Giant panda' }, true], ['giant-name', { name: 'King cobra' }, true], ['giant-name', { name: 'Kingfisher' }, false], ['giant-name', { name: 'Red fox' }, false],
  ['tiny-name', { name: 'Pygmy hippopotamus' }, true], ['tiny-name', { name: 'Lesser panda' }, true], ['tiny-name', { name: 'Littlefoot' }, false],
  ['alliterative-name', { name: 'Red ruffed lemur' }, true], ['alliterative-name', { name: 'Red fox' }, false], ['alliterative-name', { name: 'Fox' }, false], ['alliterative-name', { name: 'Vulpes exempli' }, false],
  ['vowel-start', { name: 'Emperor penguin' }, true], ['vowel-start', { name: 'Red fox' }, false], ['vowel-start', { name: 'Vulpes exempli' }, false],
  ['well-known', { links: 60 }, true], ['well-known', { links: 59 }, false], ['well-known', { links: null }, false], ['well-known', { links: 0 }, false],
  ['everywhere', { links: 100 }, true], ['everywhere', { links: 99 }, false],
];

export function poolChecks(raw, pool, ok) {
  const ms = raw.members;
  const STATUS = new Set(statuses.map(([, l]) => l));
  ok('species ids look like Wikidata items and ascend', ms.every((m, i) => /^Q[1-9]\d*$/.test(m.id) && (i === 0 || +m.id.slice(1) > +ms[i - 1].id.slice(1))));
  ok('every species has a name, a two-part scientific name, a known status and a kingdom', ms.every((m) => m.name && /^\S+ \S+/.test(m.sci) && STATUS.has(m.status) && m.kingdom));
  ok('every species has a class or a phylum resolved', ms.every((m) => m.class || m.phylum));
  ok('Wikimedia page counts are at least the selection threshold', ms.every((m) => m.links >= raw.meta.sitelinkThreshold));
  ok('names are not empty or Wikidata item numbers', ms.every((m) => !/^Q\d+$/.test(m.name)));
  ok('the pool is large enough to be a game (>= 1000)', pool.n >= 1000);
}
