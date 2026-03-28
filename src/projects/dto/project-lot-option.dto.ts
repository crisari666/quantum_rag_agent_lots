import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';
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
    example: 450000,
    minimum: 0,
    description: 'Price for this lot option.',
  })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price: number;
}
