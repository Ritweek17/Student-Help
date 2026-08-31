export const MOCK_LEARNING_ITEMS = [
  // Track 2: React
  {
    id: 'item-2-1',
    trackId: 'track-2',
    resourceId: 'res-1',
    title: '01. Introduction to React & Virtual DOM',
    duration: '22 min',
    status: 'Mastered',
    order: 1
  },
  {
    id: 'item-2-2',
    trackId: 'track-2',
    resourceId: 'res-1',
    title: '02. JSX Syntax & Fragment Conventions',
    duration: '18 min',
    status: 'Completed',
    order: 2
  },
  {
    id: 'item-2-3',
    trackId: 'track-2',
    resourceId: 'res-1',
    title: '03. Component Architecture & Props',
    duration: '30 min',
    status: 'Practiced',
    order: 3
  },
  {
    id: 'item-2-4',
    trackId: 'track-2',
    resourceId: 'res-1',
    title: '04. State Management with useState Hook',
    duration: '35 min',
    status: 'Practiced',
    order: 4
  },
  {
    id: 'item-2-5',
    trackId: 'track-2',
    resourceId: 'res-1',
    title: '05. Side Effects & useEffect Hook Deep Dive',
    duration: '40 min',
    status: 'Learning',
    order: 5
  },
  {
    id: 'item-2-6',
    trackId: 'track-2',
    resourceId: 'res-1',
    title: '06. Context API for Global Theme State',
    duration: '28 min',
    status: 'Not Started',
    order: 6
  },
  {
    id: 'item-2-7',
    trackId: 'track-2',
    resourceId: 'res-1',
    title: '07. React Router v7 Navigation & Layouts',
    duration: '45 min',
    status: 'Not Started',
    order: 7
  },

  // Track 1: DSA
  {
    id: 'item-1-1',
    trackId: 'track-1',
    resourceId: 'res-3',
    title: 'Arrays & Two Pointers Problem Set',
    duration: '120 min',
    status: 'Mastered',
    order: 1
  },
  {
    id: 'item-1-2',
    trackId: 'track-1',
    resourceId: 'res-3',
    title: 'Binary Search & Monotonic Stack',
    duration: '90 min',
    status: 'Completed',
    order: 2
  },
  {
    id: 'item-1-3',
    trackId: 'track-1',
    resourceId: 'res-3',
    title: 'Binary Tree Traversal (DFS & BFS)',
    duration: '110 min',
    status: 'Practiced',
    order: 3
  },
  {
    id: 'item-1-4',
    trackId: 'track-1',
    resourceId: 'res-3',
    title: 'Dynamic Programming 1D & 2D Memoization',
    duration: '150 min',
    status: 'Learning',
    order: 4
  }
];

export const MOCK_RECOMMENDED_NEXT = [
  {
    title: 'useEffect & Cleanup Functions',
    track: 'React 19 & Modern Frontend',
    reason: 'Prerequisite for API Integration & Socket listeners',
    estTime: '40 min'
  },
  {
    title: 'Graph Traversal (BFS / DFS)',
    track: 'Data Structures & Algorithms',
    reason: 'Unlocks 25+ LeetCode Medium graph problems',
    estTime: '90 min'
  },
  {
    title: 'Express Middleware Chain Architecture',
    track: 'Node.js & Backend Engineering',
    reason: 'Required before implementing JWT authentication handlers',
    estTime: '45 min'
  }
];
