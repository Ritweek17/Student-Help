import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { setupTestDatabase, clearTestDatabase, teardownTestDatabase } from '../setup.js';
import { Opportunity } from '../../src/models/Opportunity.js';

describe('CareerOS Models Test Suite — Opportunity Model', () => {
  beforeAll(async () => {
    await setupTestDatabase();
    await Opportunity.init();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();
  });

  // ==========================================
  // 1. Database Isolation
  // ==========================================
  describe('Database Isolation', () => {
    it('runs against an in-memory replica set and never the local daemon port 27017', () => {
      expect(mongoose.connection.readyState).toBe(1);
      expect(mongoose.connection.port).not.toBe(27017);
    });
  });

  // ==========================================
  // 2. Valid Opportunity Creations
  // ==========================================
  describe('Valid Opportunity Creations', () => {
    const testPrefix = 'Opportunity Test';

    it('creates a valid internship opportunity with correct fields, timestamps, and lowercase skills', async () => {
      const internship = await Opportunity.create({
        title: `${testPrefix} - Software Engineering Intern`,
        organization: 'Tech Corp',
        description: 'Build scalable services and API endpoints.',
        shortDescription: 'Software Engineering Summer Internship',
        type: 'internship',
        workMode: 'hybrid',
        location: { country: 'India', state: 'Karnataka', city: 'Bengaluru' },
        stipend: { amount: 35000, currency: 'INR', period: 'monthly' },
        duration: '3 months',
        applicationUrl: 'https://techcorp.example.com/apply/123',
        organizationWebsite: 'https://techcorp.example.com',
        skills: ['JavaScript', 'Node.js', 'React'],
        tags: ['FullStack', 'WebDev'],
        status: 'published',
        featured: true,
      });

      expect(internship._id).toBeDefined();
      expect(internship.status).toBe('published');
      expect(internship.featured).toBe(true);
      expect(internship.createdAt).toBeDefined();
      expect(internship.updatedAt).toBeDefined();
      expect(internship.skills).toContain('javascript');
    });

    it('creates a valid hackathon with default status "draft" and default verified false', async () => {
      const hackathon = await Opportunity.create({
        title: `${testPrefix} - AI Innovation Hackathon`,
        organization: 'AI Foundation',
        description: '48-hour global AI challenge.',
        type: 'hackathon',
        workMode: 'onsite',
        prize: { amount: 500000, currency: 'INR' },
        eventDate: new Date('2026-10-15T09:00:00Z'),
        endDate: new Date('2026-10-17T18:00:00Z'),
        deadline: new Date('2026-10-10T23:59:59Z'),
        registrationUrl: 'https://aifoundation.example.com/hackathon',
      });

      expect(hackathon._id).toBeDefined();
      expect(hackathon.status).toBe('draft');
      expect(hackathon.verified).toBe(false);
    });

    it('creates a valid workshop opportunity', async () => {
      const workshop = await Opportunity.create({
        title: `${testPrefix} - Cloud Architecture Workshop`,
        organization: 'Cloud Alliance',
        description: 'Hands-on AWS and Docker session.',
        type: 'workshop',
        workMode: 'online',
        eventDate: new Date('2026-11-01T10:00:00Z'),
      });

      expect(workshop._id).toBeDefined();
    });

    it('creates a valid online event (expo) opportunity with source metadata', async () => {
      const onlineEvent = await Opportunity.create({
        title: `${testPrefix} - Global Tech Expo`,
        organization: 'TechExpo International',
        description: 'Virtual tech conference and expo.',
        type: 'expo',
        workMode: 'online',
        source: { name: 'Devfolio', url: 'https://devfolio.example.com' },
      });

      expect(onlineEvent._id).toBeDefined();
    });

    it('creates a valid remote open_source opportunity', async () => {
      const remoteOpp = await Opportunity.create({
        title: `${testPrefix} - Open Source Contributor`,
        organization: 'OpenSource Labs',
        description: 'Contribute to core repository.',
        type: 'open_source',
        workMode: 'remote',
      });

      expect(remoteOpp._id).toBeDefined();
    });
  });

  // ==========================================
  // 3. Schema Validation & Rejections
  // ==========================================
  describe('Schema Validation & Rejections', () => {
    it('rejects missing title', async () => {
      const opp = new Opportunity({
        organization: 'Tech Corp',
        description: 'Desc',
        type: 'internship',
      });
      await expect(opp.validate()).rejects.toThrow(mongoose.Error.ValidationError);
    });

    it('rejects missing organization', async () => {
      const opp = new Opportunity({
        title: 'Test Opp',
        description: 'Desc',
        type: 'internship',
      });
      await expect(opp.validate()).rejects.toThrow(mongoose.Error.ValidationError);
    });

    it('rejects invalid type enum', async () => {
      const opp = new Opportunity({
        title: 'Test Opp',
        organization: 'Tech Corp',
        description: 'Desc',
        type: 'invalid_type',
      });
      await expect(opp.validate()).rejects.toThrow(mongoose.Error.ValidationError);
    });

    it('rejects invalid workMode enum', async () => {
      const opp = new Opportunity({
        title: 'Test Opp',
        organization: 'Tech Corp',
        description: 'Desc',
        type: 'internship',
        workMode: 'invalid_mode',
      });
      await expect(opp.validate()).rejects.toThrow(mongoose.Error.ValidationError);
    });

    it('rejects invalid status enum', async () => {
      const opp = new Opportunity({
        title: 'Test Opp',
        organization: 'Tech Corp',
        description: 'Desc',
        type: 'internship',
        status: 'invalid_status',
      });
      await expect(opp.validate()).rejects.toThrow(mongoose.Error.ValidationError);
    });

    it('rejects invalid applicationUrl scheme (ftp://)', async () => {
      const opp = new Opportunity({
        title: 'Test Opp',
        organization: 'Tech Corp',
        description: 'Desc',
        type: 'internship',
        applicationUrl: 'ftp://example.com',
      });
      await expect(opp.validate()).rejects.toThrow(mongoose.Error.ValidationError);
    });

    it('rejects invalid registrationUrl scheme (javascript:)', async () => {
      const opp = new Opportunity({
        title: 'Test Opp',
        organization: 'Tech Corp',
        description: 'Desc',
        type: 'internship',
        registrationUrl: 'javascript:alert(1)',
      });
      await expect(opp.validate()).rejects.toThrow(mongoose.Error.ValidationError);
    });

    it('rejects invalid organizationWebsite scheme (file://)', async () => {
      const opp = new Opportunity({
        title: 'Test Opp',
        organization: 'Tech Corp',
        description: 'Desc',
        type: 'internship',
        organizationWebsite: 'file:///etc/passwd',
      });
      await expect(opp.validate()).rejects.toThrow(mongoose.Error.ValidationError);
    });

    it('rejects negative stipend amount', async () => {
      const opp = new Opportunity({
        title: 'Test Opp',
        organization: 'Tech Corp',
        description: 'Desc',
        type: 'internship',
        stipend: { amount: -500 },
      });
      await expect(opp.validate()).rejects.toThrow(mongoose.Error.ValidationError);
    });

    it('rejects negative prize amount', async () => {
      const opp = new Opportunity({
        title: 'Test Opp',
        organization: 'Tech Corp',
        description: 'Desc',
        type: 'hackathon',
        prize: { amount: -1000 },
      });
      await expect(opp.validate()).rejects.toThrow(mongoose.Error.ValidationError);
    });

    it('rejects endDate before eventDate', async () => {
      const opp = new Opportunity({
        title: 'Test Opp',
        organization: 'Tech Corp',
        description: 'Desc',
        type: 'hackathon',
        eventDate: new Date('2026-10-15T00:00:00Z'),
        endDate: new Date('2026-10-14T00:00:00Z'),
      });
      await expect(opp.validate()).rejects.toThrow(mongoose.Error.ValidationError);
    });
  });

  // ==========================================
  // 4. Collection Indexes
  // ==========================================
  describe('Indexes', () => {
    it('verifies essential Opportunity query indexes exist', async () => {
      const indexes = await Opportunity.collection.indexes();
      expect(indexes.some((idx) => idx.key.title === 1)).toBe(true);
      expect(indexes.some((idx) => idx.key.organization === 1)).toBe(true);
      expect(indexes.some((idx) => idx.key.type === 1)).toBe(true);
      expect(indexes.some((idx) => idx.key.status === 1)).toBe(true);
      expect(indexes.some((idx) => idx.key.featured === 1)).toBe(true);
    });
  });
});
