import mongoose from 'mongoose';
import { calculateCompletenessScore, calculateRelevanceScore, calculateQualityScore } from '../src/services/ingestion/scoring.service.js';
import { Opportunity } from '../src/models/Opportunity.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  console.log('--- Phase 8G Scoring Verification ---');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Completeness Checks
  const highComp = { 
    title: 'Software Engineer Intern', 
    organization: 'Google', 
    description: 'A very long description that meets the length requirements easily by being over fifty characters.', 
    applicationUrl: 'https://google.com', 
    type: 'internship', 
    workMode: 'remote', 
    skills: ['react'] 
  };
  const lowComp = { 
    title: 'X', 
    organization: 'Y', 
    description: 'short' 
  };

  const c1 = calculateCompletenessScore(highComp);
  const c2 = calculateCompletenessScore(lowComp);
  
  assert(c1 >= 80 && c1 <= 100, `High Completeness should be >= 80 (Got ${c1})`);
  assert(c2 >= 0 && c2 <= 40, `Low Completeness should be <= 40 (Got ${c2})`);

  // 2. Relevance Checks
  const highRel = { 
    title: 'Frontend Intern', 
    description: 'Looking for a student who knows React', 
    type: 'internship', 
    skills: ['javascript', 'react'], 
    location: { country: 'India' } 
  };
  const lowRel = { 
    title: 'Marketing Manager', 
    description: 'Help sell products', 
    type: 'full_time', 
    location: { country: 'USA' },
    workMode: 'onsite'
  };

  const r1 = calculateRelevanceScore(highRel);
  const r2 = calculateRelevanceScore(lowRel);
  
  assert(r1 >= 80 && r1 <= 100, `High Relevance should be >= 80 (Got ${r1})`);
  assert(r2 >= 0 && r2 <= 40, `Low Relevance should be <= 40 (Got ${r2})`);

  // 3. Quality Score Combining
  // For q2 (highRel), it lacks URLs, so it should get a massive penalty.
  const q1 = calculateQualityScore(highComp); 
  const q2 = calculateQualityScore(highRel); 
  
  assert(q1 > q2, `Quality of complete item (${q1}) should be > item missing URL (${q2})`);
  assert(q1 >= 0 && q1 <= 100, 'Quality score must be 0-100');
  assert(q2 >= 0 && q2 <= 100, 'Quality score must be 0-100');

  // 4. Missing fields don't throw
  try {
    const nullScore = calculateQualityScore(null);
    assert(nullScore === 0, 'Null/empty opportunity handles safely (score 0)');
  } catch (e) {
    assert(false, `Null opportunity threw error: ${e.message}`);
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);

  // Quick pipeline DB check if needed (schema check)
  console.log('✅ Schema fields compiled correctly without syntax errors');
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
