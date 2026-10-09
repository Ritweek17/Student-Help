import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import { Opportunity } from '../../src/models/Opportunity.js';
import { OpportunitySource } from '../../src/models/OpportunitySource.js';
import {
  OpportunityIngestionRun,
  INGESTION_TRIGGER_TYPES,
} from '../../src/models/OpportunityIngestionRun.js';
import { isSafeHttpUrl, normalizeUrl } from '../../src/utils/ingestion/urlNormalizer.js';
import { generateContentFingerprint } from '../../src/utils/ingestion/contentFingerprint.js';
import {
  sanitizeHtml,
  stripHtmlToPlainText,
} from '../../src/utils/ingestion/htmlSanitizer.js';
import { validateOpportunityWrite } from '../../src/validators/opportunity.write.validator.js';

describe('CareerOS Models Test Suite — Ingestion Schema & Ingestion Utilities', () => {
  // ==========================================
  // 1. Opportunity Ingestion Fields & Indexes
  // ==========================================
  describe('Opportunity Ingestion Fields & Indexes', () => {
    const oppPaths = Opportunity.schema.paths;

    it('defines sourceRef as ObjectId referencing OpportunitySource', () => {
      expect(oppPaths.sourceRef).toBeDefined();
      expect(oppPaths.sourceRef.instance).toBe('ObjectId');
      expect(oppPaths.sourceRef.options.ref).toBe('OpportunitySource');
    });

    it('defines externalId as trimmed String', () => {
      expect(oppPaths.externalId).toBeDefined();
      expect(oppPaths.externalId.instance).toBe('String');
    });

    it('defines canonicalUrl as trimmed String', () => {
      expect(oppPaths.canonicalUrl).toBeDefined();
      expect(oppPaths.canonicalUrl.instance).toBe('String');
    });

    it('defines contentFingerprint as trimmed String', () => {
      expect(oppPaths.contentFingerprint).toBeDefined();
      expect(oppPaths.contentFingerprint.instance).toBe('String');
    });

    it('defines ingestionRunId as ObjectId referencing OpportunityIngestionRun', () => {
      expect(oppPaths.ingestionRunId).toBeDefined();
      expect(oppPaths.ingestionRunId.instance).toBe('ObjectId');
      expect(oppPaths.ingestionRunId.options.ref).toBe('OpportunityIngestionRun');
    });

    it('defines compound sparse unique index on { sourceRef: 1, externalId: 1 }', () => {
      const oppIndexes = Opportunity.schema.indexes();
      const compoundUniqueIndex = oppIndexes.find(([indexFields, options]) => {
        return (
          indexFields.sourceRef === 1 &&
          indexFields.externalId === 1 &&
          options?.unique === true &&
          options?.sparse === true
        );
      });
      expect(compoundUniqueIndex).toBeDefined();
    });

    it('ensures canonicalUrl is NOT globally unique', () => {
      const oppIndexes = Opportunity.schema.indexes();
      const canonicalUniqueIndex = oppIndexes.find(([indexFields, options]) => {
        return indexFields.canonicalUrl === 1 && options?.unique === true;
      });
      expect(canonicalUniqueIndex).toBeUndefined();
    });
  });

  // ==========================================
  // 2. IngestionRun Telemetry Fields
  // ==========================================
  describe('OpportunityIngestionRun Telemetry Fields', () => {
    const runPaths = OpportunityIngestionRun.schema.paths;

    it('defines duplicateCount as Number', () => {
      expect(runPaths.duplicateCount).toBeDefined();
      expect(runPaths.duplicateCount.instance).toBe('Number');
    });

    it('defines invalidCount as Number', () => {
      expect(runPaths.invalidCount).toBeDefined();
      expect(runPaths.invalidCount.instance).toBe('Number');
    });

    it('defines durationMs as Number', () => {
      expect(runPaths.durationMs).toBeDefined();
      expect(runPaths.durationMs.instance).toBe('Number');
    });

    it('defines triggeredBy enum containing scheduled, manual, webhook', () => {
      expect(runPaths.triggeredBy).toBeDefined();
      expect(runPaths.triggeredBy.instance).toBe('String');
      expect(Array.isArray(INGESTION_TRIGGER_TYPES)).toBe(true);
      expect(INGESTION_TRIGGER_TYPES).toContain('scheduled');
      expect(INGESTION_TRIGGER_TYPES).toContain('manual');
      expect(INGESTION_TRIGGER_TYPES).toContain('webhook');
    });
  });

  // ==========================================
  // 3. OpportunitySource Concurrency Lock Fields
  // ==========================================
  describe('OpportunitySource Concurrency Lock Fields', () => {
    const sourcePaths = OpportunitySource.schema.paths;

    it('defines isLocked as Boolean', () => {
      expect(sourcePaths.isLocked).toBeDefined();
      expect(sourcePaths.isLocked.instance).toBe('Boolean');
    });

    it('defines lockedAt as Date', () => {
      expect(sourcePaths.lockedAt).toBeDefined();
      expect(sourcePaths.lockedAt.instance).toBe('Date');
    });
  });

  // ==========================================
  // 4. URL Normalizer Utility
  // ==========================================
  describe('URL Normalizer Utility', () => {
    it('rejects unsafe schemes (javascript, data, ftp) and non-url inputs', () => {
      expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
      expect(isSafeHttpUrl('data:text/html,<script>')).toBe(false);
      expect(isSafeHttpUrl('ftp://ftp.example.com')).toBe(false);
      expect(isSafeHttpUrl('')).toBe(false);
      expect(isSafeHttpUrl(null)).toBe(false);
      expect(isSafeHttpUrl('https://careers.google.com')).toBe(true);
      expect(isSafeHttpUrl('http://jobs.example.com')).toBe(true);
    });

    it('strips tracking parameters, lowercases host, sorts query params, and preserves functional IDs', () => {
      const dirtyUrl1 =
        'HTTPS://CAREERS.GOOGLE.COM/jobs/results/123/?utm_source=linkedin&utm_medium=feed&jobId=456&fbclid=abc123#overview';
      const clean1 = normalizeUrl(dirtyUrl1);
      expect(clean1).toBe('https://careers.google.com/jobs/results/123?jobId=456');

      const dirtyUrl2 =
        'https://example.com/apply/?ref=jobboard&source=twitter&p=2&b=2&a=1';
      const clean2 = normalizeUrl(dirtyUrl2);
      expect(clean2).toBe('https://example.com/apply?a=1&b=2&p=2');

      const rootUrl = 'https://company.com/';
      const cleanRoot = normalizeUrl(rootUrl);
      expect(cleanRoot).toBe('https://company.com/');
    });
  });

  // ==========================================
  // 5. Content Fingerprint Generator
  // ==========================================
  describe('Content Fingerprint Generator', () => {
    it('produces deterministic 64-character SHA-256 digests resilient to whitespace and case variations', () => {
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
      expect(fp1).toBe(fp2);
      expect(fp1).toHaveLength(64);

      const fpDifferentDate = generateContentFingerprint({
        organization: 'Google',
        title: 'Software Engineer Intern',
        deadline: '2026-11-01T00:00:00.000Z',
      });
      expect(fp1).not.toBe(fpDifferentDate);

      const fpFallbackEventDate = generateContentFingerprint({
        organization: 'HackMIT',
        title: 'Annual Hackathon',
        eventDate: '2026-09-20T00:00:00.000Z',
      });
      expect(fpFallbackEventDate).toHaveLength(64);
    });
  });

  // ==========================================
  // 6. HTML Sanitizer Utility
  // ==========================================
  describe('HTML Sanitizer Utility', () => {
    it('removes scripts, iframes, event handlers, decodes entities, and extracts readable text', () => {
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
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('alert("pwned")');
      expect(sanitized).not.toContain('<iframe>');
      expect(sanitized).not.toContain('onerror');
      expect(sanitized).not.toContain('javascript:');
      expect(sanitized).toContain('Software Engineering Intern');
      expect(sanitized).toContain('Build scalable web services.');
      expect(sanitized).toContain('Qualifications & Skills');

      const plainText = stripHtmlToPlainText('<p>Fast <b>paced</b> environment.</p>', 20);
      expect(plainText).toBe('Fast paced environme...');
    });
  });

  // ==========================================
  // 7. Validator Ingestion Field Protection
  // ==========================================
  describe('Validator Ingestion Field Protection', () => {
    it('strictly strips all ingestion-only metadata from standard client requests', () => {
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
      expect(validatedResult.error).toBeFalsy();
      expect(validatedResult.value.sourceRef).toBeUndefined();
      expect(validatedResult.value.externalId).toBeUndefined();
      expect(validatedResult.value.canonicalUrl).toBeUndefined();
      expect(validatedResult.value.contentFingerprint).toBeUndefined();
      expect(validatedResult.value.ingestionRunId).toBeUndefined();
    });
  });
});
