import { Opportunity, OPPORTUNITY_TYPES } from '../../models/Opportunity.js';
import { normalizeOpportunityData } from './normalizer.js';
import { isSafeHttpUrl } from '../../utils/ingestion/urlNormalizer.js';
import { generateContentFingerprint } from '../../utils/ingestion/contentFingerprint.js';
import { calculateCompletenessScore, calculateRelevanceScore, calculateQualityScore } from './scoring.service.js';

/**
 * Gate A Validation
 * @param {Object} normalized 
 * @returns {Object} { isValid, reasons }
 */
function validateGateA(normalized) {
  const reasons = [];

  if (!normalized.title) reasons.push('Missing title');
  else if (normalized.title.length < 3) reasons.push('Title must be at least 3 characters');

  if (!normalized.organization) reasons.push('Missing organization');
  else if (normalized.organization.length < 2) reasons.push('Organization must be at least 2 characters');

  if (!normalized.description) reasons.push('Missing description');
  else if (normalized.description.length < 20) reasons.push('Description must be at least 20 characters');

  if (normalized.type && !OPPORTUNITY_TYPES.includes(normalized.type)) {
    reasons.push('Invalid opportunity type');
  }

  if (!normalized.applicationUrl && !normalized.registrationUrl) {
    reasons.push('Missing or invalid applicationUrl or registrationUrl (must be a valid HTTP/HTTPS URL)');
  } else {
    if (normalized.applicationUrl && !isSafeHttpUrl(normalized.applicationUrl)) {
      reasons.push('applicationUrl must be a valid HTTP/HTTPS URL');
    }
    if (normalized.registrationUrl && !isSafeHttpUrl(normalized.registrationUrl)) {
      reasons.push('registrationUrl must be a valid HTTP/HTTPS URL');
    }
  }

  if (!normalized.sourceRef) {
    reasons.push('Missing sourceRef');
  }

  // Dates
  if (normalized.eventDate && isNaN(normalized.eventDate.getTime())) {
    reasons.push('Invalid eventDate');
  }
  if (normalized.endDate && isNaN(normalized.endDate.getTime())) {
    reasons.push('Invalid endDate');
  }
  if (normalized.deadline && isNaN(normalized.deadline.getTime())) {
    reasons.push('Invalid deadline');
  }
  if (normalized.eventDate && normalized.endDate && normalized.endDate < normalized.eventDate) {
    reasons.push('endDate cannot be before eventDate');
  }

  // Stipend/Prize
  if (normalized.stipend?.amount !== undefined && normalized.stipend.amount < 0) {
    reasons.push('Stipend amount cannot be negative');
  }
  if (normalized.prize?.amount !== undefined && normalized.prize.amount < 0) {
    reasons.push('Prize amount cannot be negative');
  }

  return {
    isValid: reasons.length === 0,
    reasons
  };
}

/**
 * Define fields owned by the ingestion source.
 * We do not overwrite verified, verifiedBy, verifiedAt, featured, etc.
 */
const SOURCE_OWNED_FIELDS = [
  'title', 'organization', 'description', 'shortDescription', 'type', 'workMode',
  'skills', 'tags', 'location', 'stipend', 'prize', 'applicationUrl', 'registrationUrl',
  'organizationLogo', 'organizationWebsite', 'deadline', 'eventDate', 'endDate',
  'duration', 'canonicalUrl', 'contentFingerprint', 'ingestionRunId',
  'sourceRef', 'externalId', 'sourceId', 'sourceType', 'source',
  'postedAt', 'lastSeenAt', 'qualityScore', 'relevanceScore', 'completenessScore'
];

/**
 * Source-agnostic Opportunity ingestion pipeline entry point.
 * 
 * @param {Object} params
 * @param {Object} params.rawItem - Raw opportunity from the external source
 * @param {Object} params.source - OpportunitySource document or config (must include _id or id)
 * @param {string|ObjectId} params.ingestionRunId - ID of the active ingestion run
 * @returns {Promise<Object>} Structured result 
 */
export async function processOpportunityItem({ rawItem, source, ingestionRunId }) {
  try {
    if (!rawItem) {
      return { status: 'invalid', action: 'skipped', reason: 'Missing rawItem' };
    }
    if (!source || (!source._id && !source.id)) {
      return { status: 'invalid', action: 'skipped', reason: 'Missing source configuration or ID' };
    }

    // 1. Normalize
    const normalized = normalizeOpportunityData(rawItem, source);

    // Apply ingestion metadata early for validation and deduplication
    normalized.sourceRef = source._id || source.id;
    // ensure externalId is trimmed string
    if (rawItem.externalId !== undefined && rawItem.externalId !== null) {
      normalized.externalId = String(rawItem.externalId).trim();
    }
    normalized.ingestionRunId = ingestionRunId;

    // Optional: map legacy sourceType/sourceId if not explicitly provided
    if (!normalized.sourceType && source.type) normalized.sourceType = source.type;
    if (!normalized.sourceId && normalized.externalId) normalized.sourceId = normalized.externalId;

    // Use primary application URL as canonical URL, or fallback to registration URL
    normalized.canonicalUrl = normalized.applicationUrl || normalized.registrationUrl;

    // Generate Fingerprint
    const fingerprintInput = {
      organization: normalized.organization,
      title: normalized.title,
      deadline: normalized.deadline,
      eventDate: normalized.eventDate
    };
    normalized.contentFingerprint = generateContentFingerprint(fingerprintInput);

    // Apply Freshness/Liveness metadata
    normalized.lastSeenAt = new Date();

    // Calculate Deterministic Scores
    normalized.completenessScore = calculateCompletenessScore(normalized);
    normalized.relevanceScore = calculateRelevanceScore(normalized);
    normalized.qualityScore = calculateQualityScore(normalized);

    // 2. Gate A Validation
    const validation = validateGateA(normalized);
    if (!validation.isValid) {
      return {
        status: 'invalid',
        action: 'skipped',
        reason: 'Gate-A Validation failed',
        warnings: validation.reasons
      };
    }

    // 3. Deduplication - Tier 1 (Source Identity)
    let existing;
    if (normalized.externalId) {
      existing = await Opportunity.findOne({
        sourceRef: normalized.sourceRef,
        externalId: normalized.externalId
      });
    }

    if (existing) {
      // It's a same-source record -> UPDATE
      const updateData = {};
      const warnings = [];

      // Check if verified data is materially changing (could be a warning)
      if (existing.verified) {
        if (existing.title !== normalized.title || existing.organization !== normalized.organization) {
          warnings.push('Material change to verified record (title/org)');
        }
      }

      for (const field of SOURCE_OWNED_FIELDS) {
        if (normalized[field] !== undefined) {
          updateData[field] = normalized[field];
        }
      }

      // MongoDB Race Safety - we can use findOneAndUpdate to prevent weird concurrent bugs, 
      // but typical .set/.save handles it fine since we are explicitly merging.
      for (const [k, v] of Object.entries(updateData)) {
        existing[k] = v;
      }
      
      await existing.save();

      return {
        status: 'success',
        action: 'updated',
        opportunityId: existing._id,
        warnings
      };
    }

    // 4. Deduplication - Tier 2 (Canonical URL)
    if (normalized.canonicalUrl) {
      const urlMatch = await Opportunity.findOne({ canonicalUrl: normalized.canonicalUrl });
      if (urlMatch) {
        return {
          status: 'duplicate',
          action: 'cross_source_duplicate',
          opportunityId: urlMatch._id,
          reason: 'Canonical URL matched another source'
        };
      }
    }

    // 5. Deduplication - Tier 3 (Content Fingerprint)
    if (normalized.contentFingerprint) {
      const fpMatch = await Opportunity.findOne({ contentFingerprint: normalized.contentFingerprint });
      if (fpMatch) {
        return {
          status: 'duplicate',
          action: 'fingerprint_duplicate',
          opportunityId: fpMatch._id,
          reason: 'Content fingerprint matched another opportunity'
        };
      }
    }

    // 6. UPSERT / CREATE (New Opportunity)
    // At this point, we are confident it is new.
    normalized.status = 'draft';
    normalized.verified = false;

    // Explicitly create only using safe fields to avoid NoSQL injection
    const createData = { status: 'draft', verified: false };
    for (const field of SOURCE_OWNED_FIELDS) {
      if (normalized[field] !== undefined) {
        createData[field] = normalized[field];
      }
    }

    try {
      const created = await Opportunity.create(createData);
      return {
        status: 'success',
        action: 'created',
        opportunityId: created._id
      };
    } catch (createErr) {
      // Handle MongoDB E11000 Duplicate Key Error (Race condition between workers)
      if (createErr.code === 11000) {
        const raceExisting = await Opportunity.findOne({
          sourceRef: normalized.sourceRef,
          externalId: normalized.externalId
        });
        if (raceExisting) {
          return {
            status: 'success',
            action: 'updated',
            opportunityId: raceExisting._id,
            reason: 'Recovered from duplicate-key race condition'
          };
        }
      }
      // Re-throw if it wasn't a duplicate key race we could recover from
      throw createErr;
    }

  } catch (error) {
    return {
      status: 'failed',
      action: 'skipped',
      reason: error.message || 'Unexpected pipeline error'
    };
  }
}
