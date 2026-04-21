import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

const MAX_TITLE = 300;
const MAX_LOCATION = 2000;
const MAX_DESCRIPTION = 20000;

export class CreateProjectReleaseDto {
  @ApiProperty({ example: 'Spring launch', maxLength: MAX_TITLE })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_TITLE)
  title: string;

  @ApiProperty({ example: 'https://maps.google.com/?q=...', maxLength: MAX_LOCATION })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_LOCATION)
  googleMapLocation: string;

  @ApiProperty({ example: 'Downtown', maxLength: MAX_LOCATION })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_LOCATION)
  location: string;

  @ApiPropertyOptional({ example: 'Details...', maxLength: MAX_DESCRIPTION })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_DESCRIPTION)
  description?: string;

  @ApiPropertyOptional({
    description: 'Optional image filenames (usually filled via upload endpoint)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiPropertyOptional({
    description: 'Defaults to true (enabled) when omitted',
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
