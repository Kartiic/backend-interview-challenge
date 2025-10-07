import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, req: Request, res: Response, _: NextFunction) {
  console.error(err);
  res.status(err.statusCode || 500).json({
    error: err.message || 'Internal Server Error',
    path: req.path,
    timestamp: new Date().toISOString()
  });
}
