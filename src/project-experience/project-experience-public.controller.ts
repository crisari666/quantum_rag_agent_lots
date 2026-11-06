import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { IsEnum, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ProjectExperienceService } from './services/project-experience.service';
import { ProjectLocationsService } from './services/project-locations.service';
import { ProjectLocationCategory } from './types/project-location.enums';

class LiveLocationsQueryDto {
  @IsOptional()
  @IsNumber()
  @Min(1_000)
  @Max(50_000)
  @Type(() => Number)
  radiusMeters?: number;

  @IsOptional()
  @IsEnum(ProjectLocationCategory, { each: true })
  @Type(() => String)
  categories?: ProjectLocationCategory[];
}

@ApiTags('Project Experience Public')
@Controller('projects')
@UseGuards(ThrottlerGuard)
export class ProjectExperiencePublicController {
  public constructor(
    private readonly projectExperienceService: ProjectExperienceService,
    private readonly projectLocationsService: ProjectLocationsService,
  ) {}

  @Get(':projectId/experience/public')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Published immersive experience manifest for public clients',
  })
  @ApiParam({ name: 'projectId' })
  @ApiResponse({ status: 200, description: 'Published experience manifest.' })
  @ApiResponse({ status: 404, description: 'Not published.' })
  public getPublicManifest(@Param('projectId') projectId: string) {
    return this.projectExperienceService.getPublicManifest(projectId);
  }

  @Get(':projectId/experience/locations/public')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Public curated locations (visible+verified) filtered by experience.poi',
  })
  @ApiParam({ name: 'projectId' })
  public async getPublicLocations(@Param('projectId') projectId: string) {
    const experience =
      await this.projectExperienceService.getPublishedExperienceOrThrow(
        projectId,
      );
    const poi = this.projectExperienceService.resolvePoiSettings(experience);
    const locations =
      await this.projectLocationsService.listPublicVisible(
        projectId,
        poi,
        experience.amenityCategories ?? [],
      );
    return {
      type: 'FeatureCollection',
      features: locations.map((location) => ({
        type: 'Feature',
        id: location.id,
        properties: {
          id: location.id,
          name: location.name,
          description: location.description,
          category: location.category,
          categoryKey: location.categoryKey,
          categoryLabel: location.categoryLabel,
          panoramaAssetId: location.panoramaAssetId,
          linkedAssetId: location.linkedAssetId,
          linkedResourceId: location.linkedResourceId,
          importance: location.importance,
          distanceMeters: location.distanceMeters,
          estimatedTravelMinutes: location.estimatedTravelMinutes,
          media: location.media,
          attribution: location.attribution,
          sortOrder: location.sortOrder,
        },
        geometry: location.geometry,
      })),
    };
  }

  @Get(':projectId/experience/locations/live/public')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiOperation({
    summary:
      'Live Mapbox POIs for public clients (not persisted). Requires published + poi.liveMapboxEnabled',
  })
  @ApiParam({ name: 'projectId' })
  @ApiQuery({ name: 'radiusMeters', required: false })
  @ApiQuery({
    name: 'categories',
    required: false,
    isArray: true,
    enum: ProjectLocationCategory,
  })
  public discoverLivePublic(
    @Param('projectId') projectId: string,
    @Query() query: LiveLocationsQueryDto,
  ) {
    const categories = this.normalizeCategoriesQuery(query.categories);
    return this.projectExperienceService.discoverLivePublic({
      projectId,
      radiusMeters: query.radiusMeters,
      categories,
    });
  }

  private normalizeCategoriesQuery(
    raw: ProjectLocationCategory | ProjectLocationCategory[] | undefined,
  ): ProjectLocationCategory[] | undefined {
    if (raw === undefined) return undefined;
    return Array.isArray(raw) ? raw : [raw];
  }
}
