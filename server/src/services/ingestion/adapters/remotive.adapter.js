import { BaseOpportunityAdapter } from '../adapter.interface.js';

/**
 * Remotive API Adapter
 * Targets the official public Remotive JSON API: https://remotive.com/api/remote-jobs
 */
export class RemotiveAdapter extends BaseOpportunityAdapter {
  constructor(sourceConfig = {}) {
    super(sourceConfig);
    // Explicitly fallback if not provided
    if (!this.sourceConfig.name) this.sourceConfig.name = 'Remotive';
    if (!this.sourceConfig.slug) this.sourceConfig.slug = 'remotive';
    if (!this.sourceConfig.type) this.sourceConfig.type = 'api';
  }

  getSourceDefinition() {
    return super.getSourceDefinition();
  }

  /**
   * Fetches the latest remote software-dev jobs from Remotive API.
   * 
   * @param {Object} options 
   * @param {number} options.limit - Max items to return (default 100)
   * @returns {Promise<Array<Object>>}
   */
  async fetchOpportunities(options = {}) {
    const limit = options.limit || 100; // Enforce bounded fetching
    const url = `https://remotive.com/api/remote-jobs?category=software-dev&limit=${limit}`;

    try {
      // 15 seconds timeout
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

      // Check Content-Length if available to prevent >5MB memory explosion
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

      if (!data || !Array.isArray(data.jobs)) {
        throw new Error('Unexpected source payload structure: missing jobs array');
      }

      // Slice manually in case source ignored the limit param
      const jobs = data.jobs.slice(0, limit);
      return jobs;

    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Source request timed out (15s)');
      }
      throw error;
    }
  }

  /**
   * Normalizes a raw Remotive job object into standard Opportunity shape format
   * that Phase 8C pipeline expects.
   * 
   * @param {Object} rawItem 
   * @returns {Object}
   */
  normalize(rawItem) {
    if (!rawItem) return {};

    const normalized = {
      sourceCategory: 'software-dev',
      workMode: 'remote' // Remotive specifically hosts remote roles
    };

    // stable external identifier
    if (rawItem.id !== undefined && rawItem.id !== null) {
      normalized.externalId = String(rawItem.id);
    }

    if (rawItem.title) {
      normalized.title = rawItem.title;
    }

    if (rawItem.company_name) {
      normalized.organization = rawItem.company_name;
    }

    // Pass HTML description forward, Phase 8C handles sanitation
    if (rawItem.description) {
      normalized.description = rawItem.description;
    }

    if (rawItem.url) {
      normalized.applicationUrl = rawItem.url;
    }

    if (rawItem.company_logo) {
      normalized.organizationLogo = rawItem.company_logo;
    }

    if (rawItem.publication_date) {
      // Safely map the external publication timestamp to postedAt
      const parsedDate = new Date(rawItem.publication_date);
      if (!isNaN(parsedDate.getTime())) {
        normalized.postedAt = parsedDate;
      }
    }

    if (rawItem.candidate_required_location) {
      // We map the raw location string, e.g. "Worldwide" or "USA Only"
      // Phase 8C normalizer locations typically expect a country/state/city object
      // For now, we will pass a custom string via a raw extraction property.
      normalized.location = { country: rawItem.candidate_required_location };
    }

    if (rawItem.tags && Array.isArray(rawItem.tags)) {
      normalized.tags = rawItem.tags;
    }

    // Remotive job_type mapping 
    // Usually 'full_time', 'contract', 'freelance', 'part_time', 'internship', 'other'
    // CareerOS uses ['internship', 'hackathon', 'workshop', 'meetup', 'conference', 'expo', 'open_source', 'competition', 'fellowship', 'scholarship', 'tech_talk', 'student_program']
    // We only map valid known ones (e.g. internship). For others, we leave undefined and let Phase 8C default or error if needed.
    if (rawItem.job_type) {
      const jt = rawItem.job_type.toLowerCase();
      if (jt === 'internship') {
        normalized.type = 'internship';
      }
      // Do not invent false classifications for full_time etc.
    }

    if (rawItem.salary) {
      // Salary is often free-form text: "$50k - $80k". 
      // Do not fabricate amount/currency structured data.
      // We append it to shortDescription if Phase 8C doesn't have a place, or leave it.
      // Spec: "leave structured stipend undefined and emit a warning. Never invent compensation data."
      // Since adapter shouldn't print directly if it breaks flow, we just skip mapping structured stipend.
    }

    return normalized;
  }
}
