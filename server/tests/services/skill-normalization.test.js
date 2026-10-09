import { describe, it, expect } from 'vitest';
import {
  cleanRawSkillString,
  resolveSkillAlias,
  normalizeSkill,
  normalizeSkills,
  extractCanonicalKeys,
  compareSkills,
  getCanonicalSkill,
  isKnownSkill,
  normalizeProfileSkills,
  normalizeProjectTechnologies,
  normalizeOpportunitySkills,
  getProfileCanonicalSkills,
  getProfileSkillEvidence,
} from '../../src/services/intelligence/skill-normalization.service.js';
import { SKILL_CATEGORIES } from '../../src/services/intelligence/canonical-skills.data.js';

describe('CareerOS Skill Intelligence Normalization Service Test Suite', () => {
  // =========================================================================
  // 1. Empty / Null / Edge Case Handling
  // =========================================================================
  describe('1. Empty / Null / Invalid Input Handling', () => {
    it('safely handles null, undefined, empty strings, and whitespace', () => {
      expect(cleanRawSkillString(null)).toBe('');
      expect(cleanRawSkillString(undefined)).toBe('');
      expect(cleanRawSkillString('')).toBe('');
      expect(cleanRawSkillString('   ')).toBe('');

      expect(resolveSkillAlias(null)).toBeNull();
      expect(resolveSkillAlias(undefined)).toBeNull();
      expect(resolveSkillAlias('')).toBeNull();
      expect(resolveSkillAlias('   ')).toBeNull();

      expect(normalizeSkill(null)).toBeNull();
      expect(normalizeSkill(undefined)).toBeNull();
      expect(normalizeSkill('')).toBeNull();
      expect(normalizeSkill({})).toBeNull();
      expect(normalizeSkill({ name: '' })).toBeNull();

      expect(normalizeSkills(null)).toEqual([]);
      expect(normalizeSkills(undefined)).toEqual([]);
      expect(normalizeSkills([])).toEqual([]);
      expect(normalizeSkills([null, '', '   ', undefined])).toEqual([]);
    });
  });

  // =========================================================================
  // 2. Whitespace & Punctuation Normalization
  // =========================================================================
  describe('2. Whitespace & Punctuation Normalization', () => {
    it('trims leading/trailing whitespace and collapses internal multiple spaces', () => {
      expect(cleanRawSkillString('   react   ')).toBe('react');
      expect(cleanRawSkillString('react    native')).toBe('react native');
      expect(cleanRawSkillString('  node   .   js  ')).toBe('node . js');
    });

    it('strips leading bullets, hyphens, asterisks, and outer quotes without damaging keywords', () => {
      expect(cleanRawSkillString('• React')).toBe('react');
      expect(cleanRawSkillString('- Python')).toBe('python');
      expect(cleanRawSkillString('* Docker')).toBe('docker');
      expect(cleanRawSkillString('"TypeScript"')).toBe('typescript');
      expect(cleanRawSkillString("'GraphQL'")).toBe('graphql');
      expect(cleanRawSkillString('1) JavaScript')).toBe('javascript');
    });

    it('preserves essential programming symbols (+, #, ., /)', () => {
      expect(cleanRawSkillString('C++')).toBe('c++');
      expect(cleanRawSkillString('C#')).toBe('c#');
      expect(cleanRawSkillString('Node.js')).toBe('node.js');
      expect(cleanRawSkillString('CI/CD')).toBe('ci/cd');
      expect(cleanRawSkillString('.NET')).toBe('.net');
    });
  });

  // =========================================================================
  // 3. Lowercase Matching & Stability
  // =========================================================================
  describe('3. Lowercase Matching & Canonical Key Stability', () => {
    it('normalizes uppercase, mixed case, and lower case to identical canonical keys', () => {
      expect(resolveSkillAlias('PYTHON').canonicalKey).toBe('python');
      expect(resolveSkillAlias('Python').canonicalKey).toBe('python');
      expect(resolveSkillAlias('python').canonicalKey).toBe('python');
      expect(resolveSkillAlias('pYtHoN').canonicalKey).toBe('python');
    });

    it('retains authoritative display name regardless of raw casing', () => {
      expect(resolveSkillAlias('PYTHON').displayName).toBe('Python');
      expect(resolveSkillAlias('c++').displayName).toBe('C++');
      expect(resolveSkillAlias('JAVASCRIPT').displayName).toBe('JavaScript');
      expect(resolveSkillAlias('docker').displayName).toBe('Docker');
    });
  });

  // =========================================================================
  // 4. Duplicate Removal & Proficiency Conflict Resolution
  // =========================================================================
  describe('4. Duplicate Removal & Proficiency Conflict Resolution', () => {
    it('removes duplicate equivalent skills in arrays', () => {
      const skills = ['React', 'reactjs', 'React.js', 'react'];
      const keys = extractCanonicalKeys(skills);
      expect(keys).toEqual(['react']);
    });

    it('preserves higher proficiency level when duplicate skills are provided with different levels', () => {
      const inputs = [
        { name: 'React', level: 'beginner' },
        { name: 'reactjs', level: 'advanced' },
        { name: 'React.js', level: 'intermediate' },
      ];

      const normalized = normalizeSkills(inputs);
      expect(normalized).toHaveLength(1);
      expect(normalized[0].canonicalKey).toBe('react');
      expect(normalized[0].level).toBe('advanced');
    });

    it('preserves first level if duplicate skills have same rank', () => {
      const inputs = [
        { name: 'TypeScript', level: 'intermediate' },
        { name: 'ts', level: 'intermediate' },
      ];

      const normalized = normalizeSkills(inputs);
      expect(normalized).toHaveLength(1);
      expect(normalized[0].canonicalKey).toBe('typescript');
      expect(normalized[0].level).toBe('intermediate');
    });
  });

  // =========================================================================
  // 5. Specific Verified Tech Alias Categories
  // =========================================================================
  describe('5. Verified Tech Alias Categories', () => {
    it('resolves React aliases (react, reactjs, react.js, react js)', () => {
      const aliases = ['react', 'ReactJS', 'react.js', 'React JS', 'REACT'];
      aliases.forEach((alias) => {
        const res = resolveSkillAlias(alias);
        expect(res.canonicalKey).toBe('react');
        expect(res.displayName).toBe('React');
        expect(res.category).toBe(SKILL_CATEGORIES.FRONTEND);
      });
    });

    it('resolves Node.js aliases (node, nodejs, node.js, node js)', () => {
      const aliases = ['node', 'NodeJS', 'node.js', 'node js', 'Node.JS'];
      aliases.forEach((alias) => {
        const res = resolveSkillAlias(alias);
        expect(res.canonicalKey).toBe('node.js');
        expect(res.displayName).toBe('Node.js');
        expect(res.category).toBe(SKILL_CATEGORIES.BACKEND);
      });
    });

    it('resolves JavaScript aliases (javascript, js, ecmascript, es6)', () => {
      const aliases = ['javascript', 'JS', 'EcmaScript', 'es6', 'es2015'];
      aliases.forEach((alias) => {
        const res = resolveSkillAlias(alias);
        expect(res.canonicalKey).toBe('javascript');
        expect(res.displayName).toBe('JavaScript');
        expect(res.category).toBe(SKILL_CATEGORIES.LANGUAGES);
      });
    });

    it('resolves TypeScript aliases (typescript, ts)', () => {
      expect(resolveSkillAlias('TypeScript').canonicalKey).toBe('typescript');
      expect(resolveSkillAlias('ts').canonicalKey).toBe('typescript');
      expect(resolveSkillAlias('TS').displayName).toBe('TypeScript');
    });

    it('resolves MongoDB aliases (mongo, mongodb, mongo db)', () => {
      const aliases = ['mongo', 'MongoDB', 'mongo db', 'mongodb'];
      aliases.forEach((alias) => {
        const res = resolveSkillAlias(alias);
        expect(res.canonicalKey).toBe('mongodb');
        expect(res.displayName).toBe('MongoDB');
        expect(res.category).toBe(SKILL_CATEGORIES.DATABASE);
      });
    });

    it('resolves PostgreSQL aliases (postgres, psql, postgre, postgresql)', () => {
      const aliases = ['postgres', 'psql', 'PostgreSQL', 'postgre'];
      aliases.forEach((alias) => {
        const res = resolveSkillAlias(alias);
        expect(res.canonicalKey).toBe('postgresql');
        expect(res.displayName).toBe('PostgreSQL');
      });
    });

    it('resolves C++ aliases (cpp, cplusplus, c plus plus)', () => {
      const aliases = ['c++', 'cpp', 'Cplusplus', 'c plus plus'];
      aliases.forEach((alias) => {
        const res = resolveSkillAlias(alias);
        expect(res.canonicalKey).toBe('c++');
        expect(res.displayName).toBe('C++');
      });
    });

    it('resolves Golang aliases (go, golang)', () => {
      expect(resolveSkillAlias('go').canonicalKey).toBe('go');
      expect(resolveSkillAlias('golang').canonicalKey).toBe('go');
      expect(resolveSkillAlias('Golang').displayName).toBe('Go');
    });

    it('resolves Tailwind CSS aliases (tailwindcss, tailwind css, tailwind-css)', () => {
      const aliases = ['tailwind', 'tailwindcss', 'Tailwind CSS', 'tailwind-css'];
      aliases.forEach((alias) => {
        const res = resolveSkillAlias(alias);
        expect(res.canonicalKey).toBe('tailwind');
        expect(res.displayName).toBe('Tailwind CSS');
      });
    });

    it('resolves DSA aliases (dsa, data structures, algorithms, problem solving)', () => {
      const aliases = ['dsa', 'Data Structures', 'algorithms', 'data structures & algorithms'];
      aliases.forEach((alias) => {
        const res = resolveSkillAlias(alias);
        expect(res.canonicalKey).toBe('dsa');
        expect(res.displayName).toBe('Data Structures & Algorithms');
        expect(res.category).toBe(SKILL_CATEGORIES.FUNDAMENTALS);
      });
    });
  });

  // =========================================================================
  // 6. False-Positive Protections (Crucial Boundary Guards)
  // =========================================================================
  describe('6. False-Positive Protections', () => {
    it('strictly separates C from C++', () => {
      const cRes = resolveSkillAlias('C');
      const cppRes = resolveSkillAlias('C++');

      expect(cRes.canonicalKey).toBe('c');
      expect(cppRes.canonicalKey).toBe('c++');
      expect(cRes.canonicalKey).not.toBe(cppRes.canonicalKey);
      expect(compareSkills('C', 'C++')).toBe(false);
      expect(compareSkills('C', 'cpp')).toBe(false);
    });

    it('strictly separates Java from JavaScript', () => {
      const javaRes = resolveSkillAlias('Java');
      const jsRes = resolveSkillAlias('JavaScript');

      expect(javaRes.canonicalKey).toBe('java');
      expect(jsRes.canonicalKey).toBe('javascript');
      expect(javaRes.canonicalKey).not.toBe(jsRes.canonicalKey);
      expect(compareSkills('Java', 'JavaScript')).toBe(false);
      expect(compareSkills('core java', 'js')).toBe(false);
    });

    it('strictly separates SQL from NoSQL', () => {
      const sqlRes = resolveSkillAlias('SQL');
      const nosqlRes = resolveSkillAlias('NoSQL');

      expect(sqlRes.canonicalKey).toBe('sql');
      expect(nosqlRes.canonicalKey).toBe('nosql');
      expect(sqlRes.canonicalKey).not.toBe(nosqlRes.canonicalKey);
      expect(compareSkills('SQL', 'NoSQL')).toBe(false);
    });

    it('strictly separates React from React Native', () => {
      const reactRes = resolveSkillAlias('React');
      const rnRes = resolveSkillAlias('React Native');

      expect(reactRes.canonicalKey).toBe('react');
      expect(rnRes.canonicalKey).toBe('react native');
      expect(reactRes.canonicalKey).not.toBe(rnRes.canonicalKey);
      expect(compareSkills('React', 'React Native')).toBe(false);
      expect(compareSkills('reactjs', 'react-native')).toBe(false);
    });
  });

  // =========================================================================
  // 7. Unrecognized & Emerging Technologies Fallback
  // =========================================================================
  describe('7. Unrecognized & Novel Technologies Fallback', () => {
    it('gracefully normalizes unknown technologies without dropping data', () => {
      const res = resolveSkillAlias('Solidity');
      expect(res.canonicalKey).toBe('solidity');
      expect(res.displayName).toBe('Solidity');
      expect(res.isRecognized).toBe(false);
      expect(res.category).toBe(SKILL_CATEGORIES.OTHER);
    });

    it('formats short unknown acronyms in uppercase for display', () => {
      const res = resolveSkillAlias('zkp');
      expect(res.canonicalKey).toBe('zkp');
      expect(res.displayName).toBe('ZKP');
      expect(res.isRecognized).toBe(false);
    });

    it('correctly reports isKnownSkill status', () => {
      expect(isKnownSkill('React')).toBe(true);
      expect(isKnownSkill('react.js')).toBe(true);
      expect(isKnownSkill('SomeUnknownCustomTech123')).toBe(false);
    });
  });

  // =========================================================================
  // 8. Skill Comparison (compareSkills)
  // =========================================================================
  describe('8. Skill Comparison', () => {
    it('returns true for equivalent skill aliases', () => {
      expect(compareSkills('ReactJS', 'react')).toBe(true);
      expect(compareSkills('Node.js', 'nodejs')).toBe(true);
      expect(compareSkills('cpp', 'C++')).toBe(true);
      expect(compareSkills('K8s', 'Kubernetes')).toBe(true);
      expect(compareSkills('golang', 'Go')).toBe(true);
      expect(compareSkills('PostgreSQL', 'psql')).toBe(true);
    });

    it('returns false for distinct skills', () => {
      expect(compareSkills('React', 'Vue')).toBe(false);
      expect(compareSkills('Python', 'Java')).toBe(false);
      expect(compareSkills('Docker', 'Kubernetes')).toBe(false);
    });

    it('handles skill objects with levels seamlessly', () => {
      const skill1 = { name: 'ReactJS', level: 'advanced' };
      const skill2 = { name: 'react', level: 'beginner' };
      expect(compareSkills(skill1, skill2)).toBe(true);
    });
  });

  // =========================================================================
  // 9. Profile Skill Normalization (normalizeProfileSkills)
  // =========================================================================
  describe('9. Profile Skill Normalization', () => {
    it('normalizes profile skills array while preserving proficiency levels', () => {
      const profileSkills = [
        { name: 'JavaScript', level: 'advanced' },
        { name: 'ReactJS', level: 'intermediate' },
        { name: 'Node.js', level: 'beginner' },
      ];

      const normalized = normalizeProfileSkills(profileSkills);
      expect(normalized).toHaveLength(3);
      expect(normalized).toEqual([
        {
          name: 'javascript',
          level: 'advanced',
          displayName: 'JavaScript',
          category: SKILL_CATEGORIES.LANGUAGES,
        },
        {
          name: 'react',
          level: 'intermediate',
          displayName: 'React',
          category: SKILL_CATEGORIES.FRONTEND,
        },
        {
          name: 'node.js',
          level: 'beginner',
          displayName: 'Node.js',
          category: SKILL_CATEGORIES.BACKEND,
        },
      ]);
    });

    it('deduplicates duplicate skills entered with different casing or aliases', () => {
      const profileSkills = [
        { name: 'React', level: 'intermediate' },
        { name: 'reactjs', level: 'advanced' },
      ];

      const normalized = normalizeProfileSkills(profileSkills);
      expect(normalized).toHaveLength(1);
      expect(normalized[0].name).toBe('react');
      expect(normalized[0].level).toBe('advanced'); // Higher level preserved
    });
  });

  // =========================================================================
  // 10. Project Technologies Normalization (normalizeProjectTechnologies)
  // =========================================================================
  describe('10. Project Technologies Normalization', () => {
    it('normalizes project technology strings into canonical descriptors', () => {
      const technologies = ['React JS', 'Node.js', 'Socket.io', 'Tailwind CSS'];
      const normalized = normalizeProjectTechnologies(technologies);

      expect(normalized).toHaveLength(4);
      const keys = normalized.map((t) => t.canonicalKey);
      expect(keys).toContain('react');
      expect(keys).toContain('node.js');
      expect(keys).toContain('socket.io');
      expect(keys).toContain('tailwind');
    });

    it('deduplicates repetitive technology tags in a project', () => {
      const technologies = ['React', 'reactjs', 'React.js'];
      const keys = normalizeProjectTechnologies(technologies).map((t) => t.canonicalKey);
      expect(keys).toEqual(['react']);
    });
  });

  // =========================================================================
  // 11. Opportunity Skills Normalization (normalizeOpportunitySkills)
  // =========================================================================
  describe('11. Opportunity Skills Normalization', () => {
    it('normalizes opportunity skills array', () => {
      const oppSkills = ['react', 'node.js', 'mongodb', 'docker'];
      const normalized = normalizeOpportunitySkills(oppSkills);

      expect(normalized).toHaveLength(4);
      expect(normalized.map((s) => s.canonicalKey)).toEqual(['react', 'node.js', 'mongodb', 'docker']);
      expect(normalized.map((s) => s.displayName)).toEqual(['React', 'Node.js', 'MongoDB', 'Docker']);
    });
  });

  // =========================================================================
  // 12. Combined Profile Evidence (Claimed vs Demonstrated)
  // =========================================================================
  describe('12. Combined Profile Evidence (Claimed vs Demonstrated)', () => {
    it('derives canonical skills across both profile skills and project tech', () => {
      const mockProfile = {
        skills: [
          { name: 'JavaScript', level: 'advanced' },
          { name: 'React', level: 'intermediate' },
        ],
        projects: [
          {
            title: 'Project 1',
            technologies: ['ReactJS', 'Node.js', 'MongoDB'],
          },
        ],
      };

      const canonicalKeys = getProfileCanonicalSkills(mockProfile).map((s) => s.canonicalKey);
      expect(canonicalKeys).toEqual(['javascript', 'react', 'node.js', 'mongodb']);
    });

    it('correctly tags claimed vs demonstrated skills in getProfileSkillEvidence', () => {
      const mockProfile = {
        skills: [
          { name: 'C++', level: 'advanced' }, // Claimed only
          { name: 'React', level: 'intermediate' }, // Both claimed & demonstrated
        ],
        projects: [
          {
            title: 'Full Stack App',
            technologies: ['reactjs', 'node.js'], // Node.js demonstrated only
          },
        ],
      };

      const evidence = getProfileSkillEvidence(mockProfile);

      expect(evidence.claimed.map((s) => s.canonicalKey)).toEqual(['c++', 'react']);
      expect(evidence.demonstrated.map((s) => s.canonicalKey)).toEqual(['react', 'node.js']);

      const reactItem = evidence.all.find((i) => i.canonicalKey === 'react');
      expect(reactItem.isClaimed).toBe(true);
      expect(reactItem.isDemonstrated).toBe(true);

      const cppItem = evidence.all.find((i) => i.canonicalKey === 'c++');
      expect(cppItem.isClaimed).toBe(true);
      expect(cppItem.isDemonstrated).toBe(false);

      const nodeItem = evidence.all.find((i) => i.canonicalKey === 'node.js');
      expect(nodeItem.isClaimed).toBe(false);
      expect(nodeItem.isDemonstrated).toBe(true);
    });
  });

  // =========================================================================
  // 13. Idempotency & Repeated Normalization Determinism
  // =========================================================================
  describe('13. Idempotency & Repeated Normalization Determinism', () => {
    it('produces identical output when normalizing an already normalized skill', () => {
      const initial = normalizeSkill('ReactJS');
      const repeated = normalizeSkill(initial.canonicalKey);

      expect(initial.canonicalKey).toBe(repeated.canonicalKey);
      expect(initial.displayName).toBe(repeated.displayName);
      expect(initial.category).toBe(repeated.category);
    });

    it('is completely deterministic over 100 iterations', () => {
      const sample = ['React', 'node.js', 'CPP', 'k8s', 'mongo db'];
      const reference = extractCanonicalKeys(sample);

      for (let i = 0; i < 100; i++) {
        expect(extractCanonicalKeys(sample)).toEqual(reference);
      }
    });
  });

  // =========================================================================
  // 14. Dictionary Lookup (getCanonicalSkill)
  // =========================================================================
  describe('14. Dictionary Lookup Helper (getCanonicalSkill)', () => {
    it('retrieves skill metadata for known canonical keys', () => {
      const skill = getCanonicalSkill('react');
      expect(skill).not.toBeNull();
      expect(skill.canonicalKey).toBe('react');
      expect(skill.displayName).toBe('React');
      expect(skill.category).toBe(SKILL_CATEGORIES.FRONTEND);
      expect(skill.aliases).toContain('reactjs');
    });

    it('returns null for unknown keys or invalid inputs', () => {
      expect(getCanonicalSkill('non_existent_key')).toBeNull();
      expect(getCanonicalSkill('')).toBeNull();
      expect(getCanonicalSkill(null)).toBeNull();
    });
  });
});
