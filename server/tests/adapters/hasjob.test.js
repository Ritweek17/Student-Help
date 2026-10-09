import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { setupTestDatabase, clearTestDatabase, teardownTestDatabase } from '../setup.js';
import { Opportunity } from '../../src/models/Opportunity.js';
import { OpportunitySource } from '../../src/models/OpportunitySource.js';
import { OpportunityIngestionRun } from '../../src/models/OpportunityIngestionRun.js';
import { HasjobAdapter } from '../../src/services/ingestion/adapters/hasjob.adapter.js';
import { BaseOpportunityAdapter } from '../../src/services/ingestion/adapter.interface.js';
import { processOpportunityItem } from '../../src/services/ingestion/pipeline.service.js';

describe('Hasjob Adapter Test Suite (Deterministic / Offline)', () => {
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
      name: 'Hasjob',
      slug: 'hasjob',
      type: 'api',
      baseUrl: 'https://hasjob.co',
      enabled: false, // In production Hasjob live endpoint returned 404 and is disabled
    });

    mockRunDoc = await OpportunityIngestionRun.create({
      sourceId: mockSourceDoc._id,
      status: 'running',
      startedAt: new Date(),
    });

    adapter = new HasjobAdapter(mockSourceDoc);
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
      expect(def.slug).toBe('hasjob');
      expect(def.type).toBe('api');
      expect(def.name).toBe('Hasjob');
    });
  });

  describe('2. Normalization & Fixture Extraction', () => {
    const validFixture = {
      id: 'hasjob-12345',
      title: 'Software Engineer Intern',
      company: 'Tech Corp',
      description: 'Looking for a talented software engineer intern for Summer 2026.',
      url: 'https://hasjob.co/view/12345',
      logo: 'https://hasjob.co/logo.png',
      date: '2024-05-01T10:00:00Z',
      location: 'Bengaluru, India',
      type: 'internship',
      workMode: 'hybrid',
      skills: ['python', 'react'],
    };

    it('normalizes valid fixture fields into canonical Opportunity format', () => {
      const norm = adapter.normalize(validFixture);

      expect(norm.externalId).toBe('hasjob-12345');
      expect(norm.title).toBe('Software Engineer Intern');
      expect(norm.organization).toBe('Tech Corp');
      expect(norm.description).toBe(validFixture.description);
      expect(norm.applicationUrl).toBe('https://hasjob.co/view/12345');
      expect(norm.organizationLogo).toBe('https://hasjob.co/logo.png');
      expect(norm.skills).toContain('python');
      expect(norm.skills).toContain('react');
      expect(norm.location).toEqual({ city: 'Bengaluru, India' });
      expect(norm.workMode).toBe('hybrid');
      expect(norm.type).toBe('internship');
      expect(norm.postedAt).toBeInstanceOf(Date);
      expect(norm.postedAt.toISOString()).toBe('2024-05-01T10:00:00.000Z');
      expect(norm.eventDate).toBeUndefined();
      expect(norm.deadline).toBeUndefined();
      expect(norm.stipend).toBeUndefined();
    });

    it('infers remote workMode from location string "Anywhere" and handles alternate keys', () => {
      const ambiguousFixture = {
        id: 'ambiguous-999',
        title: 'Marketing Manager',
        company: 'Sales Co',
        content: 'Sales role anywhere across the globe with lots of details.',
        location: 'Anywhere',
        published: '2023-01-01T00:00:00Z',
      };

      const norm = adapter.normalize(ambiguousFixture);

      expect(norm.workMode).toBe('remote');
      expect(norm.type).toBeUndefined(); // Marketing Manager is not forced into internship
      expect(norm.description).toBe(ambiguousFixture.content); // content fallback
      expect(norm.postedAt).toBeInstanceOf(Date);
    });

    it('safely ignores free-form string stipend while accepting structured stipend object', () => {
      const textSalary = adapter.normalize({
        id: 'sal-1',
        title: 'Intern',
        stipend: '₹50,000 / month',
      });
      expect(textSalary.stipend).toBeUndefined();

      const structuredSalary = adapter.normalize({
        id: 'sal-2',
        title: 'Intern',
        stipend: { amount: 5000, currency: 'INR', period: 'monthly' },
      });
      expect(structuredSalary.stipend).toEqual({
        amount: 5000,
        currency: 'INR',
        period: 'monthly',
      });
    });

    it('handles null, undefined, and sparse rawItem safely without errors', () => {
      expect(adapter.normalize(null)).toEqual({});
      expect(adapter.normalize(undefined)).toEqual({});
      const sparse = adapter.normalize({ id: '1' });
      expect(sparse.externalId).toBe('1');
      expect(sparse.title).toBeUndefined();
      expect(sparse.description).toBeUndefined();
    });
  });

  describe('3. Offline Fetch Contract & Error Handling (Mocked Fetch)', () => {
    const validJob = { id: 'hasjob-12345', title: 'Software Engineer Intern' };

    it('fetches and parses valid jobs array from API JSON payload', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': '1000' }),
        text: async () => JSON.stringify({ jobs: [validJob] }),
      });

      const items = await adapter.fetchOpportunities({ limit: 5 });
      expect(items.length).toBe(1);
      expect(items[0].id).toBe('hasjob-12345');
    });

    it('handles alternative payload structures (items array and root array)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        text: async () => JSON.stringify({ items: [validJob] }),
      });

      const itemsWithItemsKey = await adapter.fetchOpportunities({ limit: 5 });
      expect(itemsWithItemsKey.length).toBe(1);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        text: async () => JSON.stringify([validJob]),
      });

      const itemsWithRootArray = await adapter.fetchOpportunities({ limit: 5 });
      expect(itemsWithRootArray.length).toBe(1);
    });

    it('bounds output length to requested limit', async () => {
      const largeList = Array.from({ length: 50 }, (_, i) => ({ id: `job-${i}` }));
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        text: async () => JSON.stringify({ jobs: largeList }),
      });

      const items = await adapter.fetchOpportunities({ limit: 10 });
      expect(items.length).toBe(10);
    });

    it('throws error on HTTP 500', async () => {
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
  });

  describe('4. Pipeline Integration & Gate-A Validation', () => {
    it('processes valid Hasjob opportunity through pipeline and creates draft document in MongoDB', async () => {
      const validJobFixture = {
        id: 'hasjob-gate-1',
        title: 'Full Stack Engineering Intern',
        company: 'Hasjob Org',
        description: 'Comprehensive description for full stack engineering intern role exceeding Gate-A 20 character length.',
        url: 'https://hasjob.co/view/hasjob-gate-1',
        type: 'internship',
        location: 'Bengaluru, India',
      };

      const normalized = adapter.normalize(validJobFixture);
      const res = await processOpportunityItem({
        rawItem: normalized,
        source: mockSourceDoc,
        ingestionRunId: mockRunDoc._id,
      });

      expect(res.status).toBe('success');
      expect(res.action).toBe('created');
      expect(res.opportunityId).toBeDefined();

      const created = await Opportunity.findById(res.opportunityId);
      expect(created.title).toBe('Full Stack Engineering Intern');
      expect(created.organization).toBe('Hasjob Org');
      expect(created.externalId).toBe('hasjob-gate-1');
      expect(created.type).toBe('internship');
      expect(created.status).toBe('draft');
      expect(created.verified).toBe(false);
      expect(created.completenessScore).toBeGreaterThanOrEqual(0);
      expect(created.qualityScore).toBeGreaterThanOrEqual(0);
    });
  });
});
