import { Router, Request, Response } from 'express';
import { SyncService } from '../services/syncService';
import { TaskService } from '../services/taskService';
import { Database } from '../db/database';

export function createSyncRouter(db: Database): Router {
  const router = Router();
  const taskService = new TaskService(db);
  const syncService = new SyncService(db, taskService);

  // ✅ Manual sync trigger
  router.post('/sync', async (req: Request, res: Response) => {
    try {
      const connected = await syncService.checkConnectivity();
      if (!connected) {
        return res.status(503).json({ error: 'Server not reachable' });
      }

      const result = await syncService.sync();
      res.json({
        message: 'Sync completed',
        summary: result,
      });
    } catch (err: any) {
      console.error('Sync failed:', err);
      res.status(500).json({ error: 'Sync failed', details: err.message });
    }
  });

  // ✅ Sync status check
  router.get('/status', async (req: Request, res: Response) => {
    try {
      const pending = await db.all(
        'SELECT COUNT(*) as count FROM sync_queue WHERE retry_count < 3'
      );
      const lastSynced = await db.get(
        'SELECT MAX(last_synced_at) as last_synced FROM tasks'
      );
      const connected = await syncService.checkConnectivity();

      res.json({
        pending: pending[0]?.count || 0,
        last_synced: lastSynced?.last_synced || null,
        online: connected,
        timestamp: new Date(),
      });
    } catch (err: any) {
      console.error('Status check failed:', err);
      res.status(500).json({ error: 'Failed to check sync status' });
    }
  });

  // ✅ Health check
  router.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date() });
  });

  return router;
}
