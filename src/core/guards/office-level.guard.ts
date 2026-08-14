import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ROLES_METADATA_KEY } from '../decorators/roles.decorator';
import type { OfficeUserLevel } from '../constants/office-user-level.constants';

/**
 * Enforces that `req.officeJwtUser.level` is one of the levels set by {@link Roles}.
 */
@Injectable()
export class OfficeLevelGuard implements CanActivate {
  public constructor(private readonly reflector: Reflector) {}

  public canActivate(context: ExecutionContext): boolean {
    const allowedLevels = this.reflector.getAllAndOverride<
      readonly OfficeUserLevel[] | undefined
    >(ROLES_METADATA_KEY, [context.getHandler(), context.getClass()]);
    if (!allowedLevels || allowedLevels.length === 0) {
      return true;
    }
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.officeJwtUser;
    if (!user) {
      throw new UnauthorizedException('TOKEN header is required');
    }
    const level = user.level;
    if (level === undefined || level === null) {
      throw new ForbiddenException('JWT payload is missing level');
    }
    if (!allowedLevels.includes(level as OfficeUserLevel)) {
      throw new ForbiddenException('Insufficient permissions for this action');
    }
    return true;
  }
}
