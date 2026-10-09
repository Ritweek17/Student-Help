import mongoose from 'mongoose';
import { getOpportunityById } from '../opportunity.service.js';
import { getProfileForUser } from '../profile.service.js';
import { calculateOpportunityMatch } from './match.service.js';
import { Todo } from '../../models/Todo.js';
import { LearningTrack } from '../../models/LearningTrack.js';
import { LearningItem } from '../../models/LearningItem.js';
import { LearningResource } from '../../models/LearningResource.js';
import { CalendarEvent } from '../../models/CalendarEvent.js';
import { Notification } from '../../models/Notification.js';

/**
 * Staleness threshold in days for developer public repositories.
 */
export const STALE_REPO_DAYS_THRESHOLD = 180;

/**
 * Calculates deadline urgency and days remaining.
 * 
 * @param {Date|string|null} deadline - Target deadline
 * @param {Date} [referenceDate=new Date()] - Reference date
 * @returns {Object} Urgency descriptor
 */
export function calculateDeadlineUrgency(deadline, referenceDate = new Date()) {
  if (!deadline) {
    return {
      urgency: 'normal',
      daysRemaining: null,
      label: 'Flexible / Rolling',
      isExpired: false,
    };
  }

  const d = new Date(deadline);
  if (isNaN(d.getTime())) {
    return {
      urgency: 'normal',
      daysRemaining: null,
      label: 'Flexible / Rolling',
      isExpired: false,
    };
  }

  const diffMs = d.getTime() - referenceDate.getTime();
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (daysRemaining < 0) {
    return {
      urgency: 'expired',
      daysRemaining,
      label: 'Deadline Passed',
      isExpired: true,
    };
  }

  if (daysRemaining <= 7) {
    return {
      urgency: 'urgent',
      daysRemaining,
      label: `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left (Urgent)`,
      isExpired: false,
    };
  }

  if (daysRemaining <= 14) {
    return {
      urgency: 'moderate',
      daysRemaining,
      label: `${daysRemaining} days left`,
      isExpired: false,
    };
  }

  return {
    urgency: 'normal',
    daysRemaining,
    label: `${daysRemaining} days left`,
    isExpired: false,
  };
}

/**
 * Finds a matching learning track, item, and resource from the real catalog for a skill.
 * 
 * @param {Object} skill - Canonical skill descriptor
 * @param {Array<Object>} tracks - Available learning tracks
 * @param {Array<Object>} items - Available learning items
 * @param {Array<Object>} resources - Available learning resources
 * @returns {Object|null} Linked learning metadata or null
 */
export function findMatchingLearningResource(skill, tracks = [], items = [], resources = []) {
  if (!skill || !Array.isArray(tracks)) return null;

  const skillKey = (skill.canonicalKey || '').toLowerCase().trim();
  const displayName = (skill.displayName || '').toLowerCase().trim();

  // Search tracks by title, category, or description
  const matchingTrack = tracks.find((track) => {
    const title = (track.title || '').toLowerCase();
    const cat = (track.category || '').toLowerCase();
    const desc = (track.description || '').toLowerCase();

    return (
      title.includes(displayName) ||
      title.includes(skillKey) ||
      cat.includes(displayName) ||
      cat.includes(skillKey) ||
      desc.includes(displayName) ||
      desc.includes(skillKey)
    );
  });

  if (!matchingTrack) return null;

  // Search associated items in this track
  const trackItems = items.filter(
    (item) => String(item.trackId) === String(matchingTrack._id)
  );

  const matchingItem = trackItems.find((item) => {
    const iTitle = (item.title || '').toLowerCase();
    return iTitle.includes(displayName) || iTitle.includes(skillKey);
  }) || trackItems[0] || null;

  // Search associated resource
  const trackResources = resources.filter(
    (res) => String(res.trackId) === String(matchingTrack._id)
  );

  const matchingResource = trackResources[0] || null;

  return {
    trackId: matchingTrack._id,
    trackTitle: matchingTrack.title,
    trackCategory: matchingTrack.category,
    itemId: matchingItem ? matchingItem._id : null,
    itemTitle: matchingItem ? matchingItem.title : null,
    resourceId: matchingResource ? matchingResource._id : null,
    resourceUrl: matchingResource ? matchingResource.url : null,
    resourceTitle: matchingResource ? matchingResource.title : null,
  };
}

/**
 * Builds the deterministic preparation plan representation without side effects.
 * 
 * @param {Object} profile - User profile
 * @param {Object} opportunity - Opportunity document
 * @param {Object} [options] - Configuration & context
 * @param {Array<Object>} [options.tracks=[]] - Pre-fetched Learning tracks
 * @param {Array<Object>} [options.items=[]] - Pre-fetched Learning items
 * @param {Array<Object>} [options.resources=[]] - Pre-fetched Learning resources
 * @param {Array<Object>} [options.existingTodos=[]] - Pre-fetched user Todos
 * @returns {Object} Comprehensive preparation plan
 */
export function buildPreparationPlan(profile, opportunity, options = {}) {
  if (!opportunity) {
    throw new Error('Opportunity is required to build preparation plan');
  }

  const {
    tracks = [],
    items = [],
    resources = [],
    existingTodos = [],
    referenceDate = new Date(),
  } = options;

  // 1. Calculate deterministic match
  const match = calculateOpportunityMatch(profile, opportunity);
  const urgencyInfo = calculateDeadlineUrgency(opportunity.deadline, referenceDate);
  const oppIdStr = String(opportunity._id || opportunity.id);

  // 2. Index existing todos by their deterministic task tag
  // Pattern: [CareerOS Prep: <opportunityId>:<taskKey>]
  const existingTodoMap = new Map();
  const prepTagPrefix = `[CareerOS Prep: ${oppIdStr}:`;

  for (const todo of existingTodos) {
    if (todo.description && todo.description.includes(prepTagPrefix)) {
      const matchKey = todo.description.match(
        new RegExp(`\\[CareerOS Prep: ${oppIdStr}:([a-zA-Z0-9_:-]+)\\]`)
      );
      if (matchKey && matchKey[1]) {
        existingTodoMap.set(matchKey[1], todo);
      }
    }
  }

  const planTasks = [];

  // -------------------------------------------------------------
  // Task Group 1: Skill Gap Tasks
  // -------------------------------------------------------------
  for (const gap of match.skillGaps) {
    const taskKey = `gap:${gap.canonicalKey}`;
    const existing = existingTodoMap.get(taskKey);
    const learningLink = findMatchingLearningResource(gap, tracks, items, resources);

    let title = '';
    let description = '';

    if (learningLink) {
      title = `Study ${gap.displayName} (${learningLink.trackTitle})`;
      description = `Work through recommended learning curriculum for ${gap.displayName} required for ${opportunity.title}. Track: ${learningLink.trackTitle}. [CareerOS Prep: ${oppIdStr}:${taskKey}]`;
    } else {
      title = `Learn ${gap.displayName} fundamentals`;
      description = `Review core ${gap.displayName} documentation and practical usage required for ${opportunity.title}. [CareerOS Prep: ${oppIdStr}:${taskKey}]`;
    }

    let dueDate = null;
    if (opportunity.deadline && !urgencyInfo.isExpired) {
      const d = new Date(opportunity.deadline);
      // Set due date 3 days before deadline, or deadline itself
      dueDate = new Date(Math.max(referenceDate.getTime(), d.getTime() - 3 * 24 * 60 * 60 * 1000));
    }

    planTasks.push({
      taskKey,
      type: 'skill_gap',
      title,
      description,
      category: 'Learning',
      priority: urgencyInfo.urgency === 'urgent' ? 'High' : 'Medium',
      dueDate,
      skillKey: gap.canonicalKey,
      displayName: gap.displayName,
      learningLink,
      isExistingTodo: Boolean(existing),
      existingTodoId: existing ? existing._id : null,
      isCompleted: existing ? Boolean(existing.completed) : false,
    });
  }

  // -------------------------------------------------------------
  // Task Group 2: GitHub Repository Showcase & Refresh Tasks
  // -------------------------------------------------------------
  const githubSkills = (match.matchedSkills || []).filter(
    (s) => s.hasGitHubEvidence && s.githubEvidence?.topRepository
  );

  for (const gSkill of githubSkills) {
    const topRepo = gSkill.githubEvidence.topRepository;
    const repoSlug = (topRepo.name || '').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const showcaseKey = `github:showcase:${gSkill.canonicalKey}:${repoSlug}`;
    const existingShowcase = existingTodoMap.get(showcaseKey);

    planTasks.push({
      taskKey: showcaseKey,
      type: 'github_showcase',
      title: `Prepare ${gSkill.displayName} demo: Highlight ${topRepo.name} architecture for ${opportunity.title}`,
      description: `Review code quality, README, and architecture in ${topRepo.name} to demonstrate your practical ${gSkill.displayName} evidence to ${opportunity.organization}. [CareerOS Prep: ${oppIdStr}:${showcaseKey}]`,
      category: 'Project',
      priority: 'Medium',
      dueDate: opportunity.deadline ? new Date(opportunity.deadline) : null,
      skillKey: gSkill.canonicalKey,
      displayName: gSkill.displayName,
      repository: topRepo,
      learningLink: null,
      isExistingTodo: Boolean(existingShowcase),
      existingTodoId: existingShowcase ? existingShowcase._id : null,
      isCompleted: existingShowcase ? Boolean(existingShowcase.completed) : false,
    });

    // Check if repository is stale
    if (topRepo.updatedAt) {
      const updatedTime = new Date(topRepo.updatedAt).getTime();
      if (!isNaN(updatedTime)) {
        const daysSinceUpdate = (referenceDate.getTime() - updatedTime) / (1000 * 60 * 60 * 24);
        if (daysSinceUpdate > STALE_REPO_DAYS_THRESHOLD) {
          const refreshKey = `github:refresh:${gSkill.canonicalKey}`;
          const existingRefresh = existingTodoMap.get(refreshKey);

          planTasks.push({
            taskKey: refreshKey,
            type: 'github_refresh',
            title: `Update ${topRepo.name} repository: Refresh dependencies and documentation`,
            description: `Your repository ${topRepo.name} demonstrating ${gSkill.displayName} has not been updated in over ${Math.floor(daysSinceUpdate)} days. Refresh the README, dependencies, or tests before showcasing it for ${opportunity.organization}. [CareerOS Prep: ${oppIdStr}:${refreshKey}]`,
            category: 'Project',
            priority: 'Low',
            dueDate: opportunity.deadline ? new Date(opportunity.deadline) : null,
            skillKey: gSkill.canonicalKey,
            displayName: gSkill.displayName,
            repository: topRepo,
            learningLink: null,
            isExistingTodo: Boolean(existingRefresh),
            existingTodoId: existingRefresh ? existingRefresh._id : null,
            isCompleted: existingRefresh ? Boolean(existingRefresh.completed) : false,
          });
        }
      }
    }
  }

  // -------------------------------------------------------------
  // Task Group 3: Project Portfolio Review (if candidate has portfolio projects)
  // -------------------------------------------------------------
  const projectEvidenceItems = (match.evidence || []).filter(
    (e) => e.type === 'demonstrated' || e.type === 'demonstrated_and_claimed'
  );
  if (projectEvidenceItems.length > 0) {
    const taskKey = 'project:review';
    const existing = existingTodoMap.get(taskKey);
    const topSkills = projectEvidenceItems.map((e) => e.skill).slice(0, 3).join(', ');

    planTasks.push({
      taskKey,
      type: 'project_review',
      title: `Review portfolio project talking points for ${opportunity.organization}`,
      description: `Prepare live demos and code walk-throughs for your projects demonstrating ${topSkills}. [CareerOS Prep: ${oppIdStr}:${taskKey}]`,
      category: 'Project',
      priority: 'Medium',
      dueDate: opportunity.deadline ? new Date(opportunity.deadline) : null,
      learningLink: null,
      isExistingTodo: Boolean(existing),
      existingTodoId: existing ? existing._id : null,
      isCompleted: existing ? Boolean(existing.completed) : false,
    });
  }

  // -------------------------------------------------------------
  // Task Group 3: Application Submission Preparation
  // -------------------------------------------------------------
  {
    const taskKey = 'application:prepare';
    const existing = existingTodoMap.get(taskKey);

    planTasks.push({
      taskKey,
      type: 'application_prep',
      title: `Prepare and submit application for ${opportunity.title}`,
      description: `Tailor your resume, verify contact details, and complete application submission at ${opportunity.organization}. [CareerOS Prep: ${oppIdStr}:${taskKey}]`,
      category: 'Application',
      priority: 'High',
      dueDate: opportunity.deadline ? new Date(opportunity.deadline) : null,
      learningLink: null,
      isExistingTodo: Boolean(existing),
      existingTodoId: existing ? existing._id : null,
      isCompleted: existing ? Boolean(existing.completed) : false,
    });
  }

  // -------------------------------------------------------------
  // Task Group 4: Deadline Milestone (if future deadline exists)
  // -------------------------------------------------------------
  if (opportunity.deadline && !urgencyInfo.isExpired) {
    const taskKey = 'milestone:deadline';
    const existing = existingTodoMap.get(taskKey);

    planTasks.push({
      taskKey,
      type: 'deadline_milestone',
      title: `Application Deadline: ${opportunity.title}`,
      description: `Final deadline for submitting your candidate profile to ${opportunity.organization}. [CareerOS Prep: ${oppIdStr}:${taskKey}]`,
      category: 'Application',
      priority: 'High',
      dueDate: new Date(opportunity.deadline),
      learningLink: null,
      isExistingTodo: Boolean(existing),
      existingTodoId: existing ? existing._id : null,
      isCompleted: existing ? Boolean(existing.completed) : false,
    });
  }

  // Summary statistics
  const totalTasks = planTasks.length;
  const createdTasks = planTasks.filter((t) => t.isExistingTodo).length;
  const completedTasks = planTasks.filter((t) => t.isCompleted).length;
  const linkedLearningCount = planTasks.filter((t) => t.learningLink).length;

  let summary = '';
  if (match.skillGaps.length === 0) {
    summary = `You match all technical requirements! Focus on application readiness and portfolio review.`;
  } else if (urgencyInfo.urgency === 'urgent') {
    summary = `Urgent preparation recommended: ${match.skillGaps.length} skill gap${match.skillGaps.length > 1 ? 's' : ''} to address within ${urgencyInfo.daysRemaining} days.`;
  } else {
    summary = `Structured preparation plan: ${match.skillGaps.length} skill gap${match.skillGaps.length > 1 ? 's' : ''} identified with recommended learning actions.`;
  }

  return {
    opportunityId: opportunity._id,
    opportunityTitle: opportunity.title,
    organization: opportunity.organization,
    deadline: opportunity.deadline || null,
    urgency: urgencyInfo,
    fitScore: match.score,
    fitLevel: match.fitLevel,
    summary,
    stats: {
      totalTasks,
      createdTasks,
      completedTasks,
      pendingTasks: totalTasks - completedTasks,
      gapCount: match.skillGaps.length,
      linkedLearningCount,
    },
    tasks: planTasks,
  };
}

/**
 * Fetches the user's derived preparation plan for a specific opportunity.
 * 
 * @param {string} userId - Authenticated user ID
 * @param {string} opportunityId - Opportunity ID
 * @param {boolean} [isAdmin=false] - Whether user is admin
 * @returns {Promise<Object>} Derived preparation plan
 */
export async function getPreparationPlanForUser(userId, opportunityId, isAdmin = false) {
  if (!mongoose.Types.ObjectId.isValid(opportunityId)) {
    const error = new Error('Invalid opportunity ID');
    error.status = 400;
    throw error;
  }

  const opportunity = await getOpportunityById(opportunityId, isAdmin);
  if (!opportunity) {
    const error = new Error('Opportunity not found');
    error.status = 404;
    throw error;
  }

  const profile = (await getProfileForUser(userId)) || {
    userId,
    skills: [],
    projects: [],
    careerPreferences: {},
  };

  // Fetch real learning catalog
  const [tracks, items, resources, existingTodos] = await Promise.all([
    LearningTrack.find({ isActive: true }).lean(),
    LearningItem.find({}).lean(),
    LearningResource.find({}).lean(),
    Todo.find({
      userId,
      description: { $regex: `\\[CareerOS Prep: ${opportunityId}:` },
    }).lean(),
  ]);

  const plan = buildPreparationPlan(profile, opportunity, {
    tracks,
    items,
    resources,
    existingTodos,
  });

  return {
    opportunityId: opportunity._id,
    plan,
  };
}

/**
 * Executes preparation plan creation into existing Todo, CalendarEvent, and Notification systems.
 * 
 * Guarantees 100% IDEMPOTENCY:
 * - If a todo with the deterministic taskKey tag already exists, it is NOT recreated.
 * - Calendar event uses unique syncKey: opp_prep_deadline_<userId>_<oppId>.
 * - Notification uses unique notificationKey: prep_plan_<userId>_<oppId>.
 * 
 * @param {string} userId - Authenticated user ID
 * @param {string} opportunityId - Opportunity ID
 * @param {Object} [options={}] - Options (taskKeys, createCalendarEvent)
 * @param {boolean} [isAdmin=false] - Admin privilege flag
 * @returns {Promise<Object>} Execution result with created/existing counts
 */
export async function generatePreparationPlanTodos(
  userId,
  opportunityId,
  options = {},
  isAdmin = false
) {
  if (!mongoose.Types.ObjectId.isValid(opportunityId)) {
    const error = new Error('Invalid opportunity ID');
    error.status = 400;
    throw error;
  }

  const opportunity = await getOpportunityById(opportunityId, isAdmin);
  if (!opportunity) {
    const error = new Error('Opportunity not found');
    error.status = 404;
    throw error;
  }

  const profile = (await getProfileForUser(userId)) || {
    userId,
    skills: [],
    projects: [],
    careerPreferences: {},
  };

  // Fetch real catalog and existing todos
  const [tracks, items, resources, existingTodos] = await Promise.all([
    LearningTrack.find({ isActive: true }).lean(),
    LearningItem.find({}).lean(),
    LearningResource.find({}).lean(),
    Todo.find({
      userId,
      description: { $regex: `\\[CareerOS Prep: ${opportunityId}:` },
    }).lean(),
  ]);

  const plan = buildPreparationPlan(profile, opportunity, {
    tracks,
    items,
    resources,
    existingTodos,
  });

  // Filter tasks if specific taskKeys requested
  let tasksToProcess = plan.tasks;
  if (Array.isArray(options.taskKeys) && options.taskKeys.length > 0) {
    const requestedSet = new Set(options.taskKeys);
    tasksToProcess = plan.tasks.filter((t) => requestedSet.has(t.taskKey));
  }

  const createdTodos = [];
  const existingTodosRetained = [];

  for (const task of tasksToProcess) {
    if (task.isExistingTodo) {
      existingTodosRetained.push(task);
    } else {
      // Create fresh Todo using existing Todo model
      const created = await Todo.create({
        userId,
        title: task.title,
        description: task.description,
        priority: task.priority,
        category: task.category,
        dueDate: task.dueDate || null,
        completed: false,
      });

      createdTodos.push(created);
    }
  }

  // -------------------------------------------------------------
  // Optional Calendar Event (Idempotent via syncKey)
  // -------------------------------------------------------------
  let calendarEventCreated = false;
  if (
    options.createCalendarEvent !== false &&
    opportunity.deadline &&
    new Date(opportunity.deadline) > new Date()
  ) {
    const syncKey = `opp_prep_deadline_${userId}_${opportunityId}`;
    try {
      const existingEvent = await CalendarEvent.findOne({ userId, syncKey });
      if (!existingEvent) {
        await CalendarEvent.create({
          userId,
          opportunityId: opportunity._id,
          title: `${opportunity.title} Application Deadline`,
          description: `Application deadline milestone for ${opportunity.title} at ${opportunity.organization}.`,
          type: 'deadline',
          source: 'opportunity',
          startAt: opportunity.deadline,
          allDay: true,
          status: 'scheduled',
          syncKey,
        });
        calendarEventCreated = true;
      }
    } catch {
      // Ignore duplicate key race conditions safely
    }
  }

  // -------------------------------------------------------------
  // Notification (Idempotent via notificationKey)
  // -------------------------------------------------------------
  const notificationKey = `prep_plan_${userId}_${opportunityId}`;
  try {
    const existingNotif = await Notification.findOne({ userId, notificationKey });
    if (!existingNotif && createdTodos.length > 0) {
      await Notification.create({
        userId,
        opportunityId: opportunity._id,
        type: 'system',
        title: 'Preparation Plan Created',
        message: `Generated ${createdTodos.length} preparation action${createdTodos.length > 1 ? 's' : ''} for ${opportunity.title}.`,
        notificationKey,
      });
    }
  } catch {
    // Ignore duplicate notification gracefully
  }

  // Return fresh plan representation reflecting newly created todos
  const updatedTodos = await Todo.find({
    userId,
    description: { $regex: `\\[CareerOS Prep: ${opportunityId}:` },
  }).lean();

  const refreshedPlan = buildPreparationPlan(profile, opportunity, {
    tracks,
    items,
    resources,
    existingTodos: updatedTodos,
  });

  return {
    opportunityId: opportunity._id,
    createdCount: createdTodos.length,
    existingCount: existingTodosRetained.length,
    calendarEventCreated,
    plan: refreshedPlan,
  };
}
