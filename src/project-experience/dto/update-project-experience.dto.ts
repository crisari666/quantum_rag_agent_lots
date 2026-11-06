import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  ProjectLocationCategory,
  ProjectLocationImportance,
} from '../types/project-location.enums';

export class UpdateExperienceRoadsStyleDto {
  @ApiPropertyOptional({ example: '#38bdf8' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string;

  @ApiPropertyOptional({ description: 'Base line width 1–12' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  width?: number;

  @ApiPropertyOptional({ description: 'Line opacity 0.2–1' })
  @IsOptional()
  @IsNumber()
  @Min(0.2)
  @Max(1)
  @Type(() => Number)
  opacity?: number;

  @ApiPropertyOptional({ enum: ['solid', 'double', 'dashed'] })
  @IsOptional()
  @IsEnum(['solid', 'double', 'dashed'])
  line?: 'solid' | 'double' | 'dashed';
}

export class UpdateExperienceMapSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  styleUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(22)
  @Type(() => Number)
  defaultZoom?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(85)
  @Type(() => Number)
  pitch?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  @Type(() => Number)
  bearing?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  centerLongitude?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  centerLatitude?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  terrainEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  @Type(() => Number)
  terrainExaggeration?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  buildings3DEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  satelliteEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  fogEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Studio player shows the scene title beside the controls',
  })
  @IsOptional()
  @IsBoolean()
  showSceneTitles?: boolean;

  @ApiPropertyOptional({ type: UpdateExperienceRoadsStyleDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateExperienceRoadsStyleDto)
  roadsStyle?: UpdateExperienceRoadsStyleDto;

  @ApiPropertyOptional({ example: '#15803d' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  availableLotColor?: string;
}

export class UpdateExperienceLayersDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  lots?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  roads?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  locations?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  assets?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  models3D?: boolean;
}

export class UpdateExperiencePoiDto {
  @ApiPropertyOptional({ description: 'Max distance for public curated POIs' })
  @IsOptional()
  @IsNumber()
  @Min(1_000)
  @Max(50_000)
  @Type(() => Number)
  publicRadiusMeters?: number;

  @ApiPropertyOptional({
    enum: ProjectLocationCategory,
    isArray: true,
    description: 'Empty = all categories',
  })
  @IsOptional()
  @IsArray()
  @IsEnum(ProjectLocationCategory, { each: true })
  publicCategories?: ProjectLocationCategory[];

  @ApiPropertyOptional({
    description: 'Allow public clients to fetch live Mapbox POIs',
  })
  @IsOptional()
  @IsBoolean()
  liveMapboxEnabled?: boolean;

  @ApiPropertyOptional({ enum: ProjectLocationImportance })
  @IsOptional()
  @IsEnum(ProjectLocationImportance)
  minImportance?: ProjectLocationImportance;
}

export class AmenityCategoryDto {
  @ApiPropertyOptional()
  @IsString()
  @MaxLength(40)
  key: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(80)
  label: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  sortOrder?: number;

  @ApiPropertyOptional({ example: '#38BDF8' })
  @IsOptional()
  @IsString()
  @Matches(/^$|^#[0-9A-Fa-f]{6}$/)
  color?: string;
}

export class UpdateProjectExperienceDto {
  @ApiPropertyOptional({ type: UpdateExperienceMapSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateExperienceMapSettingsDto)
  settings?: UpdateExperienceMapSettingsDto;

  @ApiPropertyOptional({ type: UpdateExperienceLayersDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateExperienceLayersDto)
  layers?: UpdateExperienceLayersDto;

  @ApiPropertyOptional({ type: UpdateExperiencePoiDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateExperiencePoiDto)
  poi?: UpdateExperiencePoiDto;

  @ApiPropertyOptional({ type: [AmenityCategoryDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AmenityCategoryDto)
  amenityCategories?: AmenityCategoryDto[];
}
