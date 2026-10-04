import crypto from 'crypto';

/**
 * Normalize an arbitrary text component for fingerprint generation.
 * Lowercases, trims, and collapses multiple whitespace characters.
 *
 * @param {string} text
 * @returns {string}
 */
export function normalizeFingerprintComponent(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Format a Date or date string into an ISO YYYY-MM-DD date component.
 * Returns 'nodate' if unparseable or absent.
 *
 * @param {Date|string|number} dateVal
 * @returns {string}
 */
export function normalizeDateComponent(dateVal) {
  if (!dateVal) return 'nodate';

  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return 'nodate';
    return d.toISOString().split('T')[0];
  } catch {
    return 'nodate';
  }
}

/**
 * Generate a deterministic SHA-256 content fingerprint for an opportunity.
 *
 * Combines:
 * - Normalized Organization
 * - Normalized Title
 * - Normalized Deadline (or EventDate if deadline absent, or 'nodate')
 *
 * Deliberately excludes volatile fields (descriptions, timestamps, tracking IDs)
 * to ensure stable duplicate detection across syndication feeds.
 *
 * @param {Object} params
 * @param {string} params.organization - Sponsor/Company name
 * @param {string} params.title - Role/Event title
 * @param {Date|string} [params.deadline] - Application deadline
 * @param {Date|string} [params.eventDate] - Event start date (fallback for hackathons/meetups)
 * @returns {string} 64-character lowercase SHA-256 hex digest
 */
export function generateContentFingerprint({ organization = '', title = '', deadline = null, eventDate = null } = {}) {
  const normOrg = normalizeFingerprintComponent(organization);
  const normTitle = normalizeFingerprintComponent(title);

  // Date preference: deadline first, fallback to eventDate, fallback to 'nodate'
  const dateStr = deadline
    ? normalizeDateComponent(deadline)
    : eventDate
      ? normalizeDateComponent(eventDate)
      : 'nodate';

  const rawKey = `${normOrg}|${normTitle}|${dateStr}`;

  return crypto
    .createHash('sha256')
    .update(rawKey, 'utf8')
    .digest('hex');
}
