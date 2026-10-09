/**
 * CareerOS Career Profile Intelligence Service (Phase 11F — Batch 2)
 * 
 * Deterministic computation engine for evaluating student career readiness across
 * target roles and opportunities.
 * 
 * Rules:
 * - 100% deterministic and offline-testable.
 * - Multi-dimensional readiness framework (NOT a single 0-100 score).
 * - Target cohort dynamically derived from Saved, Applied, and high-fit published opportunities (Max 15).
 * - No static/brittle role ontology; grounded in real opportunity demands.
 * - Zero database mutations (pure read-only intelligence calculation).
 * - Zero external API network calls.
 * - Reuses existing canonical skills, match engine, and preparation infrastructure.
 */

import mongoose from 'mongoose';
import { Profile } from '../../models/Profile.js';
import { Opportunity } from '../../models/Opportunity.js';
import { SavedOpportunity } from '../../models/SavedOpportunity.js';
import { Application } from '../../models/Application.js';
import { Todo } from '../../models/Todo.js';
import { CalendarEvent } from '../../models/CalendarEvent.js';
import { LearningTrack } from '../../models/LearningTrack.js';
import { LearningItem } from '../../models/LearningItem.js';
import { UserLearningProgress } from '../../models/UserLearningProgress.js';
import {
  getOpportunityRequirements,
  getCandidateSkillProfile,
} from './match.service.js';
import { normalizeSkill } from './skill-normalization.service.js';
import { computeApplicationIntelligence } from './application-intelligence.service.js';

export const MAX_TARGET_OPPORTUNITIES = 15;
export const STALLED_APPLICATION_DAYS = 14;
export const RECENT_ACTIVITY_DAYS = 30;
export const STALE_REPO_DAYS_THRESHOLD = 180;

/**
 * Priority classification thresholds based on target cohort occurrence.
 */
export const GAP_PRIORITIES = {
  P0: { label: 'Critical Gap', minPercent: 75 },
  P1: { label: 'High Priority', minPercent: 50 },
  P2: { label: 'Moderate Priority', minPercent: 25 },
  P3: { label: 'Secondary', minPercent: 0 },
};

/**
 * Resolves gap priority code based on frequency percentage.
 * 
 * @param {number} impactPercent - 0 to 100
 * @returns {'P0' | 'P1' | 'P2' | 'P3'}
 */
export function getGapPriority(impactPercent) {
  if (impactPercent >= GAP_PRIORITIES.P0.minPercent) return 'P0';
  if (impactPercent >= GAP_PRIORITIES.P1.minPercent) return 'P1';
  if (impactPercent >= GAP_PRIORITIES.P2.minPercent) return 'P2';
  return 'P3';
}

/**
 * Matches a catalog learning item/track with a canonical skill.
 * 
 * @param {Object} skill - Canonical skill descriptor
 * @param {Object} track - Learning track
 * @param {Object} [item] - Learning item
 * @returns {boolean}
 */
export function isLearningRelevantToSkill(skill, track, item = null) {
  if (!skill) return false;
  const key = (skill.canonicalKey || '').toLowerCase().trim();
  const name = (skill.displayName || '').toLowerCase().trim();

  const trackTitle = (track?.title || '').toLowerCase();
  const trackCat = (track?.category || '').toLowerCase();
  const trackDesc = (track?.description || '').toLowerCase();
  const itemTitle = (item?.title || '').toLowerCase();

  return (
    trackTitle.includes(name) ||
    trackTitle.includes(key) ||
    trackCat.includes(name) ||
    trackCat.includes(key) ||
    trackDesc.includes(name) ||
    trackDesc.includes(key) ||
    itemTitle.includes(name) ||
    itemTitle.includes(key)
  );
}

/**
 * Dynamically constructs and bounds the target opportunity cohort.
 * 
 * Ranking & selection hierarchy:
 * 1. Saved Opportunities (Direct candidate interest)
 * 2. Active Applications (Actively pursued roles)
 * 3. Fallback: published opportunities aligning with career preferences/goal
 * 
 * Enforces hard ceiling of MAX_TARGET_OPPORTUNITIES (15) and deduplicates IDs.
 * 
 * @param {Object} params
 * @param {Array<Object>} [params.savedOpportunities=[]]
 * @param {Array<Object>} [params.applications=[]]
 * @param {Array<Object>} [params.fallbackOpportunities=[]]
 * @param {number} [params.maxOpportunities=15]
 * @returns {{ cohortOpportunityIds: Array<string>, sources: Object }}
 */
export function buildTargetCohortIds({
  savedOpportunities = [],
  applications = [],
  fallbackOpportunities = [],
  maxOpportunities = MAX_TARGET_OPPORTUNITIES,
}) {
  const seenIds = new Set();
  const cohortIds = [];
  let savedCount = 0;
  let appliedCount = 0;
  let fallbackCount = 0;

  const limit = Math.max(1, Math.min(MAX_TARGET_OPPORTUNITIES, maxOpportunities));

  // 1. Saved Opportunities
  for (const saved of savedOpportunities) {
    if (cohortIds.length >= limit) break;
    const oppId = String(saved.opportunityId?._id || saved.opportunityId || saved.id || '');
    if (oppId && !seenIds.has(oppId)) {
      seenIds.add(oppId);
      cohortIds.push(oppId);
      savedCount++;
    }
  }

  // 2. Active Applications (not withdrawn or cancelled)
  for (const app of applications) {
    if (cohortIds.length >= limit) break;
    const status = String(app.status || '').toLowerCase();
    if (status === 'withdrawn' || status === 'cancelled') continue;

    const oppId = String(app.opportunityId?._id || app.opportunityId || app.id || '');
    if (oppId && !seenIds.has(oppId)) {
      seenIds.add(oppId);
      cohortIds.push(oppId);
      appliedCount++;
    }
  }

  // 3. Fallback published opportunities (if cohort still has space and fallback is needed)
  if (cohortIds.length < limit && Array.isArray(fallbackOpportunities)) {
    for (const opp of fallbackOpportunities) {
      if (cohortIds.length >= limit) break;
      const oppId = String(opp._id || opp.id || '');
      if (oppId && !seenIds.has(oppId)) {
        seenIds.add(oppId);
        cohortIds.push(oppId);
        fallbackCount++;
      }
    }
  }

  return {
    cohortOpportunityIds: cohortIds,
    sources: {
      savedCount,
      appliedCount,
      fallbackCount,
      totalCount: cohortIds.length,
    },
  };
}

/**
 * Aggregates canonical required skills across target opportunities.
 * Produces occurrence frequencies, opportunity references, impact percentages,
 * and deterministic priority tiers.
 * 
 * @param {Array<Object>} opportunities - Selected opportunity documents
 * @returns {Array<Object>} Deterministically sorted aggregated target skills
 */
export function aggregateTargetSkills(opportunities = []) {
  if (!Array.isArray(opportunities) || opportunities.length === 0) {
    return [];
  }

  const totalOpps = opportunities.length;
  // Map<canonicalKey, { canonicalKey, displayName, category, oppSet: Set<oppId> }>
  const skillMap = new Map();

  for (const opp of opportunities) {
    const oppId = String(opp._id || opp.id || '');
    const reqs = getOpportunityRequirements(opp);

    for (const req of reqs) {
      if (!req.canonicalKey) continue;
      const key = req.canonicalKey.toLowerCase().trim();

      let entry = skillMap.get(key);
      if (!entry) {
        entry = {
          canonicalKey: key,
          displayName: req.displayName || key,
          category: req.category || 'other',
          oppSet: new Set(),
        };
        skillMap.set(key, entry);
      }
      entry.oppSet.add(oppId);
    }
  }

  return Array.from(skillMap.values())
    .map((entry) => {
      const requiredByCount = entry.oppSet.size;
      const impactPercent = Math.round((requiredByCount / totalOpps) * 100);
      const priority = getGapPriority(impactPercent);

      return {
        canonicalKey: entry.canonicalKey,
        displayName: entry.displayName,
        category: entry.category,
        requiredByOpportunityCount: requiredByCount,
        totalOpportunities: totalOpps,
        impactPercent,
        priority,
        affectedOpportunityIds: Array.from(entry.oppSet).sort(),
      };
    })
    .sort((a, b) => {
      // 1. Impact percent descending
      if (b.impactPercent !== a.impactPercent) return b.impactPercent - a.impactPercent;
      // 2. Required opportunity count descending
      if (b.requiredByOpportunityCount !== a.requiredByOpportunityCount) {
        return b.requiredByOpportunityCount - a.requiredByOpportunityCount;
      }
      // 3. Alphabetical ascending by canonicalKey
      return a.canonicalKey.localeCompare(b.canonicalKey);
    });
}

/**
 * Evaluates skill coverage across aggregated target skills.
 * 
 * @param {Array<Object>} targetSkills - Output of aggregateTargetSkills
 * @param {Map<string, Object>} candidateSkills - Output of getCandidateSkillProfile
 * @returns {Object} Skill coverage dimension
 */
export function evaluateSkillCoverage(targetSkills, candidateSkills) {
  const totalCount = targetSkills.length;
  if (totalCount === 0) {
    return {
      status: 'insufficient_data',
      percentage: 0,
      coveredCount: 0,
      totalCount: 0,
      coveredSkills: [],
      uncoveredSkills: [],
    };
  }

  const coveredSkills = [];
  const uncoveredSkills = [];

  for (const tSkill of targetSkills) {
    const candidateMatch = candidateSkills.get(tSkill.canonicalKey);
    if (candidateMatch) {
      coveredSkills.push({
        ...tSkill,
        coveredByProfile: true,
      });
    } else {
      uncoveredSkills.push({
        ...tSkill,
        coveredByProfile: false,
      });
    }
  }

  const coveredCount = coveredSkills.length;
  const percentage = Math.round((coveredCount / totalCount) * 100);

  let status = 'low';
  if (percentage >= 80) status = 'excellent';
  else if (percentage >= 60) status = 'good';
  else if (percentage >= 40) status = 'moderate';

  return {
    status,
    percentage,
    coveredCount,
    totalCount,
    coveredSkills,
    uncoveredSkills,
  };
}

/**
 * Evaluates evidence depth and verification hierarchy for covered skills.
 * 
 * Hierarchy:
 * Verified (GitHub) -> Demonstrated (Portfolio Project) -> Practicing (Learning catalog) -> Claimed (Profile only)
 * 
 * @param {Array<Object>} coveredSkills
 * @param {Map<string, Object>} candidateSkills
 * @param {Array<Object>} [learningProgress=[]]
 * @param {Array<Object>} [tracks=[]]
 * @param {Array<Object>} [items=[]]
 * @returns {Object} Evidence strength dimension
 */
export function evaluateEvidenceStrength(
  coveredSkills,
  candidateSkills,
  learningProgress = [],
  tracks = [],
  items = []
) {
  const totalCovered = coveredSkills.length;
  if (totalCovered === 0) {
    return {
      status: 'none',
      verificationRate: 0,
      verifiedCount: 0,
      demonstratedCount: 0,
      practicingCount: 0,
      claimedCount: 0,
      breakdown: [],
    };
  }

  let verifiedCount = 0;
  let demonstratedCount = 0;
  let practicingCount = 0;
  let claimedCount = 0;

  const breakdown = [];

  for (const skill of coveredSkills) {
    const cMatch = candidateSkills.get(skill.canonicalKey);
    const hasGitHub = Boolean(
      cMatch?.githubEvidence?.repositories && cMatch.githubEvidence.repositories.length > 0
    );
    const hasProject = Boolean(cMatch?.projects && cMatch.projects.length > 0);
    const isClaimed = Boolean(cMatch?.isClaimed);

    // Check if skill is being actively practiced in curriculum
    const hasCurriculum = learningProgress.some((p) => {
      const status = p.status || '';
      if (!['Learning', 'Practiced', 'Completed', 'Mastered'].includes(status)) return false;
      const track = tracks.find((t) => String(t._id || t.id) === String(p.trackId));
      const item = items.find((i) => String(i._id || i.id) === String(p.itemId));
      return isLearningRelevantToSkill(skill, track, item);
    });

    let evidenceStrength = 'claimed';
    let topProof = null;

    if (hasGitHub) {
      evidenceStrength = 'verified';
      verifiedCount++;
      const topRepo = cMatch.githubEvidence.repositories[0];
      topProof = {
        type: 'github',
        name: topRepo.name,
        url: topRepo.url,
        primaryLanguage: topRepo.primaryLanguage || null,
        updatedAt: topRepo.updatedAt || null,
        isFork: Boolean(topRepo.isFork),
      };
    } else if (hasProject) {
      evidenceStrength = 'demonstrated';
      demonstratedCount++;
      const proj = cMatch.projects[0];
      topProof = {
        type: 'project',
        title: proj.title,
        description: proj.description || '',
      };
    } else if (hasCurriculum) {
      evidenceStrength = 'practicing';
      practicingCount++;
      topProof = {
        type: 'curriculum',
      };
    } else {
      evidenceStrength = 'claimed';
      claimedCount++;
      topProof = {
        type: 'profile_claim',
        proficiency: cMatch?.proficiency || 'intermediate',
      };
    }

    breakdown.push({
      canonicalKey: skill.canonicalKey,
      displayName: skill.displayName,
      category: skill.category,
      evidenceStrength,
      sources: {
        claimed: isClaimed,
        portfolioProject: hasProject,
        githubVerified: hasGitHub,
        curriculumProgress: hasCurriculum,
      },
      topProof,
    });
  }

  // Sort breakdown: verified first, demonstrated second, practicing third, claimed last
  const STRENGTH_ORDER = { verified: 4, demonstrated: 3, practicing: 2, claimed: 1 };
  breakdown.sort((a, b) => {
    const diff = (STRENGTH_ORDER[b.evidenceStrength] || 0) - (STRENGTH_ORDER[a.evidenceStrength] || 0);
    if (diff !== 0) return diff;
    return a.canonicalKey.localeCompare(b.canonicalKey);
  });

  const verifiedOrDemonstrated = verifiedCount + demonstratedCount;
  const verificationRate = Math.round((verifiedOrDemonstrated / totalCovered) * 100);

  let status = 'unverified';
  if (verificationRate >= 60) status = 'strong';
  else if (verificationRate >= 30) status = 'moderate';

  return {
    status,
    verificationRate,
    verifiedCount,
    demonstratedCount,
    practicingCount,
    claimedCount,
    breakdown,
  };
}

/**
 * Evaluates preparation plan task execution across target opportunities.
 * Inspects deterministic [CareerOS Prep: tags in user Todos.
 * 
 * @param {Array<Object>} todos - User Todo documents
 * @param {Array<string>} cohortOpportunityIds - Opportunity IDs in target cohort
 * @returns {Object} Preparation execution dimension
 */
export function evaluatePreparationExecution(todos = [], cohortOpportunityIds = []) {
  if (!Array.isArray(todos) || todos.length === 0) {
    return {
      status: 'no_tasks',
      percentage: 0,
      total: 0,
      completed: 0,
      pending: 0,
      prepTodos: [],
    };
  }

  const cohortSet = new Set(cohortOpportunityIds);

  // Filter todos containing CareerOS prep tag
  const prepTodos = todos.filter((todo) => {
    if (!todo.description || typeof todo.description !== 'string') return false;
    if (!todo.description.includes('[CareerOS Prep:')) return false;

    // If cohort is defined, verify if todo belongs to cohort
    if (cohortSet.size > 0) {
      return Array.from(cohortSet).some((oppId) =>
        todo.description.includes(`[CareerOS Prep: ${oppId}:`)
      );
    }
    return true;
  });

  const total = prepTodos.length;
  if (total === 0) {
    return {
      status: 'no_tasks',
      percentage: 0,
      total: 0,
      completed: 0,
      pending: 0,
      prepTodos: [],
    };
  }

  const completed = prepTodos.filter((t) => Boolean(t.completed)).length;
  const pending = total - completed;
  const percentage = Math.round((completed / total) * 100);

  let status = 'not_started';
  if (percentage === 100) status = 'complete';
  else if (percentage >= 60) status = 'on_track';
  else if (percentage > 0) status = 'in_progress';

  return {
    status,
    percentage,
    total,
    completed,
    pending,
  };
}

/**
 * Evaluates learning velocity against identified skill gaps.
 * Rewards curriculum engagement that directly bridges target opportunities.
 * 
 * @param {Array<Object>} uncoveredSkills - Identified skill gaps
 * @param {Array<Object>} learningProgress - User learning progress records
 * @param {Array<Object>} tracks - Available learning tracks
 * @param {Array<Object>} items - Available learning items
 * @param {Date} [referenceDate=new Date()]
 * @returns {Object} Learning velocity dimension
 */
export function evaluateLearningVelocity(
  uncoveredSkills = [],
  learningProgress = [],
  tracks = [],
  items = [],
  referenceDate = new Date()
) {
  if (!Array.isArray(learningProgress) || learningProgress.length === 0) {
    return {
      status: 'none',
      relevantActiveItems: 0,
      relevantCompletedItems: 0,
      recentProgress: false,
      alignedGapsCount: 0,
    };
  }

  const recentWindowMs = RECENT_ACTIVITY_DAYS * 24 * 60 * 60 * 1000;
  const refTime = referenceDate.getTime();

  let relevantActiveCount = 0;
  let relevantCompletedCount = 0;
  let hasRecentProgress = false;
  const alignedGapsSet = new Set();

  for (const prog of learningProgress) {
    const status = prog.status || '';
    const track = tracks.find((t) => String(t._id || t.id) === String(prog.trackId));
    const item = items.find((i) => String(i._id || i.id) === String(prog.itemId));

    // Check if this progress record aligns with any uncovered target skill gap
    let isAligned = false;
    for (const gap of uncoveredSkills) {
      if (isLearningRelevantToSkill(gap, track, item)) {
        isAligned = true;
        alignedGapsSet.add(gap.canonicalKey);
      }
    }

    if (isAligned) {
      if (['Completed', 'Mastered'].includes(status)) {
        relevantCompletedCount++;
      } else if (['Learning', 'Practiced'].includes(status)) {
        relevantActiveCount++;
      }

      if (prog.updatedAt) {
        const upTime = new Date(prog.updatedAt).getTime();
        if (refTime - upTime <= recentWindowMs) {
          hasRecentProgress = true;
        }
      }
    }
  }

  let status = 'none';
  if (relevantActiveCount > 0 || relevantCompletedCount > 0) {
    status = hasRecentProgress ? 'active' : 'paused';
  } else if (learningProgress.some((p) => ['Learning', 'Completed'].includes(p.status))) {
    status = 'unaligned'; // Learning items exist, but none match current target gaps
  }

  return {
    status,
    relevantActiveItems: relevantActiveCount,
    relevantCompletedItems: relevantCompletedCount,
    recentProgress: hasRecentProgress,
    alignedGapsCount: alignedGapsSet.size,
  };
}

/**
 * Evaluates application pipeline momentum, interview stages, and stalled submissions.
 * 
 * @param {Array<Object>} applications - User application documents
 * @param {Date} [referenceDate=new Date()]
 * @returns {Object} Application pipeline dimension
 */
export function evaluateApplicationPipeline(applications = [], referenceDate = new Date()) {
  if (!Array.isArray(applications) || applications.length === 0) {
    return {
      status: 'dormant',
      totalTracked: 0,
      activeApplications: 0,
      interviewCount: 0,
      selectedCount: 0,
      stalledApplications: 0,
      recentApplications: 0,
    };
  }

  const refTime = referenceDate.getTime();
  const recentWindowMs = RECENT_ACTIVITY_DAYS * 24 * 60 * 60 * 1000;
  const stalledWindowMs = STALLED_APPLICATION_DAYS * 24 * 60 * 60 * 1000;

  let activeCount = 0;
  let interviewCount = 0;
  let selectedCount = 0;
  let stalledCount = 0;
  let recentCount = 0;

  for (const app of applications) {
    const status = String(app.status || '').toLowerCase();
    const isApplicationActive = ['applied', 'interview', 'waiting', 'registered'].includes(status);

    if (isApplicationActive) {
      activeCount++;
    }

    if (status === 'interview') {
      interviewCount++;
    }

    if (status === 'selected' || status === 'completed') {
      selectedCount++;
    }

    const appDate = app.appliedAt || app.registeredAt || app.createdAt;
    if (appDate) {
      const time = new Date(appDate).getTime();
      if (refTime - time <= recentWindowMs) {
        recentCount++;
      }
      if (status === 'applied' && refTime - time > stalledWindowMs) {
        stalledCount++;
      }
    }
  }

  let status = 'dormant';
  if (interviewCount > 0) status = 'active_interviews';
  else if (activeCount >= 3) status = 'active_pipeline';
  else if (activeCount >= 1) {
    status = stalledCount === activeCount ? 'stalled' : 'early_pipeline';
  }

  return {
    status,
    totalTracked: applications.length,
    activeApplications: activeCount,
    interviewCount,
    selectedCount,
    stalledApplications: stalledCount,
    recentApplications: recentCount,
  };
}

/**
 * Determines the categorical readiness band based on multi-dimensional signals.
 * 
 * Bounded bands:
 * - Target Ready
 * - Advancing
 * - Developing
 * - Early Stage
 * 
 * @param {Object} dimensions - Evaluated dimensions
 * @returns {Object} Categorical band descriptor
 */
export function determineReadinessBand(dimensions) {
  const {
    skillCoverage,
    evidenceStrength,
    preparationExecution,
    learningVelocity,
    applicationPipeline,
  } = dimensions;

  const coverage = skillCoverage.percentage || 0;
  const verification = evidenceStrength.verificationRate || 0;
  const prep = preparationExecution.percentage || 0;
  const activeApps = applicationPipeline.activeApplications || 0;
  const hasCurriculum = learningVelocity.relevantActiveItems > 0 || learningVelocity.relevantCompletedItems > 0;

  const drivers = [];

  // Band 1: Target Ready
  if (
    coverage >= 75 &&
    verification >= 50 &&
    (activeApps >= 1 || prep >= 50 || preparationExecution.status === 'no_tasks')
  ) {
    drivers.push(`Strong core skill coverage (${coverage}%) across target opportunities.`);
    drivers.push(`High evidence verification rate (${verification}%) backed by code or projects.`);
    if (activeApps > 0) drivers.push(`Active application pipeline in progress (${activeApps} active).`);

    return {
      band: 'Target Ready',
      label: 'Target Ready',
      summary: 'You demonstrate strong skill coverage and verified project evidence for your target opportunities.',
      primaryDrivers: drivers,
    };
  }

  // Band 2: Advancing
  if (
    coverage >= 50 &&
    (verification >= 25 || hasCurriculum || prep > 0 || activeApps > 0)
  ) {
    drivers.push(`Solid foundational skill coverage (${coverage}%) for target opportunities.`);
    if (verification > 0) drivers.push(`${verification}% of covered skills backed by verified code or projects.`);
    if (hasCurriculum) drivers.push('Active curriculum engagement addressing identified target gaps.');
    if (prep > 0) drivers.push(`Preparation task execution underway (${prep}% complete).`);

    return {
      band: 'Advancing',
      label: 'Advancing',
      summary: 'Solid foundation for target roles. Bridging remaining skill gaps and strengthening project proof will elevate your readiness.',
      primaryDrivers: drivers,
    };
  }

  // Band 3: Developing
  if (coverage >= 25) {
    drivers.push(`Emerging skill alignment (${coverage}%) with clear target opportunities identified.`);
    if (skillCoverage.uncoveredSkills?.length > 0) {
      drivers.push(`${skillCoverage.uncoveredSkills.length} key requirement gaps to bridge.`);
    }

    return {
      band: 'Developing',
      label: 'Developing',
      summary: 'Key skill requirements identified for your target roles. Focus on closing high-priority skill gaps.',
      primaryDrivers: drivers,
    };
  }

  // Band 4: Early Stage
  drivers.push(`Limited skill alignment (${coverage}%) or unconfigured target opportunities.`);
  return {
    band: 'Early Stage',
    label: 'Early Stage',
    summary: 'Define your career targets and begin building core technical skills.',
    primaryDrivers: drivers,
  };
}

/**
 * Derives actionable recommendations from identified gaps and pipeline states.
 * Reuses existing CareerOS operational actions.
 * 
 * @param {Object} context
 * @returns {Array<Object>} Bounded list of deterministic actions
 */
export function deriveReadinessActions({
  skillCoverage,
  evidenceStrength,
  preparationExecution,
  applicationPipeline,
  githubEvidence,
  totalOpportunities = 0,
  referenceDate = new Date(),
  appIntel,
}) {
  const actions = [];
  const seenKeys = new Set();

  function addAction(action) {
    if (!action || seenKeys.has(action.actionKey)) return;
    seenKeys.add(action.actionKey);
    actions.push(action);
  }

  // Action 0: Cold start / Zero opportunities
  const hasTargets = Boolean(
    totalOpportunities > 0 ||
    skillCoverage?.totalCount > 0 ||
    skillCoverage?.uncoveredSkills?.length > 0 ||
    skillCoverage?.coveredSkills?.length > 0
  );

  if (!hasTargets) {
    addAction({
      actionKey: 'action:save_target_opportunities',
      type: 'explore_opportunities',
      title: 'Bookmark target opportunities',
      description: 'Explore published roles and bookmark 3 opportunities that match your career goals to generate personalized readiness intelligence.',
      priority: 'High',
    });
  }

  // Action 1: High-Impact Skill Gaps (P0/P1 gaps), enriched with rejection recurrence
  const sortedGaps = [...(skillCoverage.uncoveredSkills || [])].sort((a, b) => {
    const aPattern = appIntel?.rejectionPatterns?.patterns?.some((p) => p.canonicalKey === a.canonicalKey);
    const bPattern = appIntel?.rejectionPatterns?.patterns?.some((p) => p.canonicalKey === b.canonicalKey);
    if (aPattern && !bPattern) return -1;
    if (!aPattern && bPattern) return 1;
    if (b.impactPercent !== a.impactPercent) return b.impactPercent - a.impactPercent;
    return a.canonicalKey.localeCompare(b.canonicalKey);
  });

  const topGaps = sortedGaps.slice(0, 2);
  for (const gap of topGaps) {
    let desc = `${gap.displayName} is required by ${gap.requiredByOpportunityCount} of your target opportunities (${gap.impactPercent}%). Study fundamentals and complete a practical demo.`;
    
    // Check for Application Intelligence recurring rejection pattern
    const pattern = appIntel?.rejectionPatterns?.patterns?.find((p) => p.canonicalKey === gap.canonicalKey);
    
    // Deterministic Action Priority Rule (Phase 11G Batch 5A):
    // P0/P1 target gap + recurring rejection evidence -> High priority
    // P2/P3 target gap + recurring rejection evidence -> Medium priority
    // Without recurring rejection evidence: P0 -> High, P1/P2/P3 -> Medium
    let priority = gap.priority === 'P0' ? 'High' : 'Medium';
    if (pattern) {
      if (gap.priority === 'P0' || gap.priority === 'P1') {
        priority = 'High';
      } else {
        priority = 'Medium';
      }
      if (pattern.observation) {
        desc += ` ${pattern.observation}`;
      }
    }

    const actionObj = {
      actionKey: `action:gap:${gap.canonicalKey}`,
      type: 'skill_gap',
      title: `Learn ${gap.displayName} (${gap.priority} Priority)`,
      description: desc,
      priority,
      skillKey: gap.canonicalKey,
      impactPercent: gap.impactPercent,
      targetOpportunityImpact: gap.impactPercent,
    };

    if (pattern) {
      actionObj.rejectionRecurrence = pattern.recurrencePercent;
      actionObj.observationalContext = pattern.observation;
    }

    addAction(actionObj);
  }

  // Action 2: Evidence Strengthening (Covered skills that are only claimed)
  const claimedOnlySkills = (evidenceStrength.breakdown || [])
    .filter((s) => s.evidenceStrength === 'claimed')
    .slice(0, 2);

  for (const skill of claimedOnlySkills) {
    addAction({
      actionKey: `action:evidence:${skill.canonicalKey}`,
      type: 'strengthen_evidence',
      title: `Add project proof for ${skill.displayName}`,
      description: `${skill.displayName} is listed on your profile but lacks linked GitHub code or portfolio projects. Add verifiable proof to improve employer confidence.`,
      priority: 'Medium',
      skillKey: skill.canonicalKey,
    });
  }

  // Action 3: Stale GitHub Repository Refresh (> 180 days)
  if (githubEvidence && Array.isArray(githubEvidence.detectedSkills)) {
    for (const gSkill of githubEvidence.detectedSkills) {
      const topRepo = gSkill.repositories?.[0];
      if (topRepo?.updatedAt) {
        const upTime = new Date(topRepo.updatedAt).getTime();
        if (!isNaN(upTime)) {
          const daysOld = (referenceDate.getTime() - upTime) / (1000 * 60 * 60 * 24);
          if (daysOld > STALE_REPO_DAYS_THRESHOLD) {
            addAction({
              actionKey: `action:github_refresh:${gSkill.canonicalKey}`,
              type: 'github_refresh',
              title: `Refresh ${topRepo.name} repository`,
              description: `Your repository ${topRepo.name} demonstrating ${gSkill.displayName} has not been updated in over ${Math.floor(daysOld)} days. Refresh dependencies and documentation.`,
              priority: 'Low',
              skillKey: gSkill.canonicalKey,
            });
            break; // 1 refresh action is sufficient
          }
        }
      }
    }
  }

  // Action 4: Preparation Execution (if pending prep tasks exist)
  if (preparationExecution.pending > 0) {
    addAction({
      actionKey: 'action:prep_execution',
      type: 'prep_execution',
      title: `Complete pending preparation tasks (${preparationExecution.pending} pending)`,
      description: `You have ${preparationExecution.pending} open preparation task${preparationExecution.pending > 1 ? 's' : ''} for your target opportunities. Work through them to stay on track.`,
      priority: 'Medium',
    });
  }

  // Action 5: Stalled Application Follow-Up (Enriched)
  if (appIntel && appIntel.actions && appIntel.actions.length > 0) {
    for (const appAction of appIntel.actions) {
      addAction(appAction);
    }
  } else if (applicationPipeline.stalledApplications > 0) {
    addAction({
      actionKey: 'action:application_followup',
      type: 'application_followup',
      title: 'Follow up on pending applications',
      description: `You have ${applicationPipeline.stalledApplications} application${applicationPipeline.stalledApplications > 1 ? 's' : ''} submitted over ${STALLED_APPLICATION_DAYS} days ago without updates. Check your application portal or send a polite inquiry.`,
      priority: 'Low',
    });
  }

  // Action: Unscheduled Interviews (Enriched)
  if (appIntel && appIntel.interviewInsights) {
    const unscheduled = appIntel.interviewInsights.filter(i => !i.interviewScheduled);
    for (const insight of unscheduled) {
      addAction({
        actionKey: `action:schedule_interview:${insight.applicationId}`,
        type: 'schedule_interview',
        title: `Schedule interview for ${insight.organization}`,
        description: insight.preparationSignal,
        priority: 'High',
      });
    }
  }

  // Action 6: Submit Applications (if skill coverage is strong but pipeline is dormant)
  if (
    skillCoverage.percentage >= 60 &&
    applicationPipeline.activeApplications === 0
  ) {
    addAction({
      actionKey: 'action:submit_application',
      type: 'submit_application',
      title: 'Submit application to target opportunities',
      description: 'You have solid skill alignment for your target opportunities. Tailor your resume and submit applications before deadlines close.',
      priority: 'High',
    });
  }

  // Sort actions: High priority first, then Medium, then Low, breaking ties by actionKey
  const PRIORITY_SORT = { High: 3, Medium: 2, Low: 1 };
  return actions
    .sort((a, b) => {
      const pDiff = (PRIORITY_SORT[b.priority] || 0) - (PRIORITY_SORT[a.priority] || 0);
      if (pDiff !== 0) return pDiff;
      return a.actionKey.localeCompare(b.actionKey);
    })
    .slice(0, 6);
}

/**
 * Pure synchronous deterministic computation of career readiness.
 * Accepts in-memory documents/objects; 100% offline-testable.
 * 
 * @param {Object} inputs
 * @param {Object} inputs.profile - Profile document or plain object
 * @param {Array<Object>} [inputs.opportunities=[]] - Target opportunities
 * @param {Array<Object>} [inputs.applications=[]] - User applications
 * @param {Array<Object>} [inputs.savedOpportunities=[]] - User saved opportunities
 * @param {Array<Object>} [inputs.todos=[]] - User todos
 * @param {Array<Object>} [inputs.learningProgress=[]] - User learning progress
 * @param {Array<Object>} [inputs.tracks=[]] - Learning tracks
 * @param {Array<Object>} [inputs.items=[]] - Learning items
 * @param {Object} [options={}]
 * @param {Date} [options.referenceDate=new Date()]
 * @param {string} [options.guidanceMessage]
 * @returns {Object} Structured Career Readiness Snapshot
 */
export function computeCareerReadiness(
  {
    profile,
    opportunities = [],
    applications = [],
    savedOpportunities = [],
    todos = [],
    calendarEvents = [],
    learningProgress = [],
    tracks = [],
    items = [],
    applicationOpportunities = [],
  },
  options = {}
) {
  const referenceDate = options.referenceDate instanceof Date ? options.referenceDate : new Date();

  // 1. Candidate Skills
  const candidateSkills = getCandidateSkillProfile(profile);

  // 2. Aggregate Target Skills (strictly from target cohort opportunities)
  const targetSkills = aggregateTargetSkills(opportunities);

  // 3. Evaluate Dimensions
  const skillCoverage = evaluateSkillCoverage(targetSkills, candidateSkills);
  const evidenceStrength = evaluateEvidenceStrength(
    skillCoverage.coveredSkills,
    candidateSkills,
    learningProgress,
    tracks,
    items
  );

  const cohortOpportunityIds = opportunities.map((o) => String(o._id || o.id));
  const preparationExecution = evaluatePreparationExecution(todos, cohortOpportunityIds);
  const learningVelocity = evaluateLearningVelocity(
    skillCoverage.uncoveredSkills,
    learningProgress,
    tracks,
    items,
    referenceDate
  );
  const applicationPipeline = evaluateApplicationPipeline(applications, referenceDate);

  // Merge target opportunities and any extra application opportunities for application intelligence lookup
  const appIntelOpportunities = [...opportunities];
  if (Array.isArray(applicationOpportunities)) {
    for (const opp of applicationOpportunities) {
      const id = String(opp._id || opp.id || '');
      if (id && !appIntelOpportunities.some((o) => String(o._id || o.id) === id)) {
        appIntelOpportunities.push(opp);
      }
    }
  }
  for (const app of applications) {
    if (app && app.opportunityId && typeof app.opportunityId === 'object') {
      const id = String(app.opportunityId._id || app.opportunityId.id || '');
      if (id && !appIntelOpportunities.some((o) => String(o._id || o.id) === id)) {
        appIntelOpportunities.push(app.opportunityId);
      }
    }
  }

  // Compute Application Intelligence for Enrichment (One-Way Dependency)
  const appIntel = computeApplicationIntelligence(
    {
      applications,
      opportunities: appIntelOpportunities,
      savedOpportunities,
      todos,
      calendarEvents,
      profile,
    },
    { referenceDate }
  );

  // 4. Dimensions Object
  const dimensions = {
    skillCoverage: {
      status: skillCoverage.status,
      percentage: skillCoverage.percentage,
      coveredCount: skillCoverage.coveredCount,
      totalCount: skillCoverage.totalCount,
      topGaps: (skillCoverage.uncoveredSkills || []).slice(0, 5),
    },
    evidenceStrength: {
      status: evidenceStrength.status,
      verificationRate: evidenceStrength.verificationRate,
      verifiedCount: evidenceStrength.verifiedCount,
      demonstratedCount: evidenceStrength.demonstratedCount,
      practicingCount: evidenceStrength.practicingCount,
      claimedCount: evidenceStrength.claimedCount,
      breakdown: evidenceStrength.breakdown,
    },
    preparationExecution: {
      status: preparationExecution.status,
      percentage: preparationExecution.percentage,
      completed: preparationExecution.completed,
      total: preparationExecution.total,
      pending: preparationExecution.pending,
    },
    learningVelocity: {
      status: learningVelocity.status,
      relevantActiveItems: learningVelocity.relevantActiveItems,
      relevantCompletedItems: learningVelocity.relevantCompletedItems,
      recentProgress: learningVelocity.recentProgress,
      alignedGapsCount: learningVelocity.alignedGapsCount,
    },
    applicationPipeline: {
      status: applicationPipeline.status,
      totalTracked: applicationPipeline.totalTracked,
      activeApplications: applicationPipeline.activeApplications,
      interviewCount: applicationPipeline.interviewCount,
      selectedCount: applicationPipeline.selectedCount,
      stalledApplications: applicationPipeline.stalledApplications,
      recentApplications: applicationPipeline.recentApplications,
    },
  };

  // 5. Readiness Band
  const readinessBand = determineReadinessBand(dimensions);

  if (appIntel && appIntel.health) {
    if (appIntel.health.state === 'Needs Attention' || appIntel.health.state === 'Stalled') {
      const uniqueDrivers = appIntel.health.drivers.filter(d => !readinessBand.primaryDrivers.includes(d));
      readinessBand.primaryDrivers.push(...uniqueDrivers);
    }
  }

  // Contextual Observational Driver: Recurring rejection gap recurrence
  if (appIntel?.rejectionPatterns?.patterns?.length > 0) {
    for (const pattern of appIntel.rejectionPatterns.patterns.slice(0, 2)) {
      const driver = `${pattern.displayName} also appears in several recent rejected opportunities (${pattern.rejectedOpportunityCount} of ${pattern.totalRejectedOpportunitiesAnalyzed}).`;
      if (!readinessBand.primaryDrivers.includes(driver)) {
        readinessBand.primaryDrivers.push(driver);
      }
    }
  }

  // Contextual Observational Driver: Preparation pending at apply
  if (Array.isArray(appIntel?.preparationFeedback)) {
    const pendingAtApply = appIntel.preparationFeedback.filter(
      (f) => f.prepStatus === 'prep_pending_at_apply'
    );
    if (pendingAtApply.length > 0) {
      const driver = `${pendingAtApply.length} target application(s) were submitted while preparation tasks were pending.`;
      if (!readinessBand.primaryDrivers.includes(driver)) {
        readinessBand.primaryDrivers.push(driver);
      }
    }
  }

  // Contextual Observational Driver: Positive selected outcome signal
  const selectedDemonstrated = appIntel?.outcomes?.selectedSkillsDemonstrated || [];
  if (selectedDemonstrated.length > 0) {
    const topSelected = selectedDemonstrated[0];
    const candSkill = candidateSkills.get(topSelected.canonicalKey);
    const hasGithub = candSkill?.githubEvidence?.repoCount > 0;
    const proofText = hasGithub ? ' and is backed by your GitHub proof' : '';
    const driver = `${topSelected.displayName} has appeared in a selected application${proofText}.`;
    if (!readinessBand.primaryDrivers.includes(driver)) {
      readinessBand.primaryDrivers.push(driver);
    }
  }

  // 6. Readiness Actions
  const actions = deriveReadinessActions({
    skillCoverage,
    evidenceStrength,
    preparationExecution,
    applicationPipeline,
    githubEvidence: profile?.githubEvidence || null,
    totalOpportunities: opportunities.length,
    referenceDate,
    appIntel,
  });

  // 7. Target Profile Descriptor
  const targetRoles = [];
  if (profile?.careerGoal?.title && typeof profile.careerGoal.title === 'string' && profile.careerGoal.title.trim()) {
    targetRoles.push(profile.careerGoal.title.trim());
  }

  const guidance = options.guidanceMessage || (
    opportunities.length === 0 || options.isColdStart === true
      ? 'Save 3 target opportunities to personalize your career readiness.'
      : null
  );

  const sourceOpportunities = opportunities.map((opp) => ({
    id: String(opp._id || opp.id),
    title: opp.title || 'Untitled Opportunity',
    organization: opp.organization || 'Organization',
    type: opp.type || 'internship',
    deadline: opp.deadline || null,
  }));

  const enrichedSkillGaps = skillCoverage.uncoveredSkills.slice(0, 6).map(gap => {
    const pattern = appIntel?.rejectionPatterns?.patterns?.find(p => p.canonicalKey === gap.canonicalKey);
    if (pattern && pattern.observation) {
      return {
        ...gap,
        observation: pattern.observation,
        rejectionRecurrence: pattern.recurrencePercent,
        rejectedOpportunityCount: pattern.rejectedOpportunityCount,
      };
    }
    return gap;
  });

  // 8. Application Intelligence Contextual Insights (Read-only, non-scoring)
  const selectedOutcomeSignals = (appIntel?.outcomes?.selectedSkillsDemonstrated || []).map((s) => {
    const candSkill = candidateSkills.get(s.canonicalKey);
    const hasGithub = candSkill?.githubEvidence?.repoCount > 0;
    const proofText = hasGithub ? ' and is backed by your GitHub proof' : '';
    return {
      canonicalKey: s.canonicalKey,
      displayName: s.displayName,
      count: s.count,
      signal: `${s.displayName} has appeared in a selected application${proofText}.`,
    };
  });

  const applicationInsights = {
    recurringRejectionGaps: (appIntel?.rejectionPatterns?.patterns || []).map((p) => ({
      canonicalKey: p.canonicalKey,
      displayName: p.displayName,
      rejectedOpportunityCount: p.rejectedOpportunityCount,
      totalRejectedOpportunitiesAnalyzed: p.totalRejectedOpportunitiesAnalyzed,
      recurrencePercent: p.recurrencePercent,
      candidateEvidence: p.candidateEvidence,
      observation: p.observation,
    })),
    selectedOutcomeSignals,
    pipelineSignals: {
      healthState: appIntel?.health?.state || 'Healthy',
      velocity: appIntel?.recentActivity?.velocity || 'none',
      stalledCount: appIntel?.stalledApplications?.length || 0,
      unscheduledInterviewsCount: (appIntel?.interviewInsights || []).filter((i) => !i.interviewScheduled).length,
    },
  };

  return {
    readinessBand,
    targetProfile: {
      totalOpportunities: opportunities.length,
      targetRoles,
      cohortSources: options.cohortSources || {
        savedCount: savedOpportunities.length,
        appliedCount: applications.length,
        fallbackCount: 0,
        totalCount: opportunities.length,
      },
      guidance,
    },
    dimensions,
    skillGaps: enrichedSkillGaps,
    evidence: evidenceStrength.breakdown,
    actions,
    sourceOpportunities,
    applicationInsights,
    generatedAt: referenceDate,
  };
}

/**
 * Service Entry Point: Queries required data for authenticated user
 * and calculates the deterministic career readiness snapshot.
 * 
 * Read-only: zero database mutations.
 * 
 * @param {string|mongoose.Types.ObjectId} userId - Authenticated user ID
 * @param {Object} [options={}] - Options (referenceDate, maxOpportunities, in-memory overrides)
 * @returns {Promise<Object>} Career Readiness Snapshot
 */
export async function calculateCareerReadiness(userId, options = {}) {
  const referenceDate = options.referenceDate instanceof Date ? options.referenceDate : new Date();
  const maxOpps = options.maxOpportunities || MAX_TARGET_OPPORTUNITIES;

  // 1. Fetch Profile (or use injected profile in options for testing)
  let profile = options.profile;
  if (!profile && mongoose.connection.readyState === 1) {
    profile = await Profile.findOne({ userId }).lean();
  }

  if (!profile) {
    profile = {
      userId,
      skills: [],
      projects: [],
      careerPreferences: {},
      careerGoal: {},
      githubEvidence: null,
    };
  }

  // 2. Fetch User Saved Opportunities & Applications
  let savedOpportunities = options.savedOpportunities;
  let applications = options.applications;

  if (!savedOpportunities && mongoose.connection.readyState === 1) {
    savedOpportunities = await SavedOpportunity.find({ userId })
      .sort({ createdAt: -1 })
      .limit(maxOpps)
      .lean();
  }
  savedOpportunities = Array.isArray(savedOpportunities) ? savedOpportunities : [];

  if (!applications && mongoose.connection.readyState === 1) {
    applications = await Application.find({ userId })
      .sort({ appliedAt: -1, createdAt: -1 })
      .limit(maxOpps)
      .lean();
  }
  applications = Array.isArray(applications) ? applications : [];

  // 3. Fallback published opportunities if cohort is sparse
  let fallbackOpportunities = options.fallbackOpportunities || [];
  const hasUserTargets = savedOpportunities.length > 0 || applications.length > 0;
  let isColdStart = !hasUserTargets;

  if (!hasUserTargets && fallbackOpportunities.length === 0 && mongoose.connection.readyState === 1) {
    // Attempt preference/goal based published fallback
    const prefTypes = profile.careerPreferences?.opportunityTypes || [];
    const query = { status: 'published' };
    if (prefTypes.length > 0) {
      query.type = { $in: prefTypes };
    }
    fallbackOpportunities = await Opportunity.find(query)
      .sort({ postedAt: -1, createdAt: -1 })
      .limit(maxOpps)
      .lean();
  }

  // 4. Build Target Cohort IDs
  const { cohortOpportunityIds, sources } = buildTargetCohortIds({
    savedOpportunities,
    applications,
    fallbackOpportunities,
    maxOpportunities: maxOpps,
  });

  // Collect any opportunity IDs associated with applications (including rejected/selected ones)
  const appOppIds = applications
    .map((app) => String(app.opportunityId?._id || app.opportunityId || ''))
    .filter(Boolean);
  const extraOppIds = appOppIds.filter((id) => !cohortOpportunityIds.includes(id));

  // 5. Fetch Opportunities by ID (or use injected options.opportunities)
  let opportunities = options.opportunities;
  if (!opportunities && mongoose.connection.readyState === 1) {
    if (cohortOpportunityIds.length > 0) {
      opportunities = await Opportunity.find({
        _id: { $in: cohortOpportunityIds },
        status: 'published',
      }).lean();

      // Deterministically sort to match cohortOpportunityIds order
      const idOrderMap = new Map(cohortOpportunityIds.map((id, idx) => [id, idx]));
      opportunities.sort((a, b) => {
        const idxA = idOrderMap.get(String(a._id)) ?? 999;
        const idxB = idOrderMap.get(String(b._id)) ?? 999;
        return idxA - idxB;
      });
    } else {
      opportunities = [];
    }
  }
  opportunities = Array.isArray(opportunities) ? opportunities : [];

  let applicationOpportunities = options.applicationOpportunities;
  if (!applicationOpportunities && mongoose.connection.readyState === 1 && extraOppIds.length > 0) {
    applicationOpportunities = await Opportunity.find({
      _id: { $in: extraOppIds },
    }).lean();
  }
  applicationOpportunities = Array.isArray(applicationOpportunities) ? applicationOpportunities : [];

  // 6. Fetch Supporting Data: Todos, CalendarEvents, Learning Progress, Tracks, Items
  let todos = options.todos;
  if (!todos && mongoose.connection.readyState === 1) {
    todos = await Todo.find({ userId }).lean();
  }
  todos = Array.isArray(todos) ? todos : [];

  let calendarEvents = options.calendarEvents;
  if (!calendarEvents && mongoose.connection.readyState === 1) {
    calendarEvents = await CalendarEvent.find({ userId }).lean();
  }
  calendarEvents = Array.isArray(calendarEvents) ? calendarEvents : [];

  let learningProgress = options.learningProgress;
  if (!learningProgress && mongoose.connection.readyState === 1) {
    learningProgress = await UserLearningProgress.find({ userId }).lean();
  }
  learningProgress = Array.isArray(learningProgress) ? learningProgress : [];

  let tracks = options.tracks;
  let items = options.items;
  if ((!tracks || !items) && mongoose.connection.readyState === 1) {
    const [fetchedTracks, fetchedItems] = await Promise.all([
      LearningTrack.find({ isActive: true }).lean(),
      LearningItem.find({}).lean(),
    ]);
    tracks = fetchedTracks;
    items = fetchedItems;
  }
  tracks = Array.isArray(tracks) ? tracks : [];
  items = Array.isArray(items) ? items : [];

  // 7. Execute pure computation
  return computeCareerReadiness(
    {
      profile,
      opportunities,
      applications,
      savedOpportunities,
      todos,
      calendarEvents,
      learningProgress,
      tracks,
      items,
      applicationOpportunities,
    },
    {
      referenceDate,
      cohortSources: sources,
      isColdStart,
      guidanceMessage: isColdStart ? 'Save 3 target opportunities to personalize your career readiness.' : null,
    }
  );
}
