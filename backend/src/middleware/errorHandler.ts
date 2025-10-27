import { Request, Response, NextFunction } from 'express';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

export class BadRequestError extends Error implements ApiError {
  statusCode = 400;
  code = 'BAD_REQUEST';
  
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'BadRequestError';
  }
}

export class UnauthorizedError extends Error implements ApiError {
  statusCode = 401;
  code = 'UNAUTHORIZED';
  
  constructor(message: string = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class NotFoundError extends Error implements ApiError {
  statusCode = 404;
  code = 'NOT_FOUND';
  
  constructor(message: string = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error implements ApiError {
  statusCode = 409;
  code = 'CONFLICT';
  
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class InternalServerError extends Error implements ApiError {
  statusCode = 500;
  code = 'INTERNAL_SERVER_ERROR';
  
  constructor(message: string = 'Internal server error', public details?: any) {
    super(message);
    this.name = 'InternalServerError';
  }
}

// Error handler middleware
export function errorHandler(
  err: ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_SERVER_ERROR';

  // Log error for monitoring
  console.error(`[${new Date().toISOString()}] ${err.name}:`, {
    message: err.message,
    code,
    statusCode,
    path: req.path,
    method: req.method,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: {
      message: err.message,
      code,
      details: process.env.NODE_ENV === 'development' ? err.details : undefined,
    },
    timestamp: new Date().toISOString(),
  });
}

// Async handler wrapper to catch errors in async route handlers
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
