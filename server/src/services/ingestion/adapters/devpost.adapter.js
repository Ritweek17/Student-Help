import { BaseOpportunityAdapter } from '../adapter.interface.js';

/**
 * Devpost API Adapter
 * Targets the undocumented frontend JSON feed: https://devpost.com/api/hackathons
 */
export class DevpostAdapter extends BaseOpportunityAdapter {
  constructor(sourceConfig = {}) {
    super(sourceConfig);
    if (!this.sourceConfig.name) this.sourceConfig.name = 'Devpost';
    if (!this.sourceConfig.slug) this.sourceConfig.slug = 'devpost';
    if (!this.sourceConfig.type) this.sourceConfig.type = 'api';
  }

  getSourceDefinition() {
    return super.getSourceDefinition();
  }

  async fetchOpportunities(options = {}) {
    const limit = options.limit || 100;
    const url = 'https://devpost.com/api/hackathons';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'CareerOS-Ingestion-Bot/1.0'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.status === 429) {
        throw new Error('Source rate limit exceeded (HTTP 429)');
      }

      if (!response.ok) {
        throw new Error(`Source request failed with status: ${response.status}`);
      }

      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > 5 * 1024 * 1024) {
        throw new Error('Source response exceeds maximum permitted size (5MB)');
      }

      const rawText = await response.text();
      if (rawText.length > 5 * 1024 * 1024) {
        throw new Error('Source response body exceeds maximum permitted size (5MB)');
      }

      let data;
      try {
        data = JSON.parse(rawText);
      } catch (err) {
        throw new Error('Malformed JSON response from source');
      }

      const rawItems = data.hackathons;
      if (!Array.isArray(rawItems)) {
        throw new Error('Unexpected source payload structure: missing hackathons array');
      }

      return rawItems.slice(0, limit);

    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Source request timed out (15s)');
      }
      throw error;
    }
  }

  normalize(rawItem) {
    if (!rawItem) return {};

    const normalized = {
      type: 'hackathon',
      sourceCategory: 'hackathon'
    };

    // stable external identifier
    if (rawItem.id !== undefined && rawItem.id !== null) {
      normalized.externalId = String(rawItem.id);
    }

    if (rawItem.title) {
      normalized.title = String(rawItem.title).trim();
    }

    if (rawItem.organization_name) {
      normalized.organization = String(rawItem.organization_name).trim();
    }

    // Devpost's list endpoint does not include descriptions.
    // If one is provided in a detail endpoint or future update, capture it cleanly.
    if (rawItem.description) {
      normalized.description = String(rawItem.description);
    } else if (rawItem.content) {
      normalized.description = String(rawItem.content);
    }

    if (rawItem.url) {
      normalized.applicationUrl = String(rawItem.url).trim();
    }

    if (rawItem.start_a_submission_url) {
      normalized.registrationUrl = String(rawItem.start_a_submission_url).trim();
    }

    if (rawItem.thumbnail_url) {
      normalized.organizationLogo = String(rawItem.thumbnail_url).trim();
    }

    // Publication date is not naturally exposed in this endpoint. 
    // We only map it if it actually exists.
    if (rawItem.created_at || rawItem.published_at) {
      const parsedDate = new Date(rawItem.created_at || rawItem.published_at);
      if (!isNaN(parsedDate.getTime())) {
        normalized.postedAt = parsedDate;
      }
    }

    // Deadlines and event dates
    // We do NOT attempt fragile regex extraction on `submission_period_dates`.
    // Only map true ISO/structured dates if safely available.
    if (rawItem.start_date || rawItem.event_date) {
      const pd = new Date(rawItem.start_date || rawItem.event_date);
      if (!isNaN(pd.getTime())) normalized.eventDate = pd;
    }
    
    if (rawItem.deadline || rawItem.end_date) {
      const pd = new Date(rawItem.deadline || rawItem.end_date);
      if (!isNaN(pd.getTime())) normalized.deadline = pd;
    }

    // Location / WorkMode mapping determinism
    if (rawItem.displayed_location && rawItem.displayed_location.location) {
      const loc = String(rawItem.displayed_location.location).trim();
      const locLower = loc.toLowerCase();
      
      if (locLower === 'online' || locLower === 'virtual') {
        normalized.workMode = 'remote';
      } else {
        normalized.location = { city: loc };
        if (locLower.includes('hybrid')) {
          normalized.workMode = 'hybrid';
        } else {
          normalized.workMode = 'onsite';
        }
      }
    }

    // Tags & Themes
    if (rawItem.themes && Array.isArray(rawItem.themes)) {
      normalized.tags = rawItem.themes.map(t => typeof t === 'string' ? t : String(t.name));
    }
    
    if (rawItem.tags && Array.isArray(rawItem.tags)) {
      const existing = normalized.tags || [];
      normalized.tags = [...existing, ...rawItem.tags.map(t => String(t))];
    }

    // Eligibility - only mapped when explicitly signaled
    if (rawItem.invite_only === true) {
      normalized.eligibility = 'invite_only';
    }

    // Prize: strictly bounded to structured amounts. Do NOT fabricate from unstructured strings like "$<span data...>...".
    if (rawItem.prize && typeof rawItem.prize === 'object' && rawItem.prize.amount !== undefined) {
      normalized.prize = {
        amount: Number(rawItem.prize.amount),
        currency: rawItem.prize.currency || 'USD'
      };
    }

    // Strict compliance: Do not fabricate a salary/stipend structure.

    return normalized;
  }
}
