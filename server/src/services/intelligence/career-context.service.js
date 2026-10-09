/**
 * CareerOS Trusted Career Context Service (Phase 11H — B2)
 *
 * Constructs the strictly bounded, deterministic, JSON-serializable
 * TrustedAIContextV1 payload for AI orchestration.
 *
 * Guarantees:
 * - 100% deterministic, side-effect free, read-only, network-free, database-write-free.
 * - Reuses existing deterministic intelligence engines (match, application intelligence, skill normalization).
 * - Zero LLM API calls, zero provider dependencies.
 * - Strict data-minimization: zero ObjectIds, zero user IDs, zero auth tokens, zero PII, zero raw markdown/HTML descriptions.
 * - Bounded arrays and strings across all dimensions.
 * - Non-causal observational language preserved for outcome patterns.
 */

import mongoose from 'mongoose';
import { calculateOpportunityMatch, getFitLevel } from './match.service.js';
import { extractCanonicalKeys, getCanonicalSkill } from './skill-normalization.service.js';
import {
  computeApplicationIntelligence,
  MIN_SAMPLE_SIZE_REJECTION,
} from './application-intelligence.service.js';

import { Profile } from '../../models/Profile.js';
import { Opportunity } from '../../models/Opportunity.js';
import { Application } from '../../models/Application.js';
import { Todo } from '../../models/Todo.js';
import { SavedOpportunity } from '../../models/SavedOpportunity.js';
import { CalendarEvent } from '../../models/CalendarEvent.js';

export const CONTEXT_VERSION = '1';
export const MAX_CAREER_GOAL_LENGTH = 200;
export const MAX_OPPORTUNITY_TITLE_LENGTH = 120;
export const MAX_OPPORTUNITY_ORG_LENGTH = 120;
export const MAX_OPPORTUNITY_FIELD_LENGTH = 50;
export const MAX_REQUIRED_SKILLS = 20;
export const MAX_CANONICAL_SKILL_GAPS = 10;
export const MAX_MATCH_SKILLS = 15;
export const MAX_SUMMARY_LENGTH = 200;
export const MAX_TOP_LANGUAGES = 5;
export const MAX_TOP_LANGUAGE_LENGTH = 30;
export const MAX_STALLED_APPLICATIONS = 5;
export const MAX_LABEL_LENGTH = 100;
export const MAX_RECURRING_GAPS = 5;

/**
 * Safely sanitizes and bounds untrusted user/external string input.
 * Strips HTML, markdown formatting, non-printable control characters, and collapses whitespace.
 * Redacts accidental email addresses, phone numbers, JWT tokens, and 24-character hex ObjectIds.
 *
 * @param {any} text - Raw input
 * @param {number} [maxLength=200] - Hard upper character limit
 * @returns {string|null} Sanitized string or null if empty
 */
export function cleanUntrustedText(text, maxLength = 200) {
  if (typeof text !== 'string') return null;

  let cleaned = text.trim();
  if (!cleaned) return null;

  // 1. Strip HTML tags
  cleaned = cleaned.replace(/<[^>]*>/g, ' ');

  // 2. Strip markdown links [label](url) -> label and formatting chars (*, _, `, ~, #)
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
  cleaned = cleaned.replace(/[`*_~#]/g, '');

  // 3. Strip non-printable / control characters
  cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, ' ');

  // 4. Redact potential JWT tokens
  cleaned = cleaned.replace(/\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/g, '[REDACTED_TOKEN]');

  // 5. Redact potential email addresses
  cleaned = cleaned.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[REDACTED_EMAIL]');

  // 6. Redact potential phone numbers
  cleaned = cleaned.replace(/\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[REDACTED_PHONE]');

  // 7. Redact 24-character hex MongoDB ObjectIds if present in text
  cleaned = cleaned.replace(/\b[0-9a-fA-F]{24}\b/g, '[REDACTED_ID]');

  // 8. Collapse whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  if (!cleaned) return null;

  return cleaned.slice(0, maxLength);
}

/**
 * Derives bounded opportunity facts from an opportunity object.
 * Strictly excludes descriptions, markdown, raw HTML, URLs, and ObjectIds.
 *
 * @param {Object|null} opportunity
 * @returns {Object|null}
 */
export function deriveOpportunityFacts(opportunity) {
  if (!opportunity || typeof opportunity !== 'object') {
    return null;
  }

  const rawTitle = opportunity.title;
  const rawOrg = opportunity.organization || opportunity.company;

  const title = cleanUntrustedText(rawTitle, MAX_OPPORTUNITY_TITLE_LENGTH);
  const organization = cleanUntrustedText(rawOrg, MAX_OPPORTUNITY_ORG_LENGTH);

  // If both title and organization are absent, treat as missing/invalid opportunity
  if (!title && !organization) {
    return null;
  }

  // Extract canonical required skills
  const rawSkills = Array.isArray(opportunity.skills) ? opportunity.skills : [];
  const normalizedKeys = extractCanonicalKeys(rawSkills);

  // Only keep skills recognized in the canonical ontology
  const verifiedSkills = [];
  const seen = new Set();

  for (const key of normalizedKeys) {
    if (typeof key === 'string') {
      const canonical = getCanonicalSkill(key);
      if (canonical && !seen.has(canonical.canonicalKey)) {
        seen.add(canonical.canonicalKey);
        verifiedSkills.push(canonical.canonicalKey);
      }
    }
  }

  verifiedSkills.sort((a, b) => a.localeCompare(b));
  const requiredCanonicalSkills = verifiedSkills.slice(0, MAX_REQUIRED_SKILLS);

  // Seniority: extract safely if present
  let seniority = null;
  if (typeof opportunity.seniority === 'string') {
    seniority = cleanUntrustedText(opportunity.seniority, MAX_OPPORTUNITY_FIELD_LENGTH);
  } else if (Array.isArray(opportunity.eligibility?.educationLevels) && opportunity.eligibility.educationLevels.length > 0) {
    seniority = cleanUntrustedText(opportunity.eligibility.educationLevels.join(', '), MAX_OPPORTUNITY_FIELD_LENGTH);
  }

  const type = typeof opportunity.type === 'string'
    ? cleanUntrustedText(opportunity.type, MAX_OPPORTUNITY_FIELD_LENGTH)
    : null;

  const workMode = typeof opportunity.workMode === 'string'
    ? cleanUntrustedText(opportunity.workMode, MAX_OPPORTUNITY_FIELD_LENGTH)
    : null;

  return {
    title,
    organization,
    requiredCanonicalSkills,
    seniority,
    type,
    workMode,
  };
}

/**
 * Reuses deterministic match calculation to derive compact match breakdown.
 * Does not recompute or alter match mathematics.
 *
 * @param {Object} profile
 * @param {Object|null} opportunity
 * @param {Object|null} [precomputedMatch=null]
 * @returns {Object|null}
 */
export function deriveMatchBreakdown(profile, opportunity, precomputedMatch = null) {
  if (!opportunity) {
    return null;
  }

  let match = precomputedMatch;
  if (!match) {
    try {
      match = calculateOpportunityMatch(profile || {}, opportunity);
    } catch {
      return null;
    }
  }

  if (!match || typeof match.score !== 'number') {
    return null;
  }

  // Exact score preserved
  const score = Math.max(0, Math.min(100, Math.round(match.score)));
  const fitBand = match.fitLevel || getFitLevel(score);

  // Matched skills canonical keys
  const matchedList = Array.isArray(match.matchedSkills) ? match.matchedSkills : [];
  const matchedKeys = Array.from(
    new Set(
      matchedList
        .map((s) => (typeof s === 'string' ? s : s?.canonicalKey))
        .filter((k) => typeof k === 'string' && getCanonicalSkill(k))
    )
  ).sort((a, b) => a.localeCompare(b)).slice(0, MAX_MATCH_SKILLS);

  // Missing skills canonical keys
  const gapList = Array.isArray(match.skillGaps) ? match.skillGaps : [];
  const missingKeys = Array.from(
    new Set(
      gapList
        .map((g) => (typeof g === 'string' ? g : g?.canonicalKey))
        .filter((k) => typeof k === 'string' && getCanonicalSkill(k))
    )
  ).sort((a, b) => a.localeCompare(b)).slice(0, MAX_MATCH_SKILLS);

  const evidenceSummary = match.summary ? cleanUntrustedText(match.summary, MAX_SUMMARY_LENGTH) : null;

  return {
    score,
    fitBand,
    matchedSkills: matchedKeys,
    missingSkills: missingKeys,
    evidenceSummary,
  };
}

/**
 * Normalizes, deduplicates, and caps canonical skill gaps to max 10.
 * Strictly guarantees that all exposed gaps are known to the CareerOS canonical ontology.
 *
 * @param {Object} params
 * @param {Object|null} params.matchBreakdown
 * @param {Array} [params.rawGaps=[]]
 * @returns {Array<string>} Deterministically sorted canonical keys
 */
export function deriveCanonicalSkillGaps({ matchBreakdown, rawGaps = [] } = {}) {
  const gapCandidates = [];

  // 1. If match breakdown exists, prioritize missing skills from target opportunity
  if (matchBreakdown && Array.isArray(matchBreakdown.missingSkills)) {
    gapCandidates.push(...matchBreakdown.missingSkills);
  }

  // 2. Also incorporate rawGaps if provided
  if (Array.isArray(rawGaps)) {
    for (const item of rawGaps) {
      const key = typeof item === 'string' ? item : item?.canonicalKey;
      if (key) gapCandidates.push(key);
    }
  }

  // 3. Filter to known canonical ontology skills, deduplicate, sort deterministically
  const canonicalSet = new Set();
  for (const raw of gapCandidates) {
    if (typeof raw !== 'string') continue;
    const clean = raw.trim().toLowerCase();
    const canonical = getCanonicalSkill(clean);
    if (canonical && canonical.canonicalKey) {
      canonicalSet.add(canonical.canonicalKey);
    }
  }

  const sortedGaps = Array.from(canonicalSet).sort((a, b) => a.localeCompare(b));
  return sortedGaps.slice(0, MAX_CANONICAL_SKILL_GAPS);
}

/**
 * Derives compact GitHub proof summary.
 * Strictly excludes credentials, tokens, private repos, README text, and raw repository objects.
 *
 * @param {Object|null} githubEvidence
 * @returns {Object}
 */
export function deriveGitHubProofSummary(githubEvidence) {
  if (!githubEvidence || typeof githubEvidence !== 'object') {
    return {
      publicRepoCount: 0,
      topLanguages: [],
      detectedSkillCount: 0,
      syncStatus: 'not_connected',
    };
  }

  const publicRepoCount = typeof githubEvidence.publicRepoCount === 'number' && githubEvidence.publicRepoCount >= 0
    ? Math.floor(githubEvidence.publicRepoCount)
    : 0;

  const rawLanguages = Array.isArray(githubEvidence.topLanguages) ? githubEvidence.topLanguages : [];
  const cleanLanguages = [];
  const seenLang = new Set();

  for (const lang of rawLanguages) {
    if (typeof lang === 'string') {
      const clean = cleanUntrustedText(lang, MAX_TOP_LANGUAGE_LENGTH);
      if (clean && !seenLang.has(clean.toLowerCase())) {
        seenLang.add(clean.toLowerCase());
        cleanLanguages.push(clean);
      }
    }
  }

  const detectedSkillCount = Array.isArray(githubEvidence.detectedSkills)
    ? githubEvidence.detectedSkills.length
    : 0;

  const syncStatus = typeof githubEvidence.syncStatus === 'string'
    ? cleanUntrustedText(githubEvidence.syncStatus, 30) || 'idle'
    : 'idle';

  return {
    publicRepoCount,
    topLanguages: cleanLanguages.slice(0, MAX_TOP_LANGUAGES),
    detectedSkillCount,
    syncStatus,
  };
}

/**
 * Derives preparation task counts from existing Todo tagging architecture.
 * Excludes Todo IDs and complete descriptions. Does not mutate anything.
 *
 * @param {Array<Object>} [todos=[]]
 * @returns {Object}
 */
export function derivePreparationState(todos = []) {
  if (!Array.isArray(todos) || todos.length === 0) {
    return {
      totalPreparationTaskCount: 0,
      activePreparationTaskCount: 0,
      completedPreparationTaskCount: 0,
    };
  }

  // Filter todos containing [CareerOS Prep:
  const prepTodos = todos.filter((todo) => {
    return todo && typeof todo.description === 'string' && todo.description.includes('[CareerOS Prep:');
  });

  const total = prepTodos.length;
  const completed = prepTodos.filter((t) => Boolean(t.completed)).length;
  const active = total - completed;

  return {
    totalPreparationTaskCount: total,
    activePreparationTaskCount: active,
    completedPreparationTaskCount: completed,
  };
}

/**
 * Reuses application intelligence metrics for pipeline health.
 * Enforces sample-size protections and excludes internal application IDs.
 *
 * @param {Object|null} appIntelligence
 * @returns {Object}
 */
export function deriveApplicationPipelineHealth(appIntelligence) {
  if (!appIntelligence || typeof appIntelligence !== 'object') {
    return {
      state: 'Dormant',
      totalTracked: 0,
      activeApplications: 0,
      stalledCount: 0,
      interviewCount: 0,
      hasSufficientFunnelData: false,
      conversionRate: null,
    };
  }

  const counts = appIntelligence.counts || {};
  const health = appIntelligence.health || {};
  const funnel = appIntelligence.funnel || {};

  const state = cleanUntrustedText(health.state, 30) || 'Dormant';
  const totalTracked = typeof counts.totalTracked === 'number' ? counts.totalTracked : 0;
  const activeApplications = typeof counts.activeApplications === 'number' ? counts.activeApplications : 0;
  const stalledCount = typeof counts.stalledCount === 'number'
    ? counts.stalledCount
    : (Array.isArray(appIntelligence.stalledApplications) ? appIntelligence.stalledApplications.length : 0);
  const interviewCount = typeof counts.interviewCount === 'number' ? counts.interviewCount : 0;

  // Respect sample-size protection from application-intelligence.service.js
  const hasSufficientFunnelData = Boolean(funnel.sampleSufficient);
  let conversionRate = null;

  if (hasSufficientFunnelData && typeof funnel.overallConversion?.rate === 'number') {
    conversionRate = Math.max(0, Math.min(100, Math.round(funnel.overallConversion.rate)));
  }

  return {
    state,
    totalTracked,
    activeApplications,
    stalledCount,
    interviewCount,
    hasSufficientFunnelData,
    conversionRate,
  };
}

/**
 * Derives observational rejection outcome patterns.
 * Preserves strictly non-causal language: "Observed patterns, not confirmed employer rejection reasons."
 * Excludes opportunity IDs and causal claims.
 *
 * @param {Object|null} rejectionPatterns
 * @returns {Object}
 */
export function deriveObservedOutcomePatterns(rejectionPatterns) {
  if (!rejectionPatterns || typeof rejectionPatterns !== 'object') {
    return {
      status: 'insufficient_sample',
      totalRejectedAnalyzed: 0,
      recurringGaps: [],
    };
  }

  const status = rejectionPatterns.status === 'available' ? 'available' : 'insufficient_sample';
  const totalRejectedAnalyzed = typeof rejectionPatterns.totalRejectedOpportunitiesAnalyzed === 'number'
    ? rejectionPatterns.totalRejectedOpportunitiesAnalyzed
    : 0;

  if (status !== 'available' || totalRejectedAnalyzed < MIN_SAMPLE_SIZE_REJECTION) {
    return {
      status: 'insufficient_sample',
      totalRejectedAnalyzed,
      recurringGaps: [],
    };
  }

  const rawPatterns = Array.isArray(rejectionPatterns.patterns) ? rejectionPatterns.patterns : [];
  const recurringGaps = [];

  for (const item of rawPatterns.slice(0, MAX_RECURRING_GAPS)) {
    if (!item || !item.canonicalKey) continue;

    // Validate canonical key belongs to ontology
    const canonical = getCanonicalSkill(item.canonicalKey);
    if (!canonical) continue;

    const evidence = item.candidateEvidence === 'claimed_only' ? 'claimed_only' : 'unverified';
    const percent = typeof item.recurrencePercent === 'number'
      ? Math.max(0, Math.min(100, Math.round(item.recurrencePercent)))
      : 0;

    recurringGaps.push({
      canonicalKey: canonical.canonicalKey,
      displayName: cleanUntrustedText(item.displayName || canonical.displayName, 50),
      recurrencePercent: percent,
      candidateEvidence: evidence,
    });
  }

  // Deterministic sort: recurrencePercent descending, canonicalKey ascending
  recurringGaps.sort((a, b) => {
    if (b.recurrencePercent !== a.recurrencePercent) {
      return b.recurrencePercent - a.recurrencePercent;
    }
    return a.canonicalKey.localeCompare(b.canonicalKey);
  });

  return {
    status: 'available',
    totalRejectedAnalyzed,
    recurringGaps,
  };
}

/**
 * Derives stalled applications bounded to max 5 records.
 * Strictly excludes application IDs, user IDs, and MongoDB ObjectIds.
 *
 * @param {Array<Object>} [stalledList=[]]
 * @returns {Array<Object>}
 */
export function deriveStalledApplications(stalledList = []) {
  if (!Array.isArray(stalledList) || stalledList.length === 0) {
    return [];
  }

  const records = [];

  for (const item of stalledList) {
    if (!item || typeof item !== 'object') continue;

    const org = cleanUntrustedText(item.organization, 50) || 'Unknown Organization';
    const title = cleanUntrustedText(item.title, 50) || 'Unknown Role';
    const opportunityLabel = cleanUntrustedText(`${title} at ${org}`, MAX_LABEL_LENGTH);

    const applicationStatus = cleanUntrustedText(item.status, 30) || 'applied';
    const daysSinceUpdate = typeof item.ageDays === 'number' && item.ageDays >= 0
      ? Math.floor(item.ageDays)
      : 0;

    let stallCategory = 'stalled_activity';
    const reasonLower = (item.reason || '').toLowerCase();
    if (reasonLower.includes('deadline')) {
      stallCategory = 'deadline_passed';
    } else if (item.status === 'applied') {
      stallCategory = 'awaiting_first_response';
    } else if (item.status === 'waiting') {
      stallCategory = 'pending_status_update';
    }

    records.push({
      opportunityLabel,
      applicationStatus,
      daysSinceUpdate,
      stallCategory,
    });
  }

  // Deterministically sort: daysSinceUpdate descending, then opportunityLabel ascending
  records.sort((a, b) => {
    if (b.daysSinceUpdate !== a.daysSinceUpdate) {
      return b.daysSinceUpdate - a.daysSinceUpdate;
    }
    return (a.opportunityLabel || '').localeCompare(b.opportunityLabel || '');
  });

  return records.slice(0, MAX_STALLED_APPLICATIONS);
}

/**
 * Pure, in-memory, deterministic builder for TrustedAIContextV1.
 * Completely offline-testable, side-effect free, database-write-free.
 *
 * @param {Object} [data={}]
 * @param {Object} [data.profile] - Candidate profile
 * @param {Object} [data.opportunity] - Target opportunity (optional)
 * @param {Array<Object>} [data.applications] - User applications (optional)
 * @param {Array<Object>} [data.todos] - User todos (optional)
 * @param {Array<Object>} [data.savedOpportunities] - Saved opportunities (optional)
 * @param {Array<Object>} [data.calendarEvents] - Calendar events (optional)
 * @param {Array<Object>} [data.opportunities] - Lookup opportunities (optional)
 * @param {Object} [data.match] - Precomputed match result (optional)
 * @param {Object} [data.applicationIntelligence] - Precomputed application intelligence (optional)
 * @param {Object} [options={}]
 * @param {Date} [options.referenceDate] - Injected reference date
 * @returns {Object} TrustedAIContextV1
 */
export function buildTrustedAIContext(data = {}, options = {}) {
  const profile = data?.profile || {};
  const opportunity = data?.opportunity || null;
  const applications = Array.isArray(data?.applications) ? data.applications : [];
  const todos = Array.isArray(data?.todos) ? data.todos : [];
  const savedOpportunities = Array.isArray(data?.savedOpportunities) ? data.savedOpportunities : [];
  const calendarEvents = Array.isArray(data?.calendarEvents) ? data.calendarEvents : [];

  const referenceDate = options?.referenceDate instanceof Date
    ? options.referenceDate
    : (options?.referenceDate ? new Date(options.referenceDate) : new Date());

  // 1. Career Goal
  const careerGoalTitle = cleanUntrustedText(profile?.careerGoal?.title, MAX_CAREER_GOAL_LENGTH);

  // 2. Opportunity Facts
  const opportunityFacts = deriveOpportunityFacts(opportunity);

  // 3. Match Breakdown
  const matchBreakdown = deriveMatchBreakdown(profile, opportunity, data?.match);

  // 4. Application Intelligence (reuse precomputed or compute in-memory)
  let appIntelligence = data?.applicationIntelligence || null;
  if (!appIntelligence && applications.length > 0) {
    const oppMap = new Map();
    if (opportunity && (opportunity._id || opportunity.id)) {
      oppMap.set(String(opportunity._id || opportunity.id), opportunity);
    }
    const extraOpps = Array.isArray(data?.opportunities) ? data.opportunities : [];
    for (const opp of extraOpps) {
      if (opp && (opp._id || opp.id)) {
        oppMap.set(String(opp._id || opp.id), opp);
      }
    }

    try {
      appIntelligence = computeApplicationIntelligence(
        {
          applications,
          opportunities: Array.from(oppMap.values()),
          savedOpportunities,
          todos,
          calendarEvents,
          profile,
        },
        { referenceDate }
      );
    } catch {
      appIntelligence = null;
    }
  }

  // 5. Canonical Skill Gaps
  const rawGaps = data?.skillGaps || appIntelligence?.rejectionPatterns?.patterns || [];
  const canonicalSkillGaps = deriveCanonicalSkillGaps({
    matchBreakdown,
    rawGaps,
  });

  // 6. GitHub Proof Summary
  const githubProofSummary = deriveGitHubProofSummary(profile?.githubEvidence);

  // 7. Preparation State
  const preparationState = derivePreparationState(todos);

  // 8. Application Pipeline Health
  const applicationPipelineHealth = deriveApplicationPipelineHealth(appIntelligence);

  // 9. Observed Outcome Patterns
  const rejectionPatterns = data?.rejectionPatterns || appIntelligence?.rejectionPatterns || null;
  const observedOutcomePatterns = deriveObservedOutcomePatterns(rejectionPatterns);

  // 10. Stalled Applications
  const stalledList = data?.stalledApplications || appIntelligence?.stalledApplications || [];
  const stalledApplications = deriveStalledApplications(stalledList);

  return {
    version: CONTEXT_VERSION,
    careerGoalTitle,
    opportunityFacts,
    matchBreakdown,
    canonicalSkillGaps,
    githubProofSummary,
    preparationState,
    applicationPipelineHealth,
    observedOutcomePatterns,
    stalledApplications,
  };
}

/**
 * Database-backed read-only loader for authenticated user career context.
 * Performs strictly read-only queries with .lean(), zero database mutations.
 *
 * @param {string|mongoose.Types.ObjectId} userId - Authenticated user ID
 * @param {Object} [options={}]
 * @param {Date} [options.referenceDate] - Injected reference date
 * @param {string|mongoose.Types.ObjectId} [options.opportunityId] - Target opportunity ID
 * @param {Object} [options.profile] - Injected profile override
 * @param {Object} [options.opportunity] - Injected opportunity override
 * @param {Array<Object>} [options.applications] - Injected applications override
 * @param {Array<Object>} [options.todos] - Injected todos override
 * @param {Array<Object>} [options.savedOpportunities] - Injected saved opportunities override
 * @param {Array<Object>} [options.calendarEvents] - Injected calendar events override
 * @returns {Promise<Object>} TrustedAIContextV1
 */
export async function getTrustedAIContextForUser(userId, options = {}) {
  const referenceDate = options.referenceDate instanceof Date
    ? options.referenceDate
    : (options.referenceDate ? new Date(options.referenceDate) : new Date());

  let profile = options.profile;
  let opportunity = options.opportunity;
  let applications = options.applications;
  let todos = options.todos;
  let savedOpportunities = options.savedOpportunities;
  let calendarEvents = options.calendarEvents;
  let opportunities = options.opportunities;

  // Lean database reads only when connection is active and parameters not already injected
  if (mongoose.connection?.readyState === 1 && userId) {
    if (!profile) {
      profile = await Profile.findOne({ userId }).lean();
    }

    if (!opportunity && options.opportunityId) {
      opportunity = await Opportunity.findById(options.opportunityId).lean();
    }

    if (!applications) {
      applications = await Application.find({ userId }).sort({ appliedAt: -1 }).limit(50).lean();
    }

    if (!todos) {
      todos = await Todo.find({ userId, description: { $regex: '\\[CareerOS Prep:' } }).lean();
    }

    if (!savedOpportunities) {
      savedOpportunities = await SavedOpportunity.find({ userId }).limit(20).lean();
    }

    if (!calendarEvents) {
      calendarEvents = await CalendarEvent.find({ userId }).lean();
    }

    if (!opportunities && applications && applications.length > 0) {
      const oppIds = applications
        .map((a) => a.opportunityId?._id || a.opportunityId)
        .filter(Boolean);
      if (oppIds.length > 0) {
        opportunities = await Opportunity.find({ _id: { $in: oppIds } }).lean();
      }
    }
  }

  return buildTrustedAIContext(
    {
      profile,
      opportunity,
      applications,
      todos,
      savedOpportunities,
      calendarEvents,
      opportunities,
      match: options.match,
      applicationIntelligence: options.applicationIntelligence,
      rejectionPatterns: options.rejectionPatterns,
      stalledApplications: options.stalledApplications,
      skillGaps: options.skillGaps,
    },
    { referenceDate }
  );
}
