import React from 'react';
import { Badge } from './Badge';

export function StatusBadge({ status }) {
  const map = {
    Applied: { variant: 'info', label: 'Applied' },
    Interview: { variant: 'primary', label: 'Interview' },
    Waiting: { variant: 'warning', label: 'Waiting' },
    Selected: { variant: 'success', label: 'Selected 🎉' },
    Rejected: { variant: 'danger', label: 'Rejected' },
    completed: { variant: 'success', label: 'Completed' },
    pending: { variant: 'warning', label: 'Pending' },
    in_progress: { variant: 'info', label: 'In Progress' }
  };

  const current = map[status] || { variant: 'default', label: status };

  return <Badge variant={current.variant}>{current.label}</Badge>;
}
