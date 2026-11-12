import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { AppError } from '../utils/errors';

interface PgLikeError {
  code?: string;
  detail?: string;
}

function isPgLikeError(err: unknown): err is PgLikeError {
  return typeof err === 'object' && err !== null && 'code' in err;
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`,
    },
  });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: err.flatten().fieldErrors,
      },
    });
    return;
  }

  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: 'Malformed JSON in request body',
      },
    });
    return;
  }

  if (isPgLikeError(err)) {
    if (err.code === '22P02') {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_IDENTIFIER',
          message: 'Invalid identifier format',
        },
      });
      return;
    }
    if (err.code === '23505') {
      res.status(409).json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'Resource already exists',
        },
      });
      return;
    }
    if (err.code === '23503') {
      res.status(400).json({
        success: false,
        error: {
          code: 'REFERENCE_ERROR',
          message: 'Referenced record does not exist',
        },
      });
      return;
    }
  }

  console.error('Unhandled error:', err);

  const message =
    env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err instanceof Error
        ? err.message
        : 'Internal server error';

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message,
    },
  });
}

