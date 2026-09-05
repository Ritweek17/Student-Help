import React from 'react';
import { Badge } from './Badge';

export function StatusBadge({ status }) {
  if (!status) return null;

  const clean = String(status).toLowerCase().trim();

  const map = {
    // Application statuses
    applied: { variant: 'info', label: 'Applied' },
    interview: { variant: 'primary', label: 'Interview' },
    waiting: { variant: 'warning', label: 'Waiting' },
    selected: { variant: 'success', label: 'Selected 🎉' },
    rejected: { variant: 'danger', label: 'Rejected' },
    withdrawn: { variant: 'default', label: 'Withdrawn' },

    // Registration statuses
    registered: { variant: 'info', label: 'Registered' },
    attended: { variant: 'primary', label: 'Attended' },
    completed: { variant: 'success', label: 'Completed' },
    cancelled: { variant: 'danger', label: 'Cancelled' },

    // Fallbacks
    pending: { variant: 'warning', label: 'Pending' },
    in_progress: { variant: 'info', label: 'In Progress' }
  };

  const current = map[clean] || {
    variant: 'default',
    label: clean.charAt(0).toUpperCase() + clean.slice(1)
  };

  return <Badge variant={current.variant}>{current.label}</Badge>;
}
