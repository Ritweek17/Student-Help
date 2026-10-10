import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { getTrustedAIContextForUser } from './career-context.service.js';
import { orchestrateAI } from '../ai/ai-orchestration.service.js';
import { buildInterviewGenerationPromptV1, PROMPT_VERSION } from '../ai/prompts/interview-generation.v1.js';
import { parseStructuredJson, validateTransport, validateSchema } from '../ai/validation/output-validator.js';
import { Application } from '../../models/Application.js';
import { Opportunity } from '../../models/Opportunity.js';

export const INTERVIEW_JWT_AUDIENCE = 'careeros:interview:v1';
export const INTERVIEW_JWT_ISSUER = 'careeros:intelligence';

/**
 * Derives a domain-separated signing key for interview envelopes.
 * Never signs with the raw authentication jwtSecret directly.
 */
function getEnvelopeSigningKey() {
  const hmac = crypto.createHmac('sha256', env.jwtSecret);
  hmac.update('careeros_interview_envelope_v1');
  return hmac.digest();
}

/**
 * Validates the specific structured output for Interview Generation.
 * Ensures exactly 3 distinct questions, unique IDs, and valid bounded text.
 */
function validateInterviewQuestions(response, schema, context) {
  const transport = validateTransport(response);
  if (!transport.valid) return transport;

  const parsed = parseStructuredJson(transport.rawText, transport.parsedJson);
  if (!parsed.valid) return parsed;

  const schemaResult = validateSchema(parsed.data, schema);
  if (!schemaResult.valid) return schemaResult;

  const questions = schemaResult.data;
  
  if (!Array.isArray(questions) || questions.length !== 3) {
    return { valid: false, reason: 'schema_invalid', error: 'Output must be exactly 3 questions' };
  }

  const ids = new Set();
  const texts = new Set();
  
  // Grounding prep
  const allowedSkills = new Set();
  if (Array.isArray(context.canonicalSkillGaps)) {
    context.canonicalSkillGaps.forEach(k => allowedSkills.add(k.toLowerCase().trim()));
  }
  if (Array.isArray(context.opportunityFacts?.requiredCanonicalSkills)) {
    context.opportunityFacts.requiredCanonicalSkills.forEach(k => allowedSkills.add(k.toLowerCase().trim()));
  }

  for (const q of questions) {
    if (!q.id || !q.text || !q.focusSkill) {
      return { valid: false, reason: 'schema_invalid', error: 'Missing fields in question' };
    }
    
    if (ids.has(q.id)) {
      return { valid: false, reason: 'schema_invalid', error: 'Duplicate question IDs' };
    }
    ids.add(q.id);

    const textClean = q.text.toLowerCase().trim();
    if (texts.has(textClean)) {
      return { valid: false, reason: 'schema_invalid', error: 'Effectively identical questions generated' };
    }
    texts.add(textClean);

    // Grounding validation for focusSkill
    // If the context is extremely sparse, we might have no allowed skills.
    // If we have allowed skills, ensure it matches one. 
    if (allowedSkills.size > 0) {
      const cleanSkill = q.focusSkill.toLowerCase().trim();
      if (!allowedSkills.has(cleanSkill)) {
        return { valid: false, reason: 'grounding_failed', error: `Focus skill ${q.focusSkill} not in allowed context` };
      }
    }
  }

  return { valid: true, data: questions };
}

/**
 * Starts an interview session for the provided application.
 * Verifies ownership, eligibility, generates questions via AI, and issues a signed envelope.
 * 
 * @param {string} userId 
 * @param {string} applicationId 
 */
export async function startInterviewGeneration(userId, applicationId) {
  // 1. Fetch Application and Verify Ownership
  const application = await Application.findOne({ _id: applicationId, userId }).lean();
  if (!application) {
    const error = new Error('Application not found or does not belong to user');
    error.status = 404;
    throw error;
  }

  if (application.type !== 'application') {
    const error = new Error('Application type must be application');
    error.status = 400;
    throw error;
  }

  const allowedStatuses = ['applied', 'interview', 'waiting'];
  if (!allowedStatuses.includes(application.status)) {
    const error = new Error('Application status ineligible for interview preparation');
    error.status = 400;
    throw error;
  }

  // 2. Fetch Opportunity
  const opportunity = await Opportunity.findOne({ _id: application.opportunityId }).lean();
  if (!opportunity) {
    const error = new Error('Associated opportunity not found');
    error.status = 404;
    throw error;
  }

  // 3. Resolve Trusted AI Context
  const trustedContext = await getTrustedAIContextForUser(userId, {
    opportunityId: application.opportunityId,
    opportunity,
    applications: [application]
  });

  // 4. Generate Questions via Shared Core (Explicit Fail-Closed Policy)
  const operation = {
    promptVersion: PROMPT_VERSION,
    context: trustedContext,
    buildPrompt: () => buildInterviewGenerationPromptV1({ context: trustedContext }),
    validateOutput: (response, schema) => validateInterviewQuestions(response, schema, trustedContext)
    // No generateFallback provided -> implies fail closed!
  };

  const result = await orchestrateAI(operation);

  if (!result.ok) {
    const error = new Error('Failed to generate interview questions');
    error.status = 503;
    error.reason = result.reason;
    error.details = result.error;
    throw error;
  }

  const questions = result.data;

  // 5. Generate Tamper-Resistant 24-Hour Envelope
  const jti = crypto.randomUUID();
  const signingKey = getEnvelopeSigningKey();
  
  const envelopePayload = {
    sub: userId.toString(),
    applicationId: application._id.toString(),
    opportunityId: opportunity._id.toString(),
    questions,
    jti
  };

  const envelope = jwt.sign(envelopePayload, signingKey, {
    algorithm: 'HS256',
    expiresIn: '24h',
    audience: INTERVIEW_JWT_AUDIENCE,
    issuer: INTERVIEW_JWT_ISSUER
  });

  return { envelope, questions };
}
