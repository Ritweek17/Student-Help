import { BaseOpportunityAdapter } from '../adapter.interface.js';

/**
 * Hasjob API Adapter
 * Targets the Hasjob JSON feed: https://hasjob.co/jobs.json
 */
export class HasjobAdapter extends BaseOpportunityAdapter {
  constructor(sourceConfig = {}) {
    super(sourceConfig);
    if (!this.sourceConfig.name) this.sourceConfig.name = 'Hasjob';
    if (!this.sourceConfig.slug) this.sourceConfig.slug = 'hasjob';
    if (!this.sourceConfig.type) this.sourceConfig.type = 'api';
  }

  getSourceDefinition() {
    return super.getSourceDefinition();
  }

  async fetchOpportunities(options = {}) {
    const limit = options.limit || 100;
    const url = 'https://hasjob.co/jobs.json';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'CareerOS-Ingestion-Bot/1.0 (Integration Test)'
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

      const rawJobs = Array.isArray(data) ? data : (data.jobs || data.items || []);
      
      if (!Array.isArray(rawJobs)) {
        throw new Error('Unexpected source payload structure: missing jobs array');
      }

      return rawJobs.slice(0, limit);

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
      sourceCategory: 'software-dev' // Assuming tech-heavy focus from Hasjob
    };

    // stable external identifier
    const id = rawItem.id || rawItem._id || rawItem.guid;
    if (id !== undefined && id !== null) {
      normalized.externalId = String(id);
    }

    if (rawItem.title) {
      normalized.title = String(rawItem.title).trim();
    }

    if (rawItem.company || rawItem.organization) {
      normalized.organization = String(rawItem.company || rawItem.organization).trim();
    }

    if (rawItem.description) {
      normalized.description = String(rawItem.description);
    } else if (rawItem.content) {
      normalized.description = String(rawItem.content);
    }

    if (rawItem.url || rawItem.link) {
      normalized.applicationUrl = String(rawItem.url || rawItem.link).trim();
    }

    if (rawItem.logo) {
      normalized.organizationLogo = String(rawItem.logo).trim();
    }

    if (rawItem.date || rawItem.published || rawItem.created_at || rawItem.publication_date) {
      const parsedDate = new Date(rawItem.date || rawItem.published || rawItem.created_at || rawItem.publication_date);
      if (!isNaN(parsedDate.getTime())) {
        normalized.postedAt = parsedDate;
      }
    }

    if (rawItem.deadline || rawItem.end_date || rawItem.expires) {
      const parsedDate = new Date(rawItem.deadline || rawItem.end_date || rawItem.expires);
      if (!isNaN(parsedDate.getTime())) {
        normalized.deadline = parsedDate;
      }
    }

    if (rawItem.location) {
      // Map location carefully
      const locStr = String(rawItem.location).toLowerCase();
      normalized.location = { city: String(rawItem.location).trim() };
      
      if (locStr.includes('remote') || locStr.includes('anywhere')) {
        normalized.workMode = 'remote';
      }
    }

    if (rawItem.remote === true || rawItem.workMode === 'remote') {
      normalized.workMode = 'remote';
    } else if (rawItem.workMode === 'hybrid') {
      normalized.workMode = 'hybrid';
    } else if (rawItem.workMode === 'onsite') {
      normalized.workMode = 'onsite';
    }

    // Type detection (only known types)
    const validTypes = ['internship', 'hackathon', 'workshop', 'meetup', 'conference', 'expo', 'open_source', 'competition', 'fellowship', 'scholarship', 'tech_talk', 'student_program'];
    
    if (rawItem.type) {
      const rawType = String(rawItem.type).toLowerCase();
      if (validTypes.includes(rawType)) {
        normalized.type = rawType;
      } else if (rawType.includes('intern') || rawType === 'internship') {
        normalized.type = 'internship';
      }
    } else if (normalized.title) {
      // Very conservative title inference
      const t = normalized.title.toLowerCase();
      if (t.includes('internship') || t.includes('intern')) {
        normalized.type = 'internship';
      }
    }

    if (rawItem.skills && Array.isArray(rawItem.skills)) {
      normalized.skills = rawItem.skills.map(s => String(s));
    }
    if (rawItem.tags && Array.isArray(rawItem.tags)) {
      normalized.tags = rawItem.tags.map(t => String(t));
    }

    // Salary ambiguity constraint: do NOT fabricate structured stipend values from free-form text
    // Only map if explicitly structured
    if (rawItem.stipend && typeof rawItem.stipend === 'object' && rawItem.stipend.amount !== undefined) {
      normalized.stipend = {
        amount: Number(rawItem.stipend.amount),
        currency: rawItem.stipend.currency || 'INR',
        period: rawItem.stipend.period || 'monthly'
      };
    }

    return normalized;
  }
}
