import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as noteController from '../controllers/note.controller.js';

export const noteRouter = Router();

noteRouter.use(requireAuth);

noteRouter.get('/notes', noteController.listNotes);
noteRouter.post('/notes', noteController.createNote);
noteRouter.get('/notes/:id', noteController.getNote);
noteRouter.patch('/notes/:id', noteController.updateNote);
noteRouter.delete('/notes/:id', noteController.deleteNote);
