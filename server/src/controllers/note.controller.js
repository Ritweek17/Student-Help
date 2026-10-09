import * as noteService from '../services/note.service.js';
import {
  validateNoteId,
  validateNoteCreate,
  validateNoteUpdate,
  validateNoteQuery,
} from '../validators/note.validator.js';

export async function createNote(request, response, next) {
  try {
    const { error, value } = validateNoteCreate(request.body);
    if (error) {
      return response.status(400).json({
        success: false,
        message: error,
      });
    }

    const userId = request.auth.userId;
    const result = await noteService.createNote(userId, value);

    return response.status(result.status).json(result.data);
  } catch (error) {
    return next(error);
  }
}

export async function getNote(request, response, next) {
  try {
    const { id } = request.params;
    if (!validateNoteId(id)) {
      return response.status(400).json({
        success: false,
        message: 'Invalid note ID',
      });
    }

    const userId = request.auth.userId;
    const result = await noteService.getNote(userId, id);

    if (result.status === 404) {
      return response.status(404).json({
        success: false,
        message: result.message,
      });
    }

    return response.status(result.status).json(result.data);
  } catch (error) {
    return next(error);
  }
}

export async function listNotes(request, response, next) {
  try {
    const { error, value } = validateNoteQuery(request.query);
    if (error) {
      return response.status(400).json({
        success: false,
        message: error,
      });
    }

    const userId = request.auth.userId;
    const result = await noteService.listNotes(userId, value);

    return response.status(result.status).json(result.data);
  } catch (error) {
    return next(error);
  }
}

export async function updateNote(request, response, next) {
  try {
    const { id } = request.params;
    if (!validateNoteId(id)) {
      return response.status(400).json({
        success: false,
        message: 'Invalid note ID',
      });
    }

    const { error, value } = validateNoteUpdate(request.body);
    if (error) {
      return response.status(400).json({
        success: false,
        message: error,
      });
    }

    const userId = request.auth.userId;
    const result = await noteService.updateNote(userId, id, value);

    if (result.status === 404) {
      return response.status(404).json({
        success: false,
        message: result.message,
      });
    }

    return response.status(result.status).json(result.data);
  } catch (error) {
    return next(error);
  }
}

export async function deleteNote(request, response, next) {
  try {
    const { id } = request.params;
    if (!validateNoteId(id)) {
      return response.status(400).json({
        success: false,
        message: 'Invalid note ID',
      });
    }

    const userId = request.auth.userId;
    const result = await noteService.deleteNote(userId, id);

    if (result.status === 404) {
      return response.status(404).json({
        success: false,
        message: result.message,
      });
    }

    return response.status(result.status).json(result.data);
  } catch (error) {
    return next(error);
  }
}
