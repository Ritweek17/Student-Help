/**
 * CareerOS — Opportunity Ingestion Adapter Interface & Contracts
 *
 * Defines the conceptual contract that all future external source adapters must fulfill.
 * No network requests or provider-specific scraping is performed in this foundational phase.
 */

/**
 * Expected schema shape for normalized opportunities produced by adapters.
 */
export const NORMALIZED_OPPORTUNITY_FIELDS = Object.freeze([
  'title',
  'organization',
  'description',
  'shortDescription',
  'type',
  'eligibility',
  'skills',
  'tags',
  'location',
  'workMode',
  'stipend',
  'prize',
  'applicationUrl',
  'registrationUrl',
  'organizationLogo',
  'organizationWebsite',
  'deadline',
  'eventDate',
  'endDate',
  'duration',
  'source',
  'sourceId',
  'sourceType',
]);

/**
 * Deduplication identity priority order for reconciling external records:
 * 1. sourceType + sourceId (Primary deterministic identity)
 * 2. source.url (Secondary identity when sourceId is unavailable)
 * 3. Normalized organization + title + date (Weak heuristic fallback)
 */
export const DEDUPLICATION_IDENTITY_PRIORITY = Object.freeze([
  'sourceType + sourceId',
  'source.url',
  'normalized organization + title + date',
]);

/**
 * Abstract Base Class for Opportunity Source Adapters.
 */
export class BaseOpportunityAdapter {
  /**
   * @param {Object} sourceConfig - Stored OpportunitySource configuration document or plain object
   */
  constructor(sourceConfig = {}) {
    if (this.constructor === BaseOpportunityAdapter) {
      // Direct instantiation is allowed for inspection/testing, but abstract methods require subclass overrides
    }
    this.sourceConfig = sourceConfig;
  }

  /**
   * Returns definition metadata describing this adapter and its targeted source.
   * @returns {{ name: string, slug: string, type: string }}
   */
  getSourceDefinition() {
    return {
      name: this.sourceConfig.name || 'Unnamed Source',
      slug: this.sourceConfig.slug || 'unknown-slug',
      type: this.sourceConfig.type || 'api',
    };
  }

  /**
   * Fetch raw items from the external source.
   * Must be implemented by concrete subclasses.
   *
   * @param {Object} [options] - Pagination or query parameters
   * @returns {Promise<Array<Object>>} Raw items retrieved from the source
   */
  async fetchOpportunities(options = {}) {
    throw new Error(
      `fetchOpportunities() must be implemented by adapter subclass for ${this.sourceConfig.slug || 'source'}`
    );
  }

  /**
   * Transform a raw source item into a standardized Opportunity object shape.
   * Must be implemented by concrete subclasses.
   *
   * @param {Object} rawItem - Single raw opportunity item from the external source
   * @returns {Object} Normalized Opportunity data matching Opportunity schema
   */
  normalize(rawItem) {
    throw new Error(
      `normalize() must be implemented by adapter subclass for ${this.sourceConfig.slug || 'source'}`
    );
  }
}
