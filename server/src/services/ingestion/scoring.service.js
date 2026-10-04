/**
 * Deterministic scoring service for Phase 8G.
 * Pure functions: No database queries, no network calls, no AI, no random values.
 */

/**
 * Calculates a deterministic completeness score (0-100).
 * Distinguishes required core fields from optional source-dependent fields.
 * 
 * Weights:
 * - Core Identity (Title, Org): 40 points
 * - Description: 30 points
 * - Actionable URL: 10 points
 * - Logistics (Type/Mode/Location): 15 points
 * - Enrichment (Skills/Tags/Dates): 5 points
 * 
 * @param {Object} opp - The normalized opportunity object
 * @returns {number} Score between 0 and 100
 */
export function calculateCompletenessScore(opp) {
  if (!opp) return 0;
  let score = 0;

  // 1. Core Identity (40)
  if (opp.title && opp.title.length >= 3) score += 20;
  if (opp.organization && opp.organization.length >= 2) score += 20;

  // 2. Description (30)
  if (opp.description && opp.description.length >= 50) score += 30;
  else if (opp.description && opp.description.length >= 20) score += 15;

  // 3. Actionable URL (10)
  if (opp.applicationUrl || opp.registrationUrl) score += 10;

  // 4. Logistics (15)
  if (opp.type) score += 5;
  
  if (opp.workMode === 'remote') {
    score += 10; // Location not strictly needed for remote
  } else if (opp.location && (opp.location.country || opp.location.city)) {
    score += 10;
  } else if (opp.workMode) {
    score += 5;
  }

  // 5. Enrichment (5)
  if ((opp.skills && opp.skills.length > 0) || (opp.tags && opp.tags.length > 0)) {
    score += 2;
  }
  if (opp.deadline || opp.eventDate) {
    score += 3;
  }

  return Math.floor(Math.min(Math.max(score, 0), 100));
}

/**
 * Calculates a deterministic relevance score (0-100).
 * Targeted towards CareerOS audience: Students, Software/CSE, India/Remote.
 * 
 * Weights:
 * - Audience (Internship/Student): 40 points
 * - Domain (Software/CSE): 30 points
 * - Geography (India/Remote): 30 points
 * 
 * @param {Object} opp - The normalized opportunity object
 * @returns {number} Score between 0 and 100
 */
export function calculateRelevanceScore(opp) {
  if (!opp) return 0;
  let score = 0;
  const titleStr = opp.title ? opp.title.toLowerCase() : '';
  const descStr = opp.description ? opp.description.toLowerCase() : '';
  const strSearch = titleStr + ' ' + descStr;
  
  // 1. Audience (40)
  const studentTypes = ['internship', 'student_program', 'hackathon', 'fellowship', 'scholarship'];
  if (opp.type && studentTypes.includes(opp.type)) {
    score += 40;
  } else if (strSearch.includes('intern') || strSearch.includes('fresher') || strSearch.includes('student') || strSearch.includes('graduate')) {
    score += 30;
  }

  // 2. Domain (30)
  const cseKeywords = [
    'software', 'developer', 'engineer', 'frontend', 'backend', 'fullstack', 
    'react', 'node', 'python', 'java', 'ai', 'machine learning', 
    'data science', 'web', 'programmer', 'coding', 'tech'
  ];
  let hasCseKeyword = false;
  
  if (opp.skills && opp.skills.some(s => cseKeywords.some(k => s.toLowerCase().includes(k)))) {
    hasCseKeyword = true;
  }
  if (!hasCseKeyword && opp.tags && opp.tags.some(t => cseKeywords.some(k => t.toLowerCase().includes(k)))) {
    hasCseKeyword = true;
  }
  if (!hasCseKeyword && cseKeywords.some(k => strSearch.includes(k))) {
    hasCseKeyword = true;
  }

  if (hasCseKeyword) score += 30;

  // 3. Geography/Accessibility (30)
  let isIndia = false;
  if (opp.location) {
    const locStr = JSON.stringify(opp.location).toLowerCase();
    if (locStr.includes('india')) isIndia = true;
  }
  
  if (isIndia || opp.workMode === 'remote') {
    score += 30;
  } else if (strSearch.includes('remote') || strSearch.includes('india')) {
    score += 15;
  }

  return Math.floor(Math.min(Math.max(score, 0), 100));
}

/**
 * Calculates a deterministic overall quality score (0-100).
 * Combines completeness and relevance, applying penalties for critical flaws.
 * 
 * Base: 40% Completeness + 60% Relevance.
 * Penalties: Missing URL (-30).
 * 
 * @param {Object} opp - The normalized opportunity object
 * @returns {number} Score between 0 and 100
 */
export function calculateQualityScore(opp) {
  if (!opp) return 0;
  const comp = calculateCompletenessScore(opp);
  const rel = calculateRelevanceScore(opp);

  let quality = (comp * 0.4) + (rel * 0.6);

  // Critical Penalty: Missing actionable URL makes the opportunity almost useless
  if (!opp.applicationUrl && !opp.registrationUrl) {
    quality -= 30; 
  }

  return Math.floor(Math.min(Math.max(quality, 0), 100));
}
