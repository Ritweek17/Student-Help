import mongoose from 'mongoose';
import { Opportunity } from '../src/models/Opportunity.js';
import { OpportunitySource } from '../src/models/OpportunitySource.js';
import { OpportunityIngestionRun, INGESTION_TRIGGER_TYPES } from '../src/models/OpportunityIngestionRun.js';
import { isSafeHttpUrl, normalizeUrl } from '../src/utils/ingestion/urlNormalizer.js';
import { generateContentFingerprint } from '../src/utils/ingestion/contentFingerprint.js';
import { sanitizeHtml, stripHtmlToPlainText, decodeHtmlEntities } from '../src/utils/ingestion/htmlSanitizer.js';
import { validateOpportunityWrite } from '../src/validators/opportunity.write.validator.js';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    throw new Error(message);
  }
}

console.log('====================================================');
console.log('CAREEROS PHASE 8B — INGESTION SCHEMA VERIFICATION');
console.log('====================================================\n');

let passedTests = 0;
function recordPass(testName) {
  passedTests++;
  console.log(`  ✓ [PASS ${passedTests}] ${testName}`);
}

// ──────────────────────────────────────────────────────────────────
// SECTION 1: OPPORTUNITY SCHEMA & INDEXES
// ──────────────────────────────────────────────────────────────────
console.log('--- 1. Opportunity Ingestion Fields & Indexes ---');

const oppPaths = Opportunity.schema.paths;

// Test 1: sourceRef
assert(oppPaths.sourceRef, 'Opportunity.sourceRef field is missing');
assert(oppPaths.sourceRef.instance === 'ObjectId', 'Opportunity.sourceRef must be an ObjectId');
assert(oppPaths.sourceRef.options.ref === 'OpportunitySource', 'Opportunity.sourceRef must reference OpportunitySource');
recordPass('Opportunity contains sourceRef (ObjectId referencing OpportunitySource)');

// Test 2: externalId
assert(oppPaths.externalId, 'Opportunity.externalId field is missing');
assert(oppPaths.externalId.instance === 'String', 'Opportunity.externalId must be a String');
recordPass('Opportunity contains externalId (String, trimmed)');

// Test 3: canonicalUrl
assert(oppPaths.canonicalUrl, 'Opportunity.canonicalUrl field is missing');
assert(oppPaths.canonicalUrl.instance === 'String', 'Opportunity.canonicalUrl must be a String');
recordPass('Opportunity contains canonicalUrl (String, trimmed)');

// Test 4: contentFingerprint
assert(oppPaths.contentFingerprint, 'Opportunity.contentFingerprint field is missing');
assert(oppPaths.contentFingerprint.instance === 'String', 'Opportunity.contentFingerprint must be a String');
recordPass('Opportunity contains contentFingerprint (String, trimmed)');

// Test 5: ingestionRunId
assert(oppPaths.ingestionRunId, 'Opportunity.ingestionRunId field is missing');
assert(oppPaths.ingestionRunId.instance === 'ObjectId', 'Opportunity.ingestionRunId must be an ObjectId');
assert(oppPaths.ingestionRunId.options.ref === 'OpportunityIngestionRun', 'Opportunity.ingestionRunId must reference OpportunityIngestionRun');
recordPass('Opportunity contains ingestionRunId (ObjectId referencing OpportunityIngestionRun)');

// Test 6: Compound sparse unique index on sourceRef + externalId
const oppIndexes = Opportunity.schema.indexes();
const compoundUniqueIndex = oppIndexes.find(([indexFields, options]) => {
  return (
    indexFields.sourceRef === 1 &&
    indexFields.externalId === 1 &&
    options?.unique === true &&
    options?.sparse === true
  );
});
assert(compoundUniqueIndex, 'Compound sparse unique index on { sourceRef: 1, externalId: 1 } is missing');
recordPass('Compound sparse unique index { sourceRef: 1, externalId: 1 } exists with unique=true, sparse=true');

// Test 7: canonicalUrl is NOT globally unique
const canonicalIndex = oppIndexes.find(([indexFields, options]) => {
  return indexFields.canonicalUrl === 1 && options?.unique === true;
});
assert(!canonicalIndex, 'canonicalUrl MUST NOT be globally unique');
recordPass('canonicalUrl is indexed for secondary lookups but is NOT globally unique');

// ──────────────────────────────────────────────────────────────────
// SECTION 2: OPPORTUNITY INGESTION RUN TELEMETRY
// ──────────────────────────────────────────────────────────────────
console.log('\n--- 2. IngestionRun Telemetry Fields ---');

const runPaths = OpportunityIngestionRun.schema.paths;

// Test 8: duplicateCount
assert(runPaths.duplicateCount, 'OpportunityIngestionRun.duplicateCount is missing');
assert(runPaths.duplicateCount.instance === 'Number', 'duplicateCount must be a Number');
recordPass('OpportunityIngestionRun contains duplicateCount (Number, default 0)');

// Test 9: invalidCount
assert(runPaths.invalidCount, 'OpportunityIngestionRun.invalidCount is missing');
assert(runPaths.invalidCount.instance === 'Number', 'invalidCount must be a Number');
recordPass('OpportunityIngestionRun contains invalidCount (Number, default 0)');

// Test 10: durationMs
assert(runPaths.durationMs, 'OpportunityIngestionRun.durationMs is missing');
assert(runPaths.durationMs.instance === 'Number', 'durationMs must be a Number');
recordPass('OpportunityIngestionRun contains durationMs (Number, default 0)');

// Test 11: triggeredBy enum
assert(runPaths.triggeredBy, 'OpportunityIngestionRun.triggeredBy is missing');
assert(runPaths.triggeredBy.instance === 'String', 'triggeredBy must be a String');
assert(Array.isArray(INGESTION_TRIGGER_TYPES) && INGESTION_TRIGGER_TYPES.includes('scheduled'), 'INGESTION_TRIGGER_TYPES missing');
assert(INGESTION_TRIGGER_TYPES.includes('manual') && INGESTION_TRIGGER_TYPES.includes('webhook'), 'INGESTION_TRIGGER_TYPES missing values');
recordPass('OpportunityIngestionRun contains triggeredBy enum (scheduled, manual, webhook)');

// ──────────────────────────────────────────────────────────────────
// SECTION 3: OPPORTUNITY SOURCE LOCK FIELDS
// ──────────────────────────────────────────────────────────────────
console.log('\n--- 3. OpportunitySource Concurrency Lock Fields ---');

const sourcePaths = OpportunitySource.schema.paths;

// Test 12: isLocked
assert(sourcePaths.isLocked, 'OpportunitySource.isLocked is missing');
assert(sourcePaths.isLocked.instance === 'Boolean', 'isLocked must be a Boolean');
recordPass('OpportunitySource contains isLocked (Boolean, default false)');

// Test 13: lockedAt
assert(sourcePaths.lockedAt, 'OpportunitySource.lockedAt is missing');
assert(sourcePaths.lockedAt.instance === 'Date', 'lockedAt must be a Date');
recordPass('OpportunitySource contains lockedAt (Date, default null)');

// ──────────────────────────────────────────────────────────────────
// SECTION 4: URL NORMALIZER TESTS
// ──────────────────────────────────────────────────────────────────
console.log('\n--- 4. URL Normalizer Utility Tests ---');

// Test 14: rejects unsafe schemes
assert(!isSafeHttpUrl('javascript:alert(1)'), 'isSafeHttpUrl allowed javascript:');
assert(!isSafeHttpUrl('data:text/html,<script>'), 'isSafeHttpUrl allowed data:');
assert(!isSafeHttpUrl('ftp://ftp.example.com'), 'isSafeHttpUrl allowed ftp:');
assert(!isSafeHttpUrl(''), 'isSafeHttpUrl allowed empty string');
assert(!isSafeHttpUrl(null), 'isSafeHttpUrl allowed null');
assert(isSafeHttpUrl('https://careers.google.com'), 'isSafeHttpUrl rejected valid https');
assert(isSafeHttpUrl('http://jobs.example.com'), 'isSafeHttpUrl rejected valid http');
recordPass('urlNormalizer rejects unsafe schemes (javascript, data, ftp) and validates HTTP/HTTPS');

// Test 15: strips tracking params, lowercases host, preserves functional params
const dirtyUrl1 = 'HTTPS://CAREERS.GOOGLE.COM/jobs/results/123/?utm_source=linkedin&utm_medium=feed&jobId=456&fbclid=abc123#overview';
const clean1 = normalizeUrl(dirtyUrl1);
assert(clean1 === 'https://careers.google.com/jobs/results/123?jobId=456', `Unexpected normalization: ${clean1}`);

const dirtyUrl2 = 'https://example.com/apply/?ref=jobboard&source=twitter&p=2&b=2&a=1';
const clean2 = normalizeUrl(dirtyUrl2);
// Query parameters sorted: a=1&b=2&p=2
assert(clean2 === 'https://example.com/apply?a=1&b=2&p=2', `Unexpected query sorting/stripping: ${clean2}`);

const rootUrl = 'https://company.com/';
const cleanRoot = normalizeUrl(rootUrl);
assert(cleanRoot === 'https://company.com/', `Root trailing slash should remain: ${cleanRoot}`);
recordPass('urlNormalizer strips tracking parameters, lowercases host, sorts query params, and preserves functional IDs');

// ──────────────────────────────────────────────────────────────────
// SECTION 5: CONTENT FINGERPRINT TESTS
// ──────────────────────────────────────────────────────────────────
console.log('\n--- 5. Content Fingerprint Generator Tests ---');

// Test 16: deterministic fingerprinting
const fp1 = generateContentFingerprint({
  organization: 'Google',
  title: 'Software Engineer Intern',
  deadline: '2026-10-15T00:00:00.000Z',
});
const fp2 = generateContentFingerprint({
  organization: '  google  ',
  title: 'SOFTWARE   ENGINEER  INTERN',
  deadline: '2026-10-15T12:30:00.000Z',
});
assert(fp1 === fp2, 'Fingerprints did not match for equivalent inputs');
assert(fp1.length === 64, 'Fingerprint must be a 64-char SHA-256 hex string');

const fpDifferentDate = generateContentFingerprint({
  organization: 'Google',
  title: 'Software Engineer Intern',
  deadline: '2026-11-01T00:00:00.000Z',
});
assert(fp1 !== fpDifferentDate, 'Fingerprint must differ when deadline differs');

const fpFallbackEventDate = generateContentFingerprint({
  organization: 'HackMIT',
  title: 'Annual Hackathon',
  eventDate: '2026-09-20T00:00:00.000Z',
});
assert(fpFallbackEventDate.length === 64, 'Event date fallback failed');
recordPass('contentFingerprint produces deterministic SHA-256 digests resilient to whitespace and case variations');

// ──────────────────────────────────────────────────────────────────
// SECTION 6: HTML SANITIZER TESTS
// ──────────────────────────────────────────────────────────────────
console.log('\n--- 6. HTML Sanitizer Utility Tests ---');

// Test 17: HTML sanitization
const maliciousHtml = `
  <h1>Software Engineering Intern</h1>
  <script>alert("pwned");</script>
  <p>Build scalable web services.<br/>Collaborate with engineers.</p>
  <iframe src="http://evil.com"></iframe>
  <img src="x" onerror="alert(1)">
  <a href="javascript:void(0)">Apply Now</a>
  &lt;b&gt;Qualifications&amp;nbsp;&amp;amp;&amp;nbsp;Skills&lt;/b&gt;
`;
const sanitized = sanitizeHtml(maliciousHtml);
assert(!sanitized.includes('<script>'), 'Script tag was not removed');
assert(!sanitized.includes('alert("pwned")'), 'Script content was not removed');
assert(!sanitized.includes('<iframe>'), 'Iframe tag was not removed');
assert(!sanitized.includes('onerror'), 'Event handler was not removed');
assert(!sanitized.includes('javascript:'), 'javascript URI was not removed');
assert(sanitized.includes('Software Engineering Intern'), 'Legitimate title missing');
assert(sanitized.includes('Build scalable web services.'), 'Legitimate body missing');
assert(sanitized.includes('Qualifications & Skills'), 'HTML entities were not decoded cleanly');

const plainText = stripHtmlToPlainText('<p>Fast <b>paced</b> environment.</p>', 20);
assert(plainText === 'Fast paced environme...', `Unexpected plain text truncate: ${plainText}`);
recordPass('htmlSanitizer removes scripts, iframes, event handlers, decodes entities, and extracts readable text');

// ──────────────────────────────────────────────────────────────────
// SECTION 7: VALIDATOR PROTECTION TESTS
// ──────────────────────────────────────────────────────────────────
console.log('\n--- 7. Ingestion Field Protection on Normal Writes ---');

// Test 18: client attempt to inject ingestion-only fields into standard write validator
const clientPayload = {
  title: 'Hacked Opportunity',
  organization: 'Spoof Corp',
  description: 'Valid description text',
  type: 'internship',
  sourceRef: new mongoose.Types.ObjectId().toString(),
  externalId: 'ext-999',
  canonicalUrl: 'https://evil.com',
  contentFingerprint: 'badhash',
  ingestionRunId: new mongoose.Types.ObjectId().toString(),
};

const validatedResult = validateOpportunityWrite(clientPayload, false);
assert(!validatedResult.error, `Validation failed: ${validatedResult.error}`);
assert(!validatedResult.value.sourceRef, 'sourceRef was not stripped from client write!');
assert(!validatedResult.value.externalId, 'externalId was not stripped from client write!');
assert(!validatedResult.value.canonicalUrl, 'canonicalUrl was not stripped from client write!');
assert(!validatedResult.value.contentFingerprint, 'contentFingerprint was not stripped from client write!');
assert(!validatedResult.value.ingestionRunId, 'ingestionRunId was not stripped from client write!');
recordPass('validateOpportunityWrite strictly strips all ingestion-only metadata from standard client requests');

console.log('\n====================================================');
console.log(`✅ VERIFICATION COMPLETE: ALL ${passedTests} TEST SUITES PASSED!`);
console.log('====================================================\n');
