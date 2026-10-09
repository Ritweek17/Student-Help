/**
 * Canonical Skills Dictionary for CareerOS Intelligence V1.
 * 
 * Defines standard canonical skill keys, authoritative display names,
 * technology categories, and verified aliases.
 * 
 * Rules:
 * - canonicalKey is always lowercase and uniquely identifies the technology.
 * - aliases are lowercase strings that unambiguously map to this canonical skill.
 * - Distinct technologies that share partial names (e.g. C vs C++, Java vs JavaScript,
 *   React vs React Native, SQL vs NoSQL) MUST NOT cross-alias each other.
 */

export const SKILL_CATEGORIES = {
  LANGUAGES: 'languages',
  FRONTEND: 'frontend',
  BACKEND: 'backend',
  MOBILE: 'mobile',
  DATABASE: 'database',
  DEVOPS: 'devops',
  DATA_AI: 'data_ai',
  FUNDAMENTALS: 'fundamentals',
  TOOLS: 'tools',
  OTHER: 'other',
};

export const CANONICAL_SKILLS = [
  // -------------------------------------------------------------
  // 1. Programming Languages
  // -------------------------------------------------------------
  {
    canonicalKey: 'javascript',
    displayName: 'JavaScript',
    category: SKILL_CATEGORIES.LANGUAGES,
    aliases: ['js', 'ecmascript', 'es6', 'es2015', 'javascript (es6+)'],
  },
  {
    canonicalKey: 'typescript',
    displayName: 'TypeScript',
    category: SKILL_CATEGORIES.LANGUAGES,
    aliases: ['ts'],
  },
  {
    canonicalKey: 'python',
    displayName: 'Python',
    category: SKILL_CATEGORIES.LANGUAGES,
    aliases: ['py', 'python3', 'python 3'],
  },
  {
    canonicalKey: 'java',
    displayName: 'Java',
    category: SKILL_CATEGORIES.LANGUAGES,
    aliases: ['core java', 'java se', 'java 8', 'java 11', 'java 17'],
  },
  {
    canonicalKey: 'c++',
    displayName: 'C++',
    category: SKILL_CATEGORIES.LANGUAGES,
    aliases: ['cpp', 'cplusplus', 'c plus plus'],
  },
  {
    canonicalKey: 'c',
    displayName: 'C',
    category: SKILL_CATEGORIES.LANGUAGES,
    aliases: ['c language', 'c lang'],
  },
  {
    canonicalKey: 'c#',
    displayName: 'C#',
    category: SKILL_CATEGORIES.LANGUAGES,
    aliases: ['csharp', 'c sharp'],
  },
  {
    canonicalKey: 'go',
    displayName: 'Go',
    category: SKILL_CATEGORIES.LANGUAGES,
    aliases: ['golang'],
  },
  {
    canonicalKey: 'rust',
    displayName: 'Rust',
    category: SKILL_CATEGORIES.LANGUAGES,
    aliases: ['rustlang'],
  },
  {
    canonicalKey: 'ruby',
    displayName: 'Ruby',
    category: SKILL_CATEGORIES.LANGUAGES,
    aliases: [],
  },
  {
    canonicalKey: 'php',
    displayName: 'PHP',
    category: SKILL_CATEGORIES.LANGUAGES,
    aliases: ['php7', 'php8'],
  },
  {
    canonicalKey: 'swift',
    displayName: 'Swift',
    category: SKILL_CATEGORIES.LANGUAGES,
    aliases: [],
  },
  {
    canonicalKey: 'kotlin',
    displayName: 'Kotlin',
    category: SKILL_CATEGORIES.LANGUAGES,
    aliases: [],
  },
  {
    canonicalKey: 'dart',
    displayName: 'Dart',
    category: SKILL_CATEGORIES.LANGUAGES,
    aliases: [],
  },
  {
    canonicalKey: 'sql',
    displayName: 'SQL',
    category: SKILL_CATEGORIES.LANGUAGES,
    aliases: ['structured query language', 'ansi sql'],
  },
  {
    canonicalKey: 'html',
    displayName: 'HTML',
    category: SKILL_CATEGORIES.LANGUAGES,
    aliases: ['html5', 'html 5'],
  },
  {
    canonicalKey: 'css',
    displayName: 'CSS',
    category: SKILL_CATEGORIES.LANGUAGES,
    aliases: ['css3', 'css 3'],
  },

  // -------------------------------------------------------------
  // 2. Frontend Frameworks & Libraries
  // -------------------------------------------------------------
  {
    canonicalKey: 'react',
    displayName: 'React',
    category: SKILL_CATEGORIES.FRONTEND,
    aliases: ['reactjs', 'react.js', 'react js'],
  },
  {
    canonicalKey: 'vue',
    displayName: 'Vue',
    category: SKILL_CATEGORIES.FRONTEND,
    aliases: ['vuejs', 'vue.js', 'vue js', 'vue 3', 'vue2'],
  },
  {
    canonicalKey: 'angular',
    displayName: 'Angular',
    category: SKILL_CATEGORIES.FRONTEND,
    aliases: ['angularjs', 'angular.js', 'angular 2+'],
  },
  {
    canonicalKey: 'next.js',
    displayName: 'Next.js',
    category: SKILL_CATEGORIES.FRONTEND,
    aliases: ['nextjs', 'next js', 'next'],
  },
  {
    canonicalKey: 'svelte',
    displayName: 'Svelte',
    category: SKILL_CATEGORIES.FRONTEND,
    aliases: ['sveltekit', 'svelte kit'],
  },
  {
    canonicalKey: 'tailwind',
    displayName: 'Tailwind CSS',
    category: SKILL_CATEGORIES.FRONTEND,
    aliases: ['tailwindcss', 'tailwind css', 'tailwind-css'],
  },
  {
    canonicalKey: 'bootstrap',
    displayName: 'Bootstrap',
    category: SKILL_CATEGORIES.FRONTEND,
    aliases: ['bootstrap 5', 'bootstrap 4', 'twitter bootstrap'],
  },
  {
    canonicalKey: 'redux',
    displayName: 'Redux',
    category: SKILL_CATEGORIES.FRONTEND,
    aliases: ['redux toolkit', 'rtk'],
  },

  // -------------------------------------------------------------
  // 3. Backend Frameworks & Runtimes
  // -------------------------------------------------------------
  {
    canonicalKey: 'node.js',
    displayName: 'Node.js',
    category: SKILL_CATEGORIES.BACKEND,
    aliases: ['nodejs', 'node', 'node js'],
  },
  {
    canonicalKey: 'express',
    displayName: 'Express',
    category: SKILL_CATEGORIES.BACKEND,
    aliases: ['expressjs', 'express.js', 'express js'],
  },
  {
    canonicalKey: 'django',
    displayName: 'Django',
    category: SKILL_CATEGORIES.BACKEND,
    aliases: ['django rest framework', 'drf'],
  },
  {
    canonicalKey: 'flask',
    displayName: 'Flask',
    category: SKILL_CATEGORIES.BACKEND,
    aliases: [],
  },
  {
    canonicalKey: 'fastapi',
    displayName: 'FastAPI',
    category: SKILL_CATEGORIES.BACKEND,
    aliases: ['fast api'],
  },
  {
    canonicalKey: 'spring boot',
    displayName: 'Spring Boot',
    category: SKILL_CATEGORIES.BACKEND,
    aliases: ['spring', 'springboot', 'spring framework'],
  },
  {
    canonicalKey: 'nest.js',
    displayName: 'NestJS',
    category: SKILL_CATEGORIES.BACKEND,
    aliases: ['nestjs', 'nest js', 'nest'],
  },
  {
    canonicalKey: 'graphql',
    displayName: 'GraphQL',
    category: SKILL_CATEGORIES.BACKEND,
    aliases: ['gql'],
  },
  {
    canonicalKey: 'rest api',
    displayName: 'REST API',
    category: SKILL_CATEGORIES.BACKEND,
    aliases: ['rest', 'restful', 'rest apis', 'restful apis', 'restful api'],
  },

  // -------------------------------------------------------------
  // 4. Mobile Development
  // -------------------------------------------------------------
  {
    canonicalKey: 'react native',
    displayName: 'React Native',
    category: SKILL_CATEGORIES.MOBILE,
    aliases: ['react-native', 'reactnative'],
  },
  {
    canonicalKey: 'flutter',
    displayName: 'Flutter',
    category: SKILL_CATEGORIES.MOBILE,
    aliases: [],
  },
  {
    canonicalKey: 'android',
    displayName: 'Android',
    category: SKILL_CATEGORIES.MOBILE,
    aliases: ['android dev', 'android development'],
  },
  {
    canonicalKey: 'ios',
    displayName: 'iOS',
    category: SKILL_CATEGORIES.MOBILE,
    aliases: ['ios dev', 'ios development'],
  },

  // -------------------------------------------------------------
  // 5. Databases & Storage
  // -------------------------------------------------------------
  {
    canonicalKey: 'mongodb',
    displayName: 'MongoDB',
    category: SKILL_CATEGORIES.DATABASE,
    aliases: ['mongo', 'mongo db'],
  },
  {
    canonicalKey: 'postgresql',
    displayName: 'PostgreSQL',
    category: SKILL_CATEGORIES.DATABASE,
    aliases: ['postgres', 'psql', 'postgre', 'postgresql db'],
  },
  {
    canonicalKey: 'mysql',
    displayName: 'MySQL',
    category: SKILL_CATEGORIES.DATABASE,
    aliases: ['my-sql'],
  },
  {
    canonicalKey: 'redis',
    displayName: 'Redis',
    category: SKILL_CATEGORIES.DATABASE,
    aliases: [],
  },
  {
    canonicalKey: 'sqlite',
    displayName: 'SQLite',
    category: SKILL_CATEGORIES.DATABASE,
    aliases: ['sqlite3'],
  },
  {
    canonicalKey: 'firebase',
    displayName: 'Firebase',
    category: SKILL_CATEGORIES.DATABASE,
    aliases: ['firestore', 'google firebase'],
  },
  {
    canonicalKey: 'nosql',
    displayName: 'NoSQL',
    category: SKILL_CATEGORIES.DATABASE,
    aliases: ['no-sql'],
  },

  // -------------------------------------------------------------
  // 6. DevOps, Cloud & Infrastructure
  // -------------------------------------------------------------
  {
    canonicalKey: 'docker',
    displayName: 'Docker',
    category: SKILL_CATEGORIES.DEVOPS,
    aliases: ['docker container', 'docker containers', 'containerization'],
  },
  {
    canonicalKey: 'kubernetes',
    displayName: 'Kubernetes',
    category: SKILL_CATEGORIES.DEVOPS,
    aliases: ['k8s'],
  },
  {
    canonicalKey: 'aws',
    displayName: 'AWS',
    category: SKILL_CATEGORIES.DEVOPS,
    aliases: ['amazon web services', 'amazon aws'],
  },
  {
    canonicalKey: 'gcp',
    displayName: 'GCP',
    category: SKILL_CATEGORIES.DEVOPS,
    aliases: ['google cloud', 'google cloud platform'],
  },
  {
    canonicalKey: 'azure',
    displayName: 'Azure',
    category: SKILL_CATEGORIES.DEVOPS,
    aliases: ['microsoft azure'],
  },
  {
    canonicalKey: 'git',
    displayName: 'Git',
    category: SKILL_CATEGORIES.TOOLS,
    aliases: [],
  },
  {
    canonicalKey: 'github',
    displayName: 'GitHub',
    category: SKILL_CATEGORIES.TOOLS,
    aliases: ['git & github', 'git/github', 'git and github'],
  },
  {
    canonicalKey: 'ci/cd',
    displayName: 'CI/CD',
    category: SKILL_CATEGORIES.DEVOPS,
    aliases: ['cicd', 'continuous integration', 'github actions', 'ci cd'],
  },
  {
    canonicalKey: 'linux',
    displayName: 'Linux',
    category: SKILL_CATEGORIES.DEVOPS,
    aliases: ['unix', 'bash', 'shell', 'shell scripting'],
  },

  // -------------------------------------------------------------
  // 7. Data Science, Machine Learning & AI
  // -------------------------------------------------------------
  {
    canonicalKey: 'machine learning',
    displayName: 'Machine Learning',
    category: SKILL_CATEGORIES.DATA_AI,
    aliases: ['ml'],
  },
  {
    canonicalKey: 'artificial intelligence',
    displayName: 'Artificial Intelligence',
    category: SKILL_CATEGORIES.DATA_AI,
    aliases: ['ai', 'ai/ml', 'aiml', 'ai & ml'],
  },
  {
    canonicalKey: 'deep learning',
    displayName: 'Deep Learning',
    category: SKILL_CATEGORIES.DATA_AI,
    aliases: ['dl'],
  },
  {
    canonicalKey: 'pytorch',
    displayName: 'PyTorch',
    category: SKILL_CATEGORIES.DATA_AI,
    aliases: ['torch'],
  },
  {
    canonicalKey: 'tensorflow',
    displayName: 'TensorFlow',
    category: SKILL_CATEGORIES.DATA_AI,
    aliases: ['tf'],
  },
  {
    canonicalKey: 'pandas',
    displayName: 'Pandas',
    category: SKILL_CATEGORIES.DATA_AI,
    aliases: [],
  },
  {
    canonicalKey: 'numpy',
    displayName: 'NumPy',
    category: SKILL_CATEGORIES.DATA_AI,
    aliases: [],
  },

  // -------------------------------------------------------------
  // 8. Core Computer Science Fundamentals
  // -------------------------------------------------------------
  {
    canonicalKey: 'dsa',
    displayName: 'Data Structures & Algorithms',
    category: SKILL_CATEGORIES.FUNDAMENTALS,
    aliases: [
      'data structures',
      'algorithms',
      'algorithm design',
      'data structures & algorithms',
      'data structures and algorithms',
      'problem solving',
      'competitive programming',
    ],
  },
  {
    canonicalKey: 'system design',
    displayName: 'System Design',
    category: SKILL_CATEGORIES.FUNDAMENTALS,
    aliases: ['distributed systems', 'low level design', 'high level design', 'lld', 'hld'],
  },
  {
    canonicalKey: 'oop',
    displayName: 'OOP',
    category: SKILL_CATEGORIES.FUNDAMENTALS,
    aliases: ['oops', 'object-oriented programming', 'object oriented programming'],
  },
  {
    canonicalKey: 'dbms',
    displayName: 'DBMS',
    category: SKILL_CATEGORIES.FUNDAMENTALS,
    aliases: ['database management', 'database management systems'],
  },
  {
    canonicalKey: 'operating systems',
    displayName: 'Operating Systems',
    category: SKILL_CATEGORIES.FUNDAMENTALS,
    aliases: ['os'],
  },
  {
    canonicalKey: 'computer networks',
    displayName: 'Computer Networks',
    category: SKILL_CATEGORIES.FUNDAMENTALS,
    aliases: ['networking', 'cn', 'computer networking'],
  },
];
