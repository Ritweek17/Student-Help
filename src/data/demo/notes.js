export const MOCK_NOTES = [
  {
    id: 'note-1',
    title: 'React 19 Hooks & Mental Model Cheatsheet',
    category: 'React',
    tags: ['React', 'Hooks', 'useEffect', 'State'],
    isPinned: true,
    createdDate: '2026-08-28',
    updatedDate: '2026-08-30',
    content: `Key takeaways for React 19 hooks:
- useState: Use for local component state that triggers re-render upon mutation.
- useEffect: Synchronize with external systems. Always return cleanup function for timers/subscriptions.
- useCallback: Memoize callback functions passed to optimized child components.
- useMemo: Cache heavy computation results until dependency array mutates.
- Custom Hooks: Extract reusable stateful logic starting with 'use' prefix.`
  },
  {
    id: 'note-2',
    title: 'Top 10 Frontend Technical Interview Questions',
    category: 'Interview',
    tags: ['Interview', 'Frontend', 'JavaScript', 'DOM'],
    isPinned: true,
    createdDate: '2026-08-25',
    updatedDate: '2026-08-29',
    content: `Must-know interview concepts:
1. Event Loop & Microtask Queue (Promises vs setTimeout execution order).
2. Debounce vs Throttle functions implementation.
3. CSS Box Model, Flexbox vs Grid alignment properties.
4. Web Vitals: LCP, INP, CLS optimization strategies.
5. Closures & Lexical Scoping in JavaScript.`
  },
  {
    id: 'note-3',
    title: 'Graph Traversal Algorithms Template (C++)',
    category: 'DSA',
    tags: ['C++', 'DSA', 'BFS', 'DFS', 'Graphs'],
    isPinned: false,
    createdDate: '2026-08-20',
    updatedDate: '2026-08-24',
    content: `BFS Uses Queue (Level order search, shortest path in unweighted graphs).
DFS Uses Stack/Recursion (Connected components, cycle detection, topological sort).`
  },
  {
    id: 'note-4',
    title: 'Express.js Security & Middleware Best Practices',
    category: 'Backend',
    tags: ['Node.js', 'Express', 'JWT', 'Security'],
    isPinned: false,
    createdDate: '2026-08-15',
    updatedDate: '2026-08-18',
    content: `Security essentials:
- Always sanitize input parameters using express-validator.
- Use helmet middleware to set HTTP headers.
- Store JWT tokens in HttpOnly samesite cookies.
- Implement rate limiting with express-rate-limit.`
  }
];
