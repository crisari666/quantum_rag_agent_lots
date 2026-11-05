import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class ReorderLocationItemDto {
  @ApiProperty()
  @IsString()
  locationId: string;

  @ApiProperty({ minimum: 0 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  sortOrder: number;
}

export class ReorderLocationsDto {
  @ApiProperty({ type: [ReorderLocationItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReorderLocationItemDto)
  items: ReorderLocationItemDto[];
}
