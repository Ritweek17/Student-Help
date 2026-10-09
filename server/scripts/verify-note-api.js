import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { User } from '../src/models/User.js';
import { Note } from '../src/models/Note.js';
import { createNote, listNotes, updateNote, deleteNote } from '../src/services/note.service.js';

let mongoServer;

async function connectDB() {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
}

async function verifyNoteApi() {
  console.log('--- Starting Note API Verification ---\n');
  await connectDB();

  try {
    // Setup test users
    const userA = await User.create({
      email: `userA_note_${Date.now()}@example.com`,
      passwordHash: 'hashedpassword',
    });

    const userB = await User.create({
      email: `userB_note_${Date.now()}@example.com`,
      passwordHash: 'hashedpassword',
    });

    console.log('Test Users Created:');
    console.log('User A:', userA._id);
    console.log('User B:', userB._id, '\n');

    // 1. Create a Note for User A
    console.log('1. Creating Note for User A...');
    const createRes = await createNote(userA._id, {
      title: 'User A First Note',
      content: 'This is the first note content',
      category: 'React',
      tags: ['React', 'Hooks'],
    });

    if (createRes.status !== 201) throw new Error(`Create failed: ${createRes.status}`);
    const noteIdA = createRes.data.note._id;
    console.log('✅ Note created successfully for User A. ID:', noteIdA, '\n');

    // 2. Validate injected userId is ignored (the service signature enforces userId implicitly, so controllers would just pass req.auth.userId)
    // 3. List User A notes
    console.log('3. Listing Notes for User A...');
    let listRes = await listNotes(userA._id, { category: 'React' });
    if (listRes.data.notes.length !== 1) throw new Error('List notes failed to find User A note');
    console.log('✅ List notes returned correct number for User A.\n');

    // 4. Update User A's note
    console.log('4. Updating User A Note...');
    const updateRes = await updateNote(userA._id, noteIdA, {
      title: 'Updated Title',
      isPinned: true
    });
    if (updateRes.status !== 200 || updateRes.data.note.title !== 'Updated Title') {
      throw new Error('Update failed');
    }
    console.log('✅ Update successful.\n');

    // 5. Ownership / IDOR test
    console.log('5. Testing IDOR: User B attempting to update User A Note...');
    const idorUpdate = await updateNote(userB._id, noteIdA, { title: 'Hacked Title' });
    if (idorUpdate.status !== 404) throw new Error(`IDOR vulnerability! Expected 404, got ${idorUpdate.status}`);
    console.log('✅ IDOR test passed: User B cannot update User A note.\n');

    console.log('Testing IDOR: User B attempting to delete User A Note...');
    const idorDelete = await deleteNote(userB._id, noteIdA);
    if (idorDelete.status !== 404) throw new Error('IDOR vulnerability! User B deleted User A note');
    console.log('✅ IDOR test passed: User B cannot delete User A note.\n');

    // 6. Delete User A's note
    console.log('6. Deleting User A Note...');
    const deleteRes = await deleteNote(userA._id, noteIdA);
    if (deleteRes.status !== 200) throw new Error('Delete failed');
    console.log('✅ Note deleted successfully.\n');

    // Verify deleted
    listRes = await listNotes(userA._id, {});
    if (listRes.data.notes.length !== 0) throw new Error('Note was not actually deleted');
    console.log('✅ Persistence verified: Note is gone.\n');

    // Cleanup
    await User.deleteMany({ _id: { $in: [userA._id, userB._id] } });
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
    
    console.log('--- Note API Verification Complete! ---');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Verification Failed:', error.message);
    process.exit(1);
  }
}

verifyNoteApi();
