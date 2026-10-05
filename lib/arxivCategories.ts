// Field registry for every ingestion source. Homepage pills, search aliases,
// and cron feeds all read from here — not just life sciences.
export const ARXIV_CATEGORY_LABELS: Record<string, string> = {
  cs: "Tech & Computer Science",
  "cs.AI": "AI",
  "cs.LG": "Machine Learning",
  "cs.CL": "Language & NLP",
  "cs.CV": "Computer Vision",
  math: "Mathematics",
  stat: "Statistics",
  eess: "Engineering",
  econ: "Economics",
  "q-fin": "Finance",
  physics: "Physics",
  "astro-ph": "Space & Astrophysics",
  "quant-ph": "Quantum",
  "cond-mat": "Materials",
  "q-bio": "Biology",
  "physics.med-ph": "Medicine",
  "physics.ao-ph": "Climate & Atmosphere",
  "gr-qc": "Gravity & Relativity",
  hep: "Particle Physics",
  nlin: "Complex Systems",
  "math-ph": "Mathematical Physics",
  nucl: "Nuclear",
  // PubMed-sourced topics
  dementia: "Dementia & Alzheimer's",
  obesity: "Obesity & Metabolic Health",
  "population-growth": "Population & Demographics",
  cancer: "Cancer",
  cardiology: "Heart & Circulation",
  "mental-health": "Mental Health",
  "infectious-disease": "Infectious Disease",
  nutrition: "Nutrition",
  "public-health": "Public Health",
};

export function categoryLabel(code: string | null | undefined): string {
  if (!code) return "Other";
  return ARXIV_CATEGORY_LABELS[code] || code;
}

/** All known category codes, in a stable display order. */
export const ARXIV_CATEGORY_CODES = Object.keys(ARXIV_CATEGORY_LABELS);

/**
 * Subset of the codes above that are real arXiv RSS category feeds — used
 * by cron-fetch's default sweep. The PubMed-only topics (dementia, obesity,
 * population-growth) are NOT arXiv categories and must never end up in a
 * request to export.arxiv.org/rss/{code}.
 */
export const ARXIV_FEED_CATEGORIES = [
  "cs",
  "math",
  "stat",
  "eess",
  "econ",
  "q-fin",
  "physics",
  "astro-ph",
  "quant-ph",
  "cond-mat",
  "q-bio",
  "gr-qc",
  "hep-th",
  "hep-ph",
  "nlin",
  "math-ph",
  "nucl-th",
  "cs.AI",
  "cs.LG",
  "cs.CL",
  "cs.CV",
  "physics.med-ph",
  "physics.ao-ph",
];

const ARXIV_FEED_SET = new Set(ARXIV_FEED_CATEGORIES);

/** Env override for cron-fetch. Drops PubMed-only / unknown codes so they never hit arXiv RSS. */
export function arxivFeedCategoriesFromEnv(
  raw: string | null | undefined = process.env.ARXIV_RSS_CATEGORIES
): string[] {
  if (!raw?.trim()) return [...ARXIV_FEED_CATEGORIES];
  const picked = raw
    .split(",")
    .map((c) => c.trim())
    .filter((c) => ARXIV_FEED_SET.has(c));
  return picked.length ? picked : [...ARXIV_FEED_CATEGORIES];
}

/**
 * PubMed search topics — polled by cron-fetch-pubmed, not the arXiv sweep.
 * `topic` is the natural-language PubMed search term; `category` is the
 * slug stored on the article and must match a key in ARXIV_CATEGORY_LABELS
 * above.
 */
export const PUBMED_TOPICS = [
  { topic: "dementia", category: "dementia" },
  { topic: "obesity", category: "obesity" },
  { topic: "population growth", category: "population-growth" },
  { topic: "cancer", category: "cancer" },
  { topic: "cardiovascular disease", category: "cardiology" },
  { topic: "mental health", category: "mental-health" },
  { topic: "infectious disease", category: "infectious-disease" },
  { topic: "nutrition", category: "nutrition" },
  { topic: "public health", category: "public-health" },
];

/** Longest-prefix first so cs.AI stays AI, hep-th becomes Particle Physics, etc. */
const CATEGORY_PREFIX_MAP: [string, string][] = [
  ["physics.med-ph", "physics.med-ph"],
  ["physics.ao-ph", "physics.ao-ph"],
  ["cs.AI", "cs.AI"],
  ["cs.LG", "cs.LG"],
  ["cs.CL", "cs.CL"],
  ["cs.CV", "cs.CV"],
  ["cs.", "cs"],
  ["cs", "cs"],
  ["math-ph", "math-ph"],
  ["math.", "math"],
  ["math", "math"],
  ["stat.", "stat"],
  ["stat", "stat"],
  ["eess.", "eess"],
  ["eess", "eess"],
  ["econ.", "econ"],
  ["econ", "econ"],
  ["q-fin.", "q-fin"],
  ["q-fin", "q-fin"],
  ["q-bio.", "q-bio"],
  ["q-bio", "q-bio"],
  ["astro-ph", "astro-ph"],
  ["quant-ph", "quant-ph"],
  ["cond-mat", "cond-mat"],
  ["physics.", "physics"],
  ["physics", "physics"],
  ["hep-", "hep"],
  ["hep.", "hep"],
  ["nucl-", "nucl"],
  ["nucl.", "nucl"],
  ["gr-qc", "gr-qc"],
  ["nlin", "nlin"],
];

export function normalizeCategory(rawTerm: string | null | undefined): string | null {
  if (!rawTerm) return null;
  const term = rawTerm.trim();
  if (!term) return null;
  if (ARXIV_CATEGORY_LABELS[term]) return term;
  for (const [prefix, field] of CATEGORY_PREFIX_MAP) {
    if (term === prefix || term.startsWith(prefix)) return field;
  }
  return term;
}

/** Everyday search words → field codes, so "tech" surfaces computer-science papers. */
export const SEARCH_FIELD_ALIASES: Record<string, string[]> = {
  tech: ["cs", "cs.AI", "cs.LG", "cs.CL", "cs.CV", "eess"],
  technology: ["cs", "cs.AI", "cs.LG", "eess"],
  computer: ["cs", "cs.AI", "cs.LG", "cs.CL", "cs.CV"],
  computing: ["cs", "eess"],
  software: ["cs"],
  digital: ["cs", "eess"],
  programming: ["cs"],
  engineering: ["eess", "cs"],
  ai: ["cs.AI", "cs.LG"],
  "machine learning": ["cs.LG", "cs.AI", "stat"],
  math: ["math", "stat", "math-ph"],
  mathematics: ["math", "stat"],
  physics: ["physics", "quant-ph", "hep", "gr-qc", "nucl"],
  space: ["astro-ph"],
  astronomy: ["astro-ph"],
  quantum: ["quant-ph"],
  biology: ["q-bio"],
  medicine: ["physics.med-ph", "cancer", "cardiology", "dementia"],
  health: [
    "physics.med-ph",
    "dementia",
    "obesity",
    "cancer",
    "cardiology",
    "mental-health",
    "public-health",
    "nutrition",
    "infectious-disease",
  ],
  climate: ["physics.ao-ph"],
  economics: ["econ"],
  economy: ["econ"],
  finance: ["q-fin", "econ"],
  money: ["q-fin", "econ"],
  materials: ["cond-mat"],
  statistics: ["stat"],
};

/** Extra title/headline words to try when the typed term is a field nickname. */
export const SEARCH_WORD_ALIASES: Record<string, string[]> = {
  tech: [
    "technology",
    "computer",
    "software",
    "algorithm",
    "computing",
    "digital",
    "machine",
    "learning",
    "neural",
  ],
  technology: ["computer", "software", "algorithm", "digital"],
  computer: ["computing", "software", "algorithm", "processor"],
  ai: ["artificial intelligence", "neural", "model", "learning"],
  money: ["market", "price", "trade", "finance", "economic"],
  space: ["star", "galaxy", "planet", "cosmic", "telescope"],
  health: ["patient", "clinical", "disease", "treatment"],
};
