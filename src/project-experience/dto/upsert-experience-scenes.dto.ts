import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ExperienceSceneCameraDto {
  @ApiProperty()
  @IsNumber()
  @Type(() => Number)
  longitude: number;

  @ApiProperty()
  @IsNumber()
  @Type(() => Number)
  latitude: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(22)
  @Type(() => Number)
  zoom: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(85)
  @Type(() => Number)
  pitch: number;

  @ApiProperty()
  @IsNumber()
  @Min(-180)
  @Max(180)
  @Type(() => Number)
  bearing: number;
}

export class ExperienceSceneNarrativeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  text?: string;
}

export class ExperienceSceneDto {
  @ApiProperty()
  @IsString()
  @MaxLength(64)
  id: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ type: ExperienceSceneCameraDto })
  @ValidateNested()
  @Type(() => ExperienceSceneCameraDto)
  camera: ExperienceSceneCameraDto;

  @ApiPropertyOptional({ default: 4000, description: 'Travel time into this camera, in milliseconds' })
  @IsOptional()
  @IsNumber()
  @Min(500)
  @Type(() => Number)
  durationMs?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  visibleLayers?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  locationIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assetIds?: string[];

  @ApiPropertyOptional({ type: ExperienceSceneNarrativeDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ExperienceSceneNarrativeDto)
  narrative?: ExperienceSceneNarrativeDto | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  sortOrder?: number;
}

export class UpsertExperienceScenesDto {
  @ApiProperty({ type: [ExperienceSceneDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExperienceSceneDto)
  scenes: ExperienceSceneDto[];
}
