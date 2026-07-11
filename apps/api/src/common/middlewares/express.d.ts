import type { NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

declare module 'express' {
  interface Request {
    id?: string;
  }
}

export {};
