export const MOCK_STUDENT_PROFILE = {
  personal: {
    fullName: 'Alex Chen',
    tagline: 'Undergraduate Computer Science Student & Full-Stack Builder',
    email: 'alex.chen.demo@university.edu',
    phone: '+1 (555) 019-2834',
    location: 'Bengaluru, India',
    bio: 'Passionate about building intuitive web applications, open-source software, and mastering algorithm design. Seeking summer 2026 software engineering internships.',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256'
  },
  education: {
    institution: 'Apex Institute of Technology',
    degree: 'Bachelor of Technology (B.Tech)',
    branch: 'Computer Science & Engineering',
    currentYear: '3rd Year',
    graduationYear: '2027',
    cgpa: '8.8 / 10.0'
  },
  skills: [
    { name: 'JavaScript', category: 'Languages', level: 'Advanced' },
    { name: 'TypeScript', category: 'Languages', level: 'Intermediate' },
    { name: 'C++', category: 'Languages', level: 'Advanced' },
    { name: 'Python', category: 'Languages', level: 'Intermediate' },
    { name: 'React', category: 'Frontend', level: 'Advanced' },
    { name: 'Tailwind CSS', category: 'Frontend', level: 'Advanced' },
    { name: 'Node.js', category: 'Backend', level: 'Intermediate' },
    { name: 'Express', category: 'Backend', level: 'Intermediate' },
    { name: 'MongoDB', category: 'Database', level: 'Intermediate' },
    { name: 'Git & GitHub', category: 'Tools', level: 'Advanced' },
    { name: 'Docker', category: 'DevOps', level: 'Beginner' }
  ],
  projects: [
    {
      id: 'proj-1',
      title: 'DevSync - Collaborative Markdown Editor',
      description: 'Real-time collaborative text editor supporting live preview, custom syntax highlighting, and WebSocket synchronization.',
      techStack: ['React', 'Node.js', 'Socket.io', 'Tailwind CSS'],
      github: 'https://github.com/demo-alex/devsync',
      liveUrl: 'https://devsync-demo.vercel.app'
    },
    {
      id: 'proj-2',
      title: 'AlgoVisualizer',
      description: 'Interactive web application visualizing Sorting, Pathfinding, and Graph algorithms with adjustable speed controls.',
      techStack: ['React', 'TypeScript', 'Canvas API'],
      github: 'https://github.com/demo-alex/algovisualizer',
      liveUrl: 'https://algovisualizer-demo.vercel.app'
    }
  ],
  experience: [
    {
      id: 'exp-1',
      role: 'Open Source Fellow',
      organization: 'OpenStack Community',
      duration: 'Jun 2025 - Aug 2025',
      location: 'Remote',
      description: 'Contributed 12 PRs to core developer tools, resolved 5 critical bugs, and improved documentation for incoming student contributors.'
    }
  ],
  certifications: [
    {
      id: 'cert-1',
      title: 'AWS Certified Cloud Practitioner',
      issuer: 'Amazon Web Services',
      issueDate: 'May 2025',
      credentialId: 'AWS-DEMO-994821'
    },
    {
      id: 'cert-2',
      title: 'Meta Frontend Developer Professional Certificate',
      issuer: 'Coursera / Meta',
      issueDate: 'Feb 2025',
      credentialId: 'META-FE-77102'
    }
  ],
  achievements: [
    {
      id: 'ach-1',
      title: 'Winner - National Campus Hackathon 2025',
      description: 'Awarded 1st place among 120 teams for building an accessible AI study notes generator.'
    },
    {
      id: 'ach-2',
      title: 'Knight Badge (LeetCode)',
      description: 'Achieved top 5% contest rating (1,850+ rating) with 450+ solved problems.'
    }
  ],
  socialLinks: {
    github: 'https://github.com/alex-chen-demo',
    linkedin: 'https://linkedin.com/in/alex-chen-demo',
    portfolio: 'https://alexchen-portfolio-demo.dev',
    leetcode: 'https://leetcode.com/alexchen_demo',
    codechef: 'https://codechef.com/users/alexchen_demo'
  },
  documents: [
    {
      id: 'doc-1',
      name: 'Alex_Chen_Software_Engineering_Resume_2026.pdf',
      size: '184 KB',
      uploadedDate: '2026-08-20',
      type: 'Primary Resume'
    },
    {
      id: 'doc-2',
      name: 'BTech_Semester_5_Transcript.pdf',
      size: '420 KB',
      uploadedDate: '2026-08-10',
      type: 'Academic Transcript'
    }
  ],
  preferences: {
    opportunityTypes: ['Internship', 'Hackathon', 'Open Source', 'Fellowship'],
    workModes: ['Remote', 'Hybrid'],
    preferredLocations: ['Bengaluru', 'Gurugram', 'Remote (Worldwide)'],
    relocation: true
  }
};
