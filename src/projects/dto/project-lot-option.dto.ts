import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Validates one entry in a project's `lotOptions` array.
 */
export class ProjectLotOptionDto {
  @ApiProperty({
    example: 200,
    minimum: 0,
    description: 'Lot area (square meters or your product unit).',
  })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  area: number;

  @ApiProperty({
    example: 400_000_000,
    minimum: 0,
    description: 'Sale price for this lot option in COP.',
  })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price: number;

  @ApiPropertyOptional({
    example: 98000,
    minimum: 0,
    description: 'Optional reference price for this lot option in USD.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  priceUsd?: number;
}
