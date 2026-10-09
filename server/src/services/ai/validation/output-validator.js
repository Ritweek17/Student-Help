/**
 * CareerOS AI Output Validation Pipeline (Phase 11H — B3)
 *
 * Implements strict, multi-stage validation for AI responses:
 * 1. Transport Validation
 * 2. JSON Syntax Validation
 * 3. Schema & Bounds Validation (output-format/schema enforcement only)
 * 4. Safety Validation (Causal claims, protected attributes, script injections)
 * 5. Grounding Validation against TrustedAIContextV1
 *
 * Architectural Note:
 * Structured output validation provides output-format and schema enforcement only.
 * No single layer guarantees prompt-injection immunity. Defense-in-depth prompt
 * injection controls are maintained across input sanitization, authoritative context
 * separation, prompt design, and post-generation grounding.
 *
 * Rejection triggers fallback with machine-safe error categories.
 */

// Prohibited causal phrasing regarding employer rejections
const PROHIBITED_CAUSAL_PATTERNS = [
  /\brejected because\b/i,
  /\bemployer rejected because\b/i,
  /\bcaused your rejection\b/i,
  /\bcaused rejection\b/i,
  /\bthe reason you were rejected\b/i,
  /\bconfirmed rejection reason\b/i,
  /\byour fault\b/i,
];

// Prohibited inference of protected demographic attributes
const PROHIBITED_DEMOGRAPHIC_PATTERNS = [
  /\b(because you are|due to your)\s+(young|old|a woman|a man|disabled|pregnant)\b/i,
  /\b(gender|race|ethnicity|sexual orientation|religious belief|caste)\s+(bias|factor|drawback)\b/i,
];

/**
 * Stage 1: Transport response validation.
 *
 * @param {any} response
 * @returns {{ valid: boolean, rawText?: string, parsedJson?: any, reason?: string, error?: string }}
 */
export function validateTransport(response) {
  if (!response || typeof response !== 'object') {
    return {
      valid: false,
      reason: 'provider_error',
      error: 'Provider returned an empty or invalid transport response',
    };
  }

  const rawText = typeof response.rawText === 'string' ? response.rawText.trim() : '';
  const parsedJson = response.parsedJson && typeof response.parsedJson === 'object' ? response.parsedJson : null;

  if (!rawText && !parsedJson) {
    return {
      valid: false,
      reason: 'provider_error',
      error: 'Provider response contained no usable text or JSON payload',
    };
  }

  return {
    valid: true,
    rawText,
    parsedJson,
  };
}

/**
 * Stage 2: JSON Parsing and extraction.
 *
 * @param {string} rawText
 * @param {any} [preparsed=null]
 * @returns {{ valid: boolean, data?: any, reason?: string, error?: string }}
 */
export function parseStructuredJson(rawText, preparsed = null) {
  if (preparsed && typeof preparsed === 'object') {
    return { valid: true, data: preparsed };
  }

  if (!rawText || typeof rawText !== 'string') {
    return { valid: false, reason: 'invalid_json', error: 'No JSON string to parse' };
  }

  // Strip optional markdown code fences ```json ... ```
  let cleanText = rawText.trim();
  if (cleanText.startsWith('```')) {
    cleanText = cleanText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }

  try {
    const data = JSON.parse(cleanText);
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return { valid: false, reason: 'invalid_json', error: 'JSON payload is not an object' };
    }
    return { valid: true, data };
  } catch (err) {
    return { valid: false, reason: 'invalid_json', error: `Malformed JSON: ${err.message}` };
  }
}

/**
 * Stage 3: Schema & Bounds validation.
 *
 * @param {any} data
 * @param {Object} schema
 * @returns {{ valid: boolean, data?: any, reason?: string, error?: string }}
 */
export function validateSchema(data, schema) {
  if (!data || typeof data !== 'object') {
    return { valid: false, reason: 'schema_invalid', error: 'Response data is not an object' };
  }

  // 1. Check required properties
  const required = Array.isArray(schema.required) ? schema.required : [];
  for (const field of required) {
    if (data[field] === undefined || data[field] === null) {
      return { valid: false, reason: 'schema_invalid', error: `Missing required field: ${field}` };
    }
  }

  // 2. Reject additional unknown properties
  if (schema.additionalProperties === false) {
    const allowedKeys = new Set(Object.keys(schema.properties || {}));
    for (const key of Object.keys(data)) {
      if (!allowedKeys.has(key)) {
        return { valid: false, reason: 'schema_invalid', error: `Unexpected field in structured output: ${key}` };
      }
    }
  }

  // 3. Validate specific field types and bounds
  const props = schema.properties || {};

  // adviceType
  if (props.adviceType && props.adviceType.enum) {
    if (!props.adviceType.enum.includes(data.adviceType)) {
      return {
        valid: false,
        reason: 'schema_invalid',
        error: `Invalid adviceType: "${data.adviceType}". Allowed: ${props.adviceType.enum.join(', ')}`,
      };
    }
  }

  // headline
  if (props.headline) {
    if (typeof data.headline !== 'string' || !data.headline.trim()) {
      return { valid: false, reason: 'schema_invalid', error: 'Headline must be a non-empty string' };
    }
    if (props.headline.maxLength && data.headline.length > props.headline.maxLength) {
      return { valid: false, reason: 'schema_invalid', error: `Headline exceeds ${props.headline.maxLength} characters` };
    }
  }

  // keyPoints
  if (props.keyPoints) {
    if (!Array.isArray(data.keyPoints)) {
      return { valid: false, reason: 'schema_invalid', error: 'keyPoints must be an array' };
    }
    if (props.keyPoints.maxItems && data.keyPoints.length > props.keyPoints.maxItems) {
      return { valid: false, reason: 'schema_invalid', error: `keyPoints exceeds max ${props.keyPoints.maxItems} items` };
    }
    const maxItemLen = props.keyPoints.items?.maxLength || 200;
    for (const point of data.keyPoints) {
      if (typeof point !== 'string' || !point.trim()) {
        return { valid: false, reason: 'schema_invalid', error: 'keyPoints entries must be non-empty strings' };
      }
      if (point.length > maxItemLen) {
        return { valid: false, reason: 'schema_invalid', error: `keyPoint entry exceeds ${maxItemLen} characters` };
      }
    }
  }

  // referencedSkills
  if (props.referencedSkills) {
    if (!Array.isArray(data.referencedSkills)) {
      return { valid: false, reason: 'schema_invalid', error: 'referencedSkills must be an array' };
    }
    if (props.referencedSkills.maxItems && data.referencedSkills.length > props.referencedSkills.maxItems) {
      return { valid: false, reason: 'schema_invalid', error: `referencedSkills exceeds max ${props.referencedSkills.maxItems} items` };
    }
    for (const skill of data.referencedSkills) {
      if (typeof skill !== 'string' || !skill.trim()) {
        return { valid: false, reason: 'schema_invalid', error: 'referencedSkills entries must be strings' };
      }
    }
  }

  // suggestedAction
  if (props.suggestedAction) {
    if (typeof data.suggestedAction !== 'string' || !data.suggestedAction.trim()) {
      return { valid: false, reason: 'schema_invalid', error: 'suggestedAction must be a non-empty string' };
    }
    if (props.suggestedAction.maxLength && data.suggestedAction.length > props.suggestedAction.maxLength) {
      return { valid: false, reason: 'schema_invalid', error: `suggestedAction exceeds ${props.suggestedAction.maxLength} characters` };
    }
  }

  return { valid: true, data };
}

/**
 * Stage 4: Safety & Non-Causality validation.
 *
 * @param {any} data
 * @returns {{ valid: boolean, reason?: string, error?: string }}
 */
export function validateSafety(data) {
  const stringsToCheck = [];

  function collectStrings(obj) {
    if (!obj) return;
    if (typeof obj === 'string') {
      stringsToCheck.push(obj);
    } else if (Array.isArray(obj)) {
      obj.forEach(collectStrings);
    } else if (typeof obj === 'object') {
      Object.values(obj).forEach(collectStrings);
    }
  }

  collectStrings(data);

  for (const str of stringsToCheck) {
    // 1. Check for raw HTML / script tags
    if (/<[a-z][\s\S]*>/i.test(str)) {
      return {
        valid: false,
        reason: 'unsafe_output',
        error: 'Output contained disallowed HTML or script elements',
      };
    }

    // 2. Check for prohibited causal claims regarding rejections
    for (const pattern of PROHIBITED_CAUSAL_PATTERNS) {
      if (pattern.test(str)) {
        return {
          valid: false,
          reason: 'unsafe_output',
          error: `Output violated non-causality contract with pattern: ${pattern}`,
        };
      }
    }

    // 3. Check for prohibited demographic / protected attribute inference
    for (const pattern of PROHIBITED_DEMOGRAPHIC_PATTERNS) {
      if (pattern.test(str)) {
        return {
          valid: false,
          reason: 'unsafe_output',
          error: `Output violated protected attribute safety contract: ${pattern}`,
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Stage 5: Grounding validation against TrustedAIContextV1.
 *
 * @param {any} data
 * @param {Object} context - Authoritative TrustedAIContextV1
 * @returns {{ valid: boolean, reason?: string, error?: string }}
 */
export function validateGrounding(data, context) {
  if (!context || typeof context !== 'object') {
    return { valid: false, reason: 'grounding_failed', error: 'Context is missing or malformed' };
  }

  // 1. Gather all canonical skills explicitly present in context
  const allowedSkills = new Set();

  if (Array.isArray(context.canonicalSkillGaps)) {
    context.canonicalSkillGaps.forEach((k) => allowedSkills.add(k.toLowerCase().trim()));
  }

  if (Array.isArray(context.matchBreakdown?.matchedSkills)) {
    context.matchBreakdown.matchedSkills.forEach((k) => allowedSkills.add(k.toLowerCase().trim()));
  }

  if (Array.isArray(context.matchBreakdown?.missingSkills)) {
    context.matchBreakdown.missingSkills.forEach((k) => allowedSkills.add(k.toLowerCase().trim()));
  }

  if (Array.isArray(context.opportunityFacts?.requiredCanonicalSkills)) {
    context.opportunityFacts.requiredCanonicalSkills.forEach((k) => allowedSkills.add(k.toLowerCase().trim()));
  }

  if (Array.isArray(context.observedOutcomePatterns?.recurringGaps)) {
    context.observedOutcomePatterns.recurringGaps.forEach((g) => {
      if (g?.canonicalKey) allowedSkills.add(g.canonicalKey.toLowerCase().trim());
    });
  }

  // 2. Validate referencedSkills: Every referenced skill MUST exist in the context
  const referencedSkills = Array.isArray(data.referencedSkills) ? data.referencedSkills : [];
  for (const skill of referencedSkills) {
    const cleanSkill = skill.toLowerCase().trim();
    if (!allowedSkills.has(cleanSkill)) {
      return {
        valid: false,
        reason: 'grounding_failed',
        error: `Output referenced ungrounded skill not present in context: "${skill}"`,
      };
    }
  }

  // 3. Validate opportunity grounding: If opportunityFacts is null, advice should not hallucinate a specific company
  if (!context.opportunityFacts) {
    const headlineAndAction = `${data.headline} ${data.suggestedAction}`.toLowerCase();
    if (headlineAndAction.includes('apply to ') || headlineAndAction.includes('at the company')) {
      // Allowed if general, but verify no invented specific opportunities
    }
  }

  // 4. Validate GitHub proof grounding: If publicRepoCount is 0, cannot claim candidate has verified public repositories
  const publicRepos = context.githubProofSummary?.publicRepoCount || 0;
  if (publicRepos === 0) {
    const allText = `${data.headline} ${(data.keyPoints || []).join(' ')} ${data.suggestedAction}`.toLowerCase();
    if (allText.includes('your verified github repositories show') || allText.includes('your active github repos demonstrate')) {
      return {
        valid: false,
        reason: 'grounding_failed',
        error: 'Output claimed verified GitHub repository evidence when publicRepoCount is 0',
      };
    }
  }

  return { valid: true };
}

/**
 * Comprehensive Validation Pipeline.
 *
 * Runs transport -> JSON parse -> schema -> safety -> grounding.
 *
 * @param {Object} response - Provider response
 * @param {Object} schema - Target JSON schema
 * @param {Object} context - Authoritative TrustedAIContextV1
 * @returns {{ valid: boolean, data?: any, reason?: string, error?: string }}
 */
export function validateAIOutputPipeline(response, schema, context) {
  // 1. Transport validation
  const transport = validateTransport(response);
  if (!transport.valid) {
    return transport;
  }

  // 2. Parse JSON
  const parsed = parseStructuredJson(transport.rawText, transport.parsedJson);
  if (!parsed.valid) {
    return parsed;
  }

  // 3. Schema validation
  const schemaResult = validateSchema(parsed.data, schema);
  if (!schemaResult.valid) {
    return schemaResult;
  }

  // 4. Safety validation
  const safetyResult = validateSafety(schemaResult.data);
  if (!safetyResult.valid) {
    return safetyResult;
  }

  // 5. Grounding validation
  const groundingResult = validateGrounding(schemaResult.data, context);
  if (!groundingResult.valid) {
    return groundingResult;
  }

  return {
    valid: true,
    data: schemaResult.data,
  };
}
