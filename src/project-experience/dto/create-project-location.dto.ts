import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  ProjectLocationCategory,
  ProjectLocationImportance,
  ProjectLocationSource,
} from '../types/project-location.enums';
import { LocationGeometryDto } from './location-geometry.dto';

export class CreateProjectLocationDto {
  @ApiProperty({ example: 'Hospital San José' })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  subtitle?: string;

  @ApiProperty({ enum: ProjectLocationCategory })
  @IsEnum(ProjectLocationCategory)
  category: ProjectLocationCategory;

  @ApiProperty({ type: LocationGeometryDto })
  @ValidateNested()
  @Type(() => LocationGeometryDto)
  geometry: LocationGeometryDto;

  @ApiPropertyOptional({ enum: ProjectLocationSource })
  @IsOptional()
  @IsEnum(ProjectLocationSource)
  source?: ProjectLocationSource;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  sourceId?: string;

  @ApiPropertyOptional({ enum: ProjectLocationImportance })
  @IsOptional()
  @IsEnum(ProjectLocationImportance)
  importance?: ProjectLocationImportance;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  estimatedTravelMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  attribution?: string;
}
