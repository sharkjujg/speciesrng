// SpeciesRNG badge rules. Each rule is a deterministic predicate over known fields: a value Wikidata does not have never matches.
// test(m, poolDate) and evidence(m, poolDate) read the prepared member from prep().

export const norm = (s) => s.normalize('NFKC').toLowerCase();

const text = (x) => (typeof x === 'string' && x.trim() ? x.trim() : null);
const tokens = (s) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
const chars = (s) => Array.from(s);

export function prep(raw) {
  const name = text(raw.name), sci = text(raw.sci);
  return {
    ...raw,
    n: name ? norm(name) : null, s: sci ? norm(sci) : null,
    st: text(raw.status) ? norm(raw.status) : null, // IUCN category, normalized
    cls: text(raw.class) ? norm(raw.class) : null, kingdomN: text(raw.kingdom) ? norm(raw.kingdom) : null,
    linksN: Number.isInteger(raw.links) && raw.links > 0 ? raw.links : null,
  };
}

const COLORS = /\b(red|blue|green|yellow|black|white|golden|gold|silver|pink|purple|orange|brown|grey|gray|scarlet|crimson|violet)\b/;
const status = (label) => (m) => m.st === label;
const sstat = (m) => `${m.name} is listed as ${m.status.toLowerCase()}`;
const cls = (label) => (m) => m.cls === label;
const FISH = new Set(['actinopterygii', 'actinopteri', 'teleostei']); // Wikidata files most bony fish under a child clade it ranks as a class
const sclass = (m) => `${m.name} is in the class ${m.class}`;
const nameOf = (m) => `"${m.name}" (${m.sci})`;

export const RULES = [
  { id: 'least-concern', name: 'Least Concern', family: 'Status', rule: 'IUCN category Least Concern', test: status('least concern'), evidence: sstat },
  { id: 'near-threatened', name: 'Near Threatened', family: 'Status', rule: 'IUCN category Near Threatened', test: status('near threatened'), evidence: sstat },
  { id: 'vulnerable', name: 'Vulnerable', family: 'Status', rule: 'IUCN category Vulnerable', test: status('vulnerable'), evidence: sstat },
  { id: 'endangered', name: 'Endangered', family: 'Status', rule: 'IUCN category Endangered', test: status('endangered'), evidence: sstat },
  { id: 'critically-endangered', name: 'Critically Endangered', family: 'Status', rule: 'IUCN category Critically Endangered', test: status('critically endangered'), evidence: sstat },
  { id: 'extinct-in-the-wild', name: 'Extinct in the Wild', family: 'Status', rule: 'IUCN category Extinct in the Wild', test: status('extinct in the wild'), evidence: sstat },
  { id: 'extinct', name: 'Extinct', family: 'Status', rule: 'IUCN category Extinct', test: status('extinct'), evidence: sstat },
  { id: 'data-deficient', name: 'Data Deficient', family: 'Status', rule: 'IUCN category Data Deficient', test: status('data deficient'), evidence: sstat },
  { id: 'mammal', name: 'Mammal', family: 'Class', rule: 'Class Mammalia', test: cls('mammalia'), evidence: sclass },
  { id: 'bird', name: 'Bird', family: 'Class', rule: 'Class Aves', test: cls('aves'), evidence: sclass },
  { id: 'reptile', name: 'Reptile', family: 'Class', rule: 'Class Reptilia', test: cls('reptilia'), evidence: sclass },
  { id: 'amphibian', name: 'Amphibian', family: 'Class', rule: 'Class Amphibia', test: cls('amphibia'), evidence: sclass },
  { id: 'fish', name: 'Ray-Finned Fish', family: 'Class', rule: 'Class Actinopterygii', test: (m) => FISH.has(m.cls), evidence: sclass },
  { id: 'shark-or-ray', name: 'Shark or Ray', family: 'Class', rule: 'Class Chondrichthyes', test: cls('chondrichthyes'), evidence: sclass },
  { id: 'insect', name: 'Insect', family: 'Class', rule: 'Class Insecta', test: cls('insecta'), evidence: sclass },
  { id: 'plant', name: 'Plant', family: 'Class', rule: 'Kingdom Plantae', test: (m) => m.kingdomN === 'plantae', evidence: (m) => `${m.name} is a plant` },
  { id: 'tautonym', name: 'Tautonym', family: 'Latin name', rule: 'Genus and species name are the same word (like Gorilla gorilla)',
    test: (m) => { const w = m.s === null ? [] : tokens(m.s); return w.length === 2 && w[0] === w[1]; }, evidence: (m) => `${m.sci} repeats its genus name` },
  { id: 'long-latin-name', name: 'Long Latin Name', family: 'Latin name', rule: 'Scientific name of 24 characters or more', test: (m) => m.s !== null && chars(m.s).length >= 24, evidence: (m) => `${m.sci} has ${chars(m.s).length} characters` },
  { id: 'latin-only', name: 'Latin Only', family: 'Common name', rule: 'The English label is just the scientific name (no common name recorded)', test: (m) => m.n !== null && m.n === m.s, evidence: (m) => `${m.sci} has no recorded common name` },
  { id: 'one-word-name', name: 'One-Word Name', family: 'Common name', rule: 'A common name of a single word', test: (m) => m.n !== null && m.n !== m.s && tokens(m.n).length === 1, evidence: nameOf },
  { id: 'hyphenated-name', name: 'Hyphenated Name', family: 'Common name', rule: 'A common name containing a hyphen', test: (m) => m.n !== null && m.n !== m.s && m.n.includes('-'), evidence: nameOf },
  { id: 'long-common-name', name: 'Long Common Name', family: 'Common name', rule: 'A common name of four or more words', test: (m) => m.n !== null && m.n !== m.s && tokens(m.n).length >= 4, evidence: nameOf },
  { id: 'colorful-name', name: 'Colorful Name', family: 'Color word', rule: 'The common name contains a color word', test: (m) => m.n !== null && m.n !== m.s && COLORS.test(m.n), evidence: nameOf },
  { id: 'giant-name', name: 'Giant Name', family: 'Size word', rule: 'The common name contains giant, great, king or emperor', test: (m) => m.n !== null && m.n !== m.s && /\b(giant|great|king|emperor)\b/.test(m.n), evidence: nameOf },
  { id: 'tiny-name', name: 'Tiny Name', family: 'Size word', rule: 'The common name contains pygmy, dwarf, least, little or lesser', test: (m) => m.n !== null && m.n !== m.s && /\b(pygmy|dwarf|least|little|lesser)\b/.test(m.n), evidence: nameOf },
  { id: 'alliterative-name', name: 'Alliterative Name', family: 'Wordplay', rule: 'The first two words of the common name start with the same letter',
    test: (m) => { if (m.n === null || m.n === m.s) return false; const w = tokens(m.n); return w.length >= 2 && w[0][0] === w[1][0]; }, evidence: nameOf },
  { id: 'vowel-start', name: 'Vowel Start', family: 'Name start', rule: 'The common name starts with A, E, I, O or U', test: (m) => m.n !== null && m.n !== m.s && /^[aeiou]/.test(m.n), evidence: nameOf },
  { id: 'well-known', name: 'Well Known', family: 'Fame', rule: 'Covered by 60 or more Wikimedia pages (a measure of attention, not importance)', test: (m) => m.linksN !== null && m.linksN >= 60, evidence: (m) => `${m.name} has ${m.linksN} Wikimedia pages` },
  { id: 'everywhere', name: 'Everywhere', family: 'Fame', rule: 'Covered by 100 or more Wikimedia pages', test: (m) => m.linksN !== null && m.linksN >= 100, evidence: (m) => `${m.name} has ${m.linksN} Wikimedia pages` },
];
