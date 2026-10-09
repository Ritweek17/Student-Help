import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { setupTestDatabase, clearTestDatabase, teardownTestDatabase } from '../setup.js';
import { Opportunity } from '../../src/models/Opportunity.js';
import { OpportunitySource } from '../../src/models/OpportunitySource.js';
import { OpportunityIngestionRun } from '../../src/models/OpportunityIngestionRun.js';
import { AdzunaAdapter } from '../../src/services/ingestion/adapters/adzuna.adapter.js';
import { processOpportunityItem } from '../../src/services/ingestion/pipeline.service.js';

describe('Adzuna Adapter Test Suite (Deterministic / Offline)', () => {
  let mockSourceDoc;
  let mockRunDoc;
  let adapter;
  const originalFetch = global.fetch;
  const originalAppId = process.env.ADZUNA_APP_ID;
  const originalAppKey = process.env.ADZUNA_APP_KEY;

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
      name: 'Adzuna',
      slug: 'adzuna',
      type: 'api',
      baseUrl: 'https://api.adzuna.com',
      enabled: false, // In production Adzuna is disabled until valid creds exist
    });

    mockRunDoc = await OpportunityIngestionRun.create({
      sourceId: mockSourceDoc._id,
      status: 'running',
      startedAt: new Date(),
    });

    adapter = new AdzunaAdapter(mockSourceDoc);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalAppId) process.env.ADZUNA_APP_ID = originalAppId;
    else delete process.env.ADZUNA_APP_ID;
    if (originalAppKey) process.env.ADZUNA_APP_KEY = originalAppKey;
    else delete process.env.ADZUNA_APP_KEY;
  });

  describe('1. Adapter Contract & Definition', () => {
    it('implements required interface methods and exports metadata', () => {
      expect(typeof adapter.fetchOpportunities).toBe('function');
      expect(typeof adapter.normalize).toBe('function');

      const def = adapter.getSourceDefinition();
      expect(def.slug).toBe('adzuna');
      expect(def.type).toBe('api');
      expect(def.name).toBe('Adzuna');
    });
  });

  describe('2. Normalization & Fixture Extraction', () => {
    const validFixture = {
      id: 1234567890,
      title: 'Software Developer Intern - Remote',
      company: { display_name: 'Tech Corp' },
      description: 'We are looking for a software developer intern. Lots of long description text here that passes Gate-A easily.',
      redirect_url: 'https://adzuna.com/land/ad/123',
      created: '2023-10-01T10:00:00Z',
      location: { display_name: 'Bangalore, India' },
      salary_min: 10000,
      salary_max: 20000,
      salary_is_predicted: '0',
    };

    it('normalizes valid fixture fields into canonical Opportunity format', () => {
      const norm = adapter.normalize(validFixture);

      expect(norm.externalId).toBe('1234567890');
      expect(norm.title).toBe('Software Developer Intern - Remote');
      expect(norm.organization).toBe('Tech Corp');
      expect(norm.description).toBe(validFixture.description);
      expect(norm.applicationUrl).toBe('https://adzuna.com/land/ad/123');
      expect(norm.postedAt).toBeInstanceOf(Date);
      expect(norm.postedAt.toISOString()).toBe('2023-10-01T10:00:00.000Z');
      expect(norm.location).toEqual({ city: 'Bangalore, India' });
      expect(norm.workMode).toBe('remote');
      expect(norm.type).toBe('internship');
    });

    it('does not fabricate unspecified fields (stipend, deadlines, logos, eligibility)', () => {
      const norm = adapter.normalize(validFixture);

      expect(norm.registrationUrl).toBeUndefined();
      expect(norm.organizationLogo).toBeUndefined();
      expect(norm.deadline).toBeUndefined();
      expect(norm.eventDate).toBeUndefined();
      expect(norm.stipend).toBeUndefined();
      expect(norm.eligibility).toBeUndefined();
      expect(norm.skills).toBeUndefined();
      expect(norm.tags).toBeUndefined();
    });

    it('infers remote workMode from location when title does not mention remote', () => {
      const norm = adapter.normalize({
        title: 'Junior Developer',
        location: { display_name: 'Remote, UK' },
      });

      expect(norm.workMode).toBe('remote');
      expect(norm.type).toBeUndefined(); // Does not assume all junior roles are internships
    });

    it('handles null, undefined, or empty rawItem safely', () => {
      expect(adapter.normalize(null)).toEqual({});
      expect(adapter.normalize(undefined)).toEqual({});
      expect(adapter.normalize({})).toEqual({ sourceCategory: 'software-dev' });
    });
  });

  describe('3. Offline Fetch Contract & Error Handling (Mocked Fetch)', () => {
    it('throws clear error when credentials are not configured', async () => {
      delete process.env.ADZUNA_APP_ID;
      delete process.env.ADZUNA_APP_KEY;

      await expect(adapter.fetchOpportunities()).rejects.toThrow('Adzuna credentials missing');
    });

    it('throws rate limit error on HTTP 429', async () => {
      process.env.ADZUNA_APP_ID = 'test_id';
      process.env.ADZUNA_APP_KEY = 'test_key';

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        headers: new Headers(),
      });

      await expect(adapter.fetchOpportunities()).rejects.toThrow('Source rate limit exceeded (HTTP 429)');
    });

    it('throws auth error on HTTP 401 or 403 without leaking credentials', async () => {
      process.env.ADZUNA_APP_ID = 'test_id';
      process.env.ADZUNA_APP_KEY = 'super_secret_key';

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        headers: new Headers(),
      });

      try {
        await adapter.fetchOpportunities();
        expect.unreachable('Should have thrown on 403');
      } catch (err) {
        expect(err.message).toContain('HTTP 403');
        expect(err.message).not.toContain('super_secret_key');
      }
    });

    it('sanitizes low-level network errors to prevent credential leakage in URL', async () => {
      process.env.ADZUNA_APP_ID = 'test_id';
      process.env.ADZUNA_APP_KEY = 'super_secret_key';

      global.fetch = vi.fn().mockRejectedValue(
        new TypeError('fetch failed: https://api.adzuna.com/?app_key=super_secret_key')
      );

      try {
        await adapter.fetchOpportunities();
        expect.unreachable('Should have thrown on network error');
      } catch (err) {
        expect(err.message).toBe('Network error during fetch (url sanitized)');
        expect(err.message).not.toContain('super_secret_key');
      }
    });

    it('throws error when response exceeds 5MB via Content-Length or body size', async () => {
      process.env.ADZUNA_APP_ID = 'test_id';
      process.env.ADZUNA_APP_KEY = 'test_key';

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': '6000000' }),
      });

      await expect(adapter.fetchOpportunities()).rejects.toThrow('exceeds maximum permitted size (5MB)');
    });

    it('throws error when JSON response is malformed', async () => {
      process.env.ADZUNA_APP_ID = 'test_id';
      process.env.ADZUNA_APP_KEY = 'test_key';

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        text: async () => '<html>Not JSON</html>',
      });

      await expect(adapter.fetchOpportunities()).rejects.toThrow('Malformed JSON response');
    });

    it('paginates correctly up to limit (2 pages of 50 items for limit 100)', async () => {
      process.env.ADZUNA_APP_ID = 'test_id';
      process.env.ADZUNA_APP_KEY = 'test_key';

      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        const results = Array.from({ length: 50 }, (_, i) => ({
          id: `item_${callCount}_${i}`,
          title: `Job ${i}`,
        }));
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          text: async () => JSON.stringify({ count: 500, results }),
        };
      });

      const items = await adapter.fetchOpportunities({ limit: 100 });
      expect(callCount).toBe(2);
      expect(items.length).toBe(100);
    });

    it('stops paginating when an empty results array is returned', async () => {
      process.env.ADZUNA_APP_ID = 'test_id';
      process.env.ADZUNA_APP_KEY = 'test_key';

      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          text: async () => JSON.stringify({ count: 500, results: [] }),
        };
      });

      const items = await adapter.fetchOpportunities({ limit: 100 });
      expect(callCount).toBe(1);
      expect(items.length).toBe(0);
    });

    it('stops paginating when total available count is reached before limit', async () => {
      process.env.ADZUNA_APP_ID = 'test_id';
      process.env.ADZUNA_APP_KEY = 'test_key';

      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          text: async () => JSON.stringify({ count: 10, results: Array(10).fill({ id: '1' }) }),
        };
      });

      const items = await adapter.fetchOpportunities({ limit: 100 });
      expect(callCount).toBe(1);
      expect(items.length).toBe(10);
    });
  });

  describe('4. Pipeline Integration & Gate-A Validation', () => {
    it('processes valid normalized fixture through pipeline to MongoDB draft document', async () => {
      const validFixture = {
        id: 987654321,
        title: 'Backend Software Intern - Remote',
        company: { display_name: 'Tech Corp' },
        description: 'Comprehensive description for backend software intern role exceeding Gate-A 20 character length.',
        redirect_url: 'https://adzuna.com/land/ad/987',
        created: '2023-10-01T10:00:00Z',
        location: { display_name: 'Bangalore, India' },
      };

      const normalized = adapter.normalize(validFixture);
      const res = await processOpportunityItem({
        rawItem: normalized,
        source: mockSourceDoc,
        ingestionRunId: mockRunDoc._id,
      });

      expect(res.status).toBe('success');
      expect(res.action).toBe('created');
      expect(res.opportunityId).toBeDefined();

      const created = await Opportunity.findById(res.opportunityId);
      expect(created.title).toBe('Backend Software Intern - Remote');
      expect(created.organization).toBe('Tech'); // Corp suffix stripped by pipeline normalizer
      expect(created.externalId).toBe('987654321');
      expect(created.status).toBe('draft');
      expect(created.verified).toBe(false);
      expect(created.completenessScore).toBeGreaterThanOrEqual(0);
      expect(created.qualityScore).toBeGreaterThanOrEqual(0);
    });

    it('rejects fixture missing description at Gate-A validation', async () => {
      const missingDescFixture = {
        id: 987654322,
        title: 'Backend Software Intern - Remote',
        company: { display_name: 'Tech Corp' },
        redirect_url: 'https://adzuna.com/land/ad/988',
      };

      const normalized = adapter.normalize(missingDescFixture);
      const res = await processOpportunityItem({
        rawItem: normalized,
        source: mockSourceDoc,
        ingestionRunId: mockRunDoc._id,
      });

      expect(res.status).toBe('invalid');
      expect(res.warnings.some((w) => w.includes('Missing description'))).toBe(true);
    });
  });
});
