import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { setupTestDatabase, clearTestDatabase, teardownTestDatabase } from '../setup.js';
import { Opportunity } from '../../src/models/Opportunity.js';
import { OpportunitySource } from '../../src/models/OpportunitySource.js';
import { OpportunityIngestionRun } from '../../src/models/OpportunityIngestionRun.js';
import { DevpostAdapter } from '../../src/services/ingestion/adapters/devpost.adapter.js';
import { BaseOpportunityAdapter } from '../../src/services/ingestion/adapter.interface.js';
import { processOpportunityItem } from '../../src/services/ingestion/pipeline.service.js';

describe('Devpost Adapter Test Suite (Deterministic / Offline)', () => {
  let mockSourceDoc;
  let mockRunDoc;
  let adapter;
  const originalFetch = global.fetch;

  beforeAll(async () => {
    await setupTestDatabase();
    await Promise.all([
      Opportunity.init(),
      OpportunitySource.init(),
      OpportunityIngestionRun.init(),
    ]);
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();

    mockSourceDoc = await OpportunitySource.create({
      name: 'Devpost',
      slug: 'devpost',
      type: 'api',
      baseUrl: 'https://devpost.com/api',
      enabled: false, // In production Devpost list endpoint is disabled due to missing descriptions
    });

    mockRunDoc = await OpportunityIngestionRun.create({
      sourceId: mockSourceDoc._id,
      status: 'running',
      startedAt: new Date(),
    });

    adapter = new DevpostAdapter(mockSourceDoc);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('1. Adapter Contract & Definition', () => {
    it('inherits from BaseOpportunityAdapter and implements contract', () => {
      expect(adapter).toBeInstanceOf(BaseOpportunityAdapter);
      expect(typeof adapter.fetchOpportunities).toBe('function');
      expect(typeof adapter.normalize).toBe('function');

      const def = adapter.getSourceDefinition();
      expect(def.slug).toBe('devpost');
      expect(def.type).toBe('api');
      expect(def.name).toBe('Devpost');
    });
  });

  describe('2. Normalization & Fixture Extraction', () => {
    const validFixture = {
      id: 29969,
      title: 'RevenueCat Shipaton 2026',
      displayed_location: {
        icon: 'globe',
        location: 'Online',
      },
      thumbnail_url: 'https://d112y698adiu2z.cloudfront.net/photos/medium_square.jpg',
      url: 'https://revenuecat-shipaton-2026.devpost.com/',
      submission_period_dates: 'Jul 31 - Oct 01, 2026',
      themes: [
        { id: 18, name: 'Design' },
        { id: 4, name: 'Gaming' },
      ],
      prize_amount: '$<span data-currency-value>740,000</span>',
      organization_name: 'RevenueCat',
      start_a_submission_url: 'https://revenuecat-shipaton-2026.devpost.com/challenges/start_a_submission',
      invite_only: false,
      start_date: '2026-07-31T00:00:00Z',
      end_date: '2026-10-01T23:59:59Z',
    };

    it('normalizes valid fixture fields into canonical Opportunity format', () => {
      const norm = adapter.normalize(validFixture);

      expect(norm.externalId).toBe('29969');
      expect(norm.title).toBe('RevenueCat Shipaton 2026');
      expect(norm.organization).toBe('RevenueCat');
      expect(norm.description).toBeUndefined(); // List endpoint does not provide description
      expect(norm.applicationUrl).toBe('https://revenuecat-shipaton-2026.devpost.com/');
      expect(norm.registrationUrl).toBe('https://revenuecat-shipaton-2026.devpost.com/challenges/start_a_submission');
      expect(norm.organizationLogo).toBe('https://d112y698adiu2z.cloudfront.net/photos/medium_square.jpg');
      expect(norm.tags).toContain('Design');
      expect(norm.tags).toContain('Gaming');
      expect(norm.workMode).toBe('remote');
      expect(norm.type).toBe('hackathon');
      expect(norm.eventDate).toBeInstanceOf(Date);
      expect(norm.deadline).toBeInstanceOf(Date);
    });

    it('does not fabricate missing or unstructured data (postedAt, stipend, unstructured prize string)', () => {
      const norm = adapter.normalize(validFixture);

      expect(norm.postedAt).toBeUndefined();
      expect(norm.prize).toBeUndefined(); // HTML string '$<span...>' is NOT mapped as structured prize
      expect(norm.stipend).toBeUndefined();
    });

    it('handles physical locations, onsite workMode, invite_only eligibility, and structured prizes', () => {
      const physicalFixture = {
        id: 111,
        title: 'Local Hackathon',
        organization_name: 'Local Tech',
        displayed_location: { location: 'San Francisco, CA' },
        invite_only: true,
        themes: ['Hardware'],
        prize: { amount: 5000, currency: 'USD' },
        published_at: '2026-01-01T00:00:00Z',
      };

      const norm = adapter.normalize(physicalFixture);

      expect(norm.workMode).toBe('onsite');
      expect(norm.location).toEqual({ city: 'San Francisco, CA' });
      expect(norm.eligibility).toBe('invite_only');
      expect(norm.postedAt).toBeInstanceOf(Date);
      expect(norm.prize).toEqual({ amount: 5000, currency: 'USD' });
      expect(norm.tags).toContain('Hardware');
    });

    it('handles null, undefined, or empty rawItem safely without errors', () => {
      expect(adapter.normalize(null)).toEqual({});
      expect(adapter.normalize(undefined)).toEqual({});
      const emptyNorm = adapter.normalize({});
      expect(emptyNorm.type).toBe('hackathon');
      expect(emptyNorm.title).toBeUndefined();
      expect(emptyNorm.externalId).toBeUndefined();
    });
  });

  describe('3. Offline Fetch Contract & Error Handling (Mocked Fetch)', () => {
    it('fetches and parses valid API JSON payload', async () => {
      const mockItem = { id: 29969, title: 'Hackathon 1' };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': '1000' }),
        text: async () => JSON.stringify({ hackathons: [mockItem] }),
      });

      const items = await adapter.fetchOpportunities({ limit: 5 });
      expect(items.length).toBe(1);
      expect(items[0].id).toBe(29969);
    });

    it('throws on HTTP 500 error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(adapter.fetchOpportunities()).rejects.toThrow('500');
    });

    it('throws rate limit error on HTTP 429', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
      });

      await expect(adapter.fetchOpportunities()).rejects.toThrow('HTTP 429');
    });

    it('throws error when JSON response is malformed', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': '50' }),
        text: async () => '<html>Not JSON</html>',
      });

      await expect(adapter.fetchOpportunities()).rejects.toThrow('Malformed JSON');
    });

    it('throws error when response exceeds 5MB', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': '6000000' }),
      });

      await expect(adapter.fetchOpportunities()).rejects.toThrow('exceeds maximum permitted size (5MB)');
    });

    it('throws error when payload is missing hackathons array', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        text: async () => JSON.stringify({ error: 'not found' }),
      });

      await expect(adapter.fetchOpportunities()).rejects.toThrow('missing hackathons array');
    });
  });

  describe('4. Pipeline Integration & Gate-A Validation', () => {
    it('safely rejects Devpost list item at Gate-A due to missing description and skips creation', async () => {
      const fixtureWithoutDesc = {
        id: 29969,
        title: 'RevenueCat Shipaton 2026',
        organization_name: 'RevenueCat',
        url: 'https://revenuecat-shipaton-2026.devpost.com/',
        displayed_location: { location: 'Online' },
      };

      const normalized = adapter.normalize(fixtureWithoutDesc);
      const res = await processOpportunityItem({
        rawItem: normalized,
        source: mockSourceDoc,
        ingestionRunId: mockRunDoc._id,
      });

      expect(res.status).toBe('invalid');
      expect(res.action).toBe('skipped');
      expect(res.warnings).toBeDefined();
      expect(res.warnings.some((w) => w.includes('Missing description'))).toBe(true);

      const dbCheck = await Opportunity.findOne({ externalId: '29969' });
      expect(dbCheck).toBeNull(); // Blocked by Gate-A data quality check
    });

    it('allows Devpost item through pipeline when description is provided', async () => {
      const fixtureWithDesc = {
        id: 30000,
        title: 'AI Global Hackathon 2026',
        organization_name: 'Devpost Community',
        description: 'Comprehensive description for AI global hackathon with plenty of details exceeding 20 chars.',
        url: 'https://ai-global.devpost.com/',
        displayed_location: { location: 'Online' },
      };

      const normalized = adapter.normalize(fixtureWithDesc);
      const res = await processOpportunityItem({
        rawItem: normalized,
        source: mockSourceDoc,
        ingestionRunId: mockRunDoc._id,
      });

      expect(res.status).toBe('success');
      expect(res.action).toBe('created');
      expect(res.opportunityId).toBeDefined();

      const created = await Opportunity.findById(res.opportunityId);
      expect(created.title).toBe('AI Global Hackathon 2026');
      expect(created.type).toBe('hackathon');
      expect(created.status).toBe('draft');
      expect(created.verified).toBe(false);
    });
  });
});
