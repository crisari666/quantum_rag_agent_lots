import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

const MAX_VENTOR_NAME = 200;

/**
 * Body for external-agent lot hold. Omit holdUntil to use the 72h default.
 */
export class HoldProjectLotDto {
  @ApiPropertyOptional({
    description: 'Display name stored on the lot while held',
    maxLength: MAX_VENTOR_NAME,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_VENTOR_NAME)
  ventorName?: string;

  @ApiPropertyOptional({
    description:
      'ISO datetime when hold expires. External agents: at least 72h (default 72h). Ventors: future date (default 24h).',
    example: '2026-08-22T15:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  holdUntil?: string;
}
