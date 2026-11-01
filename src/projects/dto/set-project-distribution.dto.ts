import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

/**
 * Audience channels for a project. At least one must be true (enforced in service).
 */
export class SetProjectDistributionDto {
  @ApiProperty({
    example: true,
    description: 'Show project on La Ceiba consumers (site, ventors, agent).',
  })
  @IsBoolean()
  laCeibaDistribution: boolean;

  @ApiProperty({
    example: false,
    description:
      'Show project on partner origins in EXTERNAL_DISTRIBUTION_ORIGINS.',
  })
  @IsBoolean()
  externalDistribution: boolean;
}
