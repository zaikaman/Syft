import { Request, Response, NextFunction } from 'express';

// Simple request logger middleware
export function logger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  
  // Log request
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} - ${duration}ms`
    );
  });

  next();
}

// Request ID middleware for tracking
export function requestId(req: Request, res: Response, next: NextFunction) {
  const id = Math.random().toString(36).substring(7);
  req.headers['x-request-id'] = id;
  res.setHeader('X-Request-ID', id);
  next();
}
