import { Router } from 'express';
import {
  createTodo,
  getTodo,
  listTodos,
  updateTodo,
  deleteTodo,
} from '../controllers/todo.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const todoRouter = Router();

todoRouter.use(requireAuth);

todoRouter.post('/todos', createTodo);
todoRouter.get('/todos', listTodos);
todoRouter.get('/todos/:id', getTodo);
todoRouter.put('/todos/:id', updateTodo);
todoRouter.delete('/todos/:id', deleteTodo);
