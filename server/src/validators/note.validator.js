import mongoose from 'mongoose';
import { NOTE_CATEGORIES } from '../models/Note.js';

export function validateNoteId(id) {
  if (!id || typeof id !== 'string') return false;
  return mongoose.Types.ObjectId.isValid(id);
}

export function validateNoteCreate(data = {}) {
  const {
    title,
    content,
    category,
    tags,
    isPinned,
    opportunityId,
    userId,
    _id,
    createdAt,
    updatedAt,
  } = data;

  if (userId !== undefined) return { error: 'userId cannot be supplied in request body' };
  if (_id !== undefined) return { error: '_id cannot be supplied in request body' };
  if (createdAt !== undefined || updatedAt !== undefined) {
    return { error: 'System timestamp fields cannot be supplied in request body' };
  }

  if (!title || typeof title !== 'string' || !title.trim()) {
    return { error: 'Note title is required' };
  }
  if (title.trim().length > 200) {
    return { error: 'Note title cannot exceed 200 characters' };
  }

  if (!content || typeof content !== 'string' || !content.trim()) {
    return { error: 'Note content is required' };
  }
  if (content.trim().length > 10000) {
    return { error: 'Note content cannot exceed 10000 characters' };
  }

  let cleanCategory = 'General';
  if (category !== undefined && category !== null && category !== '') {
    const c = String(category).trim();
    if (!NOTE_CATEGORIES.includes(c)) {
      return { error: `Category must be one of: ${NOTE_CATEGORIES.join(', ')}` };
    }
    cleanCategory = c;
  }

  let cleanTags = [];
  if (tags !== undefined && tags !== null) {
    if (!Array.isArray(tags)) {
      return { error: 'Tags must be an array of strings' };
    }
    cleanTags = tags.map(t => String(t).trim()).filter(Boolean);
    if (cleanTags.length > 10) {
      return { error: 'Cannot exceed 10 tags' };
    }
  }

  let cleanOpportunityId = undefined;
  if (opportunityId !== undefined && opportunityId !== null && opportunityId !== '') {
    if (!mongoose.Types.ObjectId.isValid(opportunityId)) {
      return { error: 'Invalid opportunityId' };
    }
    cleanOpportunityId = opportunityId;
  }

  return {
    error: null,
    value: {
      title: title.trim(),
      content: content.trim(),
      category: cleanCategory,
      tags: cleanTags,
      isPinned: Boolean(isPinned),
      opportunityId: cleanOpportunityId,
    },
  };
}

export function validateNoteUpdate(data = {}) {
  const {
    title,
    content,
    category,
    tags,
    isPinned,
    opportunityId,
    userId,
    _id,
    createdAt,
    updatedAt,
  } = data;

  if (userId !== undefined || _id !== undefined || createdAt !== undefined || updatedAt !== undefined) {
    return { error: 'Immutable or system fields cannot be modified' };
  }

  let cleanTitle = undefined;
  if (title !== undefined) {
    if (!title || typeof title !== 'string' || !title.trim()) return { error: 'Note title cannot be empty' };
    if (title.trim().length > 200) return { error: 'Note title cannot exceed 200 characters' };
    cleanTitle = title.trim();
  }

  let cleanContent = undefined;
  if (content !== undefined) {
    if (!content || typeof content !== 'string' || !content.trim()) return { error: 'Note content cannot be empty' };
    if (content.trim().length > 10000) return { error: 'Note content cannot exceed 10000 characters' };
    cleanContent = content.trim();
  }

  let cleanCategory = undefined;
  if (category !== undefined) {
    if (!category || typeof category !== 'string' || !NOTE_CATEGORIES.includes(category.trim())) {
      return { error: `Category must be one of: ${NOTE_CATEGORIES.join(', ')}` };
    }
    cleanCategory = category.trim();
  }

  let cleanTags = undefined;
  if (tags !== undefined && tags !== null) {
    if (!Array.isArray(tags)) return { error: 'Tags must be an array of strings' };
    cleanTags = tags.map(t => String(t).trim()).filter(Boolean);
    if (cleanTags.length > 10) return { error: 'Cannot exceed 10 tags' };
  }

  let cleanOpportunityId = undefined;
  if (opportunityId !== undefined) {
    if (opportunityId === null || opportunityId === '') {
      cleanOpportunityId = null;
    } else {
      if (!mongoose.Types.ObjectId.isValid(opportunityId)) return { error: 'Invalid opportunityId' };
      cleanOpportunityId = opportunityId;
    }
  }

  let cleanIsPinned = undefined;
  if (isPinned !== undefined) {
    cleanIsPinned = Boolean(isPinned);
  }

  return {
    error: null,
    value: {
      title: cleanTitle,
      content: cleanContent,
      category: cleanCategory,
      tags: cleanTags,
      isPinned: cleanIsPinned,
      opportunityId: cleanOpportunityId,
    },
  };
}

export function validateNoteQuery(query = {}) {
  let category = undefined;
  if (query.category !== undefined && query.category !== null && query.category !== '' && query.category !== 'All') {
    const c = String(query.category).trim();
    if (!NOTE_CATEGORIES.includes(c)) {
      return { error: `Invalid category filter '${c}'` };
    }
    category = c;
  }

  let search = undefined;
  if (query.search !== undefined && query.search !== null && query.search !== '') {
    search = String(query.search).trim();
  }

  return {
    error: null,
    value: {
      category,
      search,
    }
  };
}
