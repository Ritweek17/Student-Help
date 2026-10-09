/**
 * CareerOS Service Abstraction Layer
 * Pure async data access functions wrapping isolated mock datasets in src/data/demo/
 * In Phase 2, these functions can be swapped directly with Express/Node REST endpoints.
 */

import { MOCK_OPPORTUNITIES } from '../data/demo/opportunities';
import { MOCK_NOTIFICATIONS } from '../data/demo/notifications';
import { MOCK_APPLICATIONS } from '../data/demo/applications';
import { MOCK_DAILY_TASKS, MOCK_WEEKLY_ACTIVITY } from '../data/demo/tasks';
import { MOCK_STUDENT_PROFILE } from '../data/demo/profile';
import { MOCK_GOALS } from '../data/demo/goals';
import { MOCK_TODOS } from '../data/demo/todos';

import { MOCK_CALENDAR_EVENTS } from '../data/demo/calendarEvents';

const delay = (ms = 100) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchOpportunities(filters = {}) {
  await delay(120);
  let result = [...MOCK_OPPORTUNITIES];

  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.organization.toLowerCase().includes(q) ||
        item.skills.some((s) => s.toLowerCase().includes(q))
    );
  }

  if (filters.category && filters.category !== 'All') {
    result = result.filter((item) => item.category === filters.category);
  }

  if (filters.workMode && filters.workMode !== 'All') {
    result = result.filter((item) => item.workMode === filters.workMode);
  }

  return result;
}

export async function fetchOpportunityById(id) {
  await delay(100);
  const found = MOCK_OPPORTUNITIES.find((item) => item.id === id);
  if (!found) throw new Error('Opportunity not found');
  return found;
}

export async function fetchSavedOpportunities() {
  await delay(100);
  return MOCK_OPPORTUNITIES.filter((item) => item.isSaved);
}

export async function fetchApplications() {
  await delay(100);
  return MOCK_APPLICATIONS;
}

export async function fetchDailyTasks() {
  await delay(100);
  return MOCK_DAILY_TASKS;
}

export async function fetchWeeklyActivity() {
  await delay(100);
  return MOCK_WEEKLY_ACTIVITY;
}

export async function fetchStudentProfile() {
  await delay(100);
  return MOCK_STUDENT_PROFILE;
}

export async function fetchGoals() {
  await delay(100);
  return MOCK_GOALS;
}

export async function fetchNotifications(category = 'ALL') {
  await delay(100);
  if (category === 'ALL') return MOCK_NOTIFICATIONS;
  return MOCK_NOTIFICATIONS.filter((n) => n.category === category);
}

// TODOS SERVICE
export async function fetchTodos() {
  await delay(100);
  return MOCK_TODOS;
}


// CALENDAR EVENTS SERVICE
export async function fetchCalendarEvents() {
  await delay(120);
  return MOCK_CALENDAR_EVENTS;
}

