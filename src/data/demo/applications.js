export const MOCK_APPLICATIONS = [
  {
    id: 'app-1',
    opportunityId: 'opp-1',
    organization: 'Vortex Labs',
    role: 'Frontend Developer Intern',
    appliedDate: '2026-08-26',
    deadline: '2026-09-02',
    status: 'Applied',
    stipend: '₹35,000 / mo',
    resumeUsed: 'Alex_Chen_Frontend_Resume.pdf',
    location: 'Remote',
    nextAction: 'Awaiting screening response',
    timeline: [
      { date: '2026-08-26', title: 'Application Submitted', completed: true },
      { date: 'Pending', title: 'Resume Screening', completed: false },
      { date: 'Pending', title: 'Technical Interview', completed: false },
      { date: 'Pending', title: 'Final Decision', completed: false }
    ]
  },
  {
    id: 'app-2',
    opportunityId: 'opp-5',
    organization: 'ScaleGrid Systems',
    role: 'Backend Engineering Intern',
    appliedDate: '2026-08-23',
    deadline: '2026-09-01',
    status: 'Interview',
    stipend: '₹40,000 / mo',
    resumeUsed: 'Alex_Chen_FullStack_Resume.pdf',
    location: 'Gurugram, HR',
    nextAction: 'Technical Interview on Sept 3, 3:00 PM IST',
    timeline: [
      { date: '2026-08-23', title: 'Application Submitted', completed: true },
      { date: '2026-08-27', title: 'Resume Screen Passed', completed: true },
      { date: '2026-09-03', title: 'Technical Interview', completed: false },
      { date: 'Pending', title: 'Final Decision', completed: false }
    ]
  },
  {
    id: 'app-3',
    opportunityId: 'opp-4',
    organization: 'OpenStack Foundation',
    role: 'Summer Open Source Fellow',
    appliedDate: '2026-08-16',
    deadline: '2026-09-15',
    status: 'Selected',
    stipend: '$3,000 Stipend',
    resumeUsed: 'Alex_Chen_OpenSource_CV.pdf',
    location: 'Remote (Worldwide)',
    nextAction: 'Complete onboarding documents by Sept 10',
    timeline: [
      { date: '2026-08-16', title: 'Application Submitted', completed: true },
      { date: '2026-08-21', title: 'Code Proposal Reviewed', completed: true },
      { date: '2026-08-28', title: 'Selection Confirmed 🎉', completed: true },
      { date: '2026-09-15', title: 'Program Start Date', completed: false }
    ]
  },
  {
    id: 'app-4',
    opportunityId: 'opp-7',
    organization: 'Supabase Ecosystem',
    role: 'Developer Experience Fellow',
    appliedDate: '2026-08-20',
    deadline: '2026-09-20',
    status: 'Waiting',
    stipend: '$1,500 Grant',
    resumeUsed: 'Alex_Chen_DevRel_Resume.pdf',
    location: 'Remote',
    nextAction: 'Under cohort review',
    timeline: [
      { date: '2026-08-20', title: 'Application Submitted', completed: true },
      { date: '2026-08-25', title: 'Initial Review', completed: true },
      { date: 'Pending', title: 'Cohort Selection', completed: false }
    ]
  },
  {
    id: 'app-5',
    opportunityId: 'opp-99',
    organization: 'CyberCloud Inc',
    role: 'DevOps Intern',
    appliedDate: '2026-08-01',
    deadline: '2026-08-15',
    status: 'Rejected',
    stipend: '₹25,000 / mo',
    resumeUsed: 'Alex_Chen_General_Resume.pdf',
    location: 'Hybrid',
    nextAction: 'Position closed',
    timeline: [
      { date: '2026-08-01', title: 'Application Submitted', completed: true },
      { date: '2026-08-14', title: 'Not Selected', completed: true }
    ]
  }
];
