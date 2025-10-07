import { v4 as uuidv4 } from 'uuid';
import { Task } from '../types';
import { Database } from '../db/database';

export class TaskService {
  constructor(private db: Database) {}

  async createTask(taskData: Partial<Task>): Promise<Task> {
    const id = uuidv4();
    const now = new Date().toISOString();
    const task: Task = {
      id,
      title: taskData.title!,
      description: taskData.description || '',
      completed: false,
      created_at: new Date(now),
      updated_at: new Date(now),
      is_deleted: false,
      sync_status: 'pending'
    };
    await this.db.run(
      'INSERT INTO tasks (id, title, description, completed, created_at, updated_at, is_deleted, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [task.id, task.title, task.description, 0, now, now, 0, 'pending']
    );
    return task;
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<Task | null> {
    const existing = await this.getTask(id);
    if (!existing) return null;
    const now = new Date().toISOString();
    const updated = { ...existing, ...updates, updated_at: new Date(now), sync_status: 'pending' };
    await this.db.run(
      'UPDATE tasks SET title=?, description=?, completed=?, updated_at=?, sync_status=? WHERE id=?',
      [updated.title, updated.description, updated.completed ? 1 : 0, now, 'pending', id]
    );
    return updated;
  }

  async deleteTask(id: string): Promise<boolean> {
    const existing = await this.getTask(id);
    if (!existing) return false;
    const now = new Date().toISOString();
    await this.db.run(
      'UPDATE tasks SET is_deleted=1, updated_at=?, sync_status=? WHERE id=?',
      [now, 'pending', id]
    );
    return true;
  }

  async getTask(id: string): Promise<Task | null> {
    const row = await this.db.get('SELECT * FROM tasks WHERE id=?', [id]);
    if (!row || row.is_deleted) return null;
    return this.mapRow(row);
  }

  async getAllTasks(): Promise<Task[]> {
    const rows = await this.db.all('SELECT * FROM tasks WHERE is_deleted=0');
    return rows.map(this.mapRow);
  }

  private mapRow(row: any): Task {
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
      last_synced_at: row.last_synced_at ? new Date(row.last_synced_at) : undefined
    };
  }
}
