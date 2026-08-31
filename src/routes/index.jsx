import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Layouts
import { AppLayout } from '../layouts/AppLayout';
import { AuthLayout } from '../layouts/AuthLayout';

// Public Pages
import { LandingPage } from '../pages/Landing';
import { LoginPage } from '../pages/Login';
import { SignupPage } from '../pages/Signup';
import { OnboardingPage } from '../pages/Onboarding';

// Authenticated Pages
import { DashboardPage } from '../pages/Dashboard';
import { OpportunitiesPage } from '../pages/Opportunities';
import { OpportunityDetailPage } from '../pages/OpportunityDetail';
import { SavedPage } from '../pages/Saved';
import { ApplicationsPage } from '../pages/Applications';
import { ProfilePage } from '../pages/Profile';
import { LearningPage } from '../pages/Learning';
import { LearningDetailPage } from '../pages/LearningDetail';
import { TrackerPage } from '../pages/Tracker';
import { TodosPage } from '../pages/Todos';
import { NotesPage } from '../pages/Notes';
import { GoalsPage } from '../pages/Goals';
import { CalendarPage } from '../pages/Calendar';
import { ContestsPage } from '../pages/Contests';
import { NotificationsPage } from '../pages/Notifications';
import { SettingsPage } from '../pages/Settings';
import { NotFoundPage } from '../pages/NotFound';

export function AppRoutes() {
  return (
    <Routes>
      {/* Landing Page */}
      <Route path="/" element={<LandingPage />} />

      {/* Auth & Onboarding Flow */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
      </Route>

      {/* Authenticated App Shell */}
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/opportunities" element={<OpportunitiesPage />} />
        <Route path="/opportunities/:id" element={<OpportunityDetailPage />} />
        <Route path="/saved" element={<SavedPage />} />
        <Route path="/applications" element={<ApplicationsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/learning" element={<LearningPage />} />
        <Route path="/learning/:id" element={<LearningDetailPage />} />
        <Route path="/tracker" element={<TrackerPage />} />
        <Route path="/todos" element={<TodosPage />} />
        <Route path="/notes" element={<NotesPage />} />
        <Route path="/goals" element={<GoalsPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/contests" element={<ContestsPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      {/* 404 & Fallback */}
      <Route path="/404" element={<NotFoundPage />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
}
