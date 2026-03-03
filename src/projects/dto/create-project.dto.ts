import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

const MAX_TITLE_LENGTH = 500;
const MAX_LOCATION_LENGTH = 500;

export class CreateProjectDto {
  @ApiProperty({ example: 'Lote Norte', maxLength: MAX_TITLE_LENGTH })
  @IsString()
  @MaxLength(MAX_TITLE_LENGTH)
  title: string;

  @ApiProperty({ example: 'Ciudad de México', maxLength: MAX_LOCATION_LENGTH })
  @IsString()
  @MaxLength(MAX_LOCATION_LENGTH)
  location: string;

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
}
