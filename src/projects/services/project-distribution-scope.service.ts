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

type ResolveDistributionScopeInput = {
  readonly origin?: string;
  readonly referer?: string;
  readonly requestedDistribution?: string;
  readonly officeJwtUser?: OfficeJwtPayload;
};

/**
 * Decides which projects (internal / external / all) a listing request may see.
 * Origin-based segmentation relies on browser-set headers; it is not a security boundary.
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
   * `distribution=all` requires a verified office JWT; otherwise allowlisted origins get
   * external projects and everyone else gets internal projects.
   */
  public resolveScope(input: ResolveDistributionScopeInput): ProjectDistributionScope {
    const requested = input.requestedDistribution?.trim().toLowerCase() ?? '';
    if (requested === DISTRIBUTION_ALL) {
      if (!input.officeJwtUser) {
        throw new ForbiddenException('Query "distribution=all" requires a valid TOKEN header');
      }
      return 'all';
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
