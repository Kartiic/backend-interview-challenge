import sqlite3 from 'sqlite3';
import { Task, SyncQueueItem } from '../types';

const sqlite = sqlite3.verbose();

export class Database {
  private db: sqlite3.Database;

  constructor(filename: string = './data/tasks.sqlite3') {
    this.db = new sqlite.Database(filename);
  }

  async initialize(): Promise<void> {
    await this.createTables();
  }

  private async createTables(): Promise<void> {
    const createTasksTable = `
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        completed INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_deleted INTEGER DEFAULT 0,
        sync_status TEXT DEFAULT 'pending',
        server_id TEXT,
        last_synced_at DATETIME
      )
    `;

    const createSyncQueueTable = `
      CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        retry_count INTEGER DEFAULT 0,
        error_message TEXT,
        FOREIGN KEY (task_id) REFERENCES tasks(id)
      )
    `;

    const createDeadLetterQueue = `
      CREATE TABLE IF NOT EXISTS dead_letter_queue (
        id TEXT PRIMARY KEY,
        task_id TEXT,
        operation TEXT,
        data TEXT,
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await this.run(createTasksTable);
    await this.run(createSyncQueueTable);
    await this.run(createDeadLetterQueue);
  }

  run(sql: string, params: any[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}
