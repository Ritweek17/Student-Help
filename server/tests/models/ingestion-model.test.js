import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { setupTestDatabase, clearTestDatabase, teardownTestDatabase } from '../setup.js';
import {
  OpportunitySource,
  SOURCE_TYPES,
} from '../../src/models/OpportunitySource.js';
import {
  OpportunityIngestionRun,
  INGESTION_RUN_STATUSES,
} from '../../src/models/OpportunityIngestionRun.js';
import {
  BaseOpportunityAdapter,
  NORMALIZED_OPPORTUNITY_FIELDS,
  DEDUPLICATION_IDENTITY_PRIORITY,
} from '../../src/services/ingestion/adapter.interface.js';
import {
  getEnabledSources,
  createIngestionRun,
  markRunSuccess,
  markRunFailure,
  markRunPartial,
} from '../../src/services/ingestion/ingestion.service.js';
import {
  validateOpportunitySource,
  validateIngestionRunStatus,
  validateIngestionCounters,
} from '../../src/validators/ingestion.validator.js';

describe('CareerOS Models Test Suite — Opportunity Ingestion Models & Services', () => {
  beforeAll(async () => {
    await setupTestDatabase();
    await Promise.all([
      OpportunitySource.init(),
      OpportunityIngestionRun.init(),
    ]);
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();
  });

  // ==========================================
  // 1. Database Isolation
  // ==========================================
  describe('Database Isolation', () => {
    it('runs against an in-memory replica set and never the local daemon port 27017', () => {
      expect(mongoose.connection.readyState).toBe(1);
      expect(mongoose.connection.port).not.toBe(27017);
    });
  });

  // ==========================================
  // 2. OpportunitySource Model Creation & Validation
  // ==========================================
  describe('OpportunitySource Model', () => {
    it('creates OpportunitySource with valid fields and matches properties (Test 1)', async () => {
      const source = await OpportunitySource.create({
        name: 'GitHub Jobs API',
        slug: `github-${Date.now()}`,
        type: 'api',
        baseUrl: 'https://api.github.com',
        priority: 10,
      });

      expect(source._id).toBeDefined();
      expect(source.name).toBe('GitHub Jobs API');
      expect(source.type).toBe('api');
    });

    it('requires name field in schema and validator (Test 2)', async () => {
      await expect(
        OpportunitySource.create({
          slug: `no-name-${Date.now()}`,
          type: 'scraper',
        }),
      ).rejects.toThrow();

      const valName = validateOpportunitySource({ slug: 'test', type: 'api' });
      expect(valName.error).toBeDefined();
      expect(valName.error).toMatch(/name/i);
    });

    it('validates slug format and rejects spaces and special characters (Test 3)', async () => {
      await expect(
        OpportunitySource.create({
          name: 'Bad Slug',
          slug: 'Invalid Slug With Spaces!',
          type: 'api',
        }),
      ).rejects.toThrow();

      const valSlug = validateOpportunitySource({
        name: 'Valid',
        slug: 'Bad Slug!',
        type: 'api',
      });
      expect(valSlug.error).toBeDefined();
      expect(valSlug.error).toMatch(/slug/i);
    });

    it('normalizes slug to lowercase (Test 4)', async () => {
      const upperSlug = `DEVPOST-SOURCE-${Date.now()}`;
      const source = await OpportunitySource.create({
        name: 'Devpost Hackathons',
        slug: upperSlug,
        type: 'scraper',
      });

      expect(source.slug).toBe(upperSlug.toLowerCase());
    });

    it('rejects duplicate slug via unique index E11000 (Test 5)', async () => {
      const slug = `dup-slug-${Date.now()}`;
      await OpportunitySource.create({
        name: 'Source 1',
        slug,
        type: 'api',
      });

      await expect(
        OpportunitySource.create({
          name: 'Source 2',
          slug,
          type: 'api',
        }),
      ).rejects.toMatchObject({ code: 11000 });
    });

    it('accepts all valid source types in schema and validator (Test 6)', () => {
      for (const t of ['api', 'rss', 'feed', 'scraper']) {
        expect(SOURCE_TYPES).toContain(t);
        const valT = validateOpportunitySource({
          name: `Test ${t}`,
          slug: `test-${t}-${Date.now()}`,
          type: t,
        });
        expect(valT.error).toBeFalsy();
      }
    });

    it('rejects invalid source type in schema and validator (Test 7)', async () => {
      await expect(
        OpportunitySource.create({
          name: 'Bad Type Source',
          slug: `bad-type-${Date.now()}`,
          type: 'invalid_type',
        }),
      ).rejects.toThrow();

      const valBadType = validateOpportunitySource({
        name: 'Test',
        slug: 'slug-t',
        type: 'ftp_scraper',
      });
      expect(valBadType.error).toBeDefined();
      expect(valBadType.error).toMatch(/type/i);
    });

    it('accepts valid HTTP and HTTPS URLs (Tests 8 & 9)', async () => {
      const httpSource = await OpportunitySource.create({
        name: 'HTTP Source',
        slug: `http-src-${Date.now()}`,
        type: 'rss',
        baseUrl: 'http://example.com/rss',
      });
      expect(httpSource.baseUrl).toBe('http://example.com/rss');

      const httpsSource = await OpportunitySource.create({
        name: 'HTTPS Source',
        slug: `https-src-${Date.now()}`,
        type: 'api',
        baseUrl: 'https://example.com/api',
      });
      expect(httpsSource.baseUrl).toBe('https://example.com/api');
    });

    it('rejects unsafe schemes and non-URLs in schema and validator (Test 10)', async () => {
      const unsafeUrls = [
        'javascript:alert(1)',
        'data:text/html,test',
        'file:///etc/passwd',
        'ftp://ftp.example.com',
        'not a url',
      ];

      for (const u of unsafeUrls) {
        await expect(
          OpportunitySource.create({
            name: 'Unsafe URL Test',
            slug: `unsafe-${Date.now()}-${Math.random()}`,
            type: 'api',
            baseUrl: u,
          }),
        ).rejects.toThrow();

        const valU = validateOpportunitySource({
          name: 'Test',
          slug: 'test-u',
          type: 'api',
          baseUrl: u,
        });
        expect(valU.error).toBeDefined();
      }
    });

    it('defaults enabled to true (Test 11)', async () => {
      const source = await OpportunitySource.create({
        name: 'Enabled Test',
        slug: `enabled-test-${Date.now()}`,
        type: 'api',
      });
      expect(source.enabled).toBe(true);
    });

    it('defaults priority to 0 (Test 12)', async () => {
      const source = await OpportunitySource.create({
        name: 'Default Priority',
        slug: `def-pri-${Date.now()}`,
        type: 'feed',
      });
      expect(source.priority).toBe(0);
    });

    it('rejects negative priority in schema and validator (Test 13)', async () => {
      await expect(
        OpportunitySource.create({
          name: 'Neg Priority',
          slug: `neg-pri-${Date.now()}`,
          type: 'api',
          priority: -5,
        }),
      ).rejects.toThrow();

      const valPri = validateOpportunitySource({
        name: 'Test',
        slug: 'pri-t',
        type: 'api',
        priority: -1,
      });
      expect(valPri.error).toBeDefined();
      expect(valPri.error).toMatch(/priority/i);
    });

    it('updates lastRun metadata correctly (Test 14)', async () => {
      const source = await OpportunitySource.create({
        name: 'Metadata Test Source',
        slug: `meta-test-${Date.now()}`,
        type: 'api',
      });

      const runDate = new Date();
      source.lastRunAt = runDate;
      source.lastSuccessAt = runDate;
      source.lastFailureAt = runDate;
      source.lastError = 'Operational network timeout';
      await source.save();

      const fetched = await OpportunitySource.findById(source._id);
      expect(fetched.lastRunAt).toBeDefined();
      expect(fetched.lastSuccessAt).toBeDefined();
      expect(fetched.lastFailureAt).toBeDefined();
      expect(fetched.lastError).toBe('Operational network timeout');
    });

    it('preserves non-sensitive metadata object (Test 32)', async () => {
      const safeMetaSource = await OpportunitySource.create({
        name: 'Safe Meta Source',
        slug: `safe-meta-${Date.now()}`,
        type: 'feed',
        metadata: { feedFormat: 'atom', pollRate: 'hourly' },
      });

      expect(safeMetaSource.metadata.feedFormat).toBe('atom');
      expect(safeMetaSource.metadata.pollRate).toBe('hourly');
    });

    it('verifies OpportunitySource collection indexes (Test 23)', async () => {
      const sourceIndexes = await OpportunitySource.collection.indexes();
      const hasSlugIndex = sourceIndexes.some(
        (i) => i.key.slug === 1 && i.unique,
      );
      const hasEnabledPriorityIndex = sourceIndexes.some(
        (i) => i.key.enabled === 1 && i.key.priority === -1,
      );

      expect(hasSlugIndex).toBe(true);
      expect(hasEnabledPriorityIndex).toBe(true);
    });
  });

  // ==========================================
  // 3. OpportunityIngestionRun Model Creation & Validation
  // ==========================================
  describe('OpportunityIngestionRun Model', () => {
    it('creates run with sourceId reference and default running status (Tests 15 & 16)', async () => {
      const source = await OpportunitySource.create({
        name: 'Source For Run',
        slug: `src-run-${Date.now()}`,
        type: 'api',
      });

      const run = await OpportunityIngestionRun.create({
        sourceId: source._id,
        startedAt: new Date(),
      });

      expect(run._id).toBeDefined();
      expect(run.sourceId.toString()).toBe(source._id.toString());
      expect(run.status).toBe('running');
    });

    it('accepts valid statuses in schema and validator (Test 17)', () => {
      for (const s of ['running', 'completed', 'failed', 'partial']) {
        expect(INGESTION_RUN_STATUSES).toContain(s);
        const valS = validateIngestionRunStatus(s);
        expect(valS.error).toBeFalsy();
      }
    });

    it('rejects invalid status in schema and validator (Test 18)', async () => {
      const source = await OpportunitySource.create({
        name: 'Source For Bad Status',
        slug: `src-bad-status-${Date.now()}`,
        type: 'api',
      });

      await expect(
        OpportunityIngestionRun.create({
          sourceId: source._id,
          status: 'unknown_status',
          startedAt: new Date(),
        }),
      ).rejects.toThrow();

      const valBadStatus = validateIngestionRunStatus('finished');
      expect(valBadStatus.error).toBeDefined();
    });

    it('defaults all ingestion counters to 0 (Test 19)', async () => {
      const source = await OpportunitySource.create({
        name: 'Source Counters',
        slug: `src-counters-${Date.now()}`,
        type: 'api',
      });

      const run = await OpportunityIngestionRun.create({
        sourceId: source._id,
        startedAt: new Date(),
      });

      expect(run.fetchedCount).toBe(0);
      expect(run.createdCount).toBe(0);
      expect(run.updatedCount).toBe(0);
      expect(run.skippedCount).toBe(0);
      expect(run.failedCount).toBe(0);
    });

    it('rejects negative counters in schema and validator (Test 20)', async () => {
      const source = await OpportunitySource.create({
        name: 'Source Neg Counter',
        slug: `src-neg-counter-${Date.now()}`,
        type: 'api',
      });

      await expect(
        OpportunityIngestionRun.create({
          sourceId: source._id,
          startedAt: new Date(),
          fetchedCount: -10,
        }),
      ).rejects.toThrow();

      const valCounters = validateIngestionCounters({ fetchedCount: -1 });
      expect(valCounters.error).toBeDefined();
    });

    it('requires startedAt date (Test 21)', async () => {
      const source = await OpportunitySource.create({
        name: 'Source No Start',
        slug: `src-no-start-${Date.now()}`,
        type: 'api',
      });

      await expect(
        OpportunityIngestionRun.create({
          sourceId: source._id,
        }),
      ).rejects.toThrow();
    });

    it('enforces completedAt ordering (completedAt >= startedAt) (Test 22)', async () => {
      const source = await OpportunitySource.create({
        name: 'Source Ordering',
        slug: `src-ordering-${Date.now()}`,
        type: 'api',
      });

      await expect(
        OpportunityIngestionRun.create({
          sourceId: source._id,
          startedAt: new Date('2026-10-15T12:00:00Z'),
          completedAt: new Date('2026-10-15T11:00:00Z'), // 1 hour earlier
        }),
      ).rejects.toThrow();
    });

    it('verifies OpportunityIngestionRun collection indexes (Test 24)', async () => {
      const runIndexes = await OpportunityIngestionRun.collection.indexes();
      const hasSourceStartIndex = runIndexes.some(
        (i) => i.key.sourceId === 1 && i.key.startedAt === -1,
      );
      const hasStatusStartIndex = runIndexes.some(
        (i) => i.key.status === 1 && i.key.startedAt === -1,
      );

      expect(hasSourceStartIndex).toBe(true);
      expect(hasStatusStartIndex).toBe(true);
    });
  });

  // ==========================================
  // 4. Ingestion Service Operations
  // ==========================================
  describe('Ingestion Service Operations', () => {
    it('retrieves enabled sources sorted by priority descending and excludes disabled (Test 25)', async () => {
      const disabledSource = await OpportunitySource.create({
        name: 'Disabled Source',
        slug: `disabled-${Date.now()}`,
        type: 'feed',
        enabled: false,
        priority: 999,
      });

      const highPriSource = await OpportunitySource.create({
        name: 'High Priority Source',
        slug: `high-pri-${Date.now()}`,
        type: 'api',
        enabled: true,
        priority: 100,
      });

      const lowPriSource = await OpportunitySource.create({
        name: 'Low Priority Source',
        slug: `low-pri-${Date.now()}`,
        type: 'feed',
        enabled: true,
        priority: 10,
      });

      const enabledSources = await getEnabledSources();
      expect(enabledSources.some((s) => s.slug === disabledSource.slug)).toBe(false);

      const highPriIdx = enabledSources.findIndex((s) => s.slug === highPriSource.slug);
      const lowPriIdx = enabledSources.findIndex((s) => s.slug === lowPriSource.slug);

      expect(highPriIdx).toBeGreaterThanOrEqual(0);
      expect(lowPriIdx).toBeGreaterThanOrEqual(0);
      expect(highPriIdx).toBeLessThan(lowPriIdx);
    });

    it('creates ingestion run and updates source lastRunAt (Test 26)', async () => {
      const freshSource = await OpportunitySource.create({
        name: 'Run Test Source',
        slug: `run-test-${Date.now()}`,
        type: 'scraper',
      });

      expect(freshSource.lastRunAt).toBeUndefined();

      const createdRun = await createIngestionRun(freshSource._id, { version: '1.0' });
      expect(createdRun.status).toBe('running');

      const freshSourceUpdated = await OpportunitySource.findById(freshSource._id);
      expect(freshSourceUpdated.lastRunAt).toBeDefined();
    });

    it('marks run success, sets completedAt, updates counters and source lastSuccessAt (Test 27)', async () => {
      const source = await OpportunitySource.create({
        name: 'Success Source',
        slug: `success-src-${Date.now()}`,
        type: 'scraper',
      });

      const run = await createIngestionRun(source._id);
      const successRun = await markRunSuccess(run._id, {
        fetchedCount: 50,
        createdCount: 45,
        skippedCount: 5,
      });

      expect(successRun.status).toBe('completed');
      expect(successRun.completedAt).toBeDefined();
      expect(successRun.fetchedCount).toBe(50);
      expect(successRun.createdCount).toBe(45);

      const sourceUpdated = await OpportunitySource.findById(source._id);
      expect(sourceUpdated.lastSuccessAt).toBeDefined();
    });

    it('marks run failure, records error message, and updates source lastFailureAt and lastError (Test 28)', async () => {
      const source = await OpportunitySource.create({
        name: 'Fail Source',
        slug: `fail-src-${Date.now()}`,
        type: 'scraper',
      });

      const run = await createIngestionRun(source._id);
      const failRun = await markRunFailure(
        run._id,
        'Connection timed out after 30s',
        { failedCount: 1 },
      );

      expect(failRun.status).toBe('failed');
      expect(failRun.errorMessage).toBe('Connection timed out after 30s');
      expect(failRun.completedAt).toBeDefined();

      const sourceUpdated = await OpportunitySource.findById(source._id);
      expect(sourceUpdated.lastFailureAt).toBeDefined();
      expect(sourceUpdated.lastError).toBe('Connection timed out after 30s');
    });

    it('marks run partial, records error message, completedAt, and counters (Test 29)', async () => {
      const source = await OpportunitySource.create({
        name: 'Partial Source',
        slug: `partial-src-${Date.now()}`,
        type: 'scraper',
      });

      const run = await createIngestionRun(source._id);
      const partialRun = await markRunPartial(
        run._id,
        'Page 2 rate-limited',
        { fetchedCount: 20, createdCount: 20, failedCount: 5 },
      );

      expect(partialRun.status).toBe('partial');
      expect(partialRun.errorMessage).toBe('Page 2 rate-limited');
      expect(partialRun.completedAt).toBeDefined();
    });
  });

  // ==========================================
  // 5. Adapter Interface & Contracts
  // ==========================================
  describe('Adapter Interface & Normalized Opportunity Contract', () => {
    it('enforces BaseOpportunityAdapter interface contract (Test 30)', async () => {
      const adapter = new BaseOpportunityAdapter({
        name: 'Generic Adapter',
        slug: 'generic',
        type: 'api',
      });

      const def = adapter.getSourceDefinition();
      expect(def.name).toBe('Generic Adapter');

      await expect(adapter.fetchOpportunities()).rejects.toThrow();
      expect(() => adapter.normalize({})).toThrow();
    });

    it('documents normalized opportunity fields and deduplication priority tiers (Test 31)', () => {
      expect(NORMALIZED_OPPORTUNITY_FIELDS).toContain('title');
      expect(NORMALIZED_OPPORTUNITY_FIELDS).toContain('organization');
      expect(NORMALIZED_OPPORTUNITY_FIELDS).toContain('sourceType');
      expect(NORMALIZED_OPPORTUNITY_FIELDS).toContain('sourceId');
      expect(DEDUPLICATION_IDENTITY_PRIORITY).toHaveLength(3);
    });
  });
});
