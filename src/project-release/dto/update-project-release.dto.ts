import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

const MAX_TITLE = 300;
const MAX_LOCATION = 2000;
const MAX_DESCRIPTION = 20000;

export class UpdateProjectReleaseDto {
  @ApiPropertyOptional({ maxLength: MAX_TITLE })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TITLE)
  title?: string;

  @ApiPropertyOptional({ maxLength: MAX_LOCATION })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_LOCATION)
  googleMapLocation?: string;

  @ApiPropertyOptional({ maxLength: MAX_LOCATION })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_LOCATION)
  location?: string;

  @ApiPropertyOptional({ maxLength: MAX_DESCRIPTION })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_DESCRIPTION)
  description?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
