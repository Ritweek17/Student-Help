/**
 * CareerOS — Ingestion HTML Sanitizer Utility (Phase 8B)
 *
 * Converts untrusted external HTML descriptions into clean, safe plain text
 * or sanitized formatted text without external dependencies.
 */

const DANGEROUS_TAG_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi,
  /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
  /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
  /<embed\b[^>]*>/gi,
  /<applet\b[^<]*(?:(?!<\/applet>)<[^<]*)*<\/applet>/gi,
  /<meta\b[^>]*>/gi,
  /<link\b[^>]*>/gi,
];

const DANGEROUS_EVENT_HANDLERS = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const DANGEROUS_SCHEMES = /(?:javascript|vbscript|data):[^\s"'>]+/gi;

const COMMON_ENTITIES = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&mdash;': '—',
  '&ndash;': '–',
  '&bull;': '•',
  '&hellip;': '…',
  '&copy;': '©',
  '&reg;': '®',
  '&trade;': '™',
};

/**
 * Decode HTML entities into standard UTF-8 characters.
 * @param {string} text
 * @returns {string}
 */
export function decodeHtmlEntities(text) {
  if (!text || typeof text !== 'string') return '';

  let decoded = text;
  // Multi-pass (up to 2 passes) to handle double-encoded entities like &amp;nbsp;
  for (let pass = 0; pass < 2; pass++) {
    for (const [entity, replacement] of Object.entries(COMMON_ENTITIES)) {
      decoded = decoded.replaceAll(entity, replacement);
    }

    // Decode decimal entities (e.g. &#65;)
    decoded = decoded.replace(/&#(\d+);/g, (_match, dec) => {
      try {
        return String.fromCharCode(parseInt(dec, 10));
      } catch {
        return '';
      }
    });

    // Decode hex entities (e.g. &#x41;)
    decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (_match, hex) => {
      try {
        return String.fromCharCode(parseInt(hex, 16));
      } catch {
        return '';
      }
    });
  }

  return decoded;
}

/**
 * Sanitize untrusted external HTML into safe, readable plain text.
 * Strips executable scripts, event handlers, embeds, and HTML tags,
 * while preserving paragraph structure and decoding entities.
 *
 * @param {string} rawHtml - Untrusted external HTML string
 * @returns {string} Clean, safe text
 */
export function sanitizeHtml(rawHtml) {
  if (!rawHtml || typeof rawHtml !== 'string') {
    return '';
  }

  let text = rawHtml;

  // 1. Remove dangerous executable/embed elements
  for (const pattern of DANGEROUS_TAG_PATTERNS) {
    text = text.replace(pattern, ' ');
  }

  // 2. Remove inline event handlers and dangerous URI schemes
  text = text.replace(DANGEROUS_EVENT_HANDLERS, ' ');
  text = text.replace(DANGEROUS_SCHEMES, ' ');

  // 3. Convert structural HTML block elements into clean line breaks
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<\/(div|h[1-6]|tr)>/gi, '\n');
  text = text.replace(/<\/li>/gi, '\n');
  text = text.replace(/<li[^>]*>/gi, '• ');

  // 4. Strip all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // 5. Decode entities
  text = decodeHtmlEntities(text);

  // 6. Strip any residual or decoded HTML tags (e.g. from &lt;b&gt;)
  text = text.replace(/<[^>]+>/g, '');

  // 7. Clean up excessive whitespace
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n\s*\n\s*\n+/g, '\n\n');

  return text.trim();
}

/**
 * Extract clean single-line plain text (suitable for titles or short descriptions).
 *
 * @param {string} rawHtml
 * @param {number} [maxLength=300]
 * @returns {string}
 */
export function stripHtmlToPlainText(rawHtml, maxLength = 300) {
  const sanitized = sanitizeHtml(rawHtml);
  const singleLine = sanitized.replace(/\s+/g, ' ').trim();
  if (maxLength && singleLine.length > maxLength) {
    return singleLine.slice(0, maxLength).trim() + '...';
  }
  return singleLine;
}
