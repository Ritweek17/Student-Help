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
import { MOCK_LEARNING_TRACKS } from '../data/demo/learningTracks';
import { MOCK_LEARNING_RESOURCES } from '../data/demo/learningResources';
import { MOCK_LEARNING_ITEMS, MOCK_RECOMMENDED_NEXT } from '../data/demo/learningItems';
import { MOCK_TODOS } from '../data/demo/todos';
import { MOCK_NOTES } from '../data/demo/notes';
import { MOCK_CALENDAR_EVENTS } from '../data/demo/calendarEvents';
import { MOCK_CODING_CONTESTS } from '../data/demo/codingContests';

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

// LEARNING MODULE SERVICES
export async function fetchLearningTracks() {
  await delay(120);
  return MOCK_LEARNING_TRACKS;
}

export async function fetchLearningTrackById(id) {
  await delay(100);
  const track = MOCK_LEARNING_TRACKS.find((t) => t.id === id);
  if (!track) throw new Error('Learning track not found');
  return track;
}

export async function fetchLearningResources(trackId) {
  await delay(100);
  if (!trackId) return MOCK_LEARNING_RESOURCES;
  return MOCK_LEARNING_RESOURCES.filter((r) => r.trackId === trackId);
}

export async function fetchLearningItems(trackId) {
  await delay(100);
  if (!trackId) return MOCK_LEARNING_ITEMS;
  return MOCK_LEARNING_ITEMS.filter((i) => i.trackId === trackId);
}

export async function fetchRecommendedNext() {
  await delay(100);
  return MOCK_RECOMMENDED_NEXT;
}

// TODOS SERVICE
export async function fetchTodos() {
  await delay(100);
  return MOCK_TODOS;
}

// NOTES SERVICE
export async function fetchNotes() {
  await delay(100);
  return MOCK_NOTES;
}

// CALENDAR EVENTS SERVICE
export async function fetchCalendarEvents() {
  await delay(120);
  return MOCK_CALENDAR_EVENTS;
}

// CODING CONTESTS SERVICE
export async function fetchCodingContests() {
  await delay(100);
  return MOCK_CODING_CONTESTS;
}
