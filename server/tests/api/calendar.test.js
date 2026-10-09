import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app.js';
import { setupTestDatabase, clearTestDatabase, teardownTestDatabase } from '../setup.js';
import { createTestUser } from '../helpers/auth.helper.js';
import { User } from '../../src/models/User.js';
import { Opportunity } from '../../src/models/Opportunity.js';
import { Application } from '../../src/models/Application.js';
import { CalendarEvent } from '../../src/models/CalendarEvent.js';

describe('Calendar API Test Suite (Supertest + MongoMemoryReplSet)', () => {
  let userA;
  let tokenA;
  let headersA;

  let userB;
  let tokenB;
  let headersB;

  let pubOpp1;
  let pubOpp2;
  let appA1;
  let regA1;
  let appB1;

  beforeAll(async () => {
    await setupTestDatabase();
    await Promise.all([
      CalendarEvent.init(),
      Application.init(),
      Opportunity.init(),
      User.init(),
    ]);
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();

    const authA = await createTestUser('cal_user_a', 'student');
    userA = authA.user;
    tokenA = authA.token;
    headersA = { Authorization: `Bearer ${tokenA}` };

    const authB = await createTestUser('cal_user_b', 'student');
    userB = authB.user;
    tokenB = authB.token;
    headersB = { Authorization: `Bearer ${tokenB}` };

    pubOpp1 = await Opportunity.create({
      title: 'Calendar Internship 1',
      organization: 'CalOrg 1',
      description: 'Cal Description 1',
      type: 'internship',
      status: 'published',
    });

    pubOpp2 = await Opportunity.create({
      title: 'Calendar Hackathon 2',
      organization: 'HackCalOrg 2',
      description: 'Cal Description 2',
      type: 'hackathon',
      status: 'published',
    });

    appA1 = await Application.create({
      userId: userA._id,
      opportunityId: pubOpp1._id,
      type: 'application',
      status: 'applied',
    });

    regA1 = await Application.create({
      userId: userA._id,
      opportunityId: pubOpp2._id,
      type: 'registration',
      status: 'registered',
    });

    appB1 = await Application.create({
      userId: userB._id,
      opportunityId: pubOpp1._id,
      type: 'application',
      status: 'applied',
    });
  });

  describe('Authentication Boundaries', () => {
    it('returns 401 for unauthenticated event creation', async () => {
      const res = await request(app)
        .post('/api/calendar')
        .send({ title: 'T', type: 'personal', startAt: new Date().toISOString() });
      expect(res.status).toBe(401);
    });

    it('returns 401 for unauthenticated event listing', async () => {
      const res = await request(app).get('/api/calendar');
      expect(res.status).toBe(401);
    });

    it('returns 401 for unauthenticated event retrieval', async () => {
      const res = await request(app).get(`/api/calendar/${new mongoose.Types.ObjectId()}`);
      expect(res.status).toBe(401);
    });

    it('returns 401 for unauthenticated event update', async () => {
      const res = await request(app)
        .put(`/api/calendar/${new mongoose.Types.ObjectId()}`)
        .send({ title: 'New Title' });
      expect(res.status).toBe(401);
    });

    it('returns 401 for unauthenticated event deletion', async () => {
      const res = await request(app).delete(`/api/calendar/${new mongoose.Types.ObjectId()}`);
      expect(res.status).toBe(401);
    });
  });

  describe('Model, Defaults & Event Link Tests', () => {
    it('creates personal event with default status, allDay, source, and timestamps', async () => {
      const start = new Date(Date.now() + 86400000).toISOString();
      const res = await request(app)
        .post('/api/calendar')
        .set(headersA)
        .send({
          title: 'Personal Event',
          type: 'personal',
          startAt: start,
        });

      expect(res.status).toBe(201);
      const ev = res.body.event;
      expect(ev.title).toBe('Personal Event');
      expect(ev.status).toBe('scheduled');
      expect(ev.allDay).toBe(false);
      expect(ev.source).toBe('manual');
      expect(ev.userId).toBe(userA._id.toString());
      expect(ev.createdAt).toBeDefined();
      expect(ev.updatedAt).toBeDefined();
    });

    it('creates opportunity-linked event', async () => {
      const start = new Date(Date.now() + 172800000).toISOString();
      const res = await request(app)
        .post('/api/calendar')
        .set(headersA)
        .send({
          title: 'Opp Event',
          type: 'deadline',
          startAt: start,
          opportunityId: pubOpp1._id.toString(),
          source: 'opportunity',
        });

      expect(res.status).toBe(201);
      expect(res.body.event.opportunityId).toBe(pubOpp1._id.toString());
      expect(res.body.event.source).toBe('opportunity');
    });

    it('creates application-linked event', async () => {
      const start = new Date(Date.now() + 259200000).toISOString();
      const res = await request(app)
        .post('/api/calendar')
        .set(headersA)
        .send({
          title: 'App Event',
          type: 'interview',
          startAt: start,
          applicationId: appA1._id.toString(),
          opportunityId: pubOpp1._id.toString(),
          source: 'application',
        });

      expect(res.status).toBe(201);
      expect(res.body.event.applicationId).toBe(appA1._id.toString());
      expect(res.body.event.opportunityId).toBe(pubOpp1._id.toString());
      expect(res.body.event.source).toBe('application');
    });

    it('creates registration-linked event', async () => {
      const start = new Date(Date.now() + 345600000).toISOString();
      const res = await request(app)
        .post('/api/calendar')
        .set(headersA)
        .send({
          title: 'Reg Event',
          type: 'event',
          startAt: start,
          applicationId: regA1._id.toString(),
          opportunityId: pubOpp2._id.toString(),
          source: 'registration',
        });

      expect(res.status).toBe(201);
      expect(res.body.event.applicationId).toBe(regA1._id.toString());
      expect(res.body.event.opportunityId).toBe(pubOpp2._id.toString());
      expect(res.body.event.source).toBe('registration');
    });
  });

  describe('Validation Tests', () => {
    it('rejects missing title with 400', async () => {
      const res = await request(app)
        .post('/api/calendar')
        .set(headersA)
        .send({ type: 'personal', startAt: new Date().toISOString() });
      expect(res.status).toBe(400);
    });

    it('rejects invalid type with 400', async () => {
      const res = await request(app)
        .post('/api/calendar')
        .set(headersA)
        .send({ title: 'T', type: 'invalidType', startAt: new Date().toISOString() });
      expect(res.status).toBe(400);
    });

    it('rejects invalid status with 400', async () => {
      const res = await request(app)
        .post('/api/calendar')
        .set(headersA)
        .send({ title: 'T', type: 'personal', status: 'invalidStatus', startAt: new Date().toISOString() });
      expect(res.status).toBe(400);
    });

    it('rejects invalid source with 400', async () => {
      const res = await request(app)
        .post('/api/calendar')
        .set(headersA)
        .send({ title: 'T', type: 'personal', source: 'invalidSource', startAt: new Date().toISOString() });
      expect(res.status).toBe(400);
    });

    it('rejects invalid URL scheme with 400', async () => {
      const res = await request(app)
        .post('/api/calendar')
        .set(headersA)
        .send({ title: 'T', type: 'personal', url: 'ftp://bad-url.com', startAt: new Date().toISOString() });
      expect(res.status).toBe(400);
    });

    it('rejects invalid startAt date string with 400', async () => {
      const res = await request(app)
        .post('/api/calendar')
        .set(headersA)
        .send({ title: 'T', type: 'personal', startAt: 'invalid-date' });
      expect(res.status).toBe(400);
    });

    it('rejects invalid endAt date string with 400', async () => {
      const res = await request(app)
        .post('/api/calendar')
        .set(headersA)
        .send({ title: 'T', type: 'personal', startAt: new Date().toISOString(), endAt: 'invalid-date' });
      expect(res.status).toBe(400);
    });

    it('rejects endAt before startAt with 400', async () => {
      const res = await request(app)
        .post('/api/calendar')
        .set(headersA)
        .send({
          title: 'T',
          type: 'personal',
          startAt: new Date(Date.now() + 86400000).toISOString(),
          endAt: new Date(Date.now() - 86400000).toISOString(),
        });
      expect(res.status).toBe(400);
    });

    it('rejects negative reminderMinutes with 400', async () => {
      const res = await request(app)
        .post('/api/calendar')
        .set(headersA)
        .send({ title: 'T', type: 'personal', startAt: new Date().toISOString(), reminderMinutes: -5 });
      expect(res.status).toBe(400);
    });

    it('rejects malformed ObjectId in route param with 400', async () => {
      const res = await request(app)
        .get('/api/calendar/invalid-id')
        .set(headersA);
      expect(res.status).toBe(400);
    });

    it('rejects invalid pagination parameters with 400', async () => {
      const res = await request(app)
        .get('/api/calendar?page=0')
        .set(headersA);
      expect(res.status).toBe(400);
    });

    it('rejects invalid date filter query parameter with 400', async () => {
      const res = await request(app)
        .get('/api/calendar?startBefore=bad-date')
        .set(headersA);
      expect(res.status).toBe(400);
    });
  });

  describe('Link Security Tests', () => {
    it('rejects linking User B applicationId by User A with 400', async () => {
      const res = await request(app)
        .post('/api/calendar')
        .set(headersA)
        .send({
          title: 'Spoofed App Event',
          type: 'interview',
          startAt: new Date().toISOString(),
          applicationId: appB1._id.toString(),
        });
      expect(res.status).toBe(400);
    });

    it('rejects nonexistent applicationId with 400', async () => {
      const res = await request(app)
        .post('/api/calendar')
        .set(headersA)
        .send({
          title: 'Fake App Event',
          type: 'interview',
          startAt: new Date().toISOString(),
          applicationId: new mongoose.Types.ObjectId().toString(),
        });
      expect(res.status).toBe(400);
    });

    it('rejects nonexistent opportunityId with 400', async () => {
      const res = await request(app)
        .post('/api/calendar')
        .set(headersA)
        .send({
          title: 'Fake Opp Event',
          type: 'deadline',
          startAt: new Date().toISOString(),
          opportunityId: new mongoose.Types.ObjectId().toString(),
        });
      expect(res.status).toBe(400);
    });

    it('rejects inconsistent opportunityId & applicationId relationship with 400', async () => {
      const res = await request(app)
        .post('/api/calendar')
        .set(headersA)
        .send({
          title: 'Inconsistent Link Event',
          type: 'interview',
          startAt: new Date().toISOString(),
          applicationId: appA1._id.toString(),
          opportunityId: pubOpp2._id.toString(),
        });
      expect(res.status).toBe(400);
    });
  });

  describe('Ownership Security (IDOR) & Single Item Operations', () => {
    let eventA;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/calendar')
        .set(headersA)
        .send({
          title: 'Owned Event A',
          type: 'personal',
          startAt: new Date(Date.now() + 86400000).toISOString(),
        });
      eventA = res.body.event;
    });

    it('allows User A to GET own event', async () => {
      const res = await request(app)
        .get(`/api/calendar/${eventA._id}`)
        .set(headersA);
      expect(res.status).toBe(200);
      expect(res.body.event.title).toBe('Owned Event A');
    });

    it('returns 404 when User B tries to GET User A event (IDOR protection)', async () => {
      const res = await request(app)
        .get(`/api/calendar/${eventA._id}`)
        .set(headersB);
      expect(res.status).toBe(404);
    });

    it('allows User A to update own event', async () => {
      const res = await request(app)
        .put(`/api/calendar/${eventA._id}`)
        .set(headersA)
        .send({ title: 'Updated Title' });
      expect(res.status).toBe(200);
      expect(res.body.event.title).toBe('Updated Title');
    });

    it('returns 404 when User B tries to update User A event', async () => {
      const res = await request(app)
        .put(`/api/calendar/${eventA._id}`)
        .set(headersB)
        .send({ title: 'Hacked Title' });
      expect(res.status).toBe(404);
    });

    it('returns 404 when User B tries to delete User A event', async () => {
      const res = await request(app)
        .delete(`/api/calendar/${eventA._id}`)
        .set(headersB);
      expect(res.status).toBe(404);

      // Verify event still exists
      const check = await request(app)
        .get(`/api/calendar/${eventA._id}`)
        .set(headersA);
      expect(check.status).toBe(200);
    });
  });

  describe('Listing, Filters, Pagination & Sorting', () => {
    beforeEach(async () => {
      // Create 4 distinct events for User A
      await request(app)
        .post('/api/calendar')
        .set(headersA)
        .send({
          title: 'Event 1 - Personal',
          type: 'personal',
          startAt: new Date(Date.now() + 86400000).toISOString(),
        });

      await request(app)
        .post('/api/calendar')
        .set(headersA)
        .send({
          title: 'Event 2 - Deadline',
          type: 'deadline',
          startAt: new Date(Date.now() + 172800000).toISOString(),
          opportunityId: pubOpp1._id.toString(),
          source: 'opportunity',
        });

      await request(app)
        .post('/api/calendar')
        .set(headersA)
        .send({
          title: 'Event 3 - Interview',
          type: 'interview',
          startAt: new Date(Date.now() + 259200000).toISOString(),
          applicationId: appA1._id.toString(),
          opportunityId: pubOpp1._id.toString(),
          source: 'application',
        });

      await request(app)
        .post('/api/calendar')
        .set(headersA)
        .send({
          title: 'Event 4 - Reg Event',
          type: 'event',
          startAt: new Date(Date.now() + 345600000).toISOString(),
          applicationId: regA1._id.toString(),
          opportunityId: pubOpp2._id.toString(),
          source: 'registration',
        });
    });

    it('isolates lists between User A and User B', async () => {
      const resA = await request(app).get('/api/calendar').set(headersA);
      const resB = await request(app).get('/api/calendar').set(headersB);

      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);
      expect(resA.body.events.length).toBe(4);
      expect(resB.body.events.length).toBe(0);
    });

    it('supports pagination limit and total count', async () => {
      const res = await request(app)
        .get('/api/calendar?page=1&limit=2')
        .set(headersA);
      expect(res.status).toBe(200);
      expect(res.body.events.length).toBe(2);
      expect(res.body.pagination.total).toBe(4);
    });

    it('filters by event type: interview', async () => {
      const res = await request(app)
        .get('/api/calendar?type=interview')
        .set(headersA);
      expect(res.status).toBe(200);
      expect(res.body.events.length).toBe(1);
      expect(res.body.events[0].type).toBe('interview');
    });

    it('filters by status: scheduled', async () => {
      const res = await request(app)
        .get('/api/calendar?status=scheduled')
        .set(headersA);
      expect(res.status).toBe(200);
      expect(res.body.events.length).toBe(4);
    });

    it('filters by date range: startBefore and startAfter', async () => {
      const middleDate = new Date(Date.now() + 200000000).toISOString();

      const resBefore = await request(app)
        .get(`/api/calendar?startBefore=${middleDate}`)
        .set(headersA);
      expect(resBefore.status).toBe(200);
      expect(resBefore.body.events.length).toBe(2);

      const resAfter = await request(app)
        .get(`/api/calendar?startAfter=${middleDate}`)
        .set(headersA);
      expect(resAfter.status).toBe(200);
      expect(resAfter.body.events.length).toBe(2);
    });

    it('returns events in ascending startAt order', async () => {
      const res = await request(app).get('/api/calendar').set(headersA);
      const events = res.body.events;
      for (let i = 0; i < events.length - 1; i++) {
        expect(new Date(events[i].startAt).getTime()).toBeLessThanOrEqual(
          new Date(events[i + 1].startAt).getTime()
        );
      }
    });
  });

  describe('Update, Delete & Immutability Tests', () => {
    let eventA;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/calendar')
        .set(headersA)
        .send({
          title: 'Original Event',
          type: 'personal',
          startAt: new Date(Date.now() + 86400000).toISOString(),
        });
      eventA = res.body.event;
    });

    it('supports comprehensive update of status, startAt, reminderMinutes, and url', async () => {
      const newStart = new Date(Date.now() + 500000000).toISOString();
      const res = await request(app)
        .put(`/api/calendar/${eventA._id}`)
        .set(headersA)
        .send({
          status: 'completed',
          startAt: newStart,
          reminderMinutes: 30,
          url: 'https://meet.google.com/abc-defg-hij',
        });

      expect(res.status).toBe(200);
      expect(res.body.event.status).toBe('completed');
      expect(res.body.event.reminderMinutes).toBe(30);
      expect(res.body.event.url).toBe('https://meet.google.com/abc-defg-hij');
    });

    it('rejects attempt to mutate userId with 400', async () => {
      const res = await request(app)
        .put(`/api/calendar/${eventA._id}`)
        .set(headersA)
        .send({ userId: userB._id.toString() });
      expect(res.status).toBe(400);
    });

    it('allows User A to delete own event, and returns 404 on repeated delete', async () => {
      const delRes = await request(app)
        .delete(`/api/calendar/${eventA._id}`)
        .set(headersA);
      expect(delRes.status).toBe(200);

      const getRes = await request(app)
        .get(`/api/calendar/${eventA._id}`)
        .set(headersA);
      expect(getRes.status).toBe(404);

      const delAgain = await request(app)
        .delete(`/api/calendar/${eventA._id}`)
        .set(headersA);
      expect(delAgain.status).toBe(404);
    });
  });
});
