import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { ProjectLocationCategory } from '../types/project-location.enums';

export class DiscoverLocationsDto {
  @ApiProperty({
    description: 'Search radius in meters around the project coordinates',
    example: 10000,
    minimum: 500,
    maximum: 50000,
  })
  @IsNumber()
  @Min(500)
  @Max(50_000)
  @Type(() => Number)
  radiusMeters: number;

  @ApiPropertyOptional({
    enum: ProjectLocationCategory,
    isArray: true,
    description: 'Categories to discover (defaults to common POI set)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(ProjectLocationCategory, { each: true })
  categories?: ProjectLocationCategory[];
}
