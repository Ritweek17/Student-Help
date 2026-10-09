/**
 * CareerOS Application Intelligence & Outcome Feedback Service (Phase 11G — Batch 2)
 *
 * Deterministic computation engine for evaluating student application funnel metrics,
 * pipeline health, stalled applications, rejection-gap recurrence, preparation-to-application
 * correlations, and follow-up opportunities.
 *
 * Architecture & Constraints:
 * - 100% deterministic and offline-testable with referenceDate injection.
 * - Pure derived intelligence service: ZERO database mutations.
 * - ZERO new MongoDB models, collections, or persistent analytics snapshots.
 * - ZERO background workers, timers, or AI/LLM dependencies.
 * - Zero modification of match engine scoring or career readiness logic.
 * - Bounded historical window: max 50 recent records or past 180 days (whichever is stricter).
 * - Zero N+1 queries: batched $in reads scoped strictly to authenticated userId.
 * - Sample-size protections: percentages require >= 5 samples; rejection recurrence requires >= 3.
 * - Causality guardrail: strictly observational and non-causal language.
 */

import mongoose from 'mongoose';
import { Application } from '../../models/Application.js';
import { Opportunity } from '../../models/Opportunity.js';
import { SavedOpportunity } from '../../models/SavedOpportunity.js';
import { Todo } from '../../models/Todo.js';
import { CalendarEvent } from '../../models/CalendarEvent.js';
import { Profile } from '../../models/Profile.js';
import {
  getOpportunityRequirements,
  getCandidateSkillProfile,
} from './match.service.js';
import { normalizeSkill } from './skill-normalization.service.js';

// =============================================================================
// BOUNDING & CONFIGURATION CONSTANTS
// =============================================================================

export const ANALYSIS_WINDOW_DAYS = 180;
export const MAX_APPLICATIONS = 50;
export const STALLED_APPLICATION_DAYS = 14;
export const RECENT_ACTIVITY_DAYS = 30;
export const MIN_SAMPLE_SIZE_PERCENTAGE = 5;
export const MIN_SAMPLE_SIZE_REJECTION = 3;

/**
 * Valid Application lifecycle status classifications based on real Application schema.
 */
export const APPLICATION_STATUS_GROUPS = {
  ACTIVE: ['applied', 'waiting', 'interview'],
  INTERVIEW: ['interview'],
  SELECTED: ['selected'],
  REJECTED: ['rejected'],
  WITHDRAWN: ['withdrawn'],
  TERMINAL: ['selected', 'rejected', 'withdrawn'],
};

// =============================================================================
// HELPER UTILITIES (PURE & DETERMINISTIC)
// =============================================================================

/**
 * Safely resolves the primary timestamp for an application record.
 * Prioritizes appliedAt, then createdAt, and falls back to referenceDate.
 *
 * @param {Object} app - Application document or plain object
 * @param {Date} referenceDate - Reference date fallback
 * @returns {Date}
 */
export function getApplicationDate(app, referenceDate = new Date()) {
  if (app?.appliedAt) return new Date(app.appliedAt);
  if (app?.createdAt) return new Date(app.createdAt);
  return new Date(referenceDate);
}

/**
 * Safely resolves the last activity timestamp for an application.
 *
 * @param {Object} app - Application document or plain object
 * @param {Date} referenceDate - Reference date fallback
 * @returns {Date}
 */
export function getApplicationUpdateDate(app, referenceDate = new Date()) {
  if (app?.updatedAt) return new Date(app.updatedAt);
  return getApplicationDate(app, referenceDate);
}

/**
 * Normalizes an application's status to standard conceptual lifecycle group.
 *
 * @param {string} status - Application status enum value
 * @returns {string} One of 'active' | 'interview' | 'selected' | 'rejected' | 'withdrawn' | 'unknown'
 */
export function normalizeApplicationStatus(status) {
  if (APPLICATION_STATUS_GROUPS.ACTIVE.includes(status)) {
    if (status === 'interview') return 'interview';
    return 'active';
  }
  if (APPLICATION_STATUS_GROUPS.SELECTED.includes(status)) return 'selected';
  if (APPLICATION_STATUS_GROUPS.REJECTED.includes(status)) return 'rejected';
  if (APPLICATION_STATUS_GROUPS.WITHDRAWN.includes(status)) return 'withdrawn';
  return 'unknown';
}

/**
 * Calculates median value for an array of numbers.
 *
 * @param {number[]} numbers
 * @returns {number|null}
 */
export function calculateMedian(numbers) {
  if (!Array.isArray(numbers) || numbers.length === 0) return null;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * Filters and bounds application records by the strict historical analysis window
 * and maximum application count limit. Deterministically sorted by recency then ID.
 *
 * @param {Array<Object>} applications - Raw application records
 * @param {Date} referenceDate - Reference date
 * @returns {Array<Object>} Bounded applications
 */
export function filterAndBoundApplications(applications, referenceDate = new Date()) {
  if (!Array.isArray(applications) || applications.length === 0) {
    return [];
  }

  const cutoffTime = referenceDate.getTime() - ANALYSIS_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  // Filter type: 'application' (or undefined type defaulting to application) within window
  const inWindow = applications.filter((app) => {
    if (app.type && app.type !== 'application') return false;
    const appTime = getApplicationDate(app, referenceDate).getTime();
    return appTime >= cutoffTime;
  });

  // Deterministically sort by appliedAt/createdAt descending, then ID ascending
  inWindow.sort((a, b) => {
    const timeA = getApplicationDate(a, referenceDate).getTime();
    const timeB = getApplicationDate(b, referenceDate).getTime();
    if (timeB !== timeA) return timeB - timeA;
    const idA = String(a._id || a.id || '');
    const idB = String(b._id || b.id || '');
    return idA.localeCompare(idB);
  });

  // Cap to MAX_APPLICATIONS
  return inWindow.slice(0, MAX_APPLICATIONS);
}

// =============================================================================
// SUB-ENGINE: APPLICATION COUNTS
// =============================================================================

/**
 * Calculates basic application counts across status categories.
 *
 * @param {Array<Object>} applications - Bounded application records
 * @param {number} stalledCount - Number of stalled applications
 * @param {Date} referenceDate - Reference date
 * @returns {Object}
 */
export function calculateApplicationCounts(applications, stalledCount = 0, referenceDate = new Date()) {
  let activeApplications = 0;
  let interviewCount = 0;
  let selectedCount = 0;
  let rejectedCount = 0;
  let withdrawnCount = 0;
  let recentApplications = 0;

  const recentCutoff = referenceDate.getTime() - RECENT_ACTIVITY_DAYS * 24 * 60 * 60 * 1000;

  for (const app of applications) {
    const status = app.status;
    if (APPLICATION_STATUS_GROUPS.ACTIVE.includes(status)) {
      activeApplications++;
    }
    if (status === 'interview') {
      interviewCount++;
    } else if (status === 'selected') {
      selectedCount++;
    } else if (status === 'rejected') {
      rejectedCount++;
    } else if (status === 'withdrawn') {
      withdrawnCount++;
    }

    const appTime = getApplicationDate(app, referenceDate).getTime();
    if (appTime >= recentCutoff) {
      recentApplications++;
    }
  }

  return {
    totalTracked: applications.length,
    activeApplications,
    interviewCount,
    selectedCount,
    rejectedCount,
    withdrawnCount,
    recentApplications,
    stalledApplications: stalledCount,
  };
}

// =============================================================================
// SUB-ENGINE: STALLED APPLICATION DETECTION
// =============================================================================

/**
 * Detects stalled active applications based on 14-day inactivity or passed deadlines.
 * Guarantee: Exactly ONE entry per application ID (no duplicates).
 *
 * @param {Array<Object>} applications - Bounded applications
 * @param {Map<string, Object>} opportunityMap - Map of opportunityId -> opportunity
 * @param {Date} referenceDate - Reference date
 * @returns {Array<Object>} Deterministically sorted stalled applications
 */
export function detectStalledApplications(applications, opportunityMap, referenceDate = new Date()) {
  const stalled = [];
  const refTime = referenceDate.getTime();

  for (const app of applications) {
    if (!APPLICATION_STATUS_GROUPS.ACTIVE.includes(app.status)) {
      continue;
    }

    const appId = String(app._id || app.id || '');
    const oppId = String(app.opportunityId?._id || app.opportunityId || '');
    const opp = opportunityMap.get(oppId) || {};
    const org = opp.organization || 'Unknown Organization';
    const title = opp.title || 'Unknown Role';

    const appDate = getApplicationDate(app, referenceDate);
    const updateDate = getApplicationUpdateDate(app, referenceDate);
    const ageDays = Math.max(0, Math.floor((refTime - appDate.getTime()) / (1000 * 60 * 60 * 24)));
    const updateAgeDays = Math.max(0, Math.floor((refTime - updateDate.getTime()) / (1000 * 60 * 60 * 24)));

    let isStalled = false;
    let reason = '';
    let effectiveAgeDays = ageDays;

    // Check condition A: status 'applied' older than 14 days without activity
    if (app.status === 'applied' && ageDays > STALLED_APPLICATION_DAYS) {
      isStalled = true;
      reason = `No response received for more than ${STALLED_APPLICATION_DAYS} days after applying.`;
      effectiveAgeDays = ageDays;
    }

    // Check condition B: status 'waiting' older than 14 days since update
    else if (app.status === 'waiting' && updateAgeDays > STALLED_APPLICATION_DAYS) {
      isStalled = true;
      reason = `Waiting for response for more than ${STALLED_APPLICATION_DAYS} days since last update.`;
      effectiveAgeDays = updateAgeDays;
    }

    // Check condition C: opportunity deadline passed while application remains active
    const deadline = opp.deadline ? new Date(opp.deadline) : null;
    const isDeadlinePassed = deadline && deadline.getTime() < refTime;

    if (isDeadlinePassed) {
      if (isStalled) {
        reason += ' Opportunity application deadline has also passed.';
      } else {
        isStalled = true;
        reason = 'Opportunity deadline has passed while application remains active.';
      }
    }

    if (isStalled) {
      stalled.push({
        applicationId: appId,
        opportunityId: oppId,
        organization: org,
        title,
        status: app.status,
        reason,
        ageDays: effectiveAgeDays,
      });
    }
  }

  // Deterministically sort stalled applications by ageDays descending, then applicationId ascending
  stalled.sort((a, b) => {
    if (b.ageDays !== a.ageDays) return b.ageDays - a.ageDays;
    return a.applicationId.localeCompare(b.applicationId);
  });

  return stalled;
}

// =============================================================================
// SUB-ENGINE: APPLICATION HEALTH EVALUATION
// =============================================================================

/**
 * Categorically evaluates application pipeline health.
 * Categorical states: 'Healthy' | 'Active Momentum' | 'Needs Attention' | 'Stalled' | 'Dormant'
 * NO continuous 0-100 score.
 *
 * @param {Object} params
 * @param {number} params.totalTracked
 * @param {number} params.activeCount
 * @param {Array<Object>} params.stalledApplications
 * @param {Array<Object>} params.interviewInsights
 * @returns {Object} { state, summary, drivers, stalledCount, activeCount }
 */
export function evaluateApplicationHealth({
  totalTracked,
  activeCount,
  stalledApplications,
  interviewInsights = [],
}) {
  const stalledCount = stalledApplications.length;
  const unscheduledInterviews = interviewInsights.filter((i) => !i.interviewScheduled);

  let state = 'Healthy';
  let summary = '';
  const drivers = [];

  // 1. Dormant: No active applications
  if (activeCount === 0) {
    state = 'Dormant';
    summary = 'No active applications in the current tracking window.';
    drivers.push(
      totalTracked === 0
        ? 'No application tracking records found within the last 180 days.'
        : 'All tracked applications have reached terminal outcomes (selected, rejected, or withdrawn).'
    );
  }
  // 2. Stalled: All active applications are stalled
  else if (stalledCount > 0 && stalledCount === activeCount) {
    state = 'Stalled';
    summary = 'All active applications are currently stalled with no recent updates.';
    drivers.push(`${stalledCount} active application(s) have had no update for more than 14 days.`);
  }
  // 3. Needs Attention: Partial stalled or interview missing calendar event
  else if (stalledCount > 0 || unscheduledInterviews.length > 0) {
    state = 'Needs Attention';
    summary = 'Some active applications require attention or follow-up.';
    if (stalledCount > 0) {
      drivers.push(
        `${stalledCount} of ${activeCount} active application(s) have had no update for more than 14 days.`
      );
    }
    if (unscheduledInterviews.length > 0) {
      drivers.push(
        `${unscheduledInterviews.length} active interview stage(s) do not have a confirmed calendar schedule.`
      );
    }
  }
  // 4. Active Momentum: 3+ active applications with no stalled applications
  else if (activeCount >= 3) {
    state = 'Active Momentum';
    summary = 'Strong active application pipeline with consistent progress.';
    drivers.push(`${activeCount} active applications are progressing within expected timelines.`);
  }
  // 5. Healthy: 1-2 active applications, zero stalled
  else {
    state = 'Healthy';
    summary = 'Active applications are progressing within expected timelines.';
    drivers.push(`${activeCount} active application(s) with no stalled stages.`);
  }

  return {
    state,
    summary,
    drivers,
    stalledCount,
    activeCount,
  };
}

// =============================================================================
// SUB-ENGINE: FUNNEL METRICS WITH SAMPLE-SIZE PROTECTION
// =============================================================================

/**
 * Builds a safe funnel conversion step with minimum sample-size guardrail.
 *
 * @param {number} numerator
 * @param {number} denominator
 * @param {string} stageLabel
 * @returns {Object}
 */
export function buildFunnelStage(numerator, denominator, stageLabel) {
  if (denominator < MIN_SAMPLE_SIZE_PERCENTAGE) {
    return {
      numerator,
      denominator,
      percentage: null,
      status: 'insufficient_sample',
      message: `Conversion percentages unlock after tracking ${MIN_SAMPLE_SIZE_PERCENTAGE} applications in this stage.`,
    };
  }

  const percentage = Math.round((numerator / denominator) * 100);
  return {
    numerator,
    denominator,
    percentage,
    status: 'available',
    message: null,
  };
}

/**
 * Computes deterministic funnel conversion metrics.
 *
 * @param {Object} params
 * @param {Array<Object>} params.applications
 * @param {Array<Object>} params.savedOpportunities
 * @param {Object} params.counts
 * @returns {Object} Funnel metrics
 */
export function calculateFunnelMetrics({ applications, savedOpportunities, counts }) {
  // 1. Saved -> Applied
  // Denominator: Total unique saved opportunities
  // Numerator: Unique saved opportunities that have a corresponding application
  const appliedOppIds = new Set(
    applications.map((app) => String(app.opportunityId?._id || app.opportunityId || ''))
  );

  const uniqueSavedOppIds = new Set(
    savedOpportunities.map((saved) => String(saved.opportunityId?._id || saved.opportunityId || ''))
  );

  let savedAppliedNumerator = 0;
  for (const savedOppId of uniqueSavedOppIds) {
    if (appliedOppIds.has(savedOppId)) {
      savedAppliedNumerator++;
    }
  }
  const savedDenominator = uniqueSavedOppIds.size;
  const savedToApplied = buildFunnelStage(
    savedAppliedNumerator,
    savedDenominator,
    'Saved to Applied'
  );

  // 2. Applied -> Interview
  // Denominator: Total applications tracked
  // Numerator: Applications that reached interview or selected (progressed past applied)
  const interviewOrSelectedCount = counts.interviewCount + counts.selectedCount;
  const appliedToInterview = buildFunnelStage(
    interviewOrSelectedCount,
    counts.totalTracked,
    'Applied to Interview'
  );

  // 3. Interview -> Selection
  // Denominator: Applications that reached interview stage (interview + selected)
  // Numerator: Selected applications
  const interviewToSelected = buildFunnelStage(
    counts.selectedCount,
    interviewOrSelectedCount,
    'Interview to Selection'
  );

  // 4. Overall Selection
  // Denominator: Total applications tracked
  // Numerator: Selected applications
  const overallSelected = buildFunnelStage(
    counts.selectedCount,
    counts.totalTracked,
    'Overall Selection'
  );

  return {
    savedToApplied,
    appliedToInterview,
    interviewToSelected,
    overallSelected,
  };
}

// =============================================================================
// SUB-ENGINE: TIME METRICS (TIME-TO-APPLY & ACTIVE STAGE LATENCY)
// =============================================================================

/**
 * Calculates time-to-apply and active stage latency.
 *
 * @param {Array<Object>} applications - Bounded applications
 * @param {Array<Object>} savedOpportunities - Saved opportunity records
 * @param {Map<string, Object>} opportunityMap - Map of opportunityId -> opportunity
 * @param {Date} referenceDate - Reference date
 * @returns {Object} Time metrics
 */
export function calculateTimeMetrics(applications, savedOpportunities, opportunityMap, referenceDate = new Date()) {
  const refTime = referenceDate.getTime();

  // 1. Time-to-Apply: where an opportunity was saved before application
  const savedCreatedAtMap = new Map();
  for (const s of savedOpportunities) {
    const oppId = String(s.opportunityId?._id || s.opportunityId || '');
    if (oppId && s.createdAt) {
      // Pick earliest saved timestamp if multiple
      const existing = savedCreatedAtMap.get(oppId);
      const savedTime = new Date(s.createdAt).getTime();
      if (!existing || savedTime < existing) {
        savedCreatedAtMap.set(oppId, savedTime);
      }
    }
  }

  const timeToApplyDiffs = [];
  for (const app of applications) {
    const oppId = String(app.opportunityId?._id || app.opportunityId || '');
    const savedTime = savedCreatedAtMap.get(oppId);
    if (savedTime !== undefined) {
      const appTime = getApplicationDate(app, referenceDate).getTime();
      if (appTime >= savedTime) {
        const diffDays = Math.max(0, Math.floor((appTime - savedTime) / (1000 * 60 * 60 * 24)));
        timeToApplyDiffs.push(diffDays);
      }
    }
  }

  let timeToApply = {
    averageDays: null,
    medianDays: null,
    sampleSize: timeToApplyDiffs.length,
    status: 'insufficient_sample',
    message: `Time-to-apply metrics unlock after tracking ${MIN_SAMPLE_SIZE_PERCENTAGE} saved-to-applied applications.`,
  };

  if (timeToApplyDiffs.length >= MIN_SAMPLE_SIZE_PERCENTAGE) {
    const sum = timeToApplyDiffs.reduce((acc, v) => acc + v, 0);
    timeToApply = {
      averageDays: Math.round(sum / timeToApplyDiffs.length),
      medianDays: calculateMedian(timeToApplyDiffs),
      sampleSize: timeToApplyDiffs.length,
      status: 'available',
      message: null,
    };
  }

  // 2. Active Stage Latency (Descriptive only; zero employer intent claims)
  const activeLatencyItems = [];
  let latencySum = 0;

  for (const app of applications) {
    if (!APPLICATION_STATUS_GROUPS.ACTIVE.includes(app.status)) continue;

    const appId = String(app._id || app.id || '');
    const oppId = String(app.opportunityId?._id || app.opportunityId || '');
    const opp = opportunityMap.get(oppId) || {};
    const appTime = getApplicationDate(app, referenceDate).getTime();
    const latencyDays = Math.max(0, Math.floor((refTime - appTime) / (1000 * 60 * 60 * 24)));

    latencySum += latencyDays;
    activeLatencyItems.push({
      applicationId: appId,
      opportunityId: oppId,
      organization: opp.organization || 'Unknown Organization',
      title: opp.title || 'Unknown Role',
      status: app.status,
      latencyDays,
    });
  }

  // Deterministically sort latency items by latencyDays descending, then applicationId ascending
  activeLatencyItems.sort((a, b) => {
    if (b.latencyDays !== a.latencyDays) return b.latencyDays - a.latencyDays;
    return a.applicationId.localeCompare(b.applicationId);
  });

  const activeStageLatency = {
    averageActiveLatencyDays:
      activeLatencyItems.length > 0 ? Math.round(latencySum / activeLatencyItems.length) : null,
    items: activeLatencyItems,
  };

  return {
    timeToApply,
    activeStageLatency,
  };
}

// =============================================================================
// SUB-ENGINE: RECENT APPLICATION VELOCITY
// =============================================================================

/**
 * Calculates recent application velocity.
 *
 * @param {Array<Object>} applications - Bounded applications
 * @param {Date} referenceDate - Reference date
 * @returns {Object}
 */
export function calculateRecentActivity(applications, referenceDate = new Date()) {
  const recentCutoff = referenceDate.getTime() - RECENT_ACTIVITY_DAYS * 24 * 60 * 60 * 1000;
  let recentCount = 0;

  for (const app of applications) {
    const appTime = getApplicationDate(app, referenceDate).getTime();
    if (appTime >= recentCutoff) {
      recentCount++;
    }
  }

  let velocity = 'none';
  if (recentCount >= 3) {
    velocity = 'active';
  } else if (recentCount >= 1) {
    velocity = 'low';
  }

  return {
    recentCount,
    velocity,
    windowDays: RECENT_ACTIVITY_DAYS,
  };
}

// =============================================================================
// SUB-ENGINE: REJECTION GAP ANALYSIS (CORE RECURRENCE & CAUSALITY SAFEGUARD)
// =============================================================================

/**
 * Analyzes recurring missing or unverified skill gaps across rejected opportunities.
 *
 * CAUSALITY GUARDRAIL:
 * Strictly observational copy: "Observational Pattern: ..."
 * Absolute prohibition: NEVER emit "You were rejected because of ...".
 *
 * @param {Array<Object>} rejectedApplications - Rejected application documents
 * @param {Map<string, Object>} opportunityMap - Map of opportunityId -> opportunity
 * @param {Object} profile - Candidate profile document
 * @returns {Object} Rejection patterns
 */
export function analyzeRejectionGaps(rejectedApplications, opportunityMap, profile) {
  const totalRejected = rejectedApplications.length;

  if (totalRejected < MIN_SAMPLE_SIZE_REJECTION) {
    return {
      status: 'insufficient_sample',
      message: `Rejection pattern analysis requires at least ${MIN_SAMPLE_SIZE_REJECTION} rejected applications to identify recurring gaps.`,
      totalRejectedOpportunitiesAnalyzed: totalRejected,
      patterns: [],
    };
  }

  // Get candidate skill profile using existing intelligence helper
  const candidateSkills = getCandidateSkillProfile(profile);

  // Skill gap aggregator: canonicalKey -> { displayName, rejectedOppSet: Set, evidenceTypes: Set }
  const gapMap = new Map();

  for (const app of rejectedApplications) {
    const oppId = String(app.opportunityId?._id || app.opportunityId || '');
    const opp = opportunityMap.get(oppId);
    if (!opp) continue;

    // Retrieve and normalize opportunity requirements
    const requiredSkills = getOpportunityRequirements(opp);

    for (const req of requiredSkills) {
      const canonicalKey = req.canonicalKey;
      const candSkill = candidateSkills.get(canonicalKey);

      // Determine evidence status
      let isGap = false;
      let evidenceLevel = 'unverified';

      if (!candSkill) {
        // Missing entirely
        isGap = true;
        evidenceLevel = 'unverified';
      } else if (
        candSkill.isClaimed &&
        !candSkill.isDemonstrated &&
        (!candSkill.githubEvidence || candSkill.githubEvidence.repoCount === 0)
      ) {
        // Claimed only, no demonstration or GitHub proof
        isGap = true;
        evidenceLevel = 'claimed_only';
      }

      if (isGap) {
        let entry = gapMap.get(canonicalKey);
        if (!entry) {
          entry = {
            canonicalKey,
            displayName: req.displayName || canonicalKey,
            rejectedOppSet: new Set(),
            evidenceLevels: new Set(),
          };
          gapMap.set(canonicalKey, entry);
        }
        entry.rejectedOppSet.add(oppId);
        entry.evidenceLevels.add(evidenceLevel);
      }
    }
  }

  // Convert gapMap to sorted pattern list
  const patterns = [];
  for (const [canonicalKey, data] of gapMap.entries()) {
    const rejectedCount = data.rejectedOppSet.size;
    const recurrencePercent = Math.round((rejectedCount / totalRejected) * 100);

    // Prioritize 'unverified' if mixed, else 'claimed_only'
    const candidateEvidence = data.evidenceLevels.has('unverified') ? 'unverified' : 'claimed_only';
    const evidenceDescription =
      candidateEvidence === 'claimed_only'
        ? 'only claimed without demonstration'
        : 'currently unverified';

    // Strictly observational non-causal language
    const observation = `Observational Pattern: ${data.displayName} appeared in ${rejectedCount} of your ${totalRejected} recent rejected opportunities and is ${evidenceDescription} on your profile.`;

    const affectedOpportunityIds = Array.from(data.rejectedOppSet).sort();

    patterns.push({
      canonicalKey,
      displayName: data.displayName,
      rejectedOpportunityCount: rejectedCount,
      totalRejectedOpportunitiesAnalyzed: totalRejected,
      recurrencePercent,
      candidateEvidence,
      observation,
      affectedOpportunityIds,
    });
  }

  // Deterministic sorting: recurrencePercent descending, rejectedCount descending, canonicalKey ascending
  patterns.sort((a, b) => {
    if (b.recurrencePercent !== a.recurrencePercent) {
      return b.recurrencePercent - a.recurrencePercent;
    }
    if (b.rejectedOpportunityCount !== a.rejectedOpportunityCount) {
      return b.rejectedOpportunityCount - a.rejectedOpportunityCount;
    }
    return a.canonicalKey.localeCompare(b.canonicalKey);
  });

  return {
    status: 'available',
    message: null,
    totalRejectedOpportunitiesAnalyzed: totalRejected,
    patterns,
  };
}

// =============================================================================
// SUB-ENGINE: PREPARATION FEEDBACK
// =============================================================================

/**
 * Inspects deterministic [CareerOS Prep: <opportunityId>:<taskKey>] tags in user Todos
 * and evaluates completion status relative to application date.
 * Observational correlation ONLY. Never claims causality.
 *
 * @param {Array<Object>} applications - Bounded applications
 * @param {Array<Object>} todos - User preparation Todos
 * @param {Map<string, Object>} opportunityMap - Map of opportunityId -> opportunity
 * @param {Date} referenceDate - Reference date
 * @returns {Array<Object>} Preparation feedback items
 */
export function analyzePreparationFeedback(applications, todos, opportunityMap, referenceDate = new Date()) {
  const feedbackItems = [];

  for (const app of applications) {
    const appId = String(app._id || app.id || '');
    const oppId = String(app.opportunityId?._id || app.opportunityId || '');
    const opp = opportunityMap.get(oppId) || {};
    const org = opp.organization || 'Unknown Organization';
    const title = opp.title || 'Unknown Role';
    const appDate = getApplicationDate(app, referenceDate);

    // Filter todos matching [CareerOS Prep: <opportunityId>:
    const prepTagPrefix = `[CareerOS Prep: ${oppId}:`;
    const oppTodos = todos.filter(
      (t) => t?.description && typeof t.description === 'string' && t.description.includes(prepTagPrefix)
    );

    let prepStatus = 'no_prep_record';
    let summary = 'No tracked preparation tasks for this opportunity.';
    const totalPrepTasks = oppTodos.length;
    let completedPrepTasks = 0;

    if (totalPrepTasks > 0) {
      completedPrepTasks = oppTodos.filter((t) => Boolean(t.completed)).length;

      // Check if all tasks were completed prior to submitting application
      const allCompletedBeforeApply = oppTodos.every((t) => {
        if (!t.completed) return false;
        if (!t.completedAt) return true; // Completed without exact timestamp
        return new Date(t.completedAt).getTime() <= appDate.getTime();
      });

      if (allCompletedBeforeApply && completedPrepTasks === totalPrepTasks) {
        prepStatus = 'prep_completed_before_apply';
        summary = 'Preparation plan completed prior to submitting the application.';
      } else {
        prepStatus = 'prep_pending_at_apply';
        summary = 'Application was submitted while preparation tasks were still pending.';
      }
    }

    feedbackItems.push({
      applicationId: appId,
      opportunityId: oppId,
      organization: org,
      title,
      prepStatus,
      summary,
      totalPrepTasks,
      completedPrepTasks,
    });
  }

  // Deterministically sort by applicationId ascending
  feedbackItems.sort((a, b) => a.applicationId.localeCompare(b.applicationId));

  return feedbackItems;
}

// =============================================================================
// SUB-ENGINE: INTERVIEW INSIGHTS
// =============================================================================

/**
 * Correlates active interview applications with scheduled CalendarEvents.
 *
 * @param {Array<Object>} applications - Bounded applications
 * @param {Array<Object>} calendarEvents - User calendar events
 * @param {Map<string, Object>} opportunityMap - Map of opportunityId -> opportunity
 * @returns {Array<Object>} Interview insights
 */
export function analyzeInterviewInsights(applications, calendarEvents, opportunityMap) {
  const insights = [];

  for (const app of applications) {
    if (app.status !== 'interview') continue;

    const appId = String(app._id || app.id || '');
    const oppId = String(app.opportunityId?._id || app.opportunityId || '');
    const opp = opportunityMap.get(oppId) || {};
    const org = opp.organization || 'Unknown Organization';
    const title = opp.title || 'Unknown Role';

    // Match calendar events linked by applicationId or opportunityId with type 'interview'
    const matchingEvents = calendarEvents.filter((evt) => {
      if (evt.type !== 'interview' || evt.status === 'cancelled') return false;
      const evtAppId = String(evt.applicationId?._id || evt.applicationId || '');
      const evtOppId = String(evt.opportunityId?._id || evt.opportunityId || '');
      return evtAppId === appId || evtOppId === oppId;
    });

    // Deterministically pick the earliest startAt event
    matchingEvents.sort((a, b) => {
      const timeA = a.startAt ? new Date(a.startAt).getTime() : 0;
      const timeB = b.startAt ? new Date(b.startAt).getTime() : 0;
      return timeA - timeB;
    });

    const primaryEvent = matchingEvents[0] || null;
    const interviewScheduled = Boolean(primaryEvent);
    const interviewEventId = primaryEvent ? String(primaryEvent._id || primaryEvent.id || '') : null;
    const interviewDate = primaryEvent?.startAt ? new Date(primaryEvent.startAt) : null;

    const preparationSignal = interviewScheduled
      ? 'Interview scheduled; review opportunity preparation plan and practice technical demonstrations.'
      : 'Active interview stage detected without scheduled calendar event.';

    insights.push({
      applicationId: appId,
      opportunityId: oppId,
      organization: org,
      title,
      interviewScheduled,
      interviewEventId,
      interviewDate,
      preparationSignal,
    });
  }

  // Deterministically sort by applicationId ascending
  insights.sort((a, b) => a.applicationId.localeCompare(b.applicationId));

  return insights;
}

// =============================================================================
// SUB-ENGINE: FOLLOW-UP ACTIONS DERIVATION
// =============================================================================

/**
 * Derives actionable follow-up recommendations in-memory.
 * Zero database persistence.
 * Rules:
 * - Generates actions strictly for stalled active applications ('applied', 'waiting').
 * - Zero follow-up actions for terminal states ('selected', 'rejected', 'withdrawn').
 * - Deterministic action keys preventing duplication.
 *
 * @param {Array<Object>} stalledApplications - Stalled applications
 * @param {Array<Object>} applications - Bounded applications
 * @returns {Array<Object>} Deterministically sorted actions
 */
export function deriveFollowUpActions(stalledApplications, applications) {
  const actions = [];
  const appStatusMap = new Map();

  for (const app of applications) {
    const appId = String(app._id || app.id || '');
    appStatusMap.set(appId, app.status);
  }

  for (const stalled of stalledApplications) {
    const status = appStatusMap.get(stalled.applicationId) || stalled.status;

    // Follow-up candidate only if still active
    if (!['applied', 'waiting'].includes(status)) {
      continue;
    }

    const actionKey = `followup:${stalled.applicationId}`;
    const priority = stalled.ageDays >= 21 ? 'High' : 'Medium';

    actions.push({
      actionKey,
      type: 'application_followup',
      title: `Follow up on application with ${stalled.organization}`,
      priority,
      applicationId: stalled.applicationId,
      opportunityId: stalled.opportunityId,
      organization: stalled.organization,
      reason: stalled.reason,
    });
  }

  // Sort deterministically: Priority ('High' before 'Medium' before 'Low'), then actionKey ascending
  const priorityRank = { High: 0, Medium: 1, Low: 2 };
  actions.sort((a, b) => {
    const pA = priorityRank[a.priority] ?? 9;
    const pB = priorityRank[b.priority] ?? 9;
    if (pA !== pB) return pA - pB;
    return a.actionKey.localeCompare(b.actionKey);
  });

  return actions;
}

// =============================================================================
// SUB-ENGINE: ROLE & SKILL APPLICATION PATTERNS
// =============================================================================

/**
 * Groups application outcomes by opportunity dimensions (e.g. type, workMode).
 *
 * @param {Array<Object>} applications - Bounded applications
 * @param {Map<string, Object>} opportunityMap - Map of opportunityId -> opportunity
 * @param {Object} profile - Candidate profile document
 * @returns {Array<Object>} Pattern groups
 */
export function analyzeRoleSkillPatterns(applications, opportunityMap, profile) {
  const groupsMap = new Map();
  const candidateSkills = getCandidateSkillProfile(profile);

  function getOrCreateGroup(groupKey, groupLabel, dimension) {
    let entry = groupsMap.get(groupKey);
    if (!entry) {
      entry = {
        groupKey,
        groupLabel,
        dimension,
        applications: 0,
        interviews: 0,
        selected: 0,
        rejected: 0,
        gapSkills: new Map(), // canonicalKey -> { displayName, count }
      };
      groupsMap.set(groupKey, entry);
    }
    return entry;
  }

  for (const app of applications) {
    const oppId = String(app.opportunityId?._id || app.opportunityId || '');
    const opp = opportunityMap.get(oppId) || {};

    const oppType = opp.type || 'other';
    const typeLabel = oppType.charAt(0).toUpperCase() + oppType.slice(1).replace(/_/g, ' ');

    const workMode = opp.workMode || 'unspecified';
    const workModeLabel = workMode.charAt(0).toUpperCase() + workMode.slice(1);

    const targetGroups = [
      getOrCreateGroup(`type:${oppType}`, typeLabel, 'type'),
      getOrCreateGroup(`workMode:${workMode}`, workModeLabel, 'workMode'),
    ];

    for (const group of targetGroups) {
      group.applications++;
      if (app.status === 'interview') group.interviews++;
      else if (app.status === 'selected') group.selected++;
      else if (app.status === 'rejected') {
        group.rejected++;

        // Track gaps for rejected roles in this group
        const reqs = getOpportunityRequirements(opp);
        for (const req of reqs) {
          const candSkill = candidateSkills.get(req.canonicalKey);
          if (
            !candSkill ||
            (candSkill.isClaimed &&
              !candSkill.isDemonstrated &&
              (!candSkill.githubEvidence || candSkill.githubEvidence.repoCount === 0))
          ) {
            const cur = group.gapSkills.get(req.canonicalKey) || {
              canonicalKey: req.canonicalKey,
              displayName: req.displayName || req.canonicalKey,
              count: 0,
            };
            cur.count++;
            group.gapSkills.set(req.canonicalKey, cur);
          }
        }
      }
    }
  }

  const results = [];
  for (const group of groupsMap.values()) {
    // Top recurring gaps sorted by count descending
    const recurringGaps = Array.from(group.gapSkills.values())
      .sort((a, b) => b.count - a.count || a.canonicalKey.localeCompare(b.canonicalKey))
      .slice(0, 3)
      .map((g) => ({
        canonicalKey: g.canonicalKey,
        displayName: g.displayName,
        count: g.count,
      }));

    results.push({
      groupKey: group.groupKey,
      groupLabel: group.groupLabel,
      dimension: group.dimension,
      applications: group.applications,
      interviews: group.interviews,
      selected: group.selected,
      rejected: group.rejected,
      recurringGaps,
    });
  }

  // Deterministically sort by applications descending, then groupKey ascending
  results.sort((a, b) => {
    if (b.applications !== a.applications) return b.applications - a.applications;
    return a.groupKey.localeCompare(b.groupKey);
  });

  return results;
}

// =============================================================================
// SUB-ENGINE: OUTCOMES & DEMONSTRATED SKILLS SUMMARY
// =============================================================================

/**
 * Summarizes application outcomes and identifies demonstrated skills in selected roles.
 *
 * @param {Array<Object>} applications - Bounded applications
 * @param {Map<string, Object>} opportunityMap - Map of opportunityId -> opportunity
 * @param {Object} profile - Candidate profile
 * @param {Object} counts - Counts summary
 * @returns {Object} Outcome summary
 */
export function summarizeOutcomes(applications, opportunityMap, profile, counts) {
  const candidateSkills = getCandidateSkillProfile(profile);
  const selectedSkillsMap = new Map();

  for (const app of applications) {
    if (app.status !== 'selected') continue;
    const oppId = String(app.opportunityId?._id || app.opportunityId || '');
    const opp = opportunityMap.get(oppId);
    if (!opp) continue;

    const reqs = getOpportunityRequirements(opp);
    for (const req of reqs) {
      const candSkill = candidateSkills.get(req.canonicalKey);
      if (candSkill && (candSkill.isDemonstrated || (candSkill.githubEvidence && candSkill.githubEvidence.repoCount > 0))) {
        const cur = selectedSkillsMap.get(req.canonicalKey) || {
          canonicalKey: req.canonicalKey,
          displayName: req.displayName || req.canonicalKey,
          count: 0,
        };
        cur.count++;
        selectedSkillsMap.set(req.canonicalKey, cur);
      }
    }
  }

  const selectedSkillsDemonstrated = Array.from(selectedSkillsMap.values()).sort(
    (a, b) => b.count - a.count || a.canonicalKey.localeCompare(b.canonicalKey)
  );

  return {
    selected: counts.selectedCount,
    rejected: counts.rejectedCount,
    withdrawn: counts.withdrawnCount,
    active: counts.activeApplications,
    interview: counts.interviewCount,
    selectedSkillsDemonstrated,
  };
}

// =============================================================================
// PURE DETERMINISTIC COMPUTATION ENGINE
// =============================================================================

/**
 * Pure deterministic Application Intelligence computation function.
 * Accepts all required inputs and options without any database or network interaction.
 *
 * @param {Object} data
 * @param {Array<Object>} [data.applications]
 * @param {Array<Object>} [data.opportunities]
 * @param {Array<Object>} [data.savedOpportunities]
 * @param {Array<Object>} [data.todos]
 * @param {Array<Object>} [data.calendarEvents]
 * @param {Object} [data.profile]
 * @param {Object} [options]
 * @param {Date} [options.referenceDate]
 * @returns {Object} Application Intelligence result
 */
export function computeApplicationIntelligence(data = {}, options = {}) {
  const referenceDate = options.referenceDate ? new Date(options.referenceDate) : new Date();

  const rawApplications = Array.isArray(data.applications) ? data.applications : [];
  const rawOpportunities = Array.isArray(data.opportunities) ? data.opportunities : [];
  const savedOpportunities = Array.isArray(data.savedOpportunities) ? data.savedOpportunities : [];
  const todos = Array.isArray(data.todos) ? data.todos : [];
  const calendarEvents = Array.isArray(data.calendarEvents) ? data.calendarEvents : [];
  const profile = data.profile || {};

  // 1. Bound and filter applications (max 50, 180-day window)
  const boundedApplications = filterAndBoundApplications(rawApplications, referenceDate);

  // 2. Build fast opportunity lookup map
  const opportunityMap = new Map();
  for (const opp of rawOpportunities) {
    if (opp && (opp._id || opp.id)) {
      opportunityMap.set(String(opp._id || opp.id), opp);
    }
  }

  // 3. Stalled Application Detection
  const stalledApplications = detectStalledApplications(boundedApplications, opportunityMap, referenceDate);

  // 4. Basic Application Counts
  const counts = calculateApplicationCounts(boundedApplications, stalledApplications.length, referenceDate);

  // 5. Interview Insights
  const interviewInsights = analyzeInterviewInsights(boundedApplications, calendarEvents, opportunityMap);

  // 6. Application Health Evaluation
  const health = evaluateApplicationHealth({
    totalTracked: counts.totalTracked,
    activeCount: counts.activeApplications,
    stalledApplications,
    interviewInsights,
  });

  // 7. Funnel Metrics (with sample-size protections)
  const funnel = calculateFunnelMetrics({
    applications: boundedApplications,
    savedOpportunities,
    counts,
  });

  // 8. Time Metrics
  const { timeToApply, activeStageLatency } = calculateTimeMetrics(
    boundedApplications,
    savedOpportunities,
    opportunityMap,
    referenceDate
  );

  // 9. Recent Activity
  const recentActivity = calculateRecentActivity(boundedApplications, referenceDate);

  // 10. Rejection Gap Analysis (Core Recurrence & Causality Guardrail)
  const rejectedApplications = boundedApplications.filter((app) => app.status === 'rejected');
  const rejectionPatterns = analyzeRejectionGaps(rejectedApplications, opportunityMap, profile);

  // 11. Role & Skill Patterns
  const rolePatterns = analyzeRoleSkillPatterns(boundedApplications, opportunityMap, profile);

  // 12. Preparation Feedback
  const preparationFeedback = analyzePreparationFeedback(boundedApplications, todos, opportunityMap, referenceDate);

  // 13. Follow-Up Actions Derivation (In-Memory Candidates)
  const actions = deriveFollowUpActions(stalledApplications, boundedApplications);

  // 14. Outcome Summary
  const outcomes = summarizeOutcomes(boundedApplications, opportunityMap, profile, counts);

  // 15. Source Applications (Compact & Sanitized)
  const sourceApplications = boundedApplications.map((app) => {
    const oppId = String(app.opportunityId?._id || app.opportunityId || '');
    const opp = opportunityMap.get(oppId) || {};
    return {
      applicationId: String(app._id || app.id || ''),
      opportunityId: oppId,
      status: app.status,
      appliedAt: app.appliedAt || null,
      organization: opp.organization || 'Unknown Organization',
      title: opp.title || 'Unknown Role',
    };
  });

  return {
    generatedAt: referenceDate.toISOString(),
    period: {
      analysisWindowDays: ANALYSIS_WINDOW_DAYS,
      maxApplications: MAX_APPLICATIONS,
      referenceDate: referenceDate.toISOString(),
      applicationsAnalyzed: boundedApplications.length,
    },
    counts,
    funnel,
    health,
    stalledApplications,
    recentActivity,
    timeMetrics: {
      timeToApply,
      activeStageLatency,
    },
    outcomes,
    rejectionPatterns,
    rolePatterns,
    preparationFeedback,
    interviewInsights,
    actions,
    sourceApplications,
  };
}

// =============================================================================
// MAIN SERVICE ENTRY POINT (DATABASE RETRIEVAL + DETERMINISTIC CALCULATION)
// =============================================================================

/**
 * Calculates complete Application Intelligence for a user.
 * Bounded, read-only, deterministic entry point.
 * Zero N+1 queries. Zero database mutations.
 *
 * @param {string|mongoose.Types.ObjectId} userId - Authenticated user ID
 * @param {Object} [options] - Optional overrides for testing or dates
 * @param {Date} [options.referenceDate] - Injected reference date for determinism
 * @param {Array<Object>} [options.applications] - Injected applications for offline testing
 * @param {Array<Object>} [options.opportunities] - Injected opportunities for offline testing
 * @param {Array<Object>} [options.savedOpportunities] - Injected saved opportunities
 * @param {Array<Object>} [options.todos] - Injected preparation todos
 * @param {Array<Object>} [options.calendarEvents] - Injected calendar events
 * @param {Object} [options.profile] - Injected candidate profile
 * @returns {Promise<Object>} Application Intelligence output
 */
export async function calculateApplicationIntelligence(userId, options = {}) {
  const referenceDate = options.referenceDate ? new Date(options.referenceDate) : new Date();

  // 1. Resolve Applications (DB or Injected)
  let applications = options.applications;
  if (!applications && mongoose.connection.readyState === 1) {
    const cutoffDate = new Date(referenceDate.getTime() - ANALYSIS_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    applications = await Application.find({
      userId,
      type: 'application',
      $or: [
        { appliedAt: { $gte: cutoffDate } },
        { appliedAt: null, createdAt: { $gte: cutoffDate } },
      ],
    })
      .sort({ appliedAt: -1, createdAt: -1 })
      .limit(MAX_APPLICATIONS)
      .lean();
  }
  applications = Array.isArray(applications) ? applications : [];

  // Filter & bound in memory for complete safety
  const boundedApplications = filterAndBoundApplications(applications, referenceDate);

  // 2. Extract Unique Opportunity IDs
  const oppIdSet = new Set();
  const appIdSet = new Set();
  for (const app of boundedApplications) {
    const oppId = String(app.opportunityId?._id || app.opportunityId || '');
    if (oppId) oppIdSet.add(oppId);
    const appId = String(app._id || app.id || '');
    if (appId) appIdSet.add(appId);
  }
  const oppIds = Array.from(oppIdSet);
  const appIds = Array.from(appIdSet);

  // 3. Resolve Opportunities in ONE Batched Query (No N+1)
  let opportunities = options.opportunities;
  if (!opportunities && mongoose.connection.readyState === 1) {
    if (oppIds.length > 0) {
      opportunities = await Opportunity.find({
        _id: { $in: oppIds },
      }).lean();
    } else {
      opportunities = [];
    }
  }
  opportunities = Array.isArray(opportunities) ? opportunities : [];

  // 4. Resolve Saved Opportunities in ONE Batched Query
  let savedOpportunities = options.savedOpportunities;
  if (!savedOpportunities && mongoose.connection.readyState === 1) {
    savedOpportunities = await SavedOpportunity.find({
      userId,
      ...(oppIds.length > 0 ? { opportunityId: { $in: oppIds } } : {}),
    }).lean();
  }
  savedOpportunities = Array.isArray(savedOpportunities) ? savedOpportunities : [];

  // 5. Resolve Preparation Todos in ONE Batched Query
  let todos = options.todos;
  if (!todos && mongoose.connection.readyState === 1) {
    todos = await Todo.find({
      userId,
      description: { $regex: '\\[CareerOS Prep:' },
    }).lean();
  }
  todos = Array.isArray(todos) ? todos : [];

  // 6. Resolve Calendar Events in ONE Batched Query
  let calendarEvents = options.calendarEvents;
  if (!calendarEvents && mongoose.connection.readyState === 1) {
    calendarEvents = await CalendarEvent.find({
      userId,
      $or: [
        ...(appIds.length > 0 ? [{ applicationId: { $in: appIds } }] : []),
        ...(oppIds.length > 0 ? [{ opportunityId: { $in: oppIds }, type: 'interview' }] : []),
      ],
    }).lean();
  }
  calendarEvents = Array.isArray(calendarEvents) ? calendarEvents : [];

  // 7. Resolve Candidate Profile
  let profile = options.profile;
  if (!profile && mongoose.connection.readyState === 1) {
    profile = await Profile.findOne({ userId }).lean();
  }
  profile = profile || {};

  // 8. Execute Pure Computation
  return computeApplicationIntelligence(
    {
      applications: boundedApplications,
      opportunities,
      savedOpportunities,
      todos,
      calendarEvents,
      profile,
    },
    { referenceDate }
  );
}
