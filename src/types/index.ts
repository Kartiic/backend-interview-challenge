export interface Task {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  sync_status: 'pending' | 'synced' | 'error';
  server_id?: string;
  last_synced_at?: string;
}

export interface SyncQueueItem {
  id: string;
  task_id: string;
  operation: 'create' | 'update' | 'delete' | 'failed';
  data: string; // JSON serialized task data
  created_at: string;
  retry_count: number;
  error_message?: string;
}

export interface SyncError {
  task_id: string;
  operation: string;
  error: string;
  timestamp: Date;
}

export interface SyncResult {
  success: boolean;
  synced_items: number;
  failed_items: number;
  errors: SyncError[];
}

export interface BatchSyncResponse {
  processed_items: {
    client_id: string;
    server_id?: string;
    status: 'success' | 'conflict' | 'error';
    resolved_data?: Task;
  }[];
}
