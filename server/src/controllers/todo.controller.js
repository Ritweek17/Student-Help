import * as todoService from '../services/todo.service.js';
import {
  validateTodoId,
  validateTodoCreate,
  validateTodoUpdate,
  validateTodoQuery,
} from '../validators/todo.validator.js';

export async function createTodo(request, response, next) {
  try {
    const { error, value } = validateTodoCreate(request.body);
    if (error) {
      return response.status(400).json({
        success: false,
        message: error,
      });
    }

    const userId = request.auth.userId;
    const result = await todoService.createTodo(userId, value);

    return response.status(result.status).json(result.data);
  } catch (error) {
    return next(error);
  }
}

export async function getTodo(request, response, next) {
  try {
    const { id } = request.params;
    if (!validateTodoId(id)) {
      return response.status(400).json({
        success: false,
        message: 'Invalid todo ID',
      });
    }

    const userId = request.auth.userId;
    const result = await todoService.getTodo(userId, id);

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

export async function listTodos(request, response, next) {
  try {
    const { error, value } = validateTodoQuery(request.query);
    if (error) {
      return response.status(400).json({
        success: false,
        message: error,
      });
    }

    const userId = request.auth.userId;
    const result = await todoService.listTodos(userId, value);

    return response.status(result.status).json(result.data);
  } catch (error) {
    return next(error);
  }
}

export async function updateTodo(request, response, next) {
  try {
    const { id } = request.params;
    if (!validateTodoId(id)) {
      return response.status(400).json({
        success: false,
        message: 'Invalid todo ID',
      });
    }

    const { error, value } = validateTodoUpdate(request.body);
    if (error) {
      return response.status(400).json({
        success: false,
        message: error,
      });
    }

    const userId = request.auth.userId;
    const result = await todoService.updateTodo(userId, id, value);

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

export async function deleteTodo(request, response, next) {
  try {
    const { id } = request.params;
    if (!validateTodoId(id)) {
      return response.status(400).json({
        success: false,
        message: 'Invalid todo ID',
      });
    }

    const userId = request.auth.userId;
    const result = await todoService.deleteTodo(userId, id);

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
