import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import {
  MAX_PROJECT_SLUG_LENGTH,
  PROJECT_SLUG_REGEX,
} from '../constants/project-slug.constants';
import { ProjectLotOptionDto } from './project-lot-option.dto';

const MAX_TITLE_LENGTH = 500;
const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_LOCATION_LENGTH = 500;
const MAX_CITY_STATE_COUNTRY_LENGTH = 200;

export class UpdateProjectDto {
  @ApiPropertyOptional({ example: 'Lote Norte', maxLength: MAX_TITLE_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TITLE_LENGTH)
  title?: string;

  @ApiPropertyOptional({
    example: 'lote-norte',
    maxLength: MAX_PROJECT_SLUG_LENGTH,
    description:
      'Unique URL slug. Send empty string "" to remove slug from the project.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null) {
      return undefined;
    }
    if (typeof value !== 'string') {
      return value;
    }
    return value.trim().toLowerCase();
  })
  @ValidateIf((_object: unknown, value: unknown) => {
    return value !== undefined && value !== '';
  })
  @IsString()
  @MaxLength(MAX_PROJECT_SLUG_LENGTH)
  @Matches(PROJECT_SLUG_REGEX, {
    message:
      'slug must be lowercase kebab-case: letters, digits, single hyphens between segments',
  })
  slug?: string;

  @ApiPropertyOptional({
    example: 'Residential lots with infrastructure.',
    maxLength: MAX_DESCRIPTION_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_DESCRIPTION_LENGTH)
  description?: string;

  @ApiPropertyOptional({
    example: 'Ciudad de México',
    maxLength: MAX_LOCATION_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_LOCATION_LENGTH)
  location?: string;

  @ApiPropertyOptional({ example: 'Ciudad de México', maxLength: MAX_CITY_STATE_COUNTRY_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_CITY_STATE_COUNTRY_LENGTH)
  city?: string;

  @ApiPropertyOptional({ example: 'CDMX', maxLength: MAX_CITY_STATE_COUNTRY_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_CITY_STATE_COUNTRY_LENGTH)
  state?: string;

  @ApiPropertyOptional({ example: 'México', maxLength: MAX_CITY_STATE_COUNTRY_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_CITY_STATE_COUNTRY_LENGTH)
  country?: string;

  @ApiPropertyOptional({ example: 19.4326 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  lat?: number;

  @ApiPropertyOptional({ example: -99.1332 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  lng?: number;

  @ApiPropertyOptional({ example: 1500000, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  priceSell?: number;

  @ApiPropertyOptional({
    example: 8,
    minimum: 0,
    description:
      'Separation for the development (e.g. meters between lots); meaning is product-defined.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  separation?: number;

  @ApiPropertyOptional({
    type: [ProjectLotOptionDto],
    description: 'Replaces the full list when sent. Use [] to clear all options.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectLotOptionDto)
  lotOptions?: ProjectLotOptionDto[];

  @ApiPropertyOptional({ example: 5, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  commissionPercentage?: number;

  @ApiPropertyOptional({ example: 75000, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  commissionValue?: number;

  @ApiPropertyOptional({
    description: 'Amenity document IDs',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];

  @ApiPropertyOptional({ description: 'Image URLs', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  images?: string[];

  @ApiPropertyOptional({
    description: 'Card image URL for project listings',
    type: String,
  })
  @IsOptional()
  @IsUrl()
  cardProject?: string;

  @ApiPropertyOptional({
    description: 'Horizontal (landscape) image URLs',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  horizontalImages?: string[];

  @ApiPropertyOptional({
    description: 'Vertical (portrait) video URLs',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  verticalVideos?: string[];
}
