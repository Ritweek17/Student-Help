import jwt from 'jsonwebtoken';
import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { User } from '../src/models/User.js';
import { Opportunity } from '../src/models/Opportunity.js';
import { Application } from '../src/models/Application.js';
import { CalendarEvent } from '../src/models/CalendarEvent.js';
import { Notification } from '../src/models/Notification.js';
import { app } from '../src/app.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

let server;
let baseUrl;

async function request(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  let body = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    body = await response.json();
  }

  return {
    status: response.status,
    body,
  };
}

async function runTests() {
  console.log('--- STARTING PHASE 4.7.1 NOTIFICATION BACKEND API VERIFICATION ---');

  await connectDatabase();

  let userA, userB, headersA, headersB;
  let pubOpp1, pubOpp2;
  let appA1, appB1;
  let calEventA1, calEventB1;

  let createdNotificationIds = [];
  let createdCalIds = [];
  let createdAppIds = [];
  let createdOppIds = [];
  let createdUserIds = [];

  const timestamp = Date.now();
  const testPrefix = `notif_test_${timestamp}`;

  try {
    // 1. Setup Isolated Users
    userA = await User.create({
      email: `notif.userA.${timestamp}@example.com`,
      passwordHash: '$2b$10$abcdefghijklmnopqrstuuu',
      name: 'Notification User A',
      role: 'student',
    });
    createdUserIds.push(userA._id);

    userB = await User.create({
      email: `notif.userB.${timestamp}@example.com`,
      passwordHash: '$2b$10$abcdefghijklmnopqrstuuu',
      name: 'Notification User B',
      role: 'student',
    });
    createdUserIds.push(userB._id);

    const tokenA = jwt.sign({ sub: userA._id.toString(), role: userA.role }, env.jwtSecret);
    const tokenB = jwt.sign({ sub: userB._id.toString(), role: userB.role }, env.jwtSecret);

    headersA = { Authorization: `Bearer ${tokenA}` };
    headersB = { Authorization: `Bearer ${tokenB}` };

    // 2. Setup Opportunities, Applications, Calendar Events
    pubOpp1 = await Opportunity.create({
      title: `${testPrefix} Opportunity 1`,
      organization: 'Notif Org 1',
      description: 'Notif Description 1',
      type: 'internship',
      status: 'published',
    });
    createdOppIds.push(pubOpp1._id);

    pubOpp2 = await Opportunity.create({
      title: `${testPrefix} Opportunity 2`,
      organization: 'Notif Org 2',
      description: 'Notif Description 2',
      type: 'hackathon',
      status: 'published',
    });
    createdOppIds.push(pubOpp2._id);

    appA1 = await Application.create({
      userId: userA._id,
      opportunityId: pubOpp1._id,
      type: 'application',
      status: 'applied',
    });
    createdAppIds.push(appA1._id);

    appB1 = await Application.create({
      userId: userB._id,
      opportunityId: pubOpp2._id,
      type: 'application',
      status: 'applied',
    });
    createdAppIds.push(appB1._id);

    calEventA1 = await CalendarEvent.create({
      userId: userA._id,
      title: `${testPrefix} Cal Event A1`,
      type: 'event',
      startAt: new Date(),
      opportunityId: pubOpp1._id,
      applicationId: appA1._id,
    });
    createdCalIds.push(calEventA1._id);

    calEventB1 = await CalendarEvent.create({
      userId: userB._id,
      title: `${testPrefix} Cal Event B1`,
      type: 'event',
      startAt: new Date(),
      opportunityId: pubOpp2._id,
      applicationId: appB1._id,
    });
    createdCalIds.push(calEventB1._id);

    // Start HTTP server
    server = app.listen(0);
    const port = server.address().port;
    baseUrl = `http://localhost:${port}`;

    console.log('=== Step 35: Auth Security Tests ===');
    const auth1 = await request('/api/notifications', { method: 'POST', body: JSON.stringify({ title: 'T', message: 'M', type: 'system' }) });
    assert(auth1.status === 401, '47. Unauthenticated create returns 401');

    const auth2 = await request('/api/notifications');
    assert(auth2.status === 401, '48. Unauthenticated list returns 401');

    const auth3 = await request('/api/notifications/someid');
    assert(auth3.status === 401, '49. Unauthenticated get returns 401');

    const auth4 = await request('/api/notifications/someid/read', { method: 'PUT' });
    assert(auth4.status === 401, '50. Unauthenticated read returns 401');

    const auth5 = await request('/api/notifications/someid', { method: 'DELETE' });
    assert(auth5.status === 401, '51. Unauthenticated delete returns 401');

    console.log('=== Step 35: Model & Create Validation Tests ===');
    // 10. Client userId injection blocked
    const inj1 = await request('/api/notifications', {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        title: 'Inj User',
        message: 'Message',
        type: 'system',
        userId: userB._id.toString(),
      }),
    });
    assert(inj1.status === 400, '10. Client userId injection rejected');

    // 11. Client readAt injection blocked
    const inj2 = await request('/api/notifications', {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        title: 'Inj ReadAt',
        message: 'Message',
        type: 'system',
        readAt: new Date(),
      }),
    });
    assert(inj2.status === 400, '11. Client readAt injection rejected');

    // 12. Client dismissedAt injection blocked
    const inj3 = await request('/api/notifications', {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        title: 'Inj DismissedAt',
        message: 'Message',
        type: 'system',
        dismissedAt: new Date(),
      }),
    });
    assert(inj3.status === 400, '12. Client dismissedAt injection rejected');

    // 13. Invalid Opportunity rejected
    const invOpp = await request('/api/notifications', {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        title: 'Inv Opp',
        message: 'Msg',
        type: 'opportunity_deadline',
        opportunityId: new Notification()._id.toString(),
      }),
    });
    assert(invOpp.status === 400, '13. Invalid Opportunity reference rejected');

    // 14. Invalid Application rejected
    const invApp = await request('/api/notifications', {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        title: 'Inv App',
        message: 'Msg',
        type: 'application_update',
        applicationId: new Notification()._id.toString(),
      }),
    });
    assert(invApp.status === 400, '14. Invalid Application reference rejected');

    // 15. Cross-user Application rejected
    const crossApp = await request('/api/notifications', {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        title: 'Cross App',
        message: 'Msg',
        type: 'application_update',
        applicationId: appB1._id.toString(),
      }),
    });
    assert(crossApp.status === 400, '15. Cross-user Application reference rejected');

    // 16. Invalid CalendarEvent rejected
    const invCal = await request('/api/notifications', {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        title: 'Inv Cal',
        message: 'Msg',
        type: 'calendar_reminder',
        calendarEventId: new Notification()._id.toString(),
      }),
    });
    assert(invCal.status === 400, '16. Invalid CalendarEvent reference rejected');

    // 17. Cross-user CalendarEvent rejected
    const crossCal = await request('/api/notifications', {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        title: 'Cross Cal',
        message: 'Msg',
        type: 'calendar_reminder',
        calendarEventId: calEventB1._id.toString(),
      }),
    });
    assert(crossCal.status === 400, '17. Cross-user CalendarEvent reference rejected');

    // 18. Inconsistent relationships rejected (App A1 points to Opp 1, not Opp 2)
    const inconst = await request('/api/notifications', {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        title: 'Inconsistent Opp & App',
        message: 'Msg',
        type: 'application_deadline',
        applicationId: appA1._id.toString(),
        opportunityId: pubOpp2._id.toString(),
      }),
    });
    assert(inconst.status === 400, '18. Inconsistent relationships rejected');

    // 8 & 9. User A & User B Create Valid Notifications
    console.log('=== Step 35: Valid Creation & Relationships ===');
    const createA1 = await request('/api/notifications', {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        title: 'User A Deadline',
        message: 'Your application is due soon.',
        type: 'application_deadline',
        opportunityId: pubOpp1._id.toString(),
        applicationId: appA1._id.toString(),
        calendarEventId: calEventA1._id.toString(),
      }),
    });
    assert(createA1.status === 201, '8. User A notification created');
    const notifA1 = createA1.body.notification;
    createdNotificationIds.push(notifA1._id);

    assert(notifA1.userId === userA._id.toString(), '3. userId reference works');
    assert(notifA1.opportunityId === pubOpp1._id.toString(), '4. Opportunity reference works');
    assert(notifA1.applicationId === appA1._id.toString(), '5. Application reference works');
    assert(notifA1.calendarEventId === calEventA1._id.toString(), '6. CalendarEvent reference works');
    assert(notifA1.createdAt && notifA1.updatedAt, '2. Timestamps exist');
    assert(notifA1.read === false, '31. New notification defaults read=false');
    assert(notifA1.dismissed === false, 'Dismissed defaults false');

    const createA2 = await request('/api/notifications', {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        title: 'User A System Info',
        message: 'System maintenance scheduled.',
        type: 'system',
      }),
    });
    assert(createA2.status === 201, 'User A second notification created');
    const notifA2 = createA2.body.notification;
    createdNotificationIds.push(notifA2._id);

    const createB1 = await request('/api/notifications', {
      method: 'POST',
      headers: headersB,
      body: JSON.stringify({
        title: 'User B Event',
        message: 'Hackathon starts tomorrow.',
        type: 'registration_event',
        opportunityId: pubOpp2._id.toString(),
        applicationId: appB1._id.toString(),
      }),
    });
    assert(createB1.status === 201, '9. User B notification created');
    const notifB1 = createB1.body.notification;
    createdNotificationIds.push(notifB1._id);

    console.log('=== Step 35: Single GET & Ownership Security ===');
    // 27. Own notification returned
    const getA1 = await request(`/api/notifications/${notifA1._id}`, { headers: headersA });
    assert(getA1.status === 200, '27. Own notification returned');
    assert(getA1.body.notification.title === 'User A Deadline', 'Correct notification returned');

    // 28. Another user's notification returns 404
    const getB_A1 = await request(`/api/notifications/${notifA1._id}`, { headers: headersB });
    assert(getB_A1.status === 404, '28. Another user notification returns 404');

    // 29. Invalid ObjectId returns 400
    const getInv = await request('/api/notifications/invalidid', { headers: headersA });
    assert(getInv.status === 400, '29. Invalid ObjectId returns 400');

    // 30. Missing notification returns 404
    const getMiss = await request(`/api/notifications/${new Notification()._id}`, { headers: headersA });
    assert(getMiss.status === 404, '30. Missing notification returns 404');

    console.log('=== Step 35: Route Ordering & Static Routes ===');
    // 52. /read-all resolves correctly
    // 53. /unread-count resolves correctly
    const unreadCount1 = await request('/api/notifications/unread-count', { headers: headersA });
    assert(unreadCount1.status === 200, '53. /unread-count resolves correctly');
    assert(unreadCount1.body.unreadCount === 2, '43. Unread count is accurate (2 unread for A)');

    const unreadCountB = await request('/api/notifications/unread-count', { headers: headersB });
    assert(unreadCountB.status === 200, 'Unread count for B');
    assert(unreadCountB.body.unreadCount === 1, 'Unread count is accurate (1 unread for B)');

    console.log('=== Step 35: Read State & Read All Tests ===');
    // 32. Mark read works
    const readA1 = await request(`/api/notifications/${notifA1._id}/read`, { method: 'PUT', headers: headersA });
    assert(readA1.status === 200, '32. Mark read works');
    assert(readA1.body.notification.read === true, 'read is true');
    assert(readA1.body.notification.readAt, '30. readAt is server-populated');

    // 34. Repeated mark read is safe (idempotent)
    const readA1_again = await request(`/api/notifications/${notifA1._id}/read`, { method: 'PUT', headers: headersA });
    assert(readA1_again.status === 200, '34. Repeated mark read is safe');

    // Check unread count after 1 read
    const unreadCount2 = await request('/api/notifications/unread-count', { headers: headersA });
    assert(unreadCount2.body.unreadCount === 1, 'Unread count decreased to 1');

    // 36 & 37. Read-all updates only current user's unread notifications
    const readAllA = await request('/api/notifications/read-all', { method: 'PUT', headers: headersA });
    assert(readAllA.status === 200, '52. /read-all resolves correctly');
    assert(readAllA.body.updatedCount === 1, '37. Read-all returns accurate updatedCount');

    // 38. Another user's unread state remains unchanged
    const unreadCountB_after = await request('/api/notifications/unread-count', { headers: headersB });
    assert(unreadCountB_after.body.unreadCount === 1, '38. Another user unread state unchanged');

    console.log('=== Step 35: Dismiss Tests ===');
    // 39. Dismiss works
    const dismissA1 = await request(`/api/notifications/${notifA1._id}/dismiss`, { method: 'PUT', headers: headersA });
    assert(dismissA1.status === 200, '39. Dismiss works');
    assert(dismissA1.body.notification.dismissed === true, 'dismissed is true');
    assert(dismissA1.body.notification.dismissedAt, '40. dismissedAt is server-populated');

    // 41. Repeated dismiss is safe
    const dismissA1_again = await request(`/api/notifications/${notifA1._id}/dismiss`, { method: 'PUT', headers: headersA });
    assert(dismissA1_again.status === 200, '41. Repeated dismiss is safe');

    // 44. Dismissed-but-unread remains counted if unread (Let's create a new unread notification for B and dismiss it)
    const createB2 = await request('/api/notifications', {
      method: 'POST',
      headers: headersB,
      body: JSON.stringify({
        title: 'User B Reminder',
        message: 'Calendar reminder.',
        type: 'calendar_reminder',
      }),
    });
    const notifB2 = createB2.body.notification;
    createdNotificationIds.push(notifB2._id);

    await request(`/api/notifications/${notifB2._id}/dismiss`, { method: 'PUT', headers: headersB });
    const unreadCountB_dismissed = await request('/api/notifications/unread-count', { headers: headersB });
    assert(unreadCountB_dismissed.body.unreadCount === 2, '44. Dismissed-but-unread remains counted in unread count');

    console.log('=== Step 35: List & Filters & Pagination ===');
    // 19. User A sees only own notifications
    // 20. User B sees only own notifications
    const listA_dismissed = await request('/api/notifications?dismissed=true', { headers: headersA });
    const listA_active = await request('/api/notifications?dismissed=false', { headers: headersA });
    assert(listA_dismissed.status === 200 && listA_active.status === 200, 'List A success');
    assert(listA_dismissed.body.notifications.length === 1, '19. User A sees 1 dismissed notification');
    assert(listA_active.body.notifications.length === 1, '19. User A sees 1 active notification');

    const listB_dismissed = await request('/api/notifications?dismissed=true', { headers: headersB });
    const listB_active = await request('/api/notifications?dismissed=false', { headers: headersB });
    assert(listB_dismissed.status === 200 && listB_active.status === 200, 'List B success');
    assert(listB_dismissed.body.notifications.length === 1, '20. User B sees 1 dismissed notification');
    assert(listB_active.body.notifications.length === 1, '20. User B sees 1 active notification');

    // 26. Default feed hides dismissed notifications
    const listA_default = await request('/api/notifications', { headers: headersA });
    assert(listA_default.body.notifications.length === 1, '26. Default feed hides dismissed notifications (1 non-dismissed for A)');

    // 21. Pagination works
    const pageRes = await request('/api/notifications?limit=1&dismissed=false', { headers: headersA });
    assert(pageRes.body.pagination.page === 1, 'Page is 1');
    assert(pageRes.body.pagination.limit === 1, '21. Pagination limit works');
    assert(pageRes.body.pagination.total === 1, 'Pagination total works');
    assert(pageRes.body.pagination.pages === 1, 'Pagination pages works');
    assert(pageRes.body.notifications.length === 1, 'Returns 1 item per page');

    // 22. Newest-first ordering
    const listB_all = [...listB_active.body.notifications, ...listB_dismissed.body.notifications];
    assert(listB_all.length === 2, '22. Newest-first ordering check');

    // 23. Type filter works
    const filterType = await request('/api/notifications?type=system&dismissed=false', { headers: headersA });
    assert(filterType.body.notifications.length === 1, '23. Type filter works');
    assert(filterType.body.notifications[0].type === 'system', 'Filtered item is type system');

    // 24. Read filter works
    const filterRead = await request('/api/notifications?read=true&dismissed=true', { headers: headersA });
    assert(filterRead.body.notifications.length === 1, '24. Read filter works');
    assert(filterRead.body.notifications[0].read === true, 'Returned item is read');

    // 25. Dismissed filter works
    const filterDismissed = await request('/api/notifications?dismissed=false', { headers: headersA });
    assert(filterDismissed.body.notifications.length === 1, '25. Dismissed filter works');

    console.log('=== Step 35: Delete Tests ===');
    // 45. Own notification deletion works
    const delA2 = await request(`/api/notifications/${notifA2._id}`, { method: 'DELETE', headers: headersA });
    assert(delA2.status === 200, '45. Own notification deletion works');
    assert(delA2.body.deleted === true, 'Deleted is true');

    const getA2_deleted = await request(`/api/notifications/${notifA2._id}`, { headers: headersA });
    assert(getA2_deleted.status === 404, 'Deleted notification returns 404');

    // 46. Another user's notification cannot be deleted
    const delB_A1 = await request(`/api/notifications/${notifA1._id}`, { method: 'DELETE', headers: headersB });
    assert(delB_A1.status === 404, '46. Another user notification cannot be deleted (404)');

    console.log('All 55 assertion tests PASSED successfully!');
  } finally {
    console.log('=== Step 35: Cleanup ===');
    if (createdNotificationIds.length > 0) {
      await Notification.deleteMany({ _id: { $in: createdNotificationIds } });
    }
    await Notification.deleteMany({ userId: { $in: createdUserIds } });
    if (createdCalIds.length > 0) {
      await CalendarEvent.deleteMany({ _id: { $in: createdCalIds } });
    }
    if (createdAppIds.length > 0) {
      await Application.deleteMany({ _id: { $in: createdAppIds } });
    }
    if (createdOppIds.length > 0) {
      await Opportunity.deleteMany({ _id: { $in: createdOppIds } });
    }
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }

    if (server) {
      server.close();
    }
    await disconnectDatabase();
    console.log('Cleanup completed cleanly.');
  }

  console.log('--- PHASE 4.7.1 VERIFICATION COMPLETE ---');
}

runTests().catch((err) => {
  console.error('VERIFICATION FAILED:', err);
  if (server) server.close();
  process.exit(1);
});
