import { CANONICAL_SKILLS, SKILL_CATEGORIES } from './canonical-skills.data.js';

/**
 * Fast lookup maps initialized once at module load time.
 */
const CANONICAL_BY_KEY = new Map();
const ALIAS_TO_CANONICAL = new Map();

for (const skill of CANONICAL_SKILLS) {
  CANONICAL_BY_KEY.set(skill.canonicalKey, skill);
  ALIAS_TO_CANONICAL.set(skill.canonicalKey, skill);

  if (Array.isArray(skill.aliases)) {
    for (const alias of skill.aliases) {
      const cleanAlias = alias.trim().toLowerCase();
      if (cleanAlias && !ALIAS_TO_CANONICAL.has(cleanAlias)) {
        ALIAS_TO_CANONICAL.set(cleanAlias, skill);
      }
    }
  }
}

/**
 * Skill proficiency level rank hierarchy for conflict resolution.
 */
const LEVEL_RANKS = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  expert: 4,
};

/**
 * Cleans a raw input string into a normalized lookup candidate.
 * Preserves essential technical characters (+, #, ., /) while
 * stripping extraneous punctuation, bullets, and noise.
 * 
 * @param {string} raw - Raw input string
 * @returns {string} Cleaned lowercased string
 */
export function cleanRawSkillString(raw) {
  if (typeof raw !== 'string') return '';

  let cleaned = raw.trim();
  if (!cleaned) return '';

  // Strip leading list numbering like "1. " or "1) "
  cleaned = cleaned.replace(/^\d+[\.\)]\s*/, '');

  // Strip leading bullets, dashes, asterisks, colons
  cleaned = cleaned.replace(/^[•\-\*,\:]+\s*/, '');
  cleaned = cleaned.replace(/^\.\s+/, '');
  cleaned = cleaned.replace(/^["'`]+|["'`]+$/g, '');

  // Strip trailing punctuation noise (commas, semicolons, colons)
  cleaned = cleaned.replace(/[\s,;:]+$/, '');

  // Collapse multiple whitespace
  cleaned = cleaned.replace(/\s+/g, ' ');

  return cleaned.trim().toLowerCase();
}

/**
 * Derives a human-readable display name for an unrecognized/fallback skill.
 * 
 * @param {string} rawCleaned - Cleaned string
 * @returns {string} Formatted display name
 */
function deriveFallbackDisplayName(rawCleaned) {
  if (!rawCleaned) return '';

  // If very short (<= 3 chars, e.g. "aws", "gcp", "sql"), uppercase it
  if (rawCleaned.length <= 3 && !rawCleaned.includes('.')) {
    return rawCleaned.toUpperCase();
  }

  // Title Case each word
  return rawCleaned
    .split(' ')
    .map((word) => {
      if (!word) return '';
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Resolves a raw skill string to its canonical skill identity.
 * 
 * @param {string} rawInput - Raw skill string (e.g. "ReactJS", "Node.js", "C++")
 * @returns {Object|null} Canonical resolution result or null if invalid
 */
export function resolveSkillAlias(rawInput) {
  const cleaned = cleanRawSkillString(rawInput);
  if (!cleaned) return null;

  // 1. Direct alias / canonical lookup
  let matched = ALIAS_TO_CANONICAL.get(cleaned);

  // 2. Secondary heuristic lookups if no direct match:
  if (!matched) {
    // Try without dots: e.g. "node.js" -> "nodejs", "next.js" -> "nextjs"
    const withoutDots = cleaned.replace(/\./g, '');
    if (withoutDots !== cleaned) {
      matched = ALIAS_TO_CANONICAL.get(withoutDots);
    }
  }

  if (!matched) {
    // Try replacing hyphens with space: e.g. "tailwind-css" -> "tailwind css"
    const withSpaces = cleaned.replace(/-/g, ' ');
    if (withSpaces !== cleaned) {
      matched = ALIAS_TO_CANONICAL.get(withSpaces);
    }
  }

  if (matched) {
    return {
      canonicalKey: matched.canonicalKey,
      displayName: matched.displayName,
      category: matched.category,
      isRecognized: true,
    };
  }

  // 3. Fallback for unrecognized or emerging technologies (no data loss)
  return {
    canonicalKey: cleaned,
    displayName: deriveFallbackDisplayName(cleaned),
    category: SKILL_CATEGORIES.OTHER,
    isRecognized: false,
  };
}

/**
 * Normalizes a single skill entity (string or { name, level } object).
 * 
 * @param {string|Object} input - Raw string or skill subdocument object
 * @returns {Object|null} Normalized skill descriptor or null if invalid
 */
export function normalizeSkill(input) {
  if (!input) return null;

  let rawString = '';
  let level = undefined;

  if (typeof input === 'string') {
    rawString = input;
  } else if (typeof input === 'object' && input !== null) {
    rawString = input.name || input.title || input.skill || '';
    if (typeof input.level === 'string') {
      const lvl = input.level.toLowerCase().trim();
      if (LEVEL_RANKS[lvl]) {
        level = lvl;
      }
    }
  }

  const resolved = resolveSkillAlias(rawString);
  if (!resolved) return null;

  return {
    raw: input,
    canonicalKey: resolved.canonicalKey,
    displayName: resolved.displayName,
    category: resolved.category,
    isRecognized: resolved.isRecognized,
    ...(level ? { level } : {}),
  };
}

/**
 * Normalizes an array of skills, safely deduplicating by canonicalKey.
 * If duplicate skills occur with different levels, the highest level is preserved.
 * 
 * @param {Array<string|Object>} inputs - Array of raw skills or skill objects
 * @param {Object} [options] - Options
 * @param {boolean} [options.asKeysOnly=false] - Return array of canonical key strings
 * @returns {Array<Object>|Array<string>} Normalized skills
 */
export function normalizeSkills(inputs, options = {}) {
  if (!Array.isArray(inputs)) return [];

  const canonicalMap = new Map();

  for (const item of inputs) {
    const normalized = normalizeSkill(item);
    if (!normalized) continue;

    const key = normalized.canonicalKey;

    if (!canonicalMap.has(key)) {
      canonicalMap.set(key, normalized);
    } else {
      // Conflict resolution: keep the higher proficiency level if present
      const existing = canonicalMap.get(key);
      const existingRank = existing.level ? LEVEL_RANKS[existing.level] || 0 : 0;
      const newRank = normalized.level ? LEVEL_RANKS[normalized.level] || 0 : 0;

      if (newRank > existingRank) {
        canonicalMap.set(key, normalized);
      }
    }
  }

  const uniqueList = Array.from(canonicalMap.values());

  if (options.asKeysOnly) {
    return uniqueList.map((item) => item.canonicalKey);
  }

  return uniqueList;
}

/**
 * Extracts a unique array of lowercase canonical keys from any skill inputs.
 * 
 * @param {Array<string|Object>} inputs - Array of skills
 * @returns {Array<string>} Array of unique canonical key strings
 */
export function extractCanonicalKeys(inputs) {
  return normalizeSkills(inputs, { asKeysOnly: true });
}

/**
 * Compares two skills for canonical equivalence.
 * 
 * @param {string|Object} skillA - First skill
 * @param {string|Object} skillB - Second skill
 * @returns {boolean} True if both resolve to the identical canonical key
 */
export function compareSkills(skillA, skillB) {
  const normA = normalizeSkill(skillA);
  const normB = normalizeSkill(skillB);

  if (!normA || !normB) return false;
  return normA.canonicalKey === normB.canonicalKey;
}

/**
 * Retrieves a canonical skill specification from the dictionary if known.
 * 
 * @param {string} canonicalKey - Canonical key (e.g. "react")
 * @returns {Object|null} Canonical skill specification or null
 */
export function getCanonicalSkill(canonicalKey) {
  if (typeof canonicalKey !== 'string') return null;
  return CANONICAL_BY_KEY.get(canonicalKey.toLowerCase().trim()) || null;
}

/**
 * Checks if a raw string resolves to a known dictionary skill.
 * 
 * @param {string} rawInput - Raw input string
 * @returns {boolean} True if recognized in canonical dictionary
 */
export function isKnownSkill(rawInput) {
  const resolved = resolveSkillAlias(rawInput);
  return Boolean(resolved && resolved.isRecognized);
}

/**
 * Normalizes Profile skills into a clean canonical structure.
 * Compatible with Profile.skills schema: array of { name, level }.
 * 
 * @param {Array<Object>} profileSkills - Existing profile skills array
 * @returns {Array<Object>} Normalized profile skills array
 */
export function normalizeProfileSkills(profileSkills) {
  if (!Array.isArray(profileSkills)) return [];

  const normalized = normalizeSkills(profileSkills);
  return normalized.map((item) => ({
    name: item.canonicalKey,
    level: item.level || 'intermediate',
    displayName: item.displayName,
    category: item.category,
  }));
}

/**
 * Normalizes project technology tags from Profile projects.
 * 
 * @param {Array<string>} technologies - Array of technology strings
 * @returns {Array<Object>} Normalized technology descriptors
 */
export function normalizeProjectTechnologies(technologies) {
  if (!Array.isArray(technologies)) return [];
  return normalizeSkills(technologies);
}

/**
 * Normalizes Opportunity skills into canonical representations.
 * 
 * @param {Array<string>} oppSkills - Opportunity skills array
 * @returns {Array<Object>} Normalized opportunity skill descriptors
 */
export function normalizeOpportunitySkills(oppSkills) {
  if (!Array.isArray(oppSkills)) return [];
  return normalizeSkills(oppSkills);
}

/**
 * Derives comprehensive canonical skills from a Profile document,
 * combining claimed profile skills and demonstrated project technologies.
 * 
 * @param {Object} profile - Profile Mongoose document or plain object
 * @returns {Array<Object>} Unique canonical skill descriptors
 */
export function getProfileCanonicalSkills(profile) {
  if (!profile) return [];
  const claimedSkills = Array.isArray(profile.skills) ? profile.skills : [];
  const projectTech = [];

  if (Array.isArray(profile.projects)) {
    for (const proj of profile.projects) {
      if (Array.isArray(proj?.technologies)) {
        projectTech.push(...proj.technologies);
      }
    }
  }

  return normalizeSkills([...claimedSkills, ...projectTech]);
}

/**
 * Categorizes a profile's skills into Claimed vs Demonstrated evidence.
 * 
 * @param {Object} profile - Profile document or object
 * @returns {Object} { claimed: Array, demonstrated: Array, all: Array }
 */
export function getProfileSkillEvidence(profile) {
  if (!profile) {
    return { claimed: [], demonstrated: [], all: [] };
  }

  const claimed = normalizeSkills(profile.skills || []);
  const projectTech = [];

  if (Array.isArray(profile.projects)) {
    for (const proj of profile.projects) {
      if (Array.isArray(proj?.technologies)) {
        projectTech.push(...proj.technologies);
      }
    }
  }

  const demonstrated = normalizeSkills(projectTech);
  const demonstratedKeySet = new Set(demonstrated.map((d) => d.canonicalKey));

  const all = normalizeSkills([...(profile.skills || []), ...projectTech]).map((item) => ({
    ...item,
    isClaimed: (profile.skills || []).some((s) => compareSkills(s, item.canonicalKey)),
    isDemonstrated: demonstratedKeySet.has(item.canonicalKey),
  }));

  return { claimed, demonstrated, all };
}
