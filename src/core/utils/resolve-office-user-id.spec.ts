import { UnauthorizedException } from '@nestjs/common';
import { resolveOfficeUserId } from './resolve-office-user-id';

describe('resolveOfficeUserId', () => {
  it('prefers userId then sub', () => {
    expect(resolveOfficeUserId({ userId: 'a', sub: 'b' })).toBe('a');
    expect(resolveOfficeUserId({ sub: 'b' })).toBe('b');
  });

  it('throws when both are missing', () => {
    expect(() => resolveOfficeUserId(undefined)).toThrow(UnauthorizedException);
    expect(() => resolveOfficeUserId({})).toThrow(UnauthorizedException);
  });
});
