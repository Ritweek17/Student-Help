export const PROMPT_VERSION = 'interview-generation.v1';

/**
 * Builds the strictly structured interview generation prompt.
 * Grounded in canonical skills and opportunity facts.
 * 
 * @param {Object} params
 * @param {Object} params.context - Authoritative TrustedAIContextV1
 * @returns {Object} { systemPrompt, userPrompt, responseSchema }
 */
export function buildInterviewGenerationPromptV1({ context }) {
  const opportunity = context?.opportunityFacts || {};
  const skills = Array.isArray(context?.canonicalSkillGaps) ? context.canonicalSkillGaps : [];
  
  const systemPrompt = `You are an expert technical interviewer at a top-tier technology company.
Your objective is to generate exactly THREE distinct, highly relevant interview questions based on the candidate's target opportunity and skill context.

RULES:
1. Return exactly three questions.
2. Ensure each question has a unique, bounded ID (e.g., "q1", "q2", "q3").
3. Question text must be clear, concise, and professional.
4. Provide exactly one focusSkill tag per question. The focusSkill MUST be chosen from the provided canonical skills or opportunity requirements.
5. Do NOT fabricate candidate experience or job requirements.
6. Return only the requested JSON array format.`;

  const userPrompt = `Generate 3 interview questions.
Target Opportunity: ${opportunity.title || 'Software Engineering Role'} at ${opportunity.organization || 'Target Company'}
Required Skills: ${(opportunity.requiredCanonicalSkills || []).join(', ') || 'General software engineering'}
Candidate Skill Gaps to Assess: ${skills.join(', ') || 'General problem solving'}`;

  const responseSchema = {
    type: "array",
    minItems: 3,
    maxItems: 3,
    items: {
      type: "object",
      required: ["id", "text", "focusSkill"],
      additionalProperties: false,
      properties: {
        id: { type: "string", maxLength: 20 },
        text: { type: "string", maxLength: 500 },
        focusSkill: { type: "string", maxLength: 100 }
      }
    }
  };

  return { systemPrompt, userPrompt, responseSchema, promptVersion: PROMPT_VERSION };
}
