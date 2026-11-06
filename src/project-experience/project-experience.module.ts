import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { OfficeLevelGuard } from '../core/guards/office-level.guard';
import { ProjectsModule } from '../projects/projects.module';
import { ProjectExperienceController } from './project-experience.controller';
import { ProjectExperiencePublicController } from './project-experience-public.controller';
import {
  ProjectExperienceAsset,
  ProjectExperienceAssetSchema,
} from './schemas/project-experience-asset.schema';
import {
  ProjectExperienceResource,
  ProjectExperienceResourceSchema,
} from './schemas/project-experience-resource.schema';
import {
  ProjectExperience,
  ProjectExperienceSchema,
} from './schemas/project-experience.schema';
import {
  ProjectLocation,
  ProjectLocationSchema,
} from './schemas/project-location.schema';
import { MapboxDrivingRouteService } from './services/mapbox-driving-route.service';
import { MapboxPoiDiscoveryService } from './services/mapbox-poi-discovery.service';
import { PoiDiscoveryService } from './services/poi-discovery.service';
import { ProjectExperienceAssetsService } from './services/project-experience-assets.service';
import { ProjectExperienceResourcesService } from './services/project-experience-resources.service';
import { ProjectExperienceService } from './services/project-experience.service';
import { ProjectLocationsService } from './services/project-locations.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ProjectLocation.name, schema: ProjectLocationSchema },
      {
        name: ProjectExperienceAsset.name,
        schema: ProjectExperienceAssetSchema,
      },
      {
        name: ProjectExperienceResource.name,
        schema: ProjectExperienceResourceSchema,
      },
      { name: ProjectExperience.name, schema: ProjectExperienceSchema },
    ]),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
    forwardRef(() => ProjectsModule),
  ],
  controllers: [
    ProjectExperienceController,
    ProjectExperiencePublicController,
  ],
  providers: [
    ProjectExperienceService,
    ProjectLocationsService,
    ProjectExperienceAssetsService,
    ProjectExperienceResourcesService,
    MapboxPoiDiscoveryService,
    MapboxDrivingRouteService,
    PoiDiscoveryService,
    OfficeLevelGuard,
  ],
  exports: [
    ProjectExperienceService,
    ProjectLocationsService,
    ProjectExperienceAssetsService,
    ProjectExperienceResourcesService,
  ],
})
export class ProjectExperienceModule {}
