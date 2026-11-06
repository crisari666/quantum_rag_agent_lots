import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
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
    description: 'Placed map source asset id. Empty clears the link.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(24)
  linkedAssetId?: string;

  @ApiPropertyOptional({
    description: 'Library resource id. Empty clears the link. Does not move the place.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(24)
  linkedResourceId?: string;

  @ApiPropertyOptional({ description: 'Meters above the terrain for a linked 3D model' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  modelAltitude?: number;

  @ApiPropertyOptional({
    type: [Number],
    description: 'Degrees [pitch, heading, roll] for a linked 3D model',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(3)
  @IsNumber({}, { each: true })
  modelRotation?: number[];

  @ApiPropertyOptional({ example: '#e07a3d' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  routeColor?: string;

  @ApiPropertyOptional({ enum: ['solid', 'double', 'dashed'] })
  @IsOptional()
  @IsEnum(['solid', 'double', 'dashed'])
  routeLine?: 'solid' | 'double' | 'dashed';

  @ApiPropertyOptional({ description: 'Hide the driving line without deleting it' })
  @IsOptional()
  @IsBoolean()
  showRoute?: boolean;

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
