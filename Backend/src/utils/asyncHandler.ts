import type { NextFunction, Request, RequestHandler, Response } from 'express';

export type AsyncRouteHandler<
  P = Record<string, string>,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = Record<string, unknown>,
> = (
  req: Request<P, ResBody, ReqBody, ReqQuery>,
  res: Response<ResBody>,
  next: NextFunction
) => Promise<void>;

export function asyncHandler<
  P = Record<string, string>,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = Record<string, unknown>,
>(fn: AsyncRouteHandler<P, ResBody, ReqBody, ReqQuery>): RequestHandler {
  return (req, res, next) => {
    void Promise.resolve(
      fn(
        req as unknown as Request<P, ResBody, ReqBody, ReqQuery>,
        res as unknown as Response<ResBody>,
        next
      )
    ).catch(next);
  };
}
