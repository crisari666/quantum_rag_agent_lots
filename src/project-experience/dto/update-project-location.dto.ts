import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
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
} from '../types/project-location.enums';
import { LocationGeometryDto } from './location-geometry.dto';

export class UpdateProjectLocationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  subtitle?: string;

  @ApiPropertyOptional({ enum: ProjectLocationCategory })
  @IsOptional()
  @IsEnum(ProjectLocationCategory)
  category?: ProjectLocationCategory;

  @ApiPropertyOptional({ description: 'Project amenity category key' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  categoryKey?: string;

  @ApiPropertyOptional({
    description: 'Panorama asset id. Empty clears the 360 link.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(24)
  panoramaAssetId?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Ordered gallery filenames to keep',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  gallery?: string[];

  @ApiPropertyOptional({ type: LocationGeometryDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationGeometryDto)
  geometry?: LocationGeometryDto;

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
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  roadDistanceMeters?: number;

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
}
