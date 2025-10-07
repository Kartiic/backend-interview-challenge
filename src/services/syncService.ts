import { Database } from '../db/database';
import { Task, SyncQueueItem } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class SyncService {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async enqueueSync(taskId: string, operation: 'create' | 'update' | 'delete', data: any): Promise<void> {
    const id = uuidv4();
    const payload = JSON.stringify(data);

    await this.db.run(
      `INSERT INTO sync_queue (id, task_id, operation, data)
       VALUES (?, ?, ?, ?)`,
      [id, taskId, operation, payload]
    );
  }

  async processSyncQueue(): Promise<void> {
    const items = await this.db.all(`SELECT * FROM sync_queue ORDER BY created_at ASC`);

    for (const item of items) {
      try {
        const data = JSON.parse(item.data);
        await this.syncWithServer(item.operation, data);

        await this.db.run(`DELETE FROM sync_queue WHERE id = ?`, [item.id]);

        await this.db.run(
          `UPDATE tasks 
           SET sync_status = 'synced', last_synced_at = CURRENT_TIMESTAMP 
           WHERE id = ?`,
          [item.task_id]
        );
      } catch (err: any) {
        console.error('Sync failed for', item.task_id, err.message);
        await this.db.run(
          `UPDATE sync_queue 
           SET retry_count = retry_count + 1, error_message = ? 
           WHERE id = ?`,
          [err.message, item.id]
        );
      }
    }
  }

  // Mock server sync (in a real app, call your backend API)
  private async syncWithServer(operation: string, task: Task): Promise<void> {
    // Simulate network delay and conflict check
    await new Promise((r) => setTimeout(r, 100));
    console.log(`✅ Synced [${operation}] for task ${task.id}`);
  }

  // Conflict resolution: prefer latest updated_at
  async resolveConflict(local: Task, remote: Task): Promise<Task> {
    return new Date(local.updated_at || 0) > new Date(remote.updated_at || 0)
      ? local
      : remote;
  }

  async getSyncQueue(): Promise<SyncQueueItem[]> {
    const rows = await this.db.all(`SELECT * FROM sync_queue`);
    return rows.map((r) => ({
      id: r.id,
      task_id: r.task_id,
      operation: r.operation,
      data: r.data,
      created_at: r.created_at,
      retry_count: r.retry_count,
      error_message: r.error_message,
    }));
  }
}
