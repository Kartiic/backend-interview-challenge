import { v4 as uuidv4 } from 'uuid';
import { Task } from '../types';
import { Database } from '../db/database';
import { SyncService } from './syncService';

export class TaskService {
  private syncService: SyncService;

  constructor(private db: Database) {
    this.syncService = new SyncService(db, this);
  }

  // ✅ Create a new task
  async createTask(taskData: Partial<Task>): Promise<Task> {
    const id = uuidv4();
    const now = new Date();

    const task: Task = {
      id,
      title: taskData.title || 'Untitled Task',
      description: taskData.description || '',
      completed: false,
      created_at: now,
      updated_at: now,
      is_deleted: false,
      sync_status: 'pending',
    };

    await this.db.run(
      `INSERT INTO tasks (id, title, description, completed, created_at, updated_at, is_deleted, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        task.id,
        task.title,
        task.description,
        task.completed ? 1 : 0,
        task.created_at.toISOString(),
        task.updated_at.toISOString(),
        task.is_deleted ? 1 : 0,
        task.sync_status,
      ]
    );

    await this.syncService.addToSyncQueue(task.id, 'create', task);
    return task;
  }

  // ✅ Update an existing task
  async updateTask(id: string, updates: Partial<Task>): Promise<Task | null> {
    const existing = await this.getTask(id);
    if (!existing) return null;

    const updatedTask: Task = {
      ...existing,
      ...updates,
      updated_at: new Date(),
      sync_status: 'pending',
    };

    await this.db.run(
      `UPDATE tasks SET title = ?, description = ?, completed = ?, updated_at = ?, sync_status = ? WHERE id = ?`,
      [
        updatedTask.title,
        updatedTask.description,
        updatedTask.completed ? 1 : 0,
        updatedTask.updated_at.toISOString(),
        updatedTask.sync_status,
        id,
      ]
    );

    await this.syncService.addToSyncQueue(id, 'update', updatedTask);
    return updatedTask;
  }

  // ✅ Soft delete task
  async deleteTask(id: string): Promise<boolean> {
    const existing = await this.getTask(id);
    if (!existing) return false;

    const updatedAt = new Date();
    await this.db.run(
      `UPDATE tasks SET is_deleted = 1, updated_at = ?, sync_status = 'pending' WHERE id = ?`,
      [updatedAt.toISOString(), id]
    );

    await this.syncService.addToSyncQueue(id, 'delete', existing);
    return true;
  }

  // ✅ Get single task
  async getTask(id: string): Promise<Task | null> {
    const row = await this.db.get(`SELECT * FROM tasks WHERE id = ?`, [id]);
    if (!row || row.is_deleted) return null;

    return this.mapRowToTask(row);
  }

  // ✅ Get all active tasks
  async getAllTasks(): Promise<Task[]> {
    const rows = await this.db.all(
      `SELECT * FROM tasks WHERE is_deleted = 0 ORDER BY updated_at DESC`
    );
    return rows.map(this.mapRowToTask);
  }

  // ✅ Tasks pending sync
  async getTasksNeedingSync(): Promise<Task[]> {
    const rows = await this.db.all(
      `SELECT * FROM tasks WHERE sync_status IN ('pending', 'error')`
    );
    return rows.map(this.mapRowToTask);
  }

  private mapRowToTask(row: any): Task {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      completed: !!row.completed,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      is_deleted: !!row.is_deleted,
      sync_status: row.sync_status,
      server_id: row.server_id,
      last_synced_at: row.last_synced_at ? new Date(row.last_synced_at) : undefined,
    };
  }
}
