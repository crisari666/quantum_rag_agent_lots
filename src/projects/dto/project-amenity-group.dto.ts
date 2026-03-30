import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsString, MaxLength } from 'class-validator';

const MAX_ICON_LENGTH = 500;
const MAX_GROUP_TITLE_LENGTH = 200;
const MAX_AMENITY_LABEL_LENGTH = 200;
const MAX_AMENITIES_PER_GROUP = 100;

/**
 * Validates one entry in a project's `amenitiesGroups` array.
 */
export class ProjectAmenityGroupDto {
  @ApiProperty({
    example: 'pool',
    description: 'Icon identifier or URL for the group.',
    maxLength: MAX_ICON_LENGTH,
  })
  @IsString()
  @MaxLength(MAX_ICON_LENGTH)
  icon: string;

  @ApiProperty({
    example: 'Recreation',
    description: 'Group heading shown in the UI.',
    maxLength: MAX_GROUP_TITLE_LENGTH,
  })
  @IsString()
  @MaxLength(MAX_GROUP_TITLE_LENGTH)
  title: string;

  @ApiProperty({
    example: ['Swimming pool', 'Green areas'],
    description: 'Human-readable amenity labels in this group.',
    type: [String],
  })
  @IsArray()
  @ArrayMaxSize(MAX_AMENITIES_PER_GROUP)
  @IsString({ each: true })
  @MaxLength(MAX_AMENITY_LABEL_LENGTH, { each: true })
  amenities: string[];
}
