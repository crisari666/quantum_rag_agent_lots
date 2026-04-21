import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { JwtVerificationService } from '../services/jwt-verification.service';
import { UPLOADS_STATIC_URL_PREFIX } from '../../config/upload-bucket.constants';

const RAG_PREFIX = '/rag';
const PATCH_PROJECT_UPDATE_REGEX = /^\/rag\/projects\/[^/]+$/;
const BEARER_PREFIX_REGEX = /^Bearer\s+/i;

/**
 * Strips optional `Bearer ` prefix from an Authorization-style token value.
 */
function extractRawJwt(value: string): string {
  const trimmed = value.trim();
  if (BEARER_PREFIX_REGEX.test(trimmed)) {
    return trimmed.replace(BEARER_PREFIX_REGEX, '').trim();
  }
  return trimmed;
}

/**
 * Requires a valid JWT in the `TOKEN` header for `/rag/*`, except listed public routes.
 */
@Injectable()
export class TokenJwtMiddleware implements NestMiddleware {
  public constructor(
    private readonly jwtVerificationService: JwtVerificationService,
  ) {}

  public async use(
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> {
    if (this.shouldBypass(req)) {
      next();
      return;
    }
    const rawHeader = req.headers['token'];

    const raw =
      typeof rawHeader === 'string'
        ? rawHeader
        : Array.isArray(rawHeader)
          ? (rawHeader[0] ?? '')
          : '';
    const token = extractRawJwt(raw);
    if (token === '') {
      throw new UnauthorizedException('TOKEN header is required');
    }
    const payload = await this.jwtVerificationService.verifyToken(token);
    req.officeJwtUser = payload;
    next();
  }

  private shouldBypass(req: Request): boolean {
    if (req.method === 'OPTIONS') {
      return true;
    }
    const pathname = this.extractPathname(req.originalUrl);
    if (!pathname.startsWith(RAG_PREFIX)) {
      return true;
    }
    if (pathname.startsWith(UPLOADS_STATIC_URL_PREFIX)) {
      return true;
    }
    const normalized =
      pathname.length > 1 && pathname.endsWith('/')
        ? pathname.slice(0, -1)
        : pathname;
    if (req.method === 'GET' && (normalized === `${RAG_PREFIX}/projects` || normalized === `${RAG_PREFIX}/project-releases`)) {
      return true;
    }
    if (req.method === 'PATCH' && PATCH_PROJECT_UPDATE_REGEX.test(normalized)) {
      return true;
    }
    return false;
  }

  private extractPathname(originalUrl: string): string {
    const questionIndex = originalUrl.indexOf('?');
    const path =
      questionIndex === -1
        ? originalUrl
        : originalUrl.slice(0, questionIndex);
    return path === '' ? '/' : path;
  }
}
