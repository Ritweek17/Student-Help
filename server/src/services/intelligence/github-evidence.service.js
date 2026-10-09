/**
 * CareerOS GitHub Evidence Normalization Service (Phase 11E — V1)
 * 
 * Extracts and normalizes demonstrated skill evidence from GitHub public
 * user profiles and repositories using the canonical skill normalization engine.
 * 
 * Rules:
 * - 100% deterministic and offline-testable.
 * - Uses existing canonical skill normalization infrastructure.
 * - Extracts evidence from primary languages and repository topics.
 * - Filters out forks from primary skill evidence by default.
 * - Safely ignores unsupported / non-technical topics (e.g. "portfolio", "hacktoberfest").
 * - Merges duplicate canonical skills across languages and topics.
 * - Deduplicates repository references per skill.
 * - Enforces deterministic sorting of skills, languages, and repositories.
 */

import { normalizeSkill } from './skill-normalization.service.js';

/**
 * Safely extracts repository reference metadata.
 * 
 * @param {Object} repo - GitHub repository payload
 * @returns {Object} Clean repository reference
 */
function createRepositoryReference(repo) {
  const name = typeof repo.name === 'string' ? repo.name.trim() : 'untitled-repo';
  const url = typeof repo.html_url === 'string'
    ? repo.html_url.trim()
    : typeof repo.url === 'string' ? repo.url.trim() : '';
  const isFork = Boolean(repo.fork);
  const primaryLanguage = typeof repo.language === 'string' && repo.language.trim()
    ? repo.language.trim()
    : null;
  const updatedAt = repo.pushed_at || repo.updated_at || null;

  return {
    name,
    url,
    isFork,
    primaryLanguage,
    updatedAt,
  };
}

/**
 * Extracts and normalizes public GitHub activity into structured skill evidence.
 * 
 * Supports both function signatures:
 * - extractGitHubSkillEvidence(user, repositories, options)
 * - extractGitHubSkillEvidence({ user, repositories }, options)
 * 
 * @param {Object} arg1 - User payload or composite object { user, repositories }
 * @param {Array<Object>|Object} [arg2] - Repositories array or options object
 * @param {Object} [options] - Options
 * @param {boolean} [options.includeForks=false] - Whether to include forked repos in skill detection
 * @param {Date} [options.syncedAt] - Override sync timestamp (for testing)
 * @returns {Object} Structured GitHub evidence descriptor
 */
export function extractGitHubSkillEvidence(arg1, arg2, options = {}) {
  let user = null;
  let rawRepos = [];
  let opts = options;

  if (arg1 && typeof arg1 === 'object' && ('user' in arg1 || 'repositories' in arg1)) {
    user = arg1.user || null;
    rawRepos = Array.isArray(arg1.repositories) ? arg1.repositories : [];
    opts = arg2 && typeof arg2 === 'object' ? arg2 : options;
  } else {
    user = arg1 && typeof arg1 === 'object' ? arg1 : null;
    rawRepos = Array.isArray(arg2) ? arg2 : [];
    opts = options;
  }

  const includeForks = Boolean(opts?.includeForks);
  const syncedAt = opts?.syncedAt instanceof Date ? opts.syncedAt : new Date();

  // 1. Resolve username
  const username = (
    user?.login ||
    user?.username ||
    (rawRepos.find((r) => r?.owner?.login)?.owner?.login) ||
    ''
  ).trim();

  // 2. Filter valid repositories
  const validRepos = rawRepos.filter((repo) => {
    return repo && typeof repo === 'object' && typeof repo.name === 'string' && repo.name.trim();
  });

  // Public repository count (prefer user's stated count, fallback to valid non-fork count)
  const publicRepoCount = typeof user?.public_repos === 'number'
    ? user.public_repos
    : validRepos.filter((r) => !r.fork).length;

  // 3. Track language frequencies for topLanguages
  const languageFrequencyMap = new Map();

  // 4. Track canonical skill evidence
  // Map<canonicalKey, { canonicalKey, displayName, category, repoCount, repoMap: Map<repoKey, repoRef> }>
  const detectedSkillsMap = new Map();

  for (const repo of validRepos) {
    const isFork = Boolean(repo.fork);

    // Track primary language frequency for non-forks (or all if includeForks)
    if (!isFork || includeForks) {
      if (typeof repo.language === 'string' && repo.language.trim()) {
        const langStr = repo.language.trim();
        languageFrequencyMap.set(langStr, (languageFrequencyMap.get(langStr) || 0) + 1);
      }
    }

    // Forks are ignored for primary skill evidence detection unless explicitly requested
    if (isFork && !includeForks) {
      continue;
    }

    const repoRef = createRepositoryReference(repo);
    // Unique key to deduplicate repository reference within the same skill
    const repoIdentifier = repoRef.url || repoRef.name;

    // Collect distinct candidate skill descriptors for THIS repository
    const repoSkillCandidates = new Map();

    // Source A: Primary Language
    if (typeof repo.language === 'string' && repo.language.trim()) {
      const normalizedLang = normalizeSkill(repo.language);
      // Languages in GitHub are considered valid technical skills
      if (normalizedLang && (normalizedLang.isRecognized || normalizedLang.canonicalKey)) {
        repoSkillCandidates.set(normalizedLang.canonicalKey, normalizedLang);
      }
    }

    // Source B: Repository Topics
    if (Array.isArray(repo.topics)) {
      for (const topic of repo.topics) {
        if (typeof topic !== 'string' || !topic.trim()) continue;
        const normalizedTopic = normalizeSkill(topic);
        // Only accept recognized canonical skills to filter out non-technical noise (e.g. "portfolio")
        if (normalizedTopic && normalizedTopic.isRecognized) {
          if (!repoSkillCandidates.has(normalizedTopic.canonicalKey)) {
            repoSkillCandidates.set(normalizedTopic.canonicalKey, normalizedTopic);
          }
        }
      }
    }

    // Merge detected skills for this repository into the overall skills map
    for (const [canonicalKey, skillInfo] of repoSkillCandidates.entries()) {
      let entry = detectedSkillsMap.get(canonicalKey);
      if (!entry) {
        entry = {
          canonicalKey,
          displayName: skillInfo.displayName,
          category: skillInfo.category,
          repoCount: 0,
          repoMap: new Map(),
        };
        detectedSkillsMap.set(canonicalKey, entry);
      }

      // Add repo reference (deduplicated by repoIdentifier)
      if (!entry.repoMap.has(repoIdentifier)) {
        entry.repoMap.set(repoIdentifier, repoRef);
      }
    }
  }

  // 5. Deterministically assemble topLanguages
  const topLanguages = Array.from(languageFrequencyMap.entries())
    .sort((a, b) => {
      // 1. Frequency descending
      if (b[1] !== a[1]) return b[1] - a[1];
      // 2. Alphabetical ascending
      return a[0].localeCompare(b[0]);
    })
    .map(([lang]) => lang);

  // 6. Deterministically assemble and sort detectedSkills
  const detectedSkills = Array.from(detectedSkillsMap.values())
    .map((entry) => {
      // Sort repositories within this skill:
      // 1. updatedAt descending (nulls last)
      // 2. name ascending
      const repos = Array.from(entry.repoMap.values()).sort((a, b) => {
        const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        if (timeB !== timeA) return timeB - timeA;
        return a.name.localeCompare(b.name);
      });

      return {
        canonicalKey: entry.canonicalKey,
        displayName: entry.displayName,
        category: entry.category,
        repoCount: repos.length,
        repositories: repos,
      };
    })
    .sort((a, b) => {
      // 1. repoCount descending
      if (b.repoCount !== a.repoCount) return b.repoCount - a.repoCount;
      // 2. canonicalKey ascending
      return a.canonicalKey.localeCompare(b.canonicalKey);
    });

  return {
    username,
    syncedAt,
    publicRepoCount,
    topLanguages,
    detectedSkills,
  };
}

/**
 * Convenient alias for extractGitHubSkillEvidence.
 */
export const buildGitHubEvidence = extractGitHubSkillEvidence;
