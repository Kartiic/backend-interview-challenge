import { Database } from '../db/database';
import { Task } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class TaskService {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async createTask(taskData: Partial<Task>): Promise<Task> {
    const id = uuidv4();
    const task: Task = {
      id,
      title: taskData.title || 'Untitled Task',
      description: taskData.description || '',
      completed: false,
      is_deleted: false,
      sync_status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await this.db.run(
      `INSERT INTO tasks (id, title, description, completed, created_at, updated_at, is_deleted, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        task.id,
        task.title,
        task.description,
        task.completed ? 1 : 0,
        task.created_at,
        task.updated_at,
        0,
        'pending',
      ]
    );

    return task;
  }

  async getAllTasks(): Promise<Task[]> {
    const rows = await this.db.all(`SELECT * FROM tasks WHERE is_deleted = 0`);
    return rows.map(this.mapRowToTask);
  }

  async getTaskById(id: string): Promise<Task | null> {
    const row = await this.db.get(`SELECT * FROM tasks WHERE id = ? AND is_deleted = 0`, [id]);
    return row ? this.mapRowToTask(row) : null;
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<Task | null> {
    const existing = await this.getTaskById(id);
    if (!existing) return null;

    const updated: Task = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
      sync_status: 'pending',
    };

    await this.db.run(
      `UPDATE tasks 
       SET title = ?, description = ?, completed = ?, updated_at = ?, sync_status = ?
       WHERE id = ?`,
      [updated.title, updated.description, updated.completed ? 1 : 0, updated.updated_at, 'pending', id]
    );

    return updated;
  }

  async deleteTask(id: string): Promise<boolean> {
    const existing = await this.getTaskById(id);
    if (!existing) return false;

    await this.db.run(`UPDATE tasks SET is_deleted = 1, sync_status = 'pending' WHERE id = ?`, [id]);
    return true;
  }

  private mapRowToTask(row: any): Task {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      completed: !!row.completed,
      created_at: row.created_at,
      updated_at: row.updated_at,
      is_deleted: !!row.is_deleted,
      sync_status: row.sync_status,
      server_id: row.server_id,
      last_synced_at: row.last_synced_at,
    };
  }
}
