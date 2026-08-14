import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ProjectLotStatus } from '../types/project-lot.enums';

const MAX_VENTOR_NAME = 200;
const MAX_SOLD_BY = 64;

export class UpdateProjectLotDto {
  @ApiPropertyOptional({ example: 200, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  area?: number;

  @ApiPropertyOptional({ example: 450_000_000, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price?: number;

  @ApiPropertyOptional({ enum: ProjectLotStatus })
  @IsOptional()
  @IsEnum(ProjectLotStatus)
  status?: ProjectLotStatus;

  @ApiPropertyOptional({
    description: 'Seller display name (optional)',
    maxLength: MAX_VENTOR_NAME,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_VENTOR_NAME)
  ventorName?: string;

  @ApiPropertyOptional({
    description: 'customers-ms customer ObjectId as string',
    maxLength: MAX_SOLD_BY,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_SOLD_BY)
  soldBy?: string;

  @ApiPropertyOptional({
    description:
      'ISO datetime when hold expires (required in spirit for hold; defaults to now+24h if omitted)',
    example: '2026-08-15T15:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  holdUntil?: string;

  @ApiPropertyOptional({
    description: 'Stage key (e.g. "1", "etapa-norte"). Empty → default.',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  stageKey?: string;

  @ApiPropertyOptional({
    description: 'Stage display name',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  stageName?: string;

  @ApiPropertyOptional({
    description: 'Stage sort order (lower first)',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  stageOrder?: number;
}

export class BulkUpdateLotStatusDto {
  @ApiProperty({ type: [String], example: ['507f1f77bcf86cd799439011'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  lotIds: string[];

  @ApiProperty({ enum: ProjectLotStatus })
  @IsEnum(ProjectLotStatus)
  status: ProjectLotStatus;

  @ApiPropertyOptional({ maxLength: MAX_VENTOR_NAME })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_VENTOR_NAME)
  ventorName?: string;

  @ApiPropertyOptional({ maxLength: MAX_SOLD_BY })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_SOLD_BY)
  soldBy?: string;

  @ApiPropertyOptional({
    description:
      'ISO datetime when hold expires; defaults to now+24h when status is hold',
    example: '2026-08-15T15:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  holdUntil?: string;
}

export class GenerateProjectLotsDto {
  @ApiPropertyOptional({
    description: 'Override project.nLots for this generate call',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  nLots?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  nCommercialSpaces?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  baseLotArea?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  baseCommercialArea?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  defaultLotPrice?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  defaultCommercialPrice?: number;
}
