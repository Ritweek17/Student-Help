import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app.js';
import { setupTestDatabase, clearTestDatabase, teardownTestDatabase } from '../setup.js';
import { createTestUser } from '../helpers/auth.helper.js';
import { Opportunity } from '../../src/models/Opportunity.js';

describe('CareerOS Opportunities API Test Suite (Supertest + In-Memory ReplSet)', () => {
  let studentUser;
  let studentToken;

  beforeAll(async () => {
    await setupTestDatabase();
    await Opportunity.init();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();

    const studentAuth = await createTestUser('opp_student', 'student');
    studentUser = studentAuth.user;
    studentToken = studentAuth.token;
  });

  // ==========================================
  // 1. Database & Environment Isolation
  // ==========================================
  describe('Environment & Database Isolation', () => {
    it('runs against an in-memory replica set and never the local daemon port 27017', () => {
      expect(mongoose.connection.readyState).toBe(1);
      expect(mongoose.connection.port).not.toBe(27017);
    });
  });

  // ==========================================
  // 2. Authentication & Authorization Boundaries
  // ==========================================
  describe('Authentication Boundaries', () => {
    it('rejects unauthenticated GET /api/opportunities with 401', async () => {
      const res = await request(app).get('/api/opportunities');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects unauthenticated GET /api/opportunities/:id with 401', async () => {
      const oppId = new mongoose.Types.ObjectId();
      const res = await request(app).get(`/api/opportunities/${oppId}`);
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('allows authenticated student to access GET /api/opportunities', async () => {
      const res = await request(app)
        .get('/api/opportunities')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.opportunities)).toBe(true);
      expect(res.body.pagination).toBeDefined();
    });
  });

  // ==========================================
  // 3. Status Lifecycle & Visibility Rules
  // ==========================================
  describe('Status Lifecycle & Visibility Rules', () => {
    let pubInternship;
    let pubHackathon;
    let draftOpp;
    let archivedOpp;
    let expiredOpp;

    beforeEach(async () => {
      pubInternship = await Opportunity.create({
        title: 'Published React Internship',
        organization: 'Alpha Tech',
        description: 'Frontend React development internship.',
        shortDescription: 'React Developer',
        type: 'internship',
        workMode: 'remote',
        location: { country: 'India', state: 'Karnataka', city: 'Bengaluru' },
        skills: ['react', 'javascript', 'css'],
        tags: ['Web', 'Frontend'],
        status: 'published',
        verified: true,
        featured: true,
        deadline: new Date('2026-10-01T00:00:00Z'),
        eventDate: new Date('2026-10-05T00:00:00Z'),
      });

      pubHackathon = await Opportunity.create({
        title: 'Published AI Hackathon',
        organization: 'Beta Corp',
        description: 'Build AI applications with Python.',
        shortDescription: 'Python AI Challenge',
        type: 'hackathon',
        workMode: 'onsite',
        location: { country: 'India', state: 'Maharashtra', city: 'Mumbai' },
        skills: ['python', 'ai', 'tensorflow'],
        tags: ['AI', 'Hackathon'],
        status: 'published',
        verified: false,
        featured: false,
        deadline: new Date('2026-11-01T00:00:00Z'),
        eventDate: new Date('2026-11-10T00:00:00Z'),
      });

      draftOpp = await Opportunity.create({
        title: 'Draft Opportunity',
        organization: 'Delta Corp',
        description: 'Draft description.',
        type: 'internship',
        workMode: 'remote',
        status: 'draft',
      });

      archivedOpp = await Opportunity.create({
        title: 'Archived Opportunity',
        organization: 'Epsilon Inc',
        description: 'Archived description.',
        type: 'workshop',
        workMode: 'online',
        status: 'archived',
      });

      expiredOpp = await Opportunity.create({
        title: 'Expired Opportunity',
        organization: 'Zeta Inc',
        description: 'Expired description.',
        type: 'meetup',
        workMode: 'online',
        status: 'expired',
      });
    });

    it('exposes only published opportunities in catalog listing', async () => {
      const res = await request(app)
        .get('/api/opportunities')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      const ids = res.body.opportunities.map((o) => o._id);

      expect(ids).toContain(pubInternship._id.toString());
      expect(ids).toContain(pubHackathon._id.toString());
      expect(ids).not.toContain(draftOpp._id.toString());
      expect(ids).not.toContain(archivedOpp._id.toString());
      expect(ids).not.toContain(expiredOpp._id.toString());
    });

    it('returns published opportunity by ID', async () => {
      const res = await request(app)
        .get(`/api/opportunities/${pubInternship._id}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.opportunity._id).toBe(pubInternship._id.toString());
      expect(res.body.opportunity.title).toBe(pubInternship.title);
    });

    it('returns 404 when student attempts to access draft opportunity by ID', async () => {
      const res = await request(app)
        .get(`/api/opportunities/${draftOpp._id}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not found/i);
    });

    it('returns 404 when student attempts to access archived opportunity by ID', async () => {
      const res = await request(app)
        .get(`/api/opportunities/${archivedOpp._id}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not found/i);
    });

    it('returns 404 when student attempts to access expired opportunity by ID', async () => {
      const res = await request(app)
        .get(`/api/opportunities/${expiredOpp._id}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not found/i);
    });

    it('returns 400 for malformed ObjectId', async () => {
      const res = await request(app)
        .get('/api/opportunities/invalid-id-123')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid opportunity id/i);
    });

    it('returns 404 for nonexistent valid ObjectId', async () => {
      const missingId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/opportunities/${missingId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not found/i);
    });
  });

  // ==========================================
  // 4. Pagination & Query Limits
  // ==========================================
  describe('Pagination & Query Limits', () => {
    beforeEach(async () => {
      await Opportunity.create([
        { title: 'Opp 1', organization: 'Org', description: 'Desc', type: 'internship', status: 'published' },
        { title: 'Opp 2', organization: 'Org', description: 'Desc', type: 'hackathon', status: 'published' },
        { title: 'Opp 3', organization: 'Org', description: 'Desc', type: 'workshop', status: 'published' },
      ]);
    });

    it('respects page and limit parameters', async () => {
      const res = await request(app)
        .get('/api/opportunities?page=1&limit=2')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.opportunities.length).toBeLessThanOrEqual(2);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(2);
      expect(res.body.pagination.total).toBe(3);
      expect(res.body.pagination.pages).toBe(2);
    });

    it('rejects limit exceeding 50 with 400 Bad Request', async () => {
      const res = await request(app)
        .get('/api/opportunities?limit=100')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/limit/i);
    });
  });

  // ==========================================
  // 5. Filtering & Search
  // ==========================================
  describe('Filtering & Search', () => {
    let pubInternship;
    let pubHackathon;
    let pubWorkshop;

    beforeEach(async () => {
      pubInternship = await Opportunity.create({
        title: 'Published React Internship',
        organization: 'Alpha Tech',
        description: 'Frontend React development internship.',
        shortDescription: 'React Developer',
        type: 'internship',
        workMode: 'remote',
        location: { country: 'India', state: 'Karnataka', city: 'Bengaluru' },
        skills: ['react', 'javascript', 'css'],
        tags: ['Web', 'Frontend'],
        status: 'published',
        verified: true,
        featured: true,
        deadline: new Date('2026-10-01T00:00:00Z'),
        eventDate: new Date('2026-10-05T00:00:00Z'),
      });

      pubHackathon = await Opportunity.create({
        title: 'Published AI Hackathon',
        organization: 'Beta Corp',
        description: 'Build AI applications with Python.',
        shortDescription: 'Python AI Challenge',
        type: 'hackathon',
        workMode: 'onsite',
        location: { country: 'India', state: 'Maharashtra', city: 'Mumbai' },
        skills: ['python', 'ai', 'tensorflow'],
        tags: ['AI', 'Hackathon'],
        status: 'published',
        verified: false,
        featured: false,
        deadline: new Date('2026-11-01T00:00:00Z'),
        eventDate: new Date('2026-11-10T00:00:00Z'),
      });

      pubWorkshop = await Opportunity.create({
        title: 'Published Node.js Workshop',
        organization: 'Gamma Systems',
        description: 'Backend Node.js microservices workshop.',
        type: 'workshop',
        workMode: 'hybrid',
        location: { country: 'India', state: 'Karnataka', city: 'Bengaluru' },
        skills: ['node.js', 'express', 'mongodb'],
        status: 'published',
        deadline: new Date('2026-12-01T00:00:00Z'),
        eventDate: new Date('2026-12-05T00:00:00Z'),
      });
    });

    it('searches across opportunities using keyword q', async () => {
      const res = await request(app)
        .get(`/api/opportunities?q=${encodeURIComponent('React')}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.opportunities.some((o) => o._id === pubInternship._id.toString())).toBe(true);
      expect(res.body.opportunities.some((o) => o._id === pubHackathon._id.toString())).toBe(false);
    });

    it('safely handles regex metacharacters in search query without injection or crash', async () => {
      const res = await request(app)
        .get(`/api/opportunities?q=${encodeURIComponent('.*')}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns empty result array with HTTP 200 for non-matching search keyword', async () => {
      const res = await request(app)
        .get(`/api/opportunities?q=${encodeURIComponent('NonExistentTitleX123')}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.opportunities).toEqual([]);
    });

    it('filters by single type', async () => {
      const res = await request(app)
        .get('/api/opportunities?type=internship')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.opportunities.length).toBeGreaterThan(0);
      expect(res.body.opportunities.every((o) => o.type === 'internship')).toBe(true);
    });

    it('filters by comma-separated multiple types', async () => {
      const res = await request(app)
        .get('/api/opportunities?type=internship,hackathon')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.opportunities.every((o) => ['internship', 'hackathon'].includes(o.type))).toBe(true);
    });

    it('filters by single workMode', async () => {
      const res = await request(app)
        .get('/api/opportunities?workMode=remote')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.opportunities.length).toBeGreaterThan(0);
      expect(res.body.opportunities.every((o) => o.workMode === 'remote')).toBe(true);
    });

    it('filters by comma-separated multiple workModes', async () => {
      const res = await request(app)
        .get('/api/opportunities?workMode=remote,hybrid')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.opportunities.every((o) => ['remote', 'hybrid'].includes(o.workMode))).toBe(true);
    });

    it('filters by skill', async () => {
      const res = await request(app)
        .get('/api/opportunities?skills=python')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.opportunities.some((o) => o._id === pubHackathon._id.toString())).toBe(true);
      expect(res.body.opportunities.some((o) => o._id === pubInternship._id.toString())).toBe(false);
    });

    it('filters by country, state, and city', async () => {
      const resCountry = await request(app)
        .get('/api/opportunities?country=India')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(resCountry.status).toBe(200);
      expect(resCountry.body.opportunities.length).toBe(3);

      const resState = await request(app)
        .get('/api/opportunities?state=Karnataka')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(resState.status).toBe(200);
      expect(resState.body.opportunities.length).toBe(2);

      const resCity = await request(app)
        .get('/api/opportunities?city=Bengaluru')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(resCity.status).toBe(200);
      expect(resCity.body.opportunities.length).toBe(2);
    });

    it('filters by verified boolean flag', async () => {
      const res = await request(app)
        .get('/api/opportunities?verified=true')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.opportunities.length).toBeGreaterThan(0);
      expect(res.body.opportunities.every((o) => o.verified === true)).toBe(true);
    });

    it('filters by featured boolean flag', async () => {
      const res = await request(app)
        .get('/api/opportunities?featured=true')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.opportunities.length).toBeGreaterThan(0);
      expect(res.body.opportunities.every((o) => o.featured === true)).toBe(true);
    });

    it('filters by deadlineBefore and deadlineAfter', async () => {
      const resBefore = await request(app)
        .get('/api/opportunities?deadlineBefore=2026-10-15T00:00:00Z')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(resBefore.status).toBe(200);
      expect(resBefore.body.opportunities.some((o) => o._id === pubInternship._id.toString())).toBe(true);
      expect(resBefore.body.opportunities.some((o) => o._id === pubWorkshop._id.toString())).toBe(false);

      const resAfter = await request(app)
        .get('/api/opportunities?deadlineAfter=2026-10-15T00:00:00Z')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(resAfter.status).toBe(200);
      expect(resAfter.body.opportunities.some((o) => o._id === pubHackathon._id.toString())).toBe(true);
      expect(resAfter.body.opportunities.some((o) => o._id === pubInternship._id.toString())).toBe(false);
    });

    it('filters by eventDateBefore and eventDateAfter', async () => {
      const resBefore = await request(app)
        .get('/api/opportunities?eventDateBefore=2026-10-20T00:00:00Z')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(resBefore.status).toBe(200);
      expect(resBefore.body.opportunities.some((o) => o._id === pubInternship._id.toString())).toBe(true);

      const resAfter = await request(app)
        .get('/api/opportunities?eventDateAfter=2026-11-01T00:00:00Z')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(resAfter.status).toBe(200);
      expect(resAfter.body.opportunities.some((o) => o._id === pubHackathon._id.toString())).toBe(true);
    });
  });

  // ==========================================
  // 6. Sorting Orders
  // ==========================================
  describe('Sorting Orders', () => {
    beforeEach(async () => {
      await Opportunity.create([
        {
          title: 'Earliest Deadline',
          organization: 'Org A',
          description: 'Desc',
          type: 'internship',
          status: 'published',
          deadline: new Date('2026-09-01T00:00:00Z'),
          eventDate: new Date('2026-09-10T00:00:00Z'),
          createdAt: new Date('2026-01-01T00:00:00Z'),
          featured: false,
        },
        {
          title: 'Latest Deadline & Featured',
          organization: 'Org B',
          description: 'Desc',
          type: 'hackathon',
          status: 'published',
          deadline: new Date('2026-12-01T00:00:00Z'),
          eventDate: new Date('2026-12-10T00:00:00Z'),
          createdAt: new Date('2026-02-01T00:00:00Z'),
          featured: true,
        },
      ]);
    });

    it('sorts by deadline_asc', async () => {
      const res = await request(app)
        .get('/api/opportunities?sort=deadline_asc')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.opportunities[0].title).toBe('Earliest Deadline');
    });

    it('sorts by event_desc', async () => {
      const res = await request(app)
        .get('/api/opportunities?sort=event_desc')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.opportunities[0].title).toBe('Latest Deadline & Featured');
    });

    it('sorts by newest', async () => {
      const res = await request(app)
        .get('/api/opportunities?sort=newest')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.opportunities[0].title).toBe('Latest Deadline & Featured');
    });

    it('sorts by oldest', async () => {
      const res = await request(app)
        .get('/api/opportunities?sort=oldest')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.opportunities[0].title).toBe('Earliest Deadline');
    });

    it('sorts by featured', async () => {
      const res = await request(app)
        .get('/api/opportunities?sort=featured')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.opportunities[0].featured).toBe(true);
    });
  });

  // ==========================================
  // 7. Query Parameter Validation & Error Handling
  // ==========================================
  describe('Query Validation Errors', () => {
    it('returns 400 for invalid date format', async () => {
      const res = await request(app)
        .get('/api/opportunities?deadlineBefore=not-a-date')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/date format/i);
    });

    it('returns 400 for invalid opportunity type', async () => {
      const res = await request(app)
        .get('/api/opportunities?type=unknown_type')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid.*type/i);
    });

    it('returns 400 for invalid workMode', async () => {
      const res = await request(app)
        .get('/api/opportunities?workMode=space')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid work mode/i);
    });

    it('returns 400 for invalid boolean parameter', async () => {
      const res = await request(app)
        .get('/api/opportunities?verified=yes')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/true.*false/i);
    });

    it('returns 400 for invalid sort option', async () => {
      const res = await request(app)
        .get('/api/opportunities?sort=random_sort')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid sort option/i);
    });
  });
});
