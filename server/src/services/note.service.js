import { Note } from '../models/Note.js';

export async function createNote(userId, data = {}) {
  const doc = await Note.create({
    userId,
    title: data.title,
    content: data.content,
    category: data.category,
    tags: data.tags,
    isPinned: data.isPinned,
    opportunityId: data.opportunityId,
  });

  return {
    status: 201,
    data: {
      success: true,
      note: doc.toObject(),
    },
  };
}

export async function getNote(userId, noteId) {
  const doc = await Note.findOne({
    _id: noteId,
    userId,
  }).lean();

  if (!doc) {
    return {
      status: 404,
      message: 'Note not found',
    };
  }

  return {
    status: 200,
    data: {
      success: true,
      note: doc,
    },
  };
}

export async function listNotes(userId, params = {}) {
  const query = { userId };

  if (params.category) {
    query.category = params.category;
  }

  if (params.search) {
    const searchRegex = new RegExp(params.search, 'i');
    query.$or = [
      { title: searchRegex },
      { content: searchRegex },
      { tags: searchRegex }
    ];
  }

  const notes = await Note.find(query)
    .sort({ isPinned: -1, updatedAt: -1 })
    .lean();

  return {
    status: 200,
    data: {
      success: true,
      notes,
    },
  };
}

export async function updateNote(userId, noteId, data = {}) {
  const doc = await Note.findOne({
    _id: noteId,
    userId,
  });

  if (!doc) {
    return {
      status: 404,
      message: 'Note not found',
    };
  }

  if (data.title !== undefined) doc.title = data.title;
  if (data.content !== undefined) doc.content = data.content;
  if (data.category !== undefined) doc.category = data.category;
  if (data.tags !== undefined) doc.tags = data.tags;
  if (data.isPinned !== undefined) doc.isPinned = data.isPinned;
  if (data.opportunityId !== undefined) doc.opportunityId = data.opportunityId;

  await doc.save();

  return {
    status: 200,
    data: {
      success: true,
      note: doc.toObject(),
    },
  };
}

export async function deleteNote(userId, noteId) {
  const res = await Note.deleteOne({
    _id: noteId,
    userId,
  });

  if (res.deletedCount === 0) {
    return {
      status: 404,
      message: 'Note not found',
    };
  }

  return {
    status: 200,
    data: {
      success: true,
      message: 'Note deleted successfully',
    },
  };
}
