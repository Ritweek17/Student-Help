/**
 * CareerOS Application Intelligence Follow-Up Execution Service (Phase 11G — Batch 5B)
 * 
 * Turns Application Intelligence follow-up candidates into real CareerOS actions:
 * - Creates deterministic Todo records tagged with [CareerOS App: <applicationId>:followup]
 * - Creates idempotent Notification records with notificationKey application_followup:<applicationId>:<period>
 * - Enforces strict 7-day cooldown per application to prevent action spam
 * - Independent server-side re-verification of ownership, active status, and stalled criteria
 * - Preserves user edits on existing Todos and respects completion states
 * - Zero external messaging, zero automatic application status mutations, zero fake interview events
 */

import mongoose from 'mongoose';
import { Application } from '../../models/Application.js';
import { Opportunity } from '../../models/Opportunity.js';
import { Todo } from '../../models/Todo.js';
import { Notification } from '../../models/Notification.js';
import { safeCreateNotification } from '../notificationGeneration.service.js';

export const FOLLOW_UP_COOLDOWN_DAYS = 7;
export const FOLLOW_UP_COOLDOWN_MS = FOLLOW_UP_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
export const STALLED_DAYS_THRESHOLD = 14;
export const URGENT_STALLED_DAYS_THRESHOLD = 21;

/**
 * Builds the deterministic tag used inside Todo descriptions.
 * 
 * @param {string|mongoose.Types.ObjectId} applicationId 
 * @returns {string}
 */
export function buildTodoTag(applicationId) {
  return `[CareerOS App: ${String(applicationId)}:followup]`;
}

/**
 * Builds deterministic notification key scoped to application and 7-day cooldown epoch period.
 * 
 * @param {string|mongoose.Types.ObjectId} applicationId 
 * @param {Date} [referenceDate=new Date()] 
 * @returns {string}
 */
export function buildNotificationKey(applicationId, referenceDate = new Date()) {
  const periodIndex = Math.floor(referenceDate.getTime() / FOLLOW_UP_COOLDOWN_MS);
  return `application_followup:${String(applicationId)}:${periodIndex}`;
}

/**
 * Builds neutral, non-causal Todo description.
 * 
 * @param {string} applicationId 
 * @param {Object} [opportunity] 
 * @param {number} ageDays 
 * @returns {string}
 */
export function buildFollowUpTodoDescription(applicationId, opportunity, ageDays) {
  const tag = buildTodoTag(applicationId);
  const role = opportunity?.title || 'the role';
  const org = opportunity?.organization || 'the company';
  return `${tag} This application for ${role} at ${org} has been active for ${ageDays} days without a recent update. Review the application details and consider sending a polite follow-up inquiry.`;
}

/**
 * Builds neutral Todo title.
 * 
 * @param {Object} [opportunity] 
 * @returns {string}
 */
export function buildFollowUpTodoTitle(opportunity) {
  const org = opportunity?.organization || 'Organization';
  return `Follow up on application with ${org}`;
}

/**
 * Builds neutral Notification message.
 * 
 * @param {Object} [opportunity] 
 * @param {number} ageDays 
 * @returns {string}
 */
export function buildFollowUpNotificationMessage(opportunity, ageDays) {
  const role = opportunity?.title || 'the role';
  const org = opportunity?.organization || 'the company';
  return `Your application for ${role} at ${org} has had no update for ${ageDays} days. Consider sending a polite follow-up inquiry.`;
}

/**
 * Processes a single candidate application document for follow-up execution.
 * 
 * @param {Object} app - Application plain object
 * @param {string} userId - Authenticated user ID
 * @param {Date} referenceDate - Evaluation reference date
 * @param {Object} accumulators - Accumulator arrays ({ created, retained, skipped, actions })
 */
export async function processApplicationCandidate(
  app,
  userId,
  referenceDate,
  { created, retained, skipped, actions }
) {
  const appId = String(app._id || app.id);
  const actionKey = `followup:${appId}`;

  // 1. Re-verify application type & active status
  // Eligible statuses: 'applied' or 'waiting'
  if (app.type && app.type !== 'application') {
    skipped.push({
      applicationId: appId,
      reason: 'invalid_type',
      type: app.type,
      message: 'Only standard job/internship applications are eligible for follow-up.',
    });
    actions.push({ actionKey, type: 'application_followup', status: 'skipped' });
    return;
  }

  if (!['applied', 'waiting'].includes(app.status)) {
    skipped.push({
      applicationId: appId,
      reason: 'inactive_status',
      status: app.status,
      message: `Application is not in an active follow-up stage (current: ${app.status}).`,
    });
    actions.push({ actionKey, type: 'application_followup', status: 'skipped' });
    return;
  }

  // 2. Re-verify stalled criteria relative to referenceDate
  const appDate = app.appliedAt || app.createdAt;
  const appTime = appDate ? new Date(appDate).getTime() : referenceDate.getTime();
  const ageDays = Math.max(0, Math.floor((referenceDate.getTime() - appTime) / (1000 * 60 * 60 * 24)));

  if (ageDays < STALLED_DAYS_THRESHOLD) {
    skipped.push({
      applicationId: appId,
      reason: 'not_stalled',
      ageDays,
      threshold: STALLED_DAYS_THRESHOLD,
      message: `Application is not stalled yet (${ageDays} days old; threshold is ${STALLED_DAYS_THRESHOLD} days).`,
    });
    actions.push({ actionKey, type: 'application_followup', status: 'skipped' });
    return;
  }

  // 3. Resolve Opportunity details
  const oppId = String(app.opportunityId?._id || app.opportunityId || '');
  let opportunity = null;
  if (oppId && mongoose.Types.ObjectId.isValid(oppId)) {
    opportunity = await Opportunity.findById(oppId).lean();
  }

  // 4. Check existing follow-up Todo by deterministic tag
  const existingTodo = await Todo.findOne({
    userId,
    description: { $regex: `\\[CareerOS App: ${appId}:followup\\]` },
  });

  // 5. Cooldown check (7 days)
  if (existingTodo) {
    const todoCreatedTime = new Date(existingTodo.createdAt).getTime();
    const todoAgeMs = referenceDate.getTime() - todoCreatedTime;

    if (todoAgeMs < FOLLOW_UP_COOLDOWN_MS) {
      const daysRemaining = Math.max(1, Math.ceil((FOLLOW_UP_COOLDOWN_MS - todoAgeMs) / (1000 * 60 * 60 * 24)));
      skipped.push({
        applicationId: appId,
        reason: 'cooldown_active',
        todoId: String(existingTodo._id),
        daysRemaining,
        message: `Follow-up action is on cooldown (${daysRemaining} day(s) remaining).`,
      });
      retained.push({
        applicationId: appId,
        todoId: String(existingTodo._id),
        completed: existingTodo.completed,
        reason: 'existing_todo_retained',
      });
      actions.push({ actionKey, type: 'application_followup', status: 'retained' });
      return;
    }

    // If cooldown has elapsed but previous Todo is still open (uncompleted), preserve it without creating duplicate
    if (!existingTodo.completed) {
      retained.push({
        applicationId: appId,
        todoId: String(existingTodo._id),
        completed: false,
        reason: 'open_todo_retained',
      });
      actions.push({ actionKey, type: 'application_followup', status: 'retained' });
      return;
    }
  }

  // Check recent Notification cooldown as a secondary guard
  const periodIndex = Math.floor(referenceDate.getTime() / FOLLOW_UP_COOLDOWN_MS);
  const notificationKey = `application_followup:${appId}:${periodIndex}`;
  const existingNotifInPeriod = await Notification.findOne({
    userId,
    notificationKey,
  }).lean();

  if (existingNotifInPeriod && !existingTodo) {
    skipped.push({
      applicationId: appId,
      reason: 'cooldown_active',
      notificationId: String(existingNotifInPeriod._id),
      message: 'A follow-up notification was already created during the current cooldown window.',
    });
    actions.push({ actionKey, type: 'application_followup', status: 'skipped' });
    return;
  }

  // 6. Create Todo and Notification
  const priority = ageDays >= URGENT_STALLED_DAYS_THRESHOLD ? 'High' : 'Medium';
  const title = buildFollowUpTodoTitle(opportunity);
  const description = buildFollowUpTodoDescription(appId, opportunity, ageDays);
  const dueDate = new Date(referenceDate.getTime() + 2 * 24 * 60 * 60 * 1000);

  const todoDoc = await Todo.create({
    userId,
    title,
    description,
    priority,
    category: 'Application',
    dueDate,
    completed: false,
  });

  const notifMessage = buildFollowUpNotificationMessage(opportunity, ageDays);
  let notifDoc = null;
  try {
    notifDoc = await safeCreateNotification({
      userId,
      notificationKey,
      type: 'application_update',
      title: 'Application follow-up recommended',
      message: notifMessage,
      opportunityId: opportunity?._id || undefined,
      applicationId: app._id,
    });
  } catch {
    // If notification creation encounters unexpected error, do not roll back the successful Todo
  }

  created.push({
    applicationId: appId,
    todoId: String(todoDoc._id),
    notificationId: notifDoc ? String(notifDoc._id) : null,
    title,
    priority,
  });

  actions.push({
    actionKey,
    type: 'application_followup',
    status: 'created',
    priority,
  });
}

/**
 * Service Entry Point: Executes application follow-up actions idempotently
 * for the authenticated user.
 * 
 * @param {string|mongoose.Types.ObjectId} userId - Authenticated user ID
 * @param {Object} [options={}] - Options
 * @param {string|mongoose.Types.ObjectId} [options.applicationId] - Optional target application ID
 * @param {Date} [options.referenceDate=new Date()] - Reference date for determinism & testing
 * @returns {Promise<Object>} Execution result summary
 */
export async function executeApplicationFollowUps(userId, options = {}) {
  const referenceDate = options.referenceDate instanceof Date ? options.referenceDate : new Date();

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    const error = new Error('Invalid user ID');
    error.status = 400;
    throw error;
  }

  const created = [];
  const retained = [];
  const skipped = [];
  const actions = [];

  // 1. Single Application Targeted
  if (options.applicationId) {
    if (!mongoose.Types.ObjectId.isValid(options.applicationId)) {
      const error = new Error('Invalid application ID');
      error.status = 400;
      throw error;
    }

    const app = await Application.findOne({
      _id: options.applicationId,
      userId,
    }).lean();

    if (!app) {
      // Check if application belongs to another user (Ownership Security Guard)
      const existsOtherUser = await Application.findById(options.applicationId).lean();
      if (existsOtherUser) {
        const error = new Error('Application does not belong to user');
        error.status = 403;
        throw error;
      }

      const error = new Error('Application not found');
      error.status = 404;
      throw error;
    }

    await processApplicationCandidate(app, userId, referenceDate, {
      created,
      retained,
      skipped,
      actions,
    });

    return {
      success: true,
      created,
      retained,
      skipped,
      actions,
      generatedAt: referenceDate.toISOString(),
    };
  }

  // 2. Batch Execution across all candidate applications for authenticated user
  const candidateApps = await Application.find({
    userId,
    type: 'application',
    status: { $in: ['applied', 'waiting'] },
  }).lean();

  for (const app of candidateApps) {
    await processApplicationCandidate(app, userId, referenceDate, {
      created,
      retained,
      skipped,
      actions,
    });
  }

  return {
    success: true,
    created,
    retained,
    skipped,
    actions,
    generatedAt: referenceDate.toISOString(),
  };
}
