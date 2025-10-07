import axios from 'axios';
import crypto from 'crypto';
import { Task, SyncQueueItem, SyncResult, BatchSyncResponse } from '../types';
import { Database } from '../db/database';
import { TaskService } from './taskService';
import { CHALLENGE_CONSTRAINTS } from '../types/challengeConstraints';

export class SyncService {
  private apiUrl: string;

  constructor(
    private db: Database,
    private taskService: TaskService,
    apiUrl: string = process.env.API_BASE_URL || 'http://localhost:3000/api'
  ) {
    this.apiUrl = apiUrl;
  }

  // ✅ Main Sync Process
  async sync(): Promise<SyncResult> {
    const items: SyncQueueItem[] = await this.db.all(
      'SELECT * FROM sync_queue ORDER BY created_at ASC'
    );

    if (items.length === 0) {
      return { success: true, synced_items: 0, failed_items: 0, errors: [] };
    }

    const batchSize = Number(process.env.SYNC_BATCH_SIZE || 10);
    const batches = [];

    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }

    let synced = 0;
    let failed = 0;
    const errors = [];

    for (const batch of batches) {
      try {
        const response = await this.processBatch(batch);
        for (const item of response.processed_items) {
          if (item.status === 'success') {
            synced++;
            await this.updateSyncStatus(item.client_id, 'synced', {
              server_id: item.server_id,
            });
          } else if (item.status === 'conflict' && item.resolved_data) {
            const resolved = item.resolved_data;
            await this.taskService.updateTask(resolved.id, resolved);
            await this.updateSyncStatus(resolved.id, 'synced');
            synced++;
          } else {
            failed++;
            await this.updateSyncStatus(item.client_id, 'error');
          }
        }
      } catch (err: any) {
        failed += batch.length;
        for (const item of batch) {
          await this.handleSyncError(item, err);
          errors.push({
            task_id: item.task_id,
            operation: item.operation,
            error: err.message,
            timestamp: new Date(),
          });
        }
      }
    }

    return {
      success: failed === 0,
      synced_items: synced,
      failed_items: failed,
      errors,
    };
  }

  // ✅ Add Task Operation to Sync Queue
  async addToSyncQueue(
    taskId: string,
    operation: 'create' | 'update' | 'delete',
    data: Partial<Task>
  ): Promise<void> {
    const id = crypto.randomUUID();
    const serialized = JSON.stringify(data);

    await this.db.run(
      `INSERT INTO sync_queue (id, task_id, operation, data)
       VALUES (?, ?, ?, ?)`,
      [id, taskId, operation, serialized]
    );
  }

  // ✅ Process a Batch
  private async processBatch(items: SyncQueueItem[]): Promise<BatchSyncResponse> {
    const checksum = crypto
      .createHash('md5')
      .update(JSON.stringify(items.map((i) => i.id)))
      .digest('hex');

    const payload = {
      items,
      checksum,
      client_timestamp: new Date(),
    };

    const { data } = await axios.post<BatchSyncResponse>(
      `${this.apiUrl}/batch`,
      payload,
      { timeout: 10000 }
    );

    return data;
  }

  // ✅ Conflict Resolution
  private async resolveConflict(local: Task, server: Task): Promise<Task> {
    const localTime = new Date(local.updated_at).getTime();
    const serverTime = new Date(server.updated_at).getTime();

    if (localTime > serverTime) return local;
    if (serverTime > localTime) return server;

    // Tie-breaker: delete wins if timestamps are equal
    if (local.is_deleted && !server.is_deleted) return local;
    if (server.is_deleted && !local.is_deleted) return server;

    return local;
  }

  // ✅ Update Sync Status
  private async updateSyncStatus(
    taskId: string,
    status: 'synced' | 'error',
    serverData?: Partial<Task>
  ): Promise<void> {
    const now = new Date().toISOString();

    if (status === 'synced') {
      await this.db.run(
        `UPDATE tasks SET sync_status = ?, last_synced_at = ?, server_id = ? WHERE id = ?`,
        [status, now, serverData?.server_id || null, taskId]
      );
      await this.db.run(`DELETE FROM sync_queue WHERE task_id = ?`, [taskId]);
    } else {
      await this.db.run(
        `UPDATE tasks SET sync_status = ?, updated_at = ? WHERE id = ?`,
        [status, now, taskId]
      );
    }
  }

  // ✅ Handle Sync Errors
  private async handleSyncError(item: SyncQueueItem, error: Error): Promise<void> {
    const maxRetries = 3;
    const newRetryCount = (item.retry_count || 0) + 1;

    if (newRetryCount >= maxRetries) {
      await this.db.run(
        `UPDATE sync_queue SET retry_count = ?, error_message = ?, operation = 'failed' WHERE id = ?`,
        [newRetryCount, error.message, item.id]
      );
    } else {
      await this.db.run(
        `UPDATE sync_queue SET retry_count = ?, error_message = ? WHERE id = ?`,
        [newRetryCount, error.message, item.id]
      );
    }
  }

  // ✅ Check if API is Reachable
  async checkConnectivity(): Promise<boolean> {
    try {
      await axios.get(`${this.apiUrl}/health`, { timeout: 4000 });
      return true;
    } catch {
      return false;
    }
  }
}
