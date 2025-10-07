export interface Task {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  created_at?: string;
  updated_at?: string;
  is_deleted?: boolean;
  sync_status?: 'pending' | 'synced' | 'failed';
  server_id?: string;
  last_synced_at?: string;
}

export interface SyncQueueItem {
  id: string;
  task_id: string;
  operation: 'create' | 'update' | 'delete';
  data: string; // JSON stringified task data
  created_at?: string;
  retry_count?: number;
  error_message?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
