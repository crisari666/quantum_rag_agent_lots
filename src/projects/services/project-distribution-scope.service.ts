import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { OfficeJwtPayload } from '../../core/types/office-jwt-payload.type';
import {
  EXTERNAL_DISTRIBUTION_ORIGINS_ENV,
  normalizeOrigin,
  parseExternalDistributionOrigins,
} from '../config/external-distribution-origins.config';
import type { ProjectDistributionScope } from '../types/project-distribution-scope.type';

const DISTRIBUTION_ALL = 'all';
const DISTRIBUTION_EXTERNAL = 'external';
const DISTRIBUTION_INTERNAL = 'internal';

type ResolveDistributionScopeInput = {
  readonly origin?: string;
  readonly referer?: string;
  readonly requestedDistribution?: string;
  readonly officeJwtUser?: OfficeJwtPayload;
};

/**
 * Decides which projects (internal / external / all) a listing request may see.
 * Origin-based segmentation relies on browser-set headers; it is not a security boundary.
 * Explicit `distribution=external|internal` is for server-to-server callers (e.g. GTower catalog).
 */
@Injectable()
export class ProjectDistributionScopeService {
  private readonly externalOrigins: ReadonlySet<string>;

  public constructor(configService: ConfigService) {
    this.externalOrigins = parseExternalDistributionOrigins(
      configService.get<string>(EXTERNAL_DISTRIBUTION_ORIGINS_ENV) ?? '',
    );
  }

  /**
   * `distribution=all` requires a verified office JWT.
   * `distribution=external|internal` select that scope without JWT.
   * Otherwise allowlisted origins get external projects; everyone else gets internal.
   */
  public resolveScope(input: ResolveDistributionScopeInput): ProjectDistributionScope {
    const requested = input.requestedDistribution?.trim().toLowerCase() ?? '';
    if (requested === DISTRIBUTION_ALL) {
      if (!input.officeJwtUser) {
        throw new ForbiddenException('Query "distribution=all" requires a valid TOKEN header');
      }
      return 'all';
    }
    if (requested === DISTRIBUTION_EXTERNAL) {
      return 'external';
    }
    if (requested === DISTRIBUTION_INTERNAL) {
      return 'internal';
    }
    const requestOrigin = input.origin ?? this.extractOriginFromReferer(input.referer);
    if (requestOrigin && this.externalOrigins.has(normalizeOrigin(requestOrigin))) {
      return 'external';
    }
    return 'internal';
  }

  private extractOriginFromReferer(referer?: string): string | undefined {
    if (!referer) return undefined;
    try {
      return new URL(referer).origin;
    } catch {
      return undefined;
    }
  }
}
