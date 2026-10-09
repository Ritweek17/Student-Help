import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app.js';
import { setupTestDatabase, clearTestDatabase, teardownTestDatabase } from '../setup.js';
import { User } from '../../src/models/User.js';
import { Note } from '../../src/models/Note.js';
import { generateAccessToken } from '../../src/services/auth.service.js';

describe('CareerOS Notes API Test Suite (Supertest + In-Memory ReplSet)', () => {
  let userA;
  let userB;
  let tokenA;
  let tokenB;

  beforeAll(async () => {
    await setupTestDatabase();
    await Note.init();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();

    userA = await User.create({
      email: `userA_notes_${Date.now()}@example.test`,
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz123456',
      role: 'student',
    });

    userB = await User.create({
      email: `userB_notes_${Date.now()}@example.test`,
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz123456',
      role: 'student',
    });

    tokenA = generateAccessToken(userA);
    tokenB = generateAccessToken(userB);
  });

  // ==========================================
  // 1. Database & Environment Isolation
  // ==========================================
  describe('Environment & Test Database Isolation', () => {
    it('runs against an in-memory replica set and never the local daemon port 27017', () => {
      expect(mongoose.connection.readyState).toBe(1);
      expect(mongoose.connection.port).not.toBe(27017);
    });
  });

  // ==========================================
  // 2. Authentication Boundary
  // ==========================================
  describe('Authentication Boundary', () => {
    it('rejects unauthenticated requests to GET /api/notes with 401', async () => {
      const res = await request(app).get('/api/notes');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects unauthenticated requests to POST /api/notes with 401', async () => {
      const res = await request(app)
        .post('/api/notes')
        .send({ title: 'No Auth Note', content: 'Test' });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ==========================================
  // 3. Note Creation & Validation & System Field Protection
  // ==========================================
  describe('POST /api/notes', () => {
    it('creates a note for authenticated user and binds userId from session', async () => {
      const res = await request(app)
        .post('/api/notes')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          title: 'User A First Note',
          content: 'This is the first note content',
          category: 'React',
          tags: ['React', 'Hooks'],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.note).toBeDefined();
      expect(res.body.note.title).toBe('User A First Note');
      expect(res.body.note.category).toBe('React');
      expect(res.body.note.tags).toEqual(['React', 'Hooks']);

      // Verify in DB that note belongs to userA
      const dbNote = await Note.findById(res.body.note._id);
      expect(dbNote).not.toBeNull();
      expect(dbNote.userId.toString()).toBe(userA._id.toString());
    });

    it('rejects client attempt to inject userId into request body with 400', async () => {
      const fakeUserId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .post('/api/notes')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          title: 'Injected User Note',
          content: 'Payload',
          userId: fakeUserId,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/userId cannot be supplied/i);
    });

    it('rejects client attempt to supply system timestamps with 400', async () => {
      const res = await request(app)
        .post('/api/notes')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          title: 'Timestamp Note',
          content: 'Payload',
          createdAt: new Date().toISOString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects note creation with missing title with 400', async () => {
      const res = await request(app)
        .post('/api/notes')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          content: 'Missing title content',
          category: 'General',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ==========================================
  // 4. Listing Notes & Category Filtering
  // ==========================================
  describe('GET /api/notes', () => {
    beforeEach(async () => {
      await Note.create([
        {
          userId: userA._id,
          title: 'React Hooks Note',
          content: 'Hooks guide',
          category: 'React',
          tags: ['React'],
        },
        {
          userId: userA._id,
          title: 'Backend API Note',
          content: 'Backend guide',
          category: 'Backend',
          tags: ['Backend'],
        },
        {
          userId: userB._id,
          title: 'User B Secret Note',
          content: 'Private note',
          category: 'React',
          tags: ['React'],
        },
      ]);
    });

    it('lists only notes belonging to authenticated user A', async () => {
      const res = await request(app)
        .get('/api/notes')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.notes).toHaveLength(2);
      expect(res.body.notes.every((n) => n.userId.toString() === userA._id.toString())).toBe(true);
    });

    it('filters notes by category for authenticated user', async () => {
      const res = await request(app)
        .get('/api/notes?category=React')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.notes).toHaveLength(1);
      expect(res.body.notes[0].title).toBe('React Hooks Note');
    });

    it('lists only user B notes for user B', async () => {
      const res = await request(app)
        .get('/api/notes')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.notes).toHaveLength(1);
      expect(res.body.notes[0].title).toBe('User B Secret Note');
    });
  });

  // ==========================================
  // 5. Single Note Retrieval & Validation
  // ==========================================
  describe('GET /api/notes/:id', () => {
    let noteA;

    beforeEach(async () => {
      noteA = await Note.create({
        userId: userA._id,
        title: 'User A Detail Note',
        content: 'Detail content',
        category: 'General',
      });
    });

    it('retrieves single note for owner user A', async () => {
      const res = await request(app)
        .get(`/api/notes/${noteA._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.note._id.toString()).toBe(noteA._id.toString());
      expect(res.body.note.title).toBe('User A Detail Note');
    });

    it('prevents user B from retrieving user A note (returns 404)', async () => {
      const res = await request(app)
        .get(`/api/notes/${noteA._id}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 for malformed note ID', async () => {
      const res = await request(app)
        .get('/api/notes/invalid-note-id')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 for nonexistent note ID', async () => {
      const nonexistentId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/notes/${nonexistentId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  // ==========================================
  // 6. Note Update & IDOR Protection
  // ==========================================
  describe('PATCH /api/notes/:id', () => {
    let noteA;

    beforeEach(async () => {
      noteA = await Note.create({
        userId: userA._id,
        title: 'Original Title',
        content: 'Original Content',
        category: 'React',
        isPinned: false,
      });
    });

    it('allows owner User A to update note title and pinned status', async () => {
      const res = await request(app)
        .patch(`/api/notes/${noteA._id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          title: 'Updated Title',
          isPinned: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.note.title).toBe('Updated Title');
      expect(res.body.note.isPinned).toBe(true);

      const dbNote = await Note.findById(noteA._id);
      expect(dbNote.title).toBe('Updated Title');
      expect(dbNote.isPinned).toBe(true);
    });

    it('prevents User B from updating User A note (IDOR protection returns 404)', async () => {
      const res = await request(app)
        .patch(`/api/notes/${noteA._id}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          title: 'Hacked Title',
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);

      // Verify in DB note was not modified
      const dbNote = await Note.findById(noteA._id);
      expect(dbNote.title).toBe('Original Title');
    });

    it('rejects attempt to modify userId or system fields on update with 400', async () => {
      const res = await request(app)
        .patch(`/api/notes/${noteA._id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          userId: userB._id.toString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 for malformed note ID on update', async () => {
      const res = await request(app)
        .patch('/api/notes/bad-id')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ title: 'Test' });

      expect(res.status).toBe(400);
    });
  });

  // ==========================================
  // 7. Note Deletion & IDOR Protection
  // ==========================================
  describe('DELETE /api/notes/:id', () => {
    let noteA;

    beforeEach(async () => {
      noteA = await Note.create({
        userId: userA._id,
        title: 'To Be Deleted',
        content: 'Content',
        category: 'General',
      });
    });

    it('prevents User B from deleting User A note (IDOR protection returns 404)', async () => {
      const res = await request(app)
        .delete(`/api/notes/${noteA._id}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);

      const dbNote = await Note.findById(noteA._id);
      expect(dbNote).not.toBeNull();
    });

    it('allows owner User A to delete own note and verifies removal', async () => {
      const res = await request(app)
        .delete(`/api/notes/${noteA._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const dbNote = await Note.findById(noteA._id);
      expect(dbNote).toBeNull();

      // List returns 0 notes
      const listRes = await request(app)
        .get('/api/notes')
        .set('Authorization', `Bearer ${tokenA}`);
      expect(listRes.body.notes).toHaveLength(0);
    });

    it('returns 400 for malformed note ID on deletion', async () => {
      const res = await request(app)
        .delete('/api/notes/invalid-id')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(400);
    });

    it('returns 404 for repeated deletion of already deleted note', async () => {
      await request(app)
        .delete(`/api/notes/${noteA._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      const repeatRes = await request(app)
        .delete(`/api/notes/${noteA._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(repeatRes.status).toBe(404);
    });
  });
});
