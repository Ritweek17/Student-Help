import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { setupTestDatabase, clearTestDatabase, teardownTestDatabase } from '../setup.js';
import { Opportunity } from '../../src/models/Opportunity.js';
import { OpportunitySource } from '../../src/models/OpportunitySource.js';
import { OpportunityIngestionRun } from '../../src/models/OpportunityIngestionRun.js';
import { RemotiveAdapter } from '../../src/services/ingestion/adapters/remotive.adapter.js';
import { BaseOpportunityAdapter } from '../../src/services/ingestion/adapter.interface.js';
import { processOpportunityItem } from '../../src/services/ingestion/pipeline.service.js';

describe('Remotive Adapter Test Suite (Deterministic / Offline)', () => {
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
      name: 'Remotive',
      slug: 'remotive',
      type: 'api',
      baseUrl: 'https://remotive.com/api',
      enabled: false, // In production Remotive generic listings do not meet supported type requirements and is disabled
    });

    mockRunDoc = await OpportunityIngestionRun.create({
      sourceId: mockSourceDoc._id,
      status: 'running',
      startedAt: new Date(),
    });

    adapter = new RemotiveAdapter(mockSourceDoc);
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
      expect(def.name).toBe('Remotive');
      expect(def.slug).toBe('remotive');
      expect(def.type).toBe('api');
    });
  });

  describe('2. Normalization & Fixture Extraction', () => {
    const validFixture = {
      id: 1042456,
      url: 'https://remotive.com/remote-jobs/software-dev/senior-frontend-engineer-1042456',
      title: 'Senior Frontend Engineer (React)',
      company_name: 'Awesome Startup Inc.',
      company_logo: 'https://remotive.com/job/1042456/logo',
      category: 'software-dev',
      tags: ['react', 'javascript', 'frontend'],
      job_type: 'internship',
      publication_date: '2026-09-01T12:00:00Z',
      candidate_required_location: 'Worldwide',
      salary: '$60,000 - $80,000',
      description: '<p>Great job here with an incredibly long description that easily exceeds the twenty character minimum requirement of Phase 8C Gate A Validation.</p>',
    };

    it('normalizes valid fixture fields into canonical Opportunity format', () => {
      const norm = adapter.normalize(validFixture);

      expect(norm.externalId).toBe('1042456');
      expect(norm.title).toBe('Senior Frontend Engineer (React)');
      expect(norm.organization).toBe('Awesome Startup Inc.');
      expect(norm.description).toBe(validFixture.description);
      expect(norm.applicationUrl).toBe(validFixture.url);
      expect(norm.organizationLogo).toBe(validFixture.company_logo);
      expect(norm.tags.length).toBe(3);
      expect(norm.tags).toContain('react');
      expect(norm.location.country).toBe('Worldwide');
      expect(norm.workMode).toBe('remote');
      expect(norm.type).toBe('internship');
      expect(norm.postedAt).toBeInstanceOf(Date);
      expect(norm.postedAt.toISOString()).toBe('2026-09-01T12:00:00.000Z');
      expect(norm.eventDate).toBeUndefined();
      expect(norm.deadline).toBeUndefined();
      expect(norm.stipend).toBeUndefined();
    });

    it('does not map non-internship job_type to unsupported types and does not fabricate compensation', () => {
      const fullTimeFixture = {
        id: 1042457,
        title: 'Full Stack Engineer',
        job_type: 'full_time',
        salary: '$100k',
      };

      const norm = adapter.normalize(fullTimeFixture);
      expect(norm.type).toBeUndefined();
      expect(norm.stipend).toBeUndefined();
    });

    it('handles null, undefined, and empty objects safely', () => {
      expect(adapter.normalize(null)).toEqual({});
      expect(adapter.normalize(undefined)).toEqual({});
      const emptyNorm = adapter.normalize({});
      expect(emptyNorm.sourceCategory).toBe('software-dev');
      expect(emptyNorm.workMode).toBe('remote');
      expect(emptyNorm.externalId).toBeUndefined();
    });
  });

  describe('3. Offline Fetch Contract & Error Handling (Mocked Fetch)', () => {
    const validJob = {
      id: 1042456,
      title: 'Frontend Engineer',
    };

    it('fetches and parses valid API JSON payload', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': '1000' }),
        text: async () => JSON.stringify({ 'job-count': 1, jobs: [validJob] }),
      });

      const items = await adapter.fetchOpportunities({ limit: 5 });
      expect(items.length).toBe(1);
      expect(items[0].id).toBe(1042456);
    });

    it('bounds output length to requested limit', async () => {
      const arr = Array.from({ length: 50 }, (_, i) => ({ id: `job-${i}` }));
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        text: async () => JSON.stringify({ 'job-count': 50, jobs: arr }),
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

    it('throws error when payload is missing jobs array', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        text: async () => JSON.stringify({ error: 'not found' }),
      });

      await expect(adapter.fetchOpportunities()).rejects.toThrow('missing jobs array');
    });
  });

  describe('4. Pipeline Integration & Gate-A Validation', () => {
    it('processes valid Remotive opportunity through pipeline and creates draft document in MongoDB', async () => {
      const validJobFixture = {
        id: 1042456,
        url: 'https://remotive.com/remote-jobs/software-dev/senior-frontend-engineer-1042456',
        title: 'Senior Frontend Engineer Intern',
        company_name: 'Awesome Startup Inc.',
        company_logo: 'https://remotive.com/job/1042456/logo',
        job_type: 'internship',
        description: '<p>Great job here with an incredibly long description that easily exceeds the twenty character minimum requirement of Phase 8C Gate A Validation.</p>',
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
      expect(created.title).toBe('Senior Frontend Engineer Intern');
      expect(created.organization).toBe('Awesome Startup'); // Inc. stripped by pipeline normalizer
      expect(created.externalId).toBe('1042456');
      expect(created.type).toBe('internship');
      expect(created.status).toBe('draft');
      expect(created.verified).toBe(false);
      expect(created.completenessScore).toBeGreaterThanOrEqual(0);
      expect(created.qualityScore).toBeGreaterThanOrEqual(0);
    });
  });
});
