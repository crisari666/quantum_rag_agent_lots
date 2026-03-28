import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class CreateProjectDto {
  @ApiProperty({ example: 'Lote Norte', maxLength: MAX_TITLE_LENGTH })
  @IsString()
  @MaxLength(MAX_TITLE_LENGTH)
  title: string;

  @ApiPropertyOptional({
    example: 'lote-norte',
    maxLength: MAX_PROJECT_SLUG_LENGTH,
    description:
      'Unique URL slug (lowercase kebab-case: a-z, digits, hyphens). Omit if not used.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null) {
      return undefined;
    }
    if (typeof value !== 'string') {
      return value;
    }
    const normalized = value.trim().toLowerCase();
    return normalized === '' ? undefined : normalized;
  })
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsString()
  @MaxLength(MAX_PROJECT_SLUG_LENGTH)
  @Matches(PROJECT_SLUG_REGEX, {
    message:
      'slug must be lowercase kebab-case: letters, digits, single hyphens between segments',
  })
  slug?: string;

  @ApiPropertyOptional({
    example: 'Residential lots with infrastructure and easy credit.',
    maxLength: MAX_DESCRIPTION_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_DESCRIPTION_LENGTH)
  description?: string;

  @ApiProperty({ example: 'Ciudad de México', maxLength: MAX_LOCATION_LENGTH })
  @IsString()
  @MaxLength(MAX_LOCATION_LENGTH)
  location: string;

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

  @ApiProperty({ example: 19.4326 })
  @IsNumber()
  @Type(() => Number)
  lat: number;

  @ApiProperty({ example: -99.1332 })
  @IsNumber()
  @Type(() => Number)
  lng: number;

  @ApiProperty({ example: 1500000, minimum: 0 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  priceSell: number;

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
    description: 'Lot size and price options buyers can choose from.',
    example: [
      { area: 200, price: 450000 },
      { area: 250, price: 520000 },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectLotOptionDto)
  lotOptions?: ProjectLotOptionDto[];

  @ApiProperty({ example: 5, minimum: 0 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  commissionPercentage: number;

  @ApiProperty({ example: 75000, minimum: 0 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  commissionValue: number;

  @ApiPropertyOptional({
    description: 'Amenity document IDs',
    example: ['507f1f77bcf86cd799439011'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];

  @ApiPropertyOptional({
    description: 'Image URLs',
    example: ['https://example.com/image.jpg'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  images?: string[];

  @ApiPropertyOptional({
    description: 'Card image URL for project listings',
    example: 'https://example.com/card.webp',
  })
  @IsOptional()
  @IsUrl()
  cardProject?: string;

  @ApiPropertyOptional({
    description: 'Horizontal (landscape) image URLs',
    example: ['https://example.com/banner.jpg'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  horizontalImages?: string[];

  @ApiPropertyOptional({
    description: 'Vertical (portrait) video URLs',
    example: ['https://example.com/promo.mp4'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  verticalVideos?: string[];

}
