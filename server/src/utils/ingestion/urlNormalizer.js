/**
 * CareerOS — Ingestion URL Normalizer Utility (Phase 8B)
 *
 * Normalizes external opportunity URLs for canonical deduplication.
 * Strips marketing and tracking parameters while preserving functional application parameters.
 */

const TRACKING_PARAM_PREFIXES = ['utm_'];

const EXACT_TRACKING_PARAMS = new Set([
  'fbclid',
  'gclid',
  'dclid',
  'msclkid',
  'twclid',
  'igshid',
  'ttclid',
  'ref',
  'referrer',
  'source',
  'origin',
  'tracking_id',
  'mc_cid',
  'mc_eid',
  '_hsenc',
  '_hsmi',
  '__hssc',
  '__hstc',
  'hsctatracking',
  'mkt_tok',
  'trk',
  'cmpid',
  'spm',
]);

/**
 * Check if a URL uses a safe HTTP or HTTPS protocol.
 * Rejects javascript:, data:, ftp:, file:, and malformed strings.
 *
 * @param {string} urlString
 * @returns {boolean}
 */
export function isSafeHttpUrl(urlString) {
  if (!urlString || typeof urlString !== 'string') {
    return false;
  }

  try {
    const parsed = new URL(urlString.trim());
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Normalize an external URL into a canonical format suitable for deduplication.
 *
 * Transformations:
 * - Rejects non-HTTP/HTTPS URLs (returns null).
 * - Trims whitespace.
 * - Lowercases scheme and hostname.
 * - Strips standard default ports (:80, :443).
 * - Strips anchor/hash fragments.
 * - Strips known marketing/analytics tracking parameters.
 * - Alphabetically sorts remaining query parameters.
 * - Removes redundant trailing slash from pathname (except root "/").
 *
 * @param {string} rawUrl - External application or registration URL
 * @returns {string|null} Canonical normalized URL string, or null if invalid
 */
export function normalizeUrl(rawUrl) {
  if (!isSafeHttpUrl(rawUrl)) {
    return null;
  }

  try {
    const parsed = new URL(rawUrl.trim());

    // Protocol: normalize to lowercase
    parsed.protocol = parsed.protocol.toLowerCase();

    // Hostname: normalize to lowercase
    parsed.hostname = parsed.hostname.toLowerCase();

    // Port: remove default ports
    if (
      (parsed.protocol === 'http:' && parsed.port === '80') ||
      (parsed.protocol === 'https:' && parsed.port === '443')
    ) {
      parsed.port = '';
    }

    // Strip hash fragment
    parsed.hash = '';

    // Filter query parameters: strip tracking params, preserve functional params
    const cleanParams = new URLSearchParams();
    const sortedKeys = Array.from(parsed.searchParams.keys()).sort();

    for (const key of sortedKeys) {
      const lowerKey = key.toLowerCase();

      // Check tracking prefixes (e.g. utm_*)
      const isPrefixTracking = TRACKING_PARAM_PREFIXES.some((prefix) =>
        lowerKey.startsWith(prefix)
      );

      // Check exact tracking names
      const isExactTracking = EXACT_TRACKING_PARAMS.has(lowerKey);

      if (!isPrefixTracking && !isExactTracking) {
        for (const value of parsed.searchParams.getAll(key)) {
          cleanParams.append(key, value);
        }
      }
    }

    // Assign sorted, cleaned params
    parsed.search = cleanParams.toString();

    // Normalize pathname: strip trailing slash unless root '/'
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }

    return parsed.toString();
  } catch {
    return null;
  }
}
