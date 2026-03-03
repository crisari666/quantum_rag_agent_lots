import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

const MAX_TITLE_LENGTH = 200;

export class CreateAmenityDto {
  @ApiProperty({ example: 'Parking', maxLength: MAX_TITLE_LENGTH })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_TITLE_LENGTH)
  title: string;
}
