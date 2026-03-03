import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

const MAX_TITLE_LENGTH = 200;

export class UpdateAmenityDto {
  @ApiPropertyOptional({ example: 'Parking', maxLength: MAX_TITLE_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TITLE_LENGTH)
  title?: string;
}
