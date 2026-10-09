import mongoose from 'mongoose';
import { CANONICAL_SKILLS } from './canonical-skills.data.js';
import {
  cleanRawSkillString,
  resolveSkillAlias,
  normalizeSkills,
  normalizeSkill,
  extractCanonicalKeys,
  compareSkills,
} from './skill-normalization.service.js';
import { getOpportunityById } from '../opportunity.service.js';
import { getProfileForUser } from '../profile.service.js';

/**
 * Fit score band boundaries and labels.
 */
export const FIT_BANDS = [
  { min: 85, max: 100, label: 'Excellent Fit' },
  { min: 70, max: 84, label: 'Strong Fit' },
  { min: 50, max: 69, label: 'Good Fit' },
  { min: 30, max: 49, label: 'Partial Fit' },
  { min: 0, max: 29, label: 'Low Fit' },
];

/**
 * Resolves a numerical score (0-100) to its human-readable fit level.
 * 
 * @param {number} score - Bounded score
 * @returns {string} Fit level label
 */
export function getFitLevel(score) {
  const bounded = Math.max(0, Math.min(100, Math.round(score)));
  for (const band of FIT_BANDS) {
    if (bounded >= band.min && bounded <= band.max) {
      return band.label;
    }
  }
  return 'Low Fit';
}

/**
 * Escapes regex special characters.
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Deterministically selects the best repository from a list of repositories.
 * 
 * Hierarchy:
 * 1. Non-forks before forks (original projects are prioritized over forks)
 * 2. Most recently updated first (freshest activity)
 * 3. Alphabetical tie-breaking by name (deterministic stability)
 * 
 * @param {Array<Object>} repositories
 * @returns {Object|null}
 */
export function selectBestRepository(repositories) {
  if (!Array.isArray(repositories) || repositories.length === 0) {
    return null;
  }

  const sorted = [...repositories].sort((a, b) => {
    // 1. Non-fork first
    const aFork = Boolean(a.isFork);
    const bFork = Boolean(b.isFork);
    if (aFork !== bFork) {
      return aFork ? 1 : -1;
    }

    // 2. Most recently updated
    const aDate = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const bDate = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    if (bDate !== aDate) {
      return bDate - aDate;
    }

    // 3. Name alphabetically
    const aName = a.name || '';
    const bName = b.name || '';
    return aName.localeCompare(bName);
  });

  return sorted[0];
}

/**
 * Deterministically scans freeform text (e.g. description) using the canonical
 * skill dictionary. Uses strict word boundaries to avoid false positives.
 * 
 * Special precautions:
 * - Single-letter names like 'c' or 'r' require explicit programming context.
 * - 'go' requires 'golang' or 'go language' to avoid matching the common verb.
 * - Special symbols (C++, C#, .NET) use tailored punctuation-aware patterns.
 * 
 * @param {string} text - Freeform text to scan
 * @returns {Array<Object>} Normalized canonical skill descriptors found in text
 */
export function extractSkillsFromText(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return [];
  }

  const rawText = text;
  const discoveredMap = new Map();

  for (const skill of CANONICAL_SKILLS) {
    const key = skill.canonicalKey;

    // Build specific regex patterns for this skill
    let patterns = [];

    if (key === 'c++') {
      patterns.push(/(?:\b|\s)c\+\+(?:\b|\s|[.,;!?])/i);
      patterns.push(/\b(?:cpp|cplusplus)\b/i);
    } else if (key === 'c#') {
      patterns.push(/(?:\b|\s)c#(?:\b|\s|[.,;!?])/i);
      patterns.push(/\b(?:csharp|c-sharp)\b/i);
    } else if (key === 'c') {
      // Must not match generic letter 'c' or bullets like 'c.'
      patterns.push(/\b(?:c\s+programming|c\s+language|language\s+c)\b/i);
    } else if (key === 'go') {
      // Must not match generic verb 'go'
      patterns.push(/\b(?:golang|go\s+language|go\s+programming)\b/i);
    } else if (key === 'react native' || key === 'react-native') {
      patterns.push(/\breact[\s-]+native\b/i);
    } else if (key === 'react') {
      // Match React but NOT React Native
      patterns.push(/\b(?:react\.?js|reactjs)\b/i);
      patterns.push(/\breact\b(?!\s*native)/i);
    } else if (key === 'css') {
      // Match standalone CSS / CSS3, but not when part of Tailwind CSS
      patterns.push(/(?<!tailwind\s+)\b(?:css|css3)\b/i);
    } else if (key === 'javascript') {
      patterns.push(/\b(?:javascript|ecmascript|es6)\b/i);
      // 'js' in text can be part of node.js or vue.js, so match stand-alone JS with word boundary
      patterns.push(/(?:^|\s)js(?:\s|[.,;!?]|$)/i);
    } else if (key === 'typescript') {
      patterns.push(/\b(?:typescript)\b/i);
      patterns.push(/(?:^|\s)ts(?:\s|[.,;!?]|$)/i);
    } else {
      // General multi-character skills: scan canonicalKey and aliases
      const candidateTerms = [skill.canonicalKey, ...(skill.aliases || [])];
      for (const term of candidateTerms) {
        if (term.length >= 3) {
          patterns.push(new RegExp(`\\b${escapeRegex(term)}\\b`, 'i'));
        }
      }
    }

    // Check if any pattern matches in the text
    for (const pattern of patterns) {
      if (pattern.test(rawText)) {
        if (!discoveredMap.has(key)) {
          discoveredMap.set(key, {
            canonicalKey: skill.canonicalKey,
            displayName: skill.displayName,
            category: skill.category,
            source: 'description',
          });
        }
        break;
      }
    }
  }

  return Array.from(discoveredMap.values());
}

/**
 * Assembles unified opportunity skill requirements from both explicit opportunity.skills
 * and deterministically extracted description skills.
 * 
 * @param {Object} opportunity - Opportunity document
 * @returns {Array<Object>} Normalized required skills with source metadata
 */
export function getOpportunityRequirements(opportunity) {
  if (!opportunity) return [];

  const requirementMap = new Map();

  // 1. Explicit opportunity skills (primary ground truth)
  const explicitList = normalizeSkills(opportunity.skills || []);
  for (const item of explicitList) {
    requirementMap.set(item.canonicalKey, {
      canonicalKey: item.canonicalKey,
      displayName: item.displayName,
      category: item.category,
      source: 'explicit',
    });
  }

  // 2. Deterministic description extraction (improves recall on sparse postings)
  const descText = [opportunity.shortDescription, opportunity.description].filter(Boolean).join('\n');
  if (descText) {
    const extracted = extractSkillsFromText(descText);
    for (const item of extracted) {
      if (!requirementMap.has(item.canonicalKey)) {
        requirementMap.set(item.canonicalKey, {
          ...item,
          source: 'description',
        });
      }
    }
  }

  return Array.from(requirementMap.values());
}

/**
 * Extracts candidate skills and evidence from a user profile.
 * Incorporates:
 * - Tier 1: Claimed skills (profile.skills)
 * - Tier 2: Portfolio projects (profile.projects[].technologies)
 * - Tier 3: Public GitHub proof of work (profile.githubEvidence.detectedSkills)
 * 
 * @param {Object} profile - Profile document
 * @returns {Map<string, Object>} Canonical skill key -> skill candidate metadata
 */
export function getCandidateSkillProfile(profile) {
  const candidateSkills = new Map();
  if (!profile) return candidateSkills;

  // 1. Claimed profile skills
  if (Array.isArray(profile.skills)) {
    const normProfileSkills = normalizeSkills(profile.skills);
    for (const skill of normProfileSkills) {
      candidateSkills.set(skill.canonicalKey, {
        canonicalKey: skill.canonicalKey,
        displayName: skill.displayName,
        category: skill.category,
        isClaimed: true,
        proficiency: skill.level || 'intermediate',
        isDemonstrated: false,
        projects: [],
      });
    }
  }

  // 2. Demonstrated project technologies
  if (Array.isArray(profile.projects)) {
    for (const project of profile.projects) {
      if (!project || !Array.isArray(project.technologies)) continue;

      const normTechs = normalizeSkills(project.technologies);
      for (const tech of normTechs) {
        let entry = candidateSkills.get(tech.canonicalKey);
        if (!entry) {
          entry = {
            canonicalKey: tech.canonicalKey,
            displayName: tech.displayName,
            category: tech.category,
            isClaimed: false,
            proficiency: null,
            isDemonstrated: true,
            projects: [],
          };
          candidateSkills.set(tech.canonicalKey, entry);
        } else {
          entry.isDemonstrated = true;
        }

        entry.projects.push({
          title: project.title || 'Untitled Project',
          description: project.description || '',
        });
      }
    }
  }

  // 3. Public GitHub Proof (Tier 3 Evidence)
  const githubEvidence = profile.githubEvidence;
  if (
    githubEvidence &&
    githubEvidence.syncStatus !== 'not_connected' &&
    Array.isArray(githubEvidence.detectedSkills)
  ) {
    for (const detected of githubEvidence.detectedSkills) {
      if (!detected || !detected.canonicalKey) continue;

      const resolved = resolveSkillAlias(detected.canonicalKey);
      const resolvedKey = resolved ? resolved.canonicalKey : String(detected.canonicalKey).toLowerCase().trim();
      const resolvedDisplayName = resolved ? resolved.displayName : (detected.displayName || resolvedKey);
      const resolvedCategory = resolved ? resolved.category : (detected.category || 'other');
      const repos = Array.isArray(detected.repositories) ? detected.repositories : [];

      let entry = candidateSkills.get(resolvedKey);
      if (!entry) {
        entry = {
          canonicalKey: resolvedKey,
          displayName: resolvedDisplayName,
          category: resolvedCategory,
          isClaimed: false,
          proficiency: null,
          isDemonstrated: true,
          projects: [],
          githubEvidence: {
            repoCount: detected.repoCount || repos.length,
            repositories: [...repos],
          },
        };
        candidateSkills.set(resolvedKey, entry);
      } else {
        entry.isDemonstrated = true;
        if (!entry.githubEvidence) {
          entry.githubEvidence = {
            repoCount: detected.repoCount || repos.length,
            repositories: [...repos],
          };
        } else {
          // Merge repositories without duplicates by url or name
          const existingUrls = new Set(
            entry.githubEvidence.repositories.map((r) => r.url || r.name)
          );
          for (const repo of repos) {
            const key = repo.url || repo.name;
            if (!existingUrls.has(key)) {
              entry.githubEvidence.repositories.push(repo);
              existingUrls.add(key);
            }
          }
          entry.githubEvidence.repoCount = Math.max(
            entry.githubEvidence.repoCount,
            entry.githubEvidence.repositories.length
          );
        }
      }
    }
  }

  return candidateSkills;
}

/**
 * Evaluates candidate-to-opportunity career preference alignment.
 * 
 * Rules:
 * - Missing preferences are neutral (not penalized).
 * - Remote opportunities match all candidates.
 * - Explicit matches award positive points.
 * 
 * @param {Object} profile - User profile
 * @param {Object} opportunity - Target opportunity
 * @returns {Object} Preference evaluation details
 */
export function evaluatePreferenceAlignment(profile, opportunity) {
  const preferences = profile?.careerPreferences || {};
  const personalLoc = profile?.personal?.location || {};

  // 1. Opportunity Type Alignment (Max 15 points)
  let typeScore = 10; // Neutral default if not configured
  let typeMatch = null;
  let typeDetail = 'No opportunity type preference specified (neutral).';

  if (Array.isArray(preferences.opportunityTypes) && preferences.opportunityTypes.length > 0) {
    const prefTypes = preferences.opportunityTypes.map((t) => String(t).toLowerCase().trim());
    const oppType = String(opportunity.type || '').toLowerCase().trim();

    if (prefTypes.includes(oppType)) {
      typeScore = 15;
      typeMatch = true;
      typeDetail = `Opportunity type (${opportunity.type}) matches your preferences.`;
    } else {
      typeScore = 0;
      typeMatch = false;
      typeDetail = `Opportunity type (${opportunity.type}) differs from your specified preferences.`;
    }
  }

  // 2. Work Mode Alignment (Max 8 points)
  let workModeScore = 5; // Neutral default
  let workModeMatch = null;
  let workModeDetail = 'No work mode preference specified (neutral).';

  const oppWorkMode = String(opportunity.workMode || '').toLowerCase().trim();
  const prefWorkModes = Array.isArray(preferences.preferredWorkModes)
    ? preferences.preferredWorkModes.map((w) => String(w).toLowerCase().trim())
    : [];

  if (oppWorkMode === 'remote' || oppWorkMode === 'online') {
    workModeScore = 8;
    workModeMatch = true;
    workModeDetail = `Remote/Online opportunity is universally accessible.`;
  } else if (prefWorkModes.length > 0) {
    if (prefWorkModes.includes(oppWorkMode)) {
      workModeScore = 8;
      workModeMatch = true;
      workModeDetail = `Work mode (${opportunity.workMode}) matches your preference.`;
    } else {
      workModeScore = 0;
      workModeMatch = false;
      workModeDetail = `Work mode (${opportunity.workMode}) differs from your preference.`;
    }
  }

  // 3. Location Alignment (Max 7 points)
  let locationScore = 4; // Neutral default
  let locationMatch = null;
  let locationDetail = 'No location preference specified (neutral).';

  if (oppWorkMode === 'remote' || oppWorkMode === 'online') {
    locationScore = 7;
    locationMatch = true;
    locationDetail = 'Remote role has no geographic constraints.';
  } else {
    const oppLoc = opportunity.location || {};
    const oppCity = String(oppLoc.city || '').toLowerCase().trim();
    const oppState = String(oppLoc.state || '').toLowerCase().trim();
    const oppCountry = String(oppLoc.country || '').toLowerCase().trim();

    const prefLocs = Array.isArray(preferences.preferredLocations)
      ? preferences.preferredLocations.map((l) => String(l).toLowerCase().trim())
      : [];

    const userCity = String(personalLoc.city || '').toLowerCase().trim();
    const userState = String(personalLoc.state || '').toLowerCase().trim();
    const userCountry = String(personalLoc.country || '').toLowerCase().trim();

    if (prefLocs.length > 0 || userCity || userCountry) {
      const matchesCity = (oppCity && (prefLocs.includes(oppCity) || userCity === oppCity));
      const matchesState = (oppState && (prefLocs.includes(oppState) || userState === oppState));
      const matchesCountry = (oppCountry && (prefLocs.includes(oppCountry) || userCountry === oppCountry));

      if (matchesCity || matchesState || matchesCountry) {
        locationScore = 7;
        locationMatch = true;
        locationDetail = `Location aligns with your profile or preferred location.`;
      } else {
        locationScore = 0;
        locationMatch = false;
        locationDetail = `Opportunity location does not match your preferred locations.`;
      }
    }
  }

  return {
    typeScore,
    typeMatch,
    typeDetail,
    workModeScore,
    workModeMatch,
    workModeDetail,
    locationScore,
    locationMatch,
    locationDetail,
    totalPreferenceScore: typeScore + workModeScore + locationScore,
  };
}

/**
 * Pure deterministic candidate-to-opportunity fit engine.
 * Calculates score, matches, gaps, evidence, and human-readable explanations.
 * 
 * @param {Object} profile - User profile document or plain object
 * @param {Object} opportunity - Opportunity document or plain object
 * @returns {Object} Comprehensive Match Result
 */
export function calculateOpportunityMatch(profile, opportunity) {
  if (!opportunity) {
    throw new Error('Opportunity is required for match calculation');
  }

  // 1. Gather requirements and candidate skills
  const requirements = getOpportunityRequirements(opportunity);
  const candidateSkills = getCandidateSkillProfile(profile);

  const matchedSkills = [];
  const skillGaps = [];
  const evidenceList = [];

  // Track proficiency weights for matched skills
  const PROFICIENCY_POINTS = {
    expert: 3,
    advanced: 2,
    intermediate: 1,
    beginner: 0,
  };

  let proficiencyBonusTotal = 0;
  let demonstratedMatchesCount = 0;

  for (const req of requirements) {
    const candidateMatch = candidateSkills.get(req.canonicalKey);

    if (candidateMatch) {
      // Matched skill
      const hasProjectEvidence = candidateMatch.projects && candidateMatch.projects.length > 0;
      const hasGitHubEvidence = Boolean(
        candidateMatch.githubEvidence &&
        candidateMatch.githubEvidence.repositories &&
        candidateMatch.githubEvidence.repositories.length > 0
      );
      const isDemonstrated = hasProjectEvidence || hasGitHubEvidence;

      if (isDemonstrated) {
        demonstratedMatchesCount++;
      }

      if (candidateMatch.isClaimed && candidateMatch.proficiency) {
        proficiencyBonusTotal += (PROFICIENCY_POINTS[candidateMatch.proficiency] || 1);
      }

      const topRepo = hasGitHubEvidence
        ? selectBestRepository(candidateMatch.githubEvidence.repositories)
        : null;

      const matchEvidence = {
        canonicalKey: req.canonicalKey,
        displayName: req.displayName,
        category: req.category,
        isClaimed: candidateMatch.isClaimed,
        proficiency: candidateMatch.proficiency,
        isDemonstrated,
        projects: candidateMatch.projects.map((p) => p.title),
        source: req.source,
        hasGitHubEvidence,
        githubEvidence: hasGitHubEvidence && topRepo ? {
          repoCount: candidateMatch.githubEvidence.repoCount,
          topRepository: {
            name: topRepo.name,
            url: topRepo.url,
            isFork: topRepo.isFork,
            primaryLanguage: topRepo.primaryLanguage || null,
            updatedAt: topRepo.updatedAt || null,
          },
        } : null,
      };

      matchedSkills.push(matchEvidence);

      // Create human-readable evidence entries
      if (hasProjectEvidence && candidateMatch.isClaimed) {
        evidenceList.push({
          skill: req.displayName,
          type: 'demonstrated_and_claimed',
          description: `Claimed (${candidateMatch.proficiency}) & demonstrated in project "${candidateMatch.projects[0].title}".`,
          projectTitle: candidateMatch.projects[0].title,
        });
      } else if (hasProjectEvidence) {
        evidenceList.push({
          skill: req.displayName,
          type: 'demonstrated',
          description: `Demonstrated in project "${candidateMatch.projects[0].title}".`,
          projectTitle: candidateMatch.projects[0].title,
        });
      } else if (candidateMatch.isClaimed && !hasGitHubEvidence) {
        evidenceList.push({
          skill: req.displayName,
          type: 'claimed',
          description: `Listed in profile skills (${candidateMatch.proficiency || 'intermediate'}).`,
        });
      }

      // If GitHub verified, add distinct proof-of-work representation
      if (hasGitHubEvidence && topRepo) {
        const repoCount = candidateMatch.githubEvidence.repoCount;
        evidenceList.push({
          skill: req.displayName,
          type: 'github_verified',
          canonicalKey: req.canonicalKey,
          repository: {
            name: topRepo.name,
            url: topRepo.url,
            isFork: topRepo.isFork,
            primaryLanguage: topRepo.primaryLanguage || null,
            updatedAt: topRepo.updatedAt || null,
          },
          repoCount,
          description: `Verified in public GitHub repository ${topRepo.name}${repoCount > 1 ? ` (+${repoCount - 1} other${repoCount > 2 ? 's' : ''})` : ''}.`,
        });
      }
    } else {
      // Skill Gap
      skillGaps.push({
        canonicalKey: req.canonicalKey,
        displayName: req.displayName,
        category: req.category,
        source: req.source,
      });
    }
  }

  // -------------------------------------------------------------
  // Scoring Model (Bounded 0 - 100)
  // -------------------------------------------------------------

  // Dimension 1: Skill Alignment & Proficiency (Max 50 points)
  let skillAlignmentScore = 0;
  const totalReqCount = requirements.length;
  const matchedCount = matchedSkills.length;

  if (totalReqCount > 0) {
    const coverageRatio = matchedCount / totalReqCount;
    const baseCoveragePoints = coverageRatio * 40; // Max 40
    const proficiencyBonus = Math.min(10, proficiencyBonusTotal); // Max 10
    skillAlignmentScore = Math.min(50, baseCoveragePoints + proficiencyBonus);
  } else {
    // If opportunity specifies no requirements, award neutral 35 baseline
    skillAlignmentScore = 35;
  }

  // Dimension 2: Demonstrated Project & GitHub Evidence (Max 20 points)
  // Each demonstrated matched skill awards 5 points up to 20
  const demonstratedScore = Math.min(20, demonstratedMatchesCount * 5);

  // Dimension 3 & 4: Preference & Context Alignment (Max 30 points)
  const prefResult = evaluatePreferenceAlignment(profile, opportunity);
  const preferenceScore = prefResult.totalPreferenceScore; // Max 30 (15 type + 8 workMode + 7 location)

  // Total Score (0 - 100)
  const rawScore = skillAlignmentScore + demonstratedScore + preferenceScore;
  const finalScore = Math.max(0, Math.min(100, Math.round(rawScore)));
  const fitLevel = getFitLevel(finalScore);

  // -------------------------------------------------------------
  // Human-Readable Explanations
  // -------------------------------------------------------------
  const positiveExplanations = [];
  const gapExplanations = [];

  const projectEvidencedSkills = matchedSkills.filter((s) => s.projects && s.projects.length > 0);
  const githubEvidencedSkills = matchedSkills.filter((s) => s.hasGitHubEvidence);

  if (matchedCount > 0) {
    const matchedNames = matchedSkills.map((s) => s.displayName).slice(0, 4).join(', ');
    positiveExplanations.push(`Matched ${matchedCount} of ${totalReqCount} required skills (${matchedNames}${matchedCount > 4 ? '...' : ''}).`);
  }

  if (projectEvidencedSkills.length > 0) {
    positiveExplanations.push(`Demonstrated ${projectEvidencedSkills.length} matching skill${projectEvidencedSkills.length > 1 ? 's' : ''} in your portfolio projects.`);
  }

  if (githubEvidencedSkills.length > 0) {
    const ghNames = githubEvidencedSkills.map((s) => s.displayName).slice(0, 3).join(', ');
    positiveExplanations.push(`Verified ${githubEvidencedSkills.length} matching skill${githubEvidencedSkills.length > 1 ? 's' : ''} (${ghNames}${githubEvidencedSkills.length > 3 ? '...' : ''}) via public GitHub repositories.`);
  }

  if (prefResult.typeMatch === true) {
    positiveExplanations.push(prefResult.typeDetail);
  }

  if (prefResult.workModeMatch === true) {
    positiveExplanations.push(prefResult.workModeDetail);
  }

  if (prefResult.locationMatch === true) {
    positiveExplanations.push(prefResult.locationDetail);
  }

  if (skillGaps.length > 0) {
    const gapNames = skillGaps.map((g) => g.displayName).slice(0, 3).join(', ');
    gapExplanations.push(`${skillGaps.length} requirement${skillGaps.length > 1 ? 's' : ''} not represented on your profile: ${gapNames}${skillGaps.length > 3 ? '...' : ''}.`);
  }

  if (demonstratedMatchesCount === 0 && matchedCount > 0) {
    gapExplanations.push('None of your matched skills have linked portfolio projects or verified GitHub repositories yet.');
  }

  if (prefResult.typeMatch === false) {
    gapExplanations.push(prefResult.typeDetail);
  }

  if (prefResult.workModeMatch === false) {
    gapExplanations.push(prefResult.workModeDetail);
  }

  // High-level summary
  let summary = '';
  if (finalScore >= 85) {
    summary = `Excellent match! You possess strong skill overlap and verified project evidence for this role.`;
  } else if (finalScore >= 70) {
    summary = `Strong match. Your core skills and preferences align well with this opportunity.`;
  } else if (finalScore >= 50) {
    summary = `Good foundational match with a few key skill gaps to bridge.`;
  } else if (finalScore >= 30) {
    summary = `Partial match. You meet some basic criteria, but several key technical requirements are missing.`;
  } else {
    summary = `Low match. This opportunity requires skills or qualifications not found on your profile.`;
  }

  return {
    score: finalScore,
    fitLevel,
    summary,
    matchedSkills,
    skillGaps,
    evidence: evidenceList,
    signals: {
      skillAlignment: {
        score: Math.round(skillAlignmentScore),
        max: 50,
        matchedCount,
        totalRequired: totalReqCount,
      },
      demonstratedEvidence: {
        score: Math.round(demonstratedScore),
        max: 20,
        demonstratedCount: demonstratedMatchesCount,
        projectEvidenceCount: projectEvidencedSkills.length,
        githubEvidenceCount: githubEvidencedSkills.length,
      },
      preferences: {
        score: Math.round(preferenceScore),
        max: 30,
        typeScore: prefResult.typeScore,
        workModeScore: prefResult.workModeScore,
        locationScore: prefResult.locationScore,
        typeMatch: prefResult.typeMatch,
        workModeMatch: prefResult.workModeMatch,
        locationMatch: prefResult.locationMatch,
      },
    },
    explanations: {
      positive: positiveExplanations,
      gaps: gapExplanations,
    },
  };
}

/**
 * Controller/Service entry point: fetches authenticated user profile and target opportunity
 * then computes the deterministic personalized match.
 * 
 * Enforces ownership: always operates against the authenticated userId.
 * 
 * @param {string} userId - Authenticated user ObjectId
 * @param {string} opportunityId - Opportunity ObjectId
 * @param {boolean} [isAdmin=false] - Whether requester is admin (can view non-published opportunities)
 * @returns {Promise<Object>} Match result or throws/returns null
 */
export async function getOpportunityMatchForUser(userId, opportunityId, isAdmin = false) {
  if (!mongoose.Types.ObjectId.isValid(opportunityId)) {
    const error = new Error('Invalid opportunity ID');
    error.status = 400;
    throw error;
  }

  const opportunity = await getOpportunityById(opportunityId, isAdmin);
  if (!opportunity) {
    const error = new Error('Opportunity not found');
    error.status = 404;
    throw error;
  }

  // Fetch the authenticated user's profile
  let profile = await getProfileForUser(userId);
  if (!profile) {
    // Graceful fallback for brand-new users without a Profile document yet
    profile = {
      userId,
      skills: [],
      projects: [],
      careerPreferences: {},
    };
  }

  const match = calculateOpportunityMatch(profile, opportunity);
  return {
    opportunityId: opportunity._id,
    match,
  };
}
