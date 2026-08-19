import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

const MAX_NOTE = 2000;

/**
 * Optional note for sold-lot desist (multipart body).
 */
export class DesistProjectLotDto {
  @ApiPropertyOptional({ maxLength: MAX_NOTE })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_NOTE)
  note?: string;
}
