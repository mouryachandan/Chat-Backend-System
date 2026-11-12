import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodType, ZodTypeDef } from 'zod';
import { BadRequestError } from '../utils/errors';

interface ValidationSchemas<TBody, TParams, TQuery> {
  body?: ZodType<TBody, ZodTypeDef, unknown>;
  params?: ZodType<TParams, ZodTypeDef, unknown>;
  query?: ZodType<TQuery, ZodTypeDef, unknown>;
}

export function validate<TBody = unknown, TParams = unknown, TQuery = unknown>(
  schemas: ValidationSchemas<TBody, TParams, TQuery>
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        next(new BadRequestError('Invalid route parameters', result.error.flatten().fieldErrors));
        return;
      }
      req.params = result.data as unknown as Record<string, string>;
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        next(new BadRequestError('Invalid query parameters', result.error.flatten().fieldErrors));
        return;
      }
      res.locals['validatedQuery'] = result.data;
    }

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        next(new BadRequestError('Invalid request body', result.error.flatten().fieldErrors));
        return;
      }
      req.body = result.data;
    }

    next();
  };
}

