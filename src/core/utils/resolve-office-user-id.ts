import { UnauthorizedException } from '@nestjs/common';
import type { OfficeJwtPayload } from '../types/office-jwt-payload.type';

/**
 * Reads the office user id from a verified JWT payload.
 */
export function resolveOfficeUserId(
  jwtUser: OfficeJwtPayload | undefined,
): string {
  const userId = (jwtUser?.userId ?? jwtUser?.sub ?? '').trim();
  if (userId === '') {
    throw new UnauthorizedException('JWT payload is missing userId');
  }
  return userId;
}
