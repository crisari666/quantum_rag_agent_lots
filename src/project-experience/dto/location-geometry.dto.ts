import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { ProjectLocationGeometryType } from '../types/project-location.enums';

export class LocationGeometryDto {
  @ApiProperty({ enum: ProjectLocationGeometryType })
  @IsEnum(ProjectLocationGeometryType)
  type: ProjectLocationGeometryType;

  @ApiProperty({
    description: 'GeoJSON coordinates matching the geometry type',
  })
  @IsNotEmpty()
  coordinates: unknown;
}
