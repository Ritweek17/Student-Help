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
import { Notification } from '../../src/models/Notification.js';

describe('Notifications API Test Suite (Supertest + MongoMemoryReplSet)', () => {
  let userA;
  let tokenA;
  let headersA;

  let userB;
  let tokenB;
  let headersB;

  let pubOpp1;
  let pubOpp2;
  let appA1;
  let appB1;
  let calEventA1;
  let calEventB1;

  beforeAll(async () => {
    await setupTestDatabase();
    await Promise.all([
      Notification.init(),
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

    const authA = await createTestUser('notif_user_a', 'student');
    userA = authA.user;
    tokenA = authA.token;
    headersA = { Authorization: `Bearer ${tokenA}` };

    const authB = await createTestUser('notif_user_b', 'student');
    userB = authB.user;
    tokenB = authB.token;
    headersB = { Authorization: `Bearer ${tokenB}` };

    pubOpp1 = await Opportunity.create({
      title: 'Notif Opp 1',
      organization: 'Notif Org 1',
      description: 'Notif Description 1',
      type: 'internship',
      status: 'published',
    });

    pubOpp2 = await Opportunity.create({
      title: 'Notif Opp 2',
      organization: 'Notif Org 2',
      description: 'Notif Description 2',
      type: 'hackathon',
      status: 'published',
    });

    appA1 = await Application.create({
      userId: userA._id,
      opportunityId: pubOpp1._id,
      type: 'application',
      status: 'applied',
    });

    appB1 = await Application.create({
      userId: userB._id,
      opportunityId: pubOpp2._id,
      type: 'application',
      status: 'applied',
    });

    calEventA1 = await CalendarEvent.create({
      userId: userA._id,
      title: 'Cal Event A1',
      type: 'event',
      startAt: new Date(),
      opportunityId: pubOpp1._id,
      applicationId: appA1._id,
    });

    calEventB1 = await CalendarEvent.create({
      userId: userB._id,
      title: 'Cal Event B1',
      type: 'event',
      startAt: new Date(),
      opportunityId: pubOpp2._id,
      applicationId: appB1._id,
    });
  });

  describe('Authentication Boundaries', () => {
    it('returns 401 for unauthenticated notification creation', async () => {
      const res = await request(app)
        .post('/api/notifications')
        .send({ title: 'T', message: 'M', type: 'system' });
      expect(res.status).toBe(401);
    });

    it('returns 401 for unauthenticated notification listing', async () => {
      const res = await request(app).get('/api/notifications');
      expect(res.status).toBe(401);
    });

    it('returns 401 for unauthenticated notification retrieval', async () => {
      const res = await request(app).get(`/api/notifications/${new mongoose.Types.ObjectId()}`);
      expect(res.status).toBe(401);
    });

    it('returns 401 for unauthenticated mark-as-read', async () => {
      const res = await request(app).put(`/api/notifications/${new mongoose.Types.ObjectId()}/read`);
      expect(res.status).toBe(401);
    });

    it('returns 401 for unauthenticated mark-all-read', async () => {
      const res = await request(app).put('/api/notifications/read-all');
      expect(res.status).toBe(401);
    });

    it('returns 401 for unauthenticated dismiss', async () => {
      const res = await request(app).put(`/api/notifications/${new mongoose.Types.ObjectId()}/dismiss`);
      expect(res.status).toBe(401);
    });

    it('returns 401 for unauthenticated unread-count', async () => {
      const res = await request(app).get('/api/notifications/unread-count');
      expect(res.status).toBe(401);
    });

    it('returns 401 for unauthenticated notification deletion', async () => {
      const res = await request(app).delete(`/api/notifications/${new mongoose.Types.ObjectId()}`);
      expect(res.status).toBe(401);
    });
  });

  describe('Model & Create Validation Tests', () => {
    it('rejects client userId injection with 400', async () => {
      const res = await request(app)
        .post('/api/notifications')
        .set(headersA)
        .send({
          title: 'Inj User',
          message: 'Message',
          type: 'system',
          userId: userB._id.toString(),
        });
      expect(res.status).toBe(400);
    });

    it('rejects client readAt injection with 400', async () => {
      const res = await request(app)
        .post('/api/notifications')
        .set(headersA)
        .send({
          title: 'Inj ReadAt',
          message: 'Message',
          type: 'system',
          readAt: new Date(),
        });
      expect(res.status).toBe(400);
    });

    it('rejects client dismissedAt injection with 400', async () => {
      const res = await request(app)
        .post('/api/notifications')
        .set(headersA)
        .send({
          title: 'Inj DismissedAt',
          message: 'Message',
          type: 'system',
          dismissedAt: new Date(),
        });
      expect(res.status).toBe(400);
    });

    it('rejects invalid/nonexistent Opportunity reference with 400', async () => {
      const res = await request(app)
        .post('/api/notifications')
        .set(headersA)
        .send({
          title: 'Inv Opp',
          message: 'Msg',
          type: 'opportunity_deadline',
          opportunityId: new mongoose.Types.ObjectId().toString(),
        });
      expect(res.status).toBe(400);
    });

    it('rejects invalid/nonexistent Application reference with 400', async () => {
      const res = await request(app)
        .post('/api/notifications')
        .set(headersA)
        .send({
          title: 'Inv App',
          message: 'Msg',
          type: 'application_update',
          applicationId: new mongoose.Types.ObjectId().toString(),
        });
      expect(res.status).toBe(400);
    });

    it('rejects cross-user Application reference with 400', async () => {
      const res = await request(app)
        .post('/api/notifications')
        .set(headersA)
        .send({
          title: 'Cross App',
          message: 'Msg',
          type: 'application_update',
          applicationId: appB1._id.toString(),
        });
      expect(res.status).toBe(400);
    });

    it('rejects invalid/nonexistent CalendarEvent reference with 400', async () => {
      const res = await request(app)
        .post('/api/notifications')
        .set(headersA)
        .send({
          title: 'Inv Cal',
          message: 'Msg',
          type: 'calendar_reminder',
          calendarEventId: new mongoose.Types.ObjectId().toString(),
        });
      expect(res.status).toBe(400);
    });

    it('rejects cross-user CalendarEvent reference with 400', async () => {
      const res = await request(app)
        .post('/api/notifications')
        .set(headersA)
        .send({
          title: 'Cross Cal',
          message: 'Msg',
          type: 'calendar_reminder',
          calendarEventId: calEventB1._id.toString(),
        });
      expect(res.status).toBe(400);
    });

    it('rejects inconsistent relationships (mismatched Opportunity & Application) with 400', async () => {
      const res = await request(app)
        .post('/api/notifications')
        .set(headersA)
        .send({
          title: 'Inconsistent Opp & App',
          message: 'Msg',
          type: 'application_deadline',
          applicationId: appA1._id.toString(),
          opportunityId: pubOpp2._id.toString(),
        });
      expect(res.status).toBe(400);
    });
  });

  describe('Valid Notification Creation & Defaults', () => {
    it('creates notification with all valid entity relationships and checks schema defaults', async () => {
      const res = await request(app)
        .post('/api/notifications')
        .set(headersA)
        .send({
          title: 'User A Deadline',
          message: 'Your application is due soon.',
          type: 'application_deadline',
          opportunityId: pubOpp1._id.toString(),
          applicationId: appA1._id.toString(),
          calendarEventId: calEventA1._id.toString(),
        });

      expect(res.status).toBe(201);
      const notif = res.body.notification;
      expect(notif.userId).toBe(userA._id.toString());
      expect(notif.opportunityId).toBe(pubOpp1._id.toString());
      expect(notif.applicationId).toBe(appA1._id.toString());
      expect(notif.calendarEventId).toBe(calEventA1._id.toString());
      expect(notif.read).toBe(false);
      expect(notif.dismissed).toBe(false);
      expect(notif.createdAt).toBeDefined();
      expect(notif.updatedAt).toBeDefined();
    });

    it('allows creating standalone system notification without related entities', async () => {
      const res = await request(app)
        .post('/api/notifications')
        .set(headersA)
        .send({
          title: 'System Info',
          message: 'Maintenance scheduled.',
          type: 'system',
        });

      expect(res.status).toBe(201);
      expect(res.body.notification.title).toBe('System Info');
      expect(res.body.notification.userId).toBe(userA._id.toString());
    });
  });

  describe('Single GET, Route Ordering & Ownership Security (IDOR)', () => {
    let notifA1;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/notifications')
        .set(headersA)
        .send({
          title: 'User A Deadline',
          message: 'Your application is due soon.',
          type: 'application_deadline',
          opportunityId: pubOpp1._id.toString(),
          applicationId: appA1._id.toString(),
          calendarEventId: calEventA1._id.toString(),
        });
      notifA1 = res.body.notification;
    });

    it('allows User A to GET own notification', async () => {
      const res = await request(app)
        .get(`/api/notifications/${notifA1._id}`)
        .set(headersA);
      expect(res.status).toBe(200);
      expect(res.body.notification.title).toBe('User A Deadline');
    });

    it('returns 404 when User B attempts to GET User A notification (IDOR protection)', async () => {
      const res = await request(app)
        .get(`/api/notifications/${notifA1._id}`)
        .set(headersB);
      expect(res.status).toBe(404);
    });

    it('returns 400 for malformed notification ObjectId', async () => {
      const res = await request(app)
        .get('/api/notifications/invalid-object-id')
        .set(headersA);
      expect(res.status).toBe(400);
    });

    it('returns 404 for unknown/missing notification ID', async () => {
      const res = await request(app)
        .get(`/api/notifications/${new mongoose.Types.ObjectId()}`)
        .set(headersA);
      expect(res.status).toBe(404);
    });

    it('correctly resolves /unread-count static route without falling into :id param', async () => {
      const res = await request(app)
        .get('/api/notifications/unread-count')
        .set(headersA);
      expect(res.status).toBe(200);
      expect(typeof res.body.unreadCount).toBe('number');
      expect(res.body.unreadCount).toBe(1);
    });
  });

  describe('Read State & Read All Operations', () => {
    let notifA1;
    let notifA2;
    let notifB1;

    beforeEach(async () => {
      const resA1 = await request(app)
        .post('/api/notifications')
        .set(headersA)
        .send({ title: 'A1', message: 'M1', type: 'system' });
      notifA1 = resA1.body.notification;

      const resA2 = await request(app)
        .post('/api/notifications')
        .set(headersA)
        .send({ title: 'A2', message: 'M2', type: 'system' });
      notifA2 = resA2.body.notification;

      const resB1 = await request(app)
        .post('/api/notifications')
        .set(headersB)
        .send({ title: 'B1', message: 'M1', type: 'system' });
      notifB1 = resB1.body.notification;
    });

    it('marks a notification as read and sets readAt server timestamp', async () => {
      const res = await request(app)
        .put(`/api/notifications/${notifA1._id}/read`)
        .set(headersA);
      expect(res.status).toBe(200);
      expect(res.body.notification.read).toBe(true);
      expect(res.body.notification.readAt).toBeDefined();
    });

    it('is idempotent on repeated mark-as-read calls', async () => {
      await request(app)
        .put(`/api/notifications/${notifA1._id}/read`)
        .set(headersA);
      const resAgain = await request(app)
        .put(`/api/notifications/${notifA1._id}/read`)
        .set(headersA);
      expect(resAgain.status).toBe(200);
      expect(resAgain.body.notification.read).toBe(true);
    });

    it('reflects decreased unread-count after mark-as-read', async () => {
      const countBefore = await request(app)
        .get('/api/notifications/unread-count')
        .set(headersA);
      expect(countBefore.body.unreadCount).toBe(2);

      await request(app)
        .put(`/api/notifications/${notifA1._id}/read`)
        .set(headersA);

      const countAfter = await request(app)
        .get('/api/notifications/unread-count')
        .set(headersA);
      expect(countAfter.body.unreadCount).toBe(1);
    });

    it('updates only current user notifications on read-all, returning updatedCount without affecting User B', async () => {
      // User A marks all read (notifA1 and notifA2 were unread)
      const res = await request(app)
        .put('/api/notifications/read-all')
        .set(headersA);
      expect(res.status).toBe(200);
      expect(res.body.updatedCount).toBe(2);

      const countA = await request(app)
        .get('/api/notifications/unread-count')
        .set(headersA);
      expect(countA.body.unreadCount).toBe(0);

      // User B unread count remains 1
      const countB = await request(app)
        .get('/api/notifications/unread-count')
        .set(headersB);
      expect(countB.body.unreadCount).toBe(1);
    });

    it('returns 404 when User B tries to mark User A notification as read', async () => {
      const res = await request(app)
        .put(`/api/notifications/${notifA1._id}/read`)
        .set(headersB);
      expect(res.status).toBe(404);
    });
  });

  describe('Dismiss Operations', () => {
    let notifA1;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/notifications')
        .set(headersA)
        .send({ title: 'A1', message: 'M1', type: 'system' });
      notifA1 = res.body.notification;
    });

    it('marks a notification as dismissed and server populates dismissedAt', async () => {
      const res = await request(app)
        .put(`/api/notifications/${notifA1._id}/dismiss`)
        .set(headersA);
      expect(res.status).toBe(200);
      expect(res.body.notification.dismissed).toBe(true);
      expect(res.body.notification.dismissedAt).toBeDefined();
    });

    it('is idempotent on repeated dismiss calls', async () => {
      await request(app)
        .put(`/api/notifications/${notifA1._id}/dismiss`)
        .set(headersA);
      const resAgain = await request(app)
        .put(`/api/notifications/${notifA1._id}/dismiss`)
        .set(headersA);
      expect(resAgain.status).toBe(200);
      expect(resAgain.body.notification.dismissed).toBe(true);
    });

    it('still counts dismissed-but-unread notifications in unread-count', async () => {
      await request(app)
        .put(`/api/notifications/${notifA1._id}/dismiss`)
        .set(headersA);

      const resCount = await request(app)
        .get('/api/notifications/unread-count')
        .set(headersA);
      expect(resCount.body.unreadCount).toBe(1);
    });

    it('returns 404 when User B tries to dismiss User A notification', async () => {
      const res = await request(app)
        .put(`/api/notifications/${notifA1._id}/dismiss`)
        .set(headersB);
      expect(res.status).toBe(404);
    });
  });

  describe('List, Filtering & Pagination', () => {
    let notifActiveSys;
    let notifDismissedDead;

    beforeEach(async () => {
      // User A: 1 active system notification (unread)
      const res1 = await request(app)
        .post('/api/notifications')
        .set(headersA)
        .send({ title: 'Active System', message: 'M1', type: 'system' });
      notifActiveSys = res1.body.notification;

      // User A: 1 deadline notification, marked read and dismissed
      const res2 = await request(app)
        .post('/api/notifications')
        .set(headersA)
        .send({
          title: 'Dismissed Deadline',
          message: 'M2',
          type: 'application_deadline',
          applicationId: appA1._id.toString(),
          opportunityId: pubOpp1._id.toString(),
        });
      notifDismissedDead = res2.body.notification;

      await request(app)
        .put(`/api/notifications/${notifDismissedDead._id}/read`)
        .set(headersA);
      await request(app)
        .put(`/api/notifications/${notifDismissedDead._id}/dismiss`)
        .set(headersA);

      // User B: 1 active notification
      await request(app)
        .post('/api/notifications')
        .set(headersB)
        .send({ title: 'User B Event', message: 'MB', type: 'system' });
    });

    it('hides dismissed notifications by default', async () => {
      const res = await request(app)
        .get('/api/notifications')
        .set(headersA);
      expect(res.status).toBe(200);
      expect(res.body.notifications.length).toBe(1);
      expect(res.body.notifications[0]._id).toBe(notifActiveSys._id);
    });

    it('filters dismissed notifications with ?dismissed=true', async () => {
      const res = await request(app)
        .get('/api/notifications?dismissed=true')
        .set(headersA);
      expect(res.status).toBe(200);
      expect(res.body.notifications.length).toBe(1);
      expect(res.body.notifications[0]._id).toBe(notifDismissedDead._id);
    });

    it('filters active notifications with ?dismissed=false', async () => {
      const res = await request(app)
        .get('/api/notifications?dismissed=false')
        .set(headersA);
      expect(res.status).toBe(200);
      expect(res.body.notifications.length).toBe(1);
      expect(res.body.notifications[0]._id).toBe(notifActiveSys._id);
    });

    it('filters by type: ?type=system', async () => {
      const res = await request(app)
        .get('/api/notifications?type=system&dismissed=false')
        .set(headersA);
      expect(res.status).toBe(200);
      expect(res.body.notifications.length).toBe(1);
      expect(res.body.notifications[0].type).toBe('system');
    });

    it('filters by read state: ?read=true', async () => {
      const res = await request(app)
        .get('/api/notifications?read=true&dismissed=true')
        .set(headersA);
      expect(res.status).toBe(200);
      expect(res.body.notifications.length).toBe(1);
      expect(res.body.notifications[0].read).toBe(true);
    });

    it('isolates lists between User A and User B', async () => {
      const resA = await request(app)
        .get('/api/notifications?dismissed=false')
        .set(headersA);
      const resB = await request(app)
        .get('/api/notifications?dismissed=false')
        .set(headersB);

      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);
      expect(resA.body.notifications.length).toBe(1);
      expect(resB.body.notifications.length).toBe(1);
      expect(resB.body.notifications[0].title).toBe('User B Event');
    });

    it('rejects invalid query parameters (e.g. invalid page, invalid dismissed, invalid type) with 400', async () => {
      const resInvPage = await request(app)
        .get('/api/notifications?page=0')
        .set(headersA);
      expect(resInvPage.status).toBe(400);

      const resInvDismissed = await request(app)
        .get('/api/notifications?dismissed=invalid')
        .set(headersA);
      expect(resInvDismissed.status).toBe(400);

      const resInvType = await request(app)
        .get('/api/notifications?type=invalid_type')
        .set(headersA);
      expect(resInvType.status).toBe(400);
    });

    it('supports pagination limit and metadata', async () => {
      // Create another active notification for User A so total active is 2
      await request(app)
        .post('/api/notifications')
        .set(headersA)
        .send({ title: 'Active System 2', message: 'M3', type: 'system' });

      const res = await request(app)
        .get('/api/notifications?page=1&limit=1&dismissed=false')
        .set(headersA);
      expect(res.status).toBe(200);
      expect(res.body.notifications.length).toBe(1);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(1);
      expect(res.body.pagination.total).toBe(2);
      expect(res.body.pagination.pages).toBe(2);
    });
  });

  describe('Delete Tests & Ownership Security', () => {
    let notifA1;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/notifications')
        .set(headersA)
        .send({ title: 'To Delete', message: 'M', type: 'system' });
      notifA1 = res.body.notification;
    });

    it('allows User A to delete own notification', async () => {
      const res = await request(app)
        .delete(`/api/notifications/${notifA1._id}`)
        .set(headersA);
      expect(res.status).toBe(200);
      expect(res.body.deleted).toBe(true);

      const getCheck = await request(app)
        .get(`/api/notifications/${notifA1._id}`)
        .set(headersA);
      expect(getCheck.status).toBe(404);
    });

    it('returns 404 when User B tries to delete User A notification (IDOR protection)', async () => {
      const res = await request(app)
        .delete(`/api/notifications/${notifA1._id}`)
        .set(headersB);
      expect(res.status).toBe(404);

      // Verify User A notification still exists
      const getCheck = await request(app)
        .get(`/api/notifications/${notifA1._id}`)
        .set(headersA);
      expect(getCheck.status).toBe(200);
    });

    it('returns 404 on repeated deletion of already deleted notification', async () => {
      await request(app)
        .delete(`/api/notifications/${notifA1._id}`)
        .set(headersA);

      const resAgain = await request(app)
        .delete(`/api/notifications/${notifA1._id}`)
        .set(headersA);
      expect(resAgain.status).toBe(404);
    });
  });
});
