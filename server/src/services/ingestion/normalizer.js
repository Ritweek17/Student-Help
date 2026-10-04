import { sanitizeHtml, stripHtmlToPlainText } from '../../utils/ingestion/htmlSanitizer.js';
import { normalizeUrl } from '../../utils/ingestion/urlNormalizer.js';

/**
 * Normalizes title.
 */
function normalizeTitle(rawTitle) {
  if (!rawTitle || typeof rawTitle !== 'string') return undefined;
  let title = rawTitle.replace(/\s+/g, ' ').trim();
  // Remove obvious noise
  title = title.replace(/^\[urgent\]\s*/i, '');
  title = title.replace(/^[🚨🔥⭐✨🎉🚀👉]+\s*/, '');
  if (title.length > 200) title = title.substring(0, 200).trim();
  return title;
}

/**
 * Normalizes organization.
 */
function normalizeOrganization(rawOrg) {
  if (!rawOrg || typeof rawOrg !== 'string') return undefined;
  let org = rawOrg.replace(/\s+/g, ' ').trim();
  // Remove obvious legal suffixes if they exist at the end safely
  org = org.replace(/,?\s*(LLC|Inc\.?|Corp\.?|Ltd\.?)\s*$/i, '');
  return org.trim();
}

/**
 * Normalizes Type.
 */
function normalizeType(rawType) {
  if (!rawType || typeof rawType !== 'string') return undefined;
  const t = rawType.toLowerCase().trim();
  
  if (t.match(/intern|co-op|summer student/)) return 'internship';
  if (t.match(/hack|codefest|game jam/)) return 'hackathon';
  if (t.match(/fellow|residency/)) return 'fellowship';
  if (t.match(/grant|award|tuition|scholar/)) return 'scholarship';
  if (t.match(/meetup|webinar|developer talk/)) return 'meetup';
  if (t.match(/workshop/)) return 'workshop';
  if (t.match(/conference/)) return 'conference';
  if (t.match(/expo/)) return 'expo';
  if (t.match(/open source/)) return 'open_source';
  if (t.match(/competition/)) return 'competition';
  if (t.match(/tech talk/)) return 'tech_talk';
  if (t.match(/student program/)) return 'student_program';
  
  // Return standard types exactly if matched
  const VALID_TYPES = ['internship', 'hackathon', 'workshop', 'meetup', 'conference', 'expo', 'open_source', 'competition', 'fellowship', 'scholarship', 'tech_talk', 'student_program'];
  if (VALID_TYPES.includes(t)) return t;

  return undefined; // Let validation fail or undefined pass
}

/**
 * Normalizes Work Mode.
 */
function normalizeWorkMode(rawWorkMode) {
  if (!rawWorkMode || typeof rawWorkMode !== 'string') return undefined;
  const wm = rawWorkMode.toLowerCase().trim();
  
  if (wm.match(/remote|wfh|work from home/)) return 'remote';
  if (wm.match(/hybrid/)) return 'hybrid';
  if (wm.match(/online|virtual/)) return 'online';
  if (wm.match(/onsite|in person|in-person/)) return 'onsite';
  
  return undefined;
}

/**
 * Normalizes Location.
 */
function normalizeLocation(rawLoc) {
  if (!rawLoc || typeof rawLoc !== 'object') return undefined;
  const loc = {};
  if (rawLoc.country && typeof rawLoc.country === 'string') loc.country = rawLoc.country.trim();
  if (rawLoc.state && typeof rawLoc.state === 'string') loc.state = rawLoc.state.trim();
  if (rawLoc.city && typeof rawLoc.city === 'string') loc.city = rawLoc.city.trim();
  
  if (Object.keys(loc).length === 0) return undefined;
  return loc;
}

/**
 * Normalizes Skills / Tags array.
 */
function normalizeArray(arr) {
  if (!Array.isArray(arr)) return undefined;
  let normalized = [];
  
  for (const item of arr) {
    if (typeof item === 'string') {
      const parts = item.split(/[/,]/); // Split by comma or slash
      for (const part of parts) {
        let clean = part.toLowerCase().trim();
        clean = clean.replace(/^[.#*•-]\s*/, ''); // Remove punctuation noise
        if (clean === 'reactjs') clean = 'react';
        if (clean === 'node.js') clean = 'nodejs';
        if (clean) normalized.push(clean);
      }
    }
  }
  
  normalized = [...new Set(normalized)]; // deduplicate
  return normalized.length > 0 ? normalized : undefined;
}

/**
 * Normalizes Monetary amount.
 */
function normalizeMonetary(rawObj) {
  if (!rawObj || typeof rawObj !== 'object') return undefined;
  const normalized = {};
  
  if (rawObj.amount !== undefined) {
    let amt = Number(rawObj.amount);
    if (!isNaN(amt) && amt >= 0) {
      normalized.amount = amt;
    }
  }
  
  if (rawObj.currency && typeof rawObj.currency === 'string') {
    normalized.currency = rawObj.currency.trim().toUpperCase();
  }
  
  if (rawObj.period && typeof rawObj.period === 'string') {
    normalized.period = rawObj.period.trim().toLowerCase();
  }
  
  if (Object.keys(normalized).length === 0) return undefined;
  return normalized;
}

/**
 * Parses and validates date strictly.
 */
function normalizeDate(rawDate) {
  if (!rawDate) return undefined;
  const parsed = new Date(rawDate);
  if (isNaN(parsed.getTime())) return undefined;
  return parsed;
}

/**
 * Normalizes external raw item into canonical Opportunity format.
 * Explicitly maps approved fields only.
 * 
 * @param {Object} rawItem - Raw item from external source
 * @param {Object} sourceConfig - Information about the source
 * @returns {Object} Normalized Opportunity data
 */
export function normalizeOpportunityData(rawItem, sourceConfig = {}) {
  if (!rawItem || typeof rawItem !== 'object') return {};

  const normalized = {};

  // Title
  if (rawItem.title) {
    normalized.title = normalizeTitle(rawItem.title);
  }

  // Organization
  if (rawItem.organization) {
    normalized.organization = normalizeOrganization(rawItem.organization);
  }

  // Description
  if (rawItem.description) {
    const cleanDesc = sanitizeHtml(rawItem.description);
    if (cleanDesc && cleanDesc.length > 0) {
      // Arbitrary max length protection for Mongo (e.g. 50KB)
      normalized.description = cleanDesc.substring(0, 50000);
      
      // Short Description
      if (rawItem.shortDescription && typeof rawItem.shortDescription === 'string') {
        normalized.shortDescription = rawItem.shortDescription.replace(/\s+/g, ' ').trim().substring(0, 300);
      } else {
        normalized.shortDescription = stripHtmlToPlainText(normalized.description, 300);
      }
    }
  }

  // Type & WorkMode
  if (rawItem.type) normalized.type = normalizeType(rawItem.type);
  if (rawItem.workMode) normalized.workMode = normalizeWorkMode(rawItem.workMode);

  // Location
  if (rawItem.location) {
    const loc = normalizeLocation(rawItem.location);
    if (loc) normalized.location = loc;
  }

  // Skills and Tags
  if (rawItem.skills) {
    const skills = normalizeArray(rawItem.skills);
    if (skills) normalized.skills = skills;
  }
  
  if (rawItem.tags) {
    const tags = normalizeArray(rawItem.tags);
    if (tags) normalized.tags = tags;
  }

  // Stipend and Prize
  if (rawItem.stipend) {
    const stipend = normalizeMonetary(rawItem.stipend);
    if (stipend) normalized.stipend = stipend;
  }
  
  if (rawItem.prize) {
    const prize = normalizeMonetary(rawItem.prize);
    if (prize) normalized.prize = prize;
  }

  // URLs
  if (rawItem.applicationUrl) normalized.applicationUrl = normalizeUrl(rawItem.applicationUrl) || undefined;
  if (rawItem.registrationUrl) normalized.registrationUrl = normalizeUrl(rawItem.registrationUrl) || undefined;
  if (rawItem.organizationLogo) normalized.organizationLogo = normalizeUrl(rawItem.organizationLogo) || undefined;
  if (rawItem.organizationWebsite) normalized.organizationWebsite = normalizeUrl(rawItem.organizationWebsite) || undefined;

  // Dates
  if (rawItem.deadline) normalized.deadline = normalizeDate(rawItem.deadline);
  if (rawItem.eventDate) normalized.eventDate = normalizeDate(rawItem.eventDate);
  if (rawItem.endDate) normalized.endDate = normalizeDate(rawItem.endDate);

  if (rawItem.duration && typeof rawItem.duration === 'string') {
    normalized.duration = rawItem.duration.trim();
  }

  // Source mapping explicitly provided by the caller or rawItem
  if (sourceConfig.name && typeof sourceConfig.name === 'string') {
    normalized.source = {
      name: sourceConfig.name.trim(),
    };
    if (sourceConfig.url) {
      normalized.source.url = normalizeUrl(sourceConfig.url) || undefined;
    }
  } else if (rawItem.source && typeof rawItem.source === 'object') {
    normalized.source = {
      name: (rawItem.source.name && typeof rawItem.source.name === 'string') ? rawItem.source.name.trim() : undefined,
      url: rawItem.source.url ? normalizeUrl(rawItem.source.url) : undefined,
    };
  }
  
  if (rawItem.sourceId && typeof rawItem.sourceId === 'string') {
    normalized.sourceId = rawItem.sourceId.trim();
  }
  
  if (rawItem.sourceType && typeof rawItem.sourceType === 'string') {
    normalized.sourceType = rawItem.sourceType.trim();
  }

  return normalized;
}
