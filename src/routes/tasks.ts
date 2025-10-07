import { Router } from 'express';
import { TaskService } from '../services/taskService';
import { Database } from '../db/database';

export function createTaskRouter(db: Database): Router {
  const router = Router();
  const taskService = new TaskService(db);

  router.get('/', async (_, res) => {
    const tasks = await taskService.getAllTasks();
    res.json(tasks);
  });

  router.get('/:id', async (req, res) => {
    const task = await taskService.getTask(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  });

  router.post('/', async (req, res) => {
    if (!req.body.title) return res.status(400).json({ error: 'Title required' });
    const task = await taskService.createTask(req.body);
    res.status(201).json(task);
  });

  router.put('/:id', async (req, res) => {
    const task = await taskService.updateTask(req.params.id, req.body);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  });

  router.delete('/:id', async (req, res) => {
    const success = await taskService.deleteTask(req.params.id);
    if (!success) return res.status(404).json({ error: 'Task not found' });
    res.json({ success: true });
  });

  return router;
}
